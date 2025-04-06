// frontend/src/utils/api.ts
// Хранилище для кэшированных ответов
const responseCache: { [key: string]: { data: unknown; timestamp: number } } = {};

// Константы
const FETCH_TIMEOUT = 15000; // 15 секунд на выполнение запроса
const CACHE_TTL = 60000; // 60 секунд жизни кэша
const GLOBAL_LOCK_RESET_DELAY = 50; // 50мс до сброса глобального блокировщика (уменьшено с 100мс)
const MAX_CONCURRENT_REQUESTS = 15; // Максимальное количество одновременных запросов (увеличено с 12)
const REQUEST_QUEUE_TIMEOUT = 10000; // 10 секунд на ожидание в очереди
const REQUEST_DEDUP_INTERVAL = 50; // 50мс для дедупликации запросов (уменьшено с 100мс)

// Глобальный флаг для предотвращения одновременных запросов
let globalRequestLock = false;
// Счетчик активных запросов
let activeRequestCount = 0;
// Таймер для сброса глобального блокировщика
let globalLockTimer: NodeJS.Timeout | null = null;
// Счетчик запросов, которые были заблокированы
let blockedRequestCount = 0;
// Очередь запросов, которые были заблокированы
const requestQueue: Array<() => void> = [];
// Хранилище для отслеживания последних запросов (для дедупликации)
const lastRequests: Record<string, { timestamp: number; promise: Promise<unknown> }> = {};

// Constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Функция для очистки устаревших записей в кэше
const cleanupCache = () => {
  const now = Date.now();
  Object.keys(responseCache).forEach(key => {
    if (now - responseCache[key].timestamp > CACHE_TTL) {
      delete responseCache[key];
    }
  });
};

// Периодическая очистка кэша
setInterval(cleanupCache, CACHE_TTL);

export type ApiResponse<T> = T | { aborted: boolean; reason?: string } | { error: string; status: number };

class ApiError extends Error {
  status: number;
  isClientError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isClientError = status >= 400 && status < 500;
  }
}

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
 * Обработка очереди запросов
 */
function processRequestQueue() {
  if (requestQueue.length === 0 || activeRequestCount >= MAX_CONCURRENT_REQUESTS) {
    return;
  }

  // Обрабатываем столько запросов, сколько возможно
  while (requestQueue.length > 0 && activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      nextRequest();
    }
  }
  
  // Если очередь пуста и нет активных запросов, сбрасываем глобальный блокировщик
  if (requestQueue.length === 0 && activeRequestCount === 0) {
    globalRequestLock = false;
    console.log(`API: Global lock reset due to empty queue and no active requests`);
  }
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
  // Пропускаем проверку для критических запросов
  const isCriticalRequest = endpoint === '/user_edits/me' || endpoint === '/admin/me';

  // Проверяем кэш для GET запросов
  if (options.method === 'GET' || !options.method) {
    const cached = responseCache[requestKey];
    if (cached && now - cached.timestamp < CACHE_TTL) {
      console.log(`API: Serving cached response for ${endpoint}`);
      return cached.data as T;
    }
  }

  // Проверяем дедупликацию запросов
  const lastRequest = lastRequests[requestKey];
  if (lastRequest && now - lastRequest.timestamp < REQUEST_DEDUP_INTERVAL) {
    console.log(`API: Deduplicating request for ${endpoint}`);
    return lastRequest.promise as Promise<ApiResponse<T>>;
  }

  // Проверяем блокировку только для некритических запросов
  if (globalRequestLock && !isCriticalRequest) {
    blockedRequestCount++;
    console.log(`API: Request to ${endpoint} blocked (global lock), active requests: ${activeRequestCount}, blocked requests: ${blockedRequestCount}`);
    
    // Если запрос заблокирован, но у нас есть кэшированные данные, используем их
    if (options.method === 'GET' || !options.method) {
      const cached = responseCache[requestKey];
      if (cached && now - cached.timestamp < CACHE_TTL) {
        console.log(`API: Using cached response for ${endpoint} after global lock`);
        return cached.data as T;
      }
    }
    
    // Если запрос заблокирован, добавляем его в очередь
    if (options.signal && !options.signal.aborted) {
      return new Promise<ApiResponse<T>>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // Удаляем запрос из очереди по таймауту
          const index = requestQueue.findIndex(req => req === queueRequest);
          if (index !== -1) {
            requestQueue.splice(index, 1);
          }
          reject(new Error('Request timed out while waiting in queue'));
        }, REQUEST_QUEUE_TIMEOUT);
        
        const queueRequest = () => {
          clearTimeout(timeoutId);
          apiFetch<T>(endpoint, options)
            .then(resolve)
            .catch(reject);
        };
        
        // Добавляем запрос в очередь
        requestQueue.push(queueRequest);
        
        // Пытаемся обработать очередь сразу, если есть место для новых запросов
        if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
          // Если активных запросов меньше максимального, сбрасываем блокировку
          if (activeRequestCount === 0) {
            globalRequestLock = false;
            console.log(`API: Global lock reset due to no active requests`);
          }
          processRequestQueue();
        }
      });
    }
    
    return { aborted: true, reason: 'global_lock' };
  }

  // Увеличиваем счетчик активных запросов
  activeRequestCount++;
  
  // Создаем контроллер для отмены запроса
  const controller = new AbortController();
  
  // Устанавливаем таймаут для запроса
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT);
  
  // Создаем промис для выполнения запроса
  const requestPromise = (async () => {
    try {
      // Создаем промис для выполнения запроса
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
        },
      });

      // Очищаем таймер таймаута
      clearTimeout(timeoutId);
      
      // Проверяем статус ответа
      if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(errorText || `HTTP error! status: ${response.status}`, response.status);
      }
      
      // Парсим JSON
      const data = await response.json();
      
      // Кэшируем ответ для GET запросов
      if (options.method === 'GET' || !options.method) {
        responseCache[requestKey] = {
          data,
          timestamp: now
        };
      }
      
      // Устанавливаем глобальный блокировщик запросов только для некритических запросов
      // после успешного выполнения запроса
      if (!isCriticalRequest) {
        // Проверяем, не идет ли статическая загрузка
        const isStaticLoading = document.querySelector('.global-spinner') !== null;
        if (!isStaticLoading) {
          globalRequestLock = true;
          console.log(`API: Global lock set, active requests: ${activeRequestCount}`);
          
          // Сбрасываем глобальный блокировщик через 50мс после завершения всех запросов
          if (globalLockTimer) {
            clearTimeout(globalLockTimer);
          }
        }
      }
      
      return data as T;
    } catch (error) {
      // Обрабатываем ошибку отмены запроса
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`API: Request to ${endpoint} was aborted`);
        throw error;
      }
      
      // Обрабатываем другие ошибки
      console.error(`API: Error fetching ${endpoint}:`, error);
      throw error;
    } finally {
      // Очищаем таймер
      clearTimeout(timeoutId);
      
      // Уменьшаем счетчик активных запросов
      activeRequestCount--;
      
      // Если это был последний запрос, устанавливаем таймер для сброса блокировки
      if (activeRequestCount === 0 && !isCriticalRequest) {
        if (globalLockTimer) {
          clearTimeout(globalLockTimer);
        }
        
        globalLockTimer = setTimeout(() => {
          globalRequestLock = false;
          console.log(`API: Global lock reset after request completion, blocked requests: ${blockedRequestCount}`);
          blockedRequestCount = 0; // Сбрасываем счетчик заблокированных запросов
          
          // Обрабатываем очередь запросов
          processRequestQueue();
        }, GLOBAL_LOCK_RESET_DELAY);
      } else {
        // Обрабатываем очередь запросов, если есть место для новых запросов
        processRequestQueue();
      }
    }
  })();

  // Сохраняем запрос для дедупликации
  lastRequests[requestKey] = {
    timestamp: now,
    promise: requestPromise
  };

  // Очищаем запись о последнем запросе через некоторое время
  setTimeout(() => {
    delete lastRequests[requestKey];
  }, REQUEST_DEDUP_INTERVAL);

  return requestPromise;
}