// frontend/src/utils/api.ts
// Хранилище для активных запросов
const activeRequests: { [key: string]: { controller: AbortController | { abort: (reason?: string) => void }; promise: Promise<unknown>; timestamp: number } } = {};
// Хранилище для временных меток последних запросов
const lastRequestTimes: { [key: string]: number } = {};
// Хранилище для кэшированных ответов
const responseCache: { [key: string]: { data: unknown; timestamp: number } } = {};

// Константы
const FETCH_TIMEOUT = 15000; // 15 секунд на выполнение запроса
const CACHE_TTL = 60000; // 60 секунд жизни кэша (увеличено)
const MIN_REQUEST_INTERVAL = 100; // Уменьшаем минимальный интервал между запросами до 100 мс
const MAX_RETRIES = 2; // Максимальное количество попыток повторного запроса

// Флаг для отслеживания повторных запросов
const isRetrying: { [key: string]: boolean } = {};
// Счетчик активных запросов для каждого endpoint
const activeRequestsCount: { [key: string]: number } = {};
// Счетчик отмененных запросов для предотвращения циклических запросов
const abortedRequestsCount: { [key: string]: number } = {};
// Флаг для отслеживания отмененных запросов
const abortedRequests: { [key: string]: boolean } = {};
// Время последнего сброса флагов для каждого endpoint
const lastResetTime: { [key: string]: number } = {};
// Глобальный флаг для предотвращения одновременных запросов
let globalRequestLock = false;
// Время последнего сброса глобального блокировщика
let lastGlobalLockReset = 0;
// Таймер для сброса глобального блокировщика
let globalLockTimer: NodeJS.Timeout | null = null;
// Таймер для автоматического сброса глобального блокировщика
let autoResetTimer: NodeJS.Timeout | null = null;
// Флаг для отслеживания, был ли сброшен глобальный блокировщик
let globalLockReset = false;
// Счетчик активных запросов
let activeRequestCount = 0;
// Таймер для автоматического сброса глобального блокировщика по таймауту
let globalLockTimeoutTimer: NodeJS.Timeout | null = null;

export type ApiResponse<T> = T | { aborted: boolean; reason?: string };

/**
 * Очистка кэша по шаблону URL
 */
export function clearCache(urlPattern?: string | RegExp) {
  if (!urlPattern) {
    // Очищаем весь кэш
    Object.keys(responseCache).forEach(key => {
      delete responseCache[key];
    });
    return;
  }
  
  // Очищаем кэш по шаблону
  Object.keys(responseCache).forEach(key => {
    if (typeof urlPattern === 'string' && key.includes(urlPattern)) {
      delete responseCache[key];
    } else if (urlPattern instanceof RegExp && urlPattern.test(key)) {
      delete responseCache[key];
    }
  });
}

/**
 * Функция для выполнения API запросов с кэшированием и обработкой ошибок
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { cache?: RequestCache; signal?: AbortSignal } = {}
): Promise<ApiResponse<T>> {
  const requestKey = `${endpoint}-${JSON.stringify(options.body || {})}-${options.method || 'GET'}`;
  const now = Date.now();

  // Проверка глобального блокировщика запросов
  if (globalRequestLock) {
    console.log(`API: Request to ${endpoint} rejected (global lock), active requests: ${activeRequestCount}`);
    
    // Сбрасываем глобальный блокировщик через 1 секунду, если он не был сброшен
    if (now - lastGlobalLockReset > 1000) {
      if (globalLockTimer) {
        clearTimeout(globalLockTimer);
      }
      
      globalLockTimer = setTimeout(() => {
        globalRequestLock = false;
        lastGlobalLockReset = Date.now();
        globalLockReset = true;
        console.log("API: Global lock reset");
      }, 1000);
      
      lastGlobalLockReset = now;
    }
    
    // Устанавливаем автоматический сброс глобального блокировщика через 5 секунд
    if (autoResetTimer) {
      clearTimeout(autoResetTimer);
    }
    
    autoResetTimer = setTimeout(() => {
      if (globalRequestLock) {
        console.log("API: Auto-resetting global lock");
        globalRequestLock = false;
        lastGlobalLockReset = Date.now();
        globalLockReset = true;
      }
    }, 5000);
    
    return { aborted: true, reason: 'global_lock' };
  }

  // Счетчик активных запросов для отладки
  activeRequestsCount[requestKey] = (activeRequestsCount[requestKey] || 0) + 1;
  const requestNumber = activeRequestsCount[requestKey];
  
  // Сброс флагов, если прошло достаточно времени (30 секунд)
  if (!lastResetTime[requestKey] || now - lastResetTime[requestKey] > 30000) {
    abortedRequestsCount[requestKey] = 0;
    abortedRequests[requestKey] = false;
    lastResetTime[requestKey] = now;
  }
  
  // Проверка минимального интервала между запросами
  const lastRequestTime = lastRequestTimes[requestKey];
  if (MIN_REQUEST_INTERVAL > 0 && lastRequestTime && now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    console.log(`API: Request to ${endpoint} rejected (too frequent)`);
    
    // Увеличиваем счетчик отмененных запросов
    abortedRequestsCount[requestKey] = (abortedRequestsCount[requestKey] || 0) + 1;
    
    // Если запрос был отменен слишком много раз подряд, возвращаем пустой результат
    if (abortedRequestsCount[requestKey] > MAX_RETRIES) {
      console.log(`API: Request to ${endpoint} aborted too many times, returning empty result`);
      activeRequestsCount[requestKey]--;
      abortedRequests[requestKey] = true;
      return { aborted: true, reason: 'too_many_retries' };
    }
    
    return { aborted: true, reason: 'too_frequent' };
  }
  
  // Если запрос был ранее отменен из-за слишком частых запросов, не выполняем его снова
  if (abortedRequests[requestKey]) {
    console.log(`API: Request to ${endpoint} skipped (previously aborted)`);
    return { aborted: true, reason: 'previously_aborted' };
  }
  
  // Сбрасываем счетчик отмененных запросов, если запрос не был отменен
  abortedRequestsCount[requestKey] = 0;
  
  // Сбрасываем флаг retry
  isRetrying[requestKey] = false;
  
  // Проверяем кэш для GET запросов
  if (options.method === 'GET' || !options.method) {
    const cachedResponse = responseCache[requestKey];
    if (cachedResponse && now - cachedResponse.timestamp < CACHE_TTL) {
      console.log(`API: Serving cached response for ${endpoint}`);
      activeRequestsCount[requestKey]--;
      return cachedResponse.data as T;
    }
  }
  
  // Обновляем время последнего запроса
  lastRequestTimes[requestKey] = now;
  
  // Если есть активный запрос с тем же ключом, отменяем его
  if (activeRequests[requestKey]) {
    console.log(`API: Aborting previous request to ${endpoint}`);
    activeRequests[requestKey].controller.abort();
  }
  
  // Устанавливаем глобальный блокировщик запросов
  globalRequestLock = true;
  lastGlobalLockReset = now;
  globalLockReset = false;
  activeRequestCount++;
  console.log(`API: Global lock set, active requests: ${activeRequestCount}`);
  
  // Сбрасываем глобальный блокировщик через 1 секунду
  if (globalLockTimer) {
    clearTimeout(globalLockTimer);
  }
  
  globalLockTimer = setTimeout(() => {
    globalRequestLock = false;
    globalLockReset = true;
    console.log("API: Global lock reset");
  }, 500); // Уменьшаем с 1000 до 500 мс
  
  // Устанавливаем автоматический сброс глобального блокировщика через 5 секунд
  if (autoResetTimer) {
    clearTimeout(autoResetTimer);
  }
  
  autoResetTimer = setTimeout(() => {
    if (globalRequestLock) {
      console.log("API: Auto-resetting global lock");
      globalRequestLock = false;
      lastGlobalLockReset = Date.now();
      globalLockReset = true;
    }
  }, 5000);
  
  // Устанавливаем таймер для автоматического сброса глобального блокировщика по таймауту
  if (globalLockTimeoutTimer) {
    clearTimeout(globalLockTimeoutTimer);
  }
  
  globalLockTimeoutTimer = setTimeout(() => {
    if (globalRequestLock) {
      console.log("API: Global lock timeout - forcing reset");
      globalRequestLock = false;
      lastGlobalLockReset = Date.now();
      globalLockReset = true;
      activeRequestCount = 0;
    }
  }, 10000); // Уменьшаем с 15000 до 10000 мс
  
  // Создаем контроллер для отмены запроса
  const controller = new AbortController();
  
  // Объединяем сигналы, если они есть
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  
  // Устанавливаем заголовки
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Добавляем токен авторизации, если он есть
  const token = localStorage.getItem('token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Создаем таймер для отмены запроса по таймауту
  const timeoutId = setTimeout(() => {
    controller.abort('timeout');
  }, FETCH_TIMEOUT);
  
  // Создаем промис для запроса
  const fetchPromise = fetch(`${endpoint}`, {
    ...options,
    headers,
    signal
  }).then(async (response) => {
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  });
  
  // Сохраняем активный запрос
  activeRequests[requestKey] = {
    controller,
    promise: fetchPromise,
    timestamp: now
  };
  
  try {
    // Выполняем запрос
    const data = await fetchPromise;
    
    // Кэшируем ответ для GET запросов
    if (options.method === 'GET' || !options.method) {
      responseCache[requestKey] = {
        data,
        timestamp: now
      };
    }
    
    // Очищаем активный запрос
    delete activeRequests[requestKey];
    activeRequestsCount[requestKey]--;
    activeRequestCount--;
    
    return data as T;
  } catch (error) {
    // Очищаем активный запрос
    delete activeRequests[requestKey];
    activeRequestsCount[requestKey]--;
    activeRequestCount--;
    
    // Обрабатываем ошибку отмены запроса
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`API: Request #${requestNumber} to ${endpoint} was aborted`);
      throw error;
    }
    
    // Обрабатываем другие ошибки
    console.error(`API: Error fetching ${endpoint}:`, error);
    throw error;
  } finally {
    // Очищаем таймер
    clearTimeout(timeoutId);
    
    // Если глобальный блокировщик не был сброшен, сбрасываем его
    if (!globalLockReset) {
      globalRequestLock = false;
      console.log(`API: Global lock reset in finally block, active requests: ${activeRequestCount}`);
    }
    
    // Очищаем таймер таймаута
    if (globalLockTimeoutTimer) {
      clearTimeout(globalLockTimeoutTimer);
      globalLockTimeoutTimer = null;
    }
  }
}