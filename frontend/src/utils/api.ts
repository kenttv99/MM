// frontend/src/utils/api.ts
// Хранилище для активных запросов
const activeRequests: { [key: string]: { controller: AbortController; promise: Promise<unknown> } } = {};
// Хранилище для временных меток последних запросов
const lastRequestTimes: { [key: string]: number } = {};
// Хранилище для кэшированных ответов
const responseCache: { [key: string]: { data: unknown; timestamp: number } } = {};

// Константы
const DEBOUNCE_DELAY = 300; // Увеличено для уменьшения количества запросов
const FETCH_TIMEOUT = 15000; // 15 секунд на выполнение запроса
const CACHE_TTL = 10000; // 10 секунд жизни кэша для обеспечения свежести данных
const MIN_REQUEST_INTERVAL = 500; // Минимальный интервал между запросами

/**
 * Очистка кэша по шаблону URL
 */
export function clearCache(urlPattern?: string | RegExp) {
  if (!urlPattern) {
    Object.keys(responseCache).forEach(key => delete responseCache[key]);
    return;
  }
  
  Object.keys(responseCache).forEach(key => {
    if (typeof urlPattern === 'string' && key.includes(urlPattern)) {
      delete responseCache[key];
    } else if (urlPattern instanceof RegExp && urlPattern.test(key)) {
      delete responseCache[key];
    }
  });
}

/**
 * Интерфейс для ошибок API
 */
interface FetchError extends Error {
  status?: number;
  isNetworkError?: boolean;
  isServerError?: boolean;
}

/**
 * Основная функция для API-запросов
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  setLoading?: (loading: boolean) => void
): Promise<T> {
  const requestKey = `${endpoint}-${JSON.stringify(options.body || {})}-${options.method || 'GET'}`;
  const now = Date.now();

  // Проверка минимального интервала между запросами
  const lastRequestTime = lastRequestTimes[requestKey];
  if (lastRequestTime && now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    throw new Error(`Request too frequent`);
  }

  // Проверка дебаунса
  if (lastRequestTime && now - lastRequestTime < DEBOUNCE_DELAY) {
    throw new Error(`Request debounced`);
  }
  lastRequestTimes[requestKey] = now;

  // Проверка кэша для GET-запросов
  const isGetRequest = !options.method || options.method === 'GET';
  if (isGetRequest && responseCache[requestKey] && now - responseCache[requestKey].timestamp < CACHE_TTL) {
    if (setLoading) setLoading(false);
    return responseCache[requestKey].data as T;
  }

  // Отмена предыдущего запроса с тем же ключом
  if (activeRequests[requestKey]) {
    activeRequests[requestKey].controller.abort();
    delete activeRequests[requestKey];
  }

  // Создаем AbortController для нового запроса
  const controller = new AbortController();
  const signal = options.signal ? options.signal : controller.signal;

  // Параметры запроса
  const url = endpoint;
  const headers = new Headers(options.headers);
  const token = endpoint.includes("/admin") ? localStorage.getItem("admin_token") : localStorage.getItem("token");
  if (token) headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Устанавливаем таймер для запроса
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error(`Request to ${endpoint} timed out after ${FETCH_TIMEOUT}ms`));
    }, FETCH_TIMEOUT);
  });

  // Создаем промис с запросом
  const fetchPromise = fetch(url, { ...options, headers, signal }).then(async (response) => {
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `HTTP error! Status: ${response.status}`;
      let errorData: Record<string, unknown> = {};
      
      if (contentType && contentType.includes("application/json")) {
        try {
          errorData = await response.json();
          if (errorData.message || errorData.detail) {
            errorMessage += `, Message: ${errorData.message || errorData.detail || JSON.stringify(errorData)}`;
          }
        } catch {
          errorMessage += ", Message: Server returned an unexpected response";
        }
      } else {
        errorMessage += ", Message: Server returned a non-JSON error response";
      }
      
      const error: FetchError = new Error(errorMessage);
      error.status = response.status;
      if (response.status >= 500) error.isServerError = true;
      throw error;
    }

    const newToken = response.headers.get("X-Refresh-Token");
    if (newToken) {
      const storageKey = endpoint.includes("/admin") ? "admin_token" : "token";
      localStorage.setItem(storageKey, newToken);
    }

    if (response.status === 204) return null;
    return response.json();
  }).then((data) => {
    if (isGetRequest) {
      responseCache[requestKey] = { data, timestamp: Date.now() };
    }
    return data as T;
  });

  // Функция для очистки активного запроса
  const cleanupRequest = () => {
    if (activeRequests[requestKey] && activeRequests[requestKey].controller === controller) {
      delete activeRequests[requestKey];
    }
  };

  // Создаем основной промис
  const combinedPromise = Promise.race([fetchPromise, timeoutPromise])
    .then((result) => {
      cleanupRequest();
      if (setLoading) {
        // Используем setTimeout для предотвращения мерцания состояния загрузки
        setTimeout(() => setLoading(false), 100);
      }
      return result;
    })
    .catch((error) => {
      cleanupRequest();
      if (setLoading) {
        // Используем setTimeout для предотвращения мерцания состояния загрузки
        setTimeout(() => setLoading(false), 100);
      }
      if (error.name === 'AbortError') {
        throw new Error('Request aborted');
      }
      if (navigator.onLine === false) {
        const networkError: FetchError = new Error('Network error: No internet connection');
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    });

  // Сохраняем запрос в активные
  activeRequests[requestKey] = { controller, promise: combinedPromise };
  if (setLoading) setLoading(true);

  return combinedPromise;
}