// frontend/src/utils/api.ts
// Storage for cached responses
import { LoadingStage } from "@/contexts/LoadingContext";
import { ApiResponse } from "@/types/api";

// Объявляем глобальный тип для счетчика активных запросов
declare global {
  interface Window {
    __activeRequestCount?: number;
  }
}

const responseCache: { [key: string]: { data: unknown; timestamp: number } } = {};

// Constants
const FETCH_TIMEOUT = 15000; // 15 seconds request timeout
const CACHE_TTL = 60000; // 60 seconds cache lifetime
const GLOBAL_LOCK_RESET_DELAY = 50; // 50ms until global lock reset (reduced from 100ms)
const MAX_CONCURRENT_REQUESTS = 15; // Maximum number of concurrent requests (increased from 12)
const REQUEST_QUEUE_TIMEOUT = 10000; // 10 seconds wait time in queue
const REQUEST_DEDUP_INTERVAL = 50; // 50ms for request deduplication (reduced from 100ms)

// Global flag to prevent simultaneous requests
let globalRequestLock = false;
// Active requests counter
let activeRequestCount = 0;
// Timer for resetting global lock
let globalLockTimer: NodeJS.Timeout | null = null;
// Counter for blocked requests
let blockedRequestCount = 0;
// Queue for blocked requests
const requestQueue: Array<() => void> = [];
// Storage for tracking last requests (for deduplication)
const lastRequests: Record<string, { timestamp: number; promise: Promise<unknown> }> = {};
// Current loading stage
let currentLoadingStage: LoadingStage = LoadingStage.AUTHENTICATION;
// Request tracking for debugging
const stageRequestCounts: Record<LoadingStage, number> = {
  [LoadingStage.AUTHENTICATION]: 0,
  [LoadingStage.STATIC_CONTENT]: 0,
  [LoadingStage.DYNAMIC_CONTENT]: 0,
  [LoadingStage.DATA_LOADING]: 0,
  [LoadingStage.COMPLETED]: 0,
  [LoadingStage.INITIAL]: 0,
  [LoadingStage.AUTH_CHECK]: 0,
  [LoadingStage.COMPLETE]: 0,
  [LoadingStage.ERROR]: 0
};

// Constants
// API_BASE_URL is not needed as we use Next.js rewrites for all API calls

// Добавим базовые настройки для логов
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

// Устанавливаем уровень логирования (можно менять при разработке/продакшене)
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.WARN 
  : LOG_LEVEL.INFO;

// Вспомогательные функции для логирования с разными уровнями
const logDebug = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
    console.log(`API: ${message}`, data);
  }
};

const logInfo = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
    console.log(`API: ${message}`, data);
  }
};

const logWarn = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
    console.log(`API: ⚠️ ${message}`, data);
  }
};

const logError = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
    console.error(`API: ⛔ ${message}`, data);
  }
};

// Инициализируем слушатель изменений стадий загрузки
export function initializeLoadingStageListener() {
  if (typeof window !== 'undefined') {
    // Добавляем обработчик события изменения стадии загрузки
    window.addEventListener('loadingStageChange', ((event: CustomEvent) => {
      if (event.detail && event.detail.stage) {
        handleStageChange(event);
      }
    }) as EventListener);
    
    logInfo('Initialized loading stage listener');
  }
}

// Обработчик изменения стадии загрузки
function handleStageChange(event: CustomEvent) {
  if (!event.detail || !event.detail.stage) return;
  
  const stage = event.detail.stage;
  const prevStage = currentLoadingStage;
  
  // Предотвращаем возврат к стадии AUTHENTICATION после перехода к другой стадии
  // Используем строковое сравнение для надежности
  if (prevStage !== 'authentication' && stage === 'authentication') {
    logWarn('Preventing regression to AUTHENTICATION stage', { prevStage, newStage: stage });
    return;
  }
  
  currentLoadingStage = stage;
  
  // Логируем только значимые изменения стадий
  logDebug(`Loading stage updated to ${stage}`, {
    prevStage,
    requestStats: getRequestStats(),
    activeRequests: requestQueue.length
  });
  
  // Если мы перешли от AUTHENTICATION к другой стадии,
  // пробуем обработать запросы в очереди, которые могли быть заблокированы
  if (prevStage === 'authentication' && stage !== 'authentication') {
    logInfo('Authentication completed, checking request queue');
    processRequestQueue();
  }
}

// Функция для получения статистики запросов
function getRequestStats() {
  return { ...stageRequestCounts };
}

// Автоматически инициализируем слушатель событий
if (typeof window !== 'undefined') {
  // Экспортируем счетчик активных запросов в глобальную область видимости для отладки
  window.__activeRequestCount = 0;
  
  initializeLoadingStageListener();
}

// Function to clean up stale cache entries
const cleanupCache = () => {
  const now = Date.now();
  Object.keys(responseCache).forEach(key => {
    if (now - responseCache[key].timestamp > CACHE_TTL) {
      delete responseCache[key];
    }
  });
};

// Periodic cache cleanup
setInterval(cleanupCache, CACHE_TTL);

interface IApiError {
  error: string;
  status: number;
}

interface ApiAborted {
  aborted: boolean;
  reason?: string;
}

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
 * Set the current loading stage - called by LoadingContext
 */
export function setCurrentLoadingStage(stage: LoadingStage) {
  const prevStage = currentLoadingStage;
  
  // Предотвращаем возврат к стадии AUTHENTICATION после перехода к другой стадии
  // Используем строковое сравнение для надежности
  if (prevStage !== 'authentication' && stage === 'authentication') {
    logWarn('Preventing regression to AUTHENTICATION stage', { prevStage, newStage: stage });
    return;
  }
  
  currentLoadingStage = stage;
  logDebug(`Loading stage updated to ${stage}`, {
    prevStage,
    requestStats: { ...stageRequestCounts },
    activeRequests: activeRequestCount
  });
}

/**
 * Clear cache by URL pattern
 */
export function clearCache(urlPattern?: string | RegExp) {
  if (!urlPattern) {
    // Clear entire cache
    Object.keys(responseCache).forEach(key => {
      delete responseCache[key];
    });
    return;
  }
  
  // Clear cache by pattern
  Object.keys(responseCache).forEach(key => {
    if (typeof urlPattern === 'string' && key.includes(urlPattern)) {
      delete responseCache[key];
    } else if (urlPattern instanceof RegExp && urlPattern.test(key)) {
      delete responseCache[key];
    }
  });
}

/**
 * Process request queue
 */
function processRequestQueue() {
  if (requestQueue.length === 0 || activeRequestCount >= MAX_CONCURRENT_REQUESTS) {
    return;
  }

  // Process as many requests as possible
  while (requestQueue.length > 0 && activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      nextRequest();
    }
  }
  
  // If queue is empty and no active requests, reset global lock
  if (requestQueue.length === 0 && activeRequestCount === 0) {
    globalRequestLock = false;
    logDebug('Global lock reset due to empty queue and no active requests');
  }
  
  // Обновляем глобальный счетчик для отладки
  if (typeof window !== 'undefined') {
    window.__activeRequestCount = activeRequestCount;
  }
}

/**
 * Check if a request should be processed based on the current loading stage
 */
function shouldProcessRequest(endpoint: string): boolean {
  // Текущие статистические данные для логирования
  stageRequestCounts[currentLoadingStage]++;
  
  // Authorization/authentication requests are always allowed
  const isAuthRequest = endpoint === '/auth/me' || 
                       endpoint === '/admin/me' || 
                       endpoint.includes('/auth/') ||
                       endpoint.includes('/login') ||
                       endpoint.includes('/token') ||
                       endpoint.includes('/register') ||
                       endpoint.includes('/password') ||
                       endpoint.includes('/user_edits/login') ||
                       endpoint.includes('/user_edits/register');
  
  if (isAuthRequest) {
    return true;
  }
  
  // Public event requests should be allowed in all stages
  const isPublicEventRequest = endpoint.includes('/public/events') || 
                               endpoint.includes('/events/public') ||
                               endpoint.includes('/v1/public/events');
                               
  if (isPublicEventRequest) {
    // Разрешаем публичные запросы к мероприятиям на любой стадии
    return true;
  }
  
  // Allow requests based on current loading stage
  switch (currentLoadingStage) {
    case LoadingStage.AUTHENTICATION:
      // Only authentication requests in authentication stage
      // Логируем только для отладки, не для каждого запроса
      if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
        logDebug(`Request check for ${endpoint} in AUTHENTICATION stage - ${isAuthRequest ? 'allowed' : 'blocked'}`);
      }
      return isAuthRequest;
      
    case LoadingStage.STATIC_CONTENT:
      // Static content requests are allowed after authentication
      // Allow basic content and public data during static content loading
      const isStaticAllowed = isAuthRequest || 
                            endpoint.includes('/static/') || 
                            endpoint.includes('/content/');
      // Логируем только для отладки, не для каждого запроса
      if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
        logDebug(`Request check for ${endpoint} in STATIC_CONTENT stage - ${isStaticAllowed ? 'allowed' : 'blocked'}`);
      }
      return isStaticAllowed;
      
    case LoadingStage.DYNAMIC_CONTENT:
    case LoadingStage.DATA_LOADING:
      // Разрешаем все запросы на динамический контент и загрузку данных
      return true;
      
    case LoadingStage.COMPLETED:
      // All requests allowed in these stages
      return true;
      
    default:
      logWarn(`Unknown loading stage ${currentLoadingStage} for request ${endpoint} - blocking`);
      return false;
  }
}

export interface APIOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  bypassLoadingStageCheck?: boolean;
}

export async function apiFetch<T>(
  endpoint: string,
  options: APIOptions = {}
): Promise<ApiResponse<T>> {
  const { bypassLoadingStageCheck, ...fetchOptions } = options;
  
  try {
    // Check if we're in the authentication stage
    if (currentLoadingStage === 'authentication' && !bypassLoadingStageCheck) {
      // Проверяем, является ли запрос публичным запросом к мероприятиям
      const isPublicEventRequest = endpoint.includes('/public/events') || 
                                  endpoint.includes('/events/public') ||
                                  endpoint.includes('/v1/public/events');
      
      // Если это публичный запрос к мероприятиям, разрешаем его
      if (isPublicEventRequest) {
        logInfo(`Allowing public event request ${endpoint} during authentication stage`);
      } else {
        logWarn(`Request blocked due to loading stage (${currentLoadingStage})`);
        
        return {
          aborted: true,
          reason: `Request blocked due to loading_stage (${currentLoadingStage})`
        };
      }
    }
    
    const requestKey = `${endpoint}-${JSON.stringify(options.data || {})}-${options.method || 'GET'}`;
    const now = Date.now();

    // Track request by stage
    stageRequestCounts[currentLoadingStage]++;

    // Check if the request should be processed based on loading stage
    if (!bypassLoadingStageCheck && !shouldProcessRequest(endpoint)) {
      logWarn(`Request to ${endpoint} blocked due to current loading stage: ${currentLoadingStage}`);
      
      return {
        aborted: true,
        reason: `Request blocked due to loading_stage_${currentLoadingStage}`
      };
    }

    // Skip check for critical requests
    const isCriticalRequest = endpoint === '/user_edits/me' || endpoint === '/admin/me';

    // Check cache for GET requests with higher priority during earlier loading stages
    if (fetchOptions.method === 'GET' || !fetchOptions.method) {
      const cached = responseCache[requestKey];
      const shouldUseCachedResponse = cached && (
        now - cached.timestamp < CACHE_TTL || 
        currentLoadingStage === LoadingStage.AUTHENTICATION ||
        currentLoadingStage === LoadingStage.STATIC_CONTENT
      );
      
      if (shouldUseCachedResponse) {
        logDebug(`Serving cached response for ${endpoint} during ${currentLoadingStage} stage`);
        return cached.data as ApiResponse<T>;
      }
    }

    // Check request deduplication
    const lastRequest = lastRequests[requestKey];
    if (lastRequest && now - lastRequest.timestamp < REQUEST_DEDUP_INTERVAL) {
      logDebug(`Deduplicating request for ${endpoint}`);
      return lastRequest.promise as Promise<ApiResponse<T>>;
    }

    // Check lock only for non-critical requests
    if (globalRequestLock && !isCriticalRequest) {
      blockedRequestCount++;
      logWarn(`Request to ${endpoint} blocked (global lock), active requests: ${activeRequestCount}, blocked requests: ${blockedRequestCount}`);
      
      // If request is blocked but we have cached data, use it with extended TTL
      if (fetchOptions.method === 'GET' || !fetchOptions.method) {
        const cached = responseCache[requestKey];
        const extendedTTL = currentLoadingStage === LoadingStage.AUTHENTICATION || 
                          currentLoadingStage === LoadingStage.STATIC_CONTENT ? 
                          CACHE_TTL * 2 : CACHE_TTL;
                          
        if (cached && now - cached.timestamp < extendedTTL) {
          logDebug(`Using cached response for ${endpoint} after global lock (extended TTL during ${currentLoadingStage})`);
          return cached.data as ApiResponse<T>;
        }
      }
      
      // If request is blocked, add it to queue
      if (fetchOptions.signal && !fetchOptions.signal.aborted) {
        return new Promise<ApiResponse<T>>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
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
          
          requestQueue.push(queueRequest);
          
          if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
            if (activeRequestCount === 0) {
              globalRequestLock = false;
              logDebug('Global lock reset due to no active requests');
            }
            processRequestQueue();
          }
        });
      }
      
      return { aborted: true, reason: 'global_lock' };
    }

    // Increase active requests counter
    activeRequestCount++;
    
    // Create controller for request abortion
    const controller = new AbortController();
    
    // Set timeout for request
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT);
    
    // Create promise for request execution
    const requestPromise = (async () => {
      try {
        // Create promise for request execution
        const response = await fetch(`${endpoint}`, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
          // Add body for POST, PUT, PATCH requests
          ...(fetchOptions.method && ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method) && fetchOptions.data
            ? { body: JSON.stringify(fetchOptions.data) }
            : {}),
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Process response
        if (response.ok) {
          // Only try to parse JSON if content-type is json
          const contentType = response.headers.get('content-type');
          let data: any;
          
          if (contentType && contentType.includes('application/json')) {
            try {
              data = await response.json();
            } catch (error) {
              logError(`Failed to parse JSON response for ${endpoint}`, error);
              data = { error: 'JSON parse error', status: response.status };
            }
          } else {
            // Handle non-JSON responses
            try {
              data = await response.text();
              // If looks like JSON, try to parse it anyway
              if (data.startsWith('{') || data.startsWith('[')) {
                try {
                  data = JSON.parse(data);
                } catch {
                  // Keep as text if JSON parsing fails
                }
              }
            } catch {
              data = { error: 'Failed to read response', status: response.status };
            }
          }
          
          // Cache successful GET responses
          if ((fetchOptions.method === 'GET' || !fetchOptions.method) && data) {
            responseCache[requestKey] = {
              data,
              timestamp: Date.now(),
            };
          }
          
          return data;
        } else {
          // Handle errors
          let errorData: any = { error: response.statusText, status: response.status };
          try {
            // Try to parse error response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const jsonError = await response.json();
              errorData = { ...errorData, ...jsonError };
            }
          } catch {
            // Ignore parse errors for error responses
          }
          
          logError(`Error response for ${endpoint}: ${response.status} ${response.statusText}`);
          return errorData;
        }
      } catch (error: unknown) {
        // Handle network errors
        logError(`Network error for ${endpoint}:`, error);
        
        // Check for abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return { aborted: true, reason: error.message };
        }
        
        // Return generic error
        return { 
          error: error instanceof Error ? error.message : 'Unknown error', 
          status: 0 
        };
      } finally {
        // Decrease active requests counter
        activeRequestCount = Math.max(0, activeRequestCount - 1);
        
        // Process request queue
        processRequestQueue();
      }
    })();
    
    // Store request promise for deduplication
    lastRequests[requestKey] = {
      timestamp: now,
      promise: requestPromise,
    };
    
    return requestPromise;
  } catch (error: unknown) {
    // Handle any errors in the outer try-catch
    logError(`Unexpected error in apiFetch for ${endpoint}:`, error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 0 
    };
  }
}