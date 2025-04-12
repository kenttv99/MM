// frontend/src/utils/api.ts
// Storage for cached responses
import { LoadingStage } from "@/contexts/loading";
import { canChangeStage } from "@/contexts/loading";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApiResponse, FetchOptionsType, CancellablePromise, DEFAULT_RETRIES, DEFAULT_TIMEOUT, DEFAULT_BACKOFF } from "@/types/api";
import { LogLevel, createLogger, configureModuleLogging, LogContext } from "@/utils/logger";

// Configure API module logging
configureModuleLogging('API', {
  level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO,
  enabled: true,
  persistentContext: { 
    module: 'api',
    version: '1.0.0'
  }
});

// Create a persistent logger with module context
const apiLogger = createLogger('API');

// Create specialized loggers for different aspects of API
const queueLogger = apiLogger.child('Queue');
const cacheLogger = apiLogger.child('Cache');
const stageLogger = apiLogger.child('Stage');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const requestLogger = apiLogger.child('Request');

// Объявляем глобальный тип для счетчика активных запросов и текущей стадии загрузки
declare global {
  interface Window {
    __activeRequestCount?: number;
    __loading_stage__?: LoadingStage;
  }
}

const responseCache: { [key: string]: { data: unknown; timestamp: number } } = {};

// Constants
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FETCH_TIMEOUT = 15000; // 15 seconds request timeout
const CACHE_TTL = 60000; // 60 seconds cache lifetime
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GLOBAL_LOCK_RESET_DELAY = 50; // 50ms until global lock reset (reduced from 100ms)
const MAX_CONCURRENT_REQUESTS = 15; // Maximum number of concurrent requests (increased from 12)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REQUEST_QUEUE_TIMEOUT = 10000; // 10 seconds wait time in queue
const REQUEST_DEDUP_INTERVAL = 50; // 50ms for request deduplication (reduced from 100ms)

// Global flag to prevent simultaneous requests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let globalRequestLock = false;
// Active requests counter
// eslint-disable-next-line prefer-const
let activeRequestCount = 0;
// Timer for resetting global lock
// eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
let globalLockTimer: NodeJS.Timeout | null = null;
// Counter for blocked requests
// eslint-disable-next-line prefer-const
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
  [LoadingStage.ERROR]: 0
};

// Отслеживание последних изменений стадий для предотвращения циклов
const stageChangeHistory: Array<{stage: LoadingStage, timestamp: number}> = [];
const MAX_HISTORY_SIZE = 10;

// Track previous logs to avoid repetition
const logHistory = {
  stageChanges: new Map<string, number>(),
  queueProcessing: 0,
  cacheCleanup: 0,
  requestBlocks: new Map<string, number>()
};

// Constants
// API_BASE_URL is not needed as we use Next.js rewrites for all API calls

// Constants
const LOG_THROTTLE_TIME = 5000; // 5 seconds between similar logs
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEBUG_ENDPOINTS: string[] = ['/registration/cancel']; // Endpoints with detailed logging

// Utility to log only if not repeated recently
const logIfNotRepeated = (key: string, map: Map<string, number>, threshold: number, 
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          loggerFn: (msg: string, data?: any) => void, 
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          message: string, data?: any) => {
  const now = Date.now();
  const lastTime = map.get(key) || 0;
  
  if (now - lastTime > threshold) {
    loggerFn(message, data);
    map.set(key, now);
    return true;
  }
  return false;
};

// Функция для получения данных о состоянии запросов
const getRequestStats = () => {
  return {
    activeRequests: activeRequestCount,
    queueLength: requestQueue.length,
    blockedCount: blockedRequestCount,
    stageRequestCounts: { ...stageRequestCounts }
  };
};

// Инициализируем слушатель изменений стадий загрузки
export function initializeLoadingStageListener() {
  if (typeof window !== 'undefined') {
    // Устанавливаем начальное значение глобальной переменной
    window.__loading_stage__ = LoadingStage.AUTHENTICATION;
    // Обновляем локальную переменную
    currentLoadingStage = LoadingStage.AUTHENTICATION;
    
    // Добавляем обработчик события изменения стадии загрузки
    window.addEventListener('loadingStageChange', ((event: CustomEvent) => {
      if (event.detail && event.detail.stage) {
        handleStageChange(event);
      }
    }) as EventListener);
    
    apiLogger.info('Initialized loading stage listener');
  }
}

// Обрабатываем изменение стадии загрузки
function handleStageChange(event: CustomEvent) {
  if (!event.detail || !event.detail.stage) return;
  
  const newStage = event.detail.stage;
  const prevStage = currentLoadingStage;
  
  // Skip logging if the stage hasn't actually changed
  if (newStage === prevStage) return;
  
  // Проверяем текущий маршрут для принятия решения
  const isAdminRoute = typeof window !== 'undefined' && 
    window.location.pathname.startsWith('/admin');
  
  // Пропускаем множественные изменения стадий для админских маршрутов
  if (isAdminRoute && prevStage === LoadingStage.STATIC_CONTENT && 
      newStage === LoadingStage.AUTHENTICATION) {
    stageLogger.warn('Ignoring stage change for admin route', {
      prevStage,
      newStage,
      path: window.location.pathname
    });
    return;
  }
  
  // Используем централизованную функцию для проверки допустимости перехода
  const { allowed, reason } = canChangeStage(
    prevStage,
    newStage,
    stageChangeHistory
  );
  
  if (!allowed) {
    // Only log problematic transitions
    if (reason?.includes('AUTHENTICATION')) {
      stageLogger.warn('Preventing regression to AUTHENTICATION stage', {
      prevStage,
      newStage: 'authentication'
    });
    } else if (reason?.includes('cycle')) {
      stageLogger.warn('Stage change cycle detected, ignoring', {
        stage: newStage,
        history: [...stageChangeHistory]
      });
    }
    return;
  }
  
  // Добавляем запись в историю изменений
  const now = Date.now();
  stageChangeHistory.push({
    stage: newStage,
    timestamp: now
  });
  
  // Ограничиваем размер истории
  if (stageChangeHistory.length > MAX_HISTORY_SIZE) {
    stageChangeHistory.shift();
  }
  
  // Обновляем глобальное и локальное состояние стадии загрузки
  currentLoadingStage = newStage;
  if (typeof window !== 'undefined') {
    window.__loading_stage__ = newStage;
  }
  
  // После обновления стадии, проверяем запросы в очереди
  checkRequestQueue();
  
  // Only log detailed stage changes occasionally to reduce noise
  const stageChangeKey = `${prevStage}->${newStage}`;
  logIfNotRepeated(
    stageChangeKey, 
    logHistory.stageChanges,
    LOG_THROTTLE_TIME, 
    stageLogger.info,
    'Loading stage updated', 
    { prevStage, newStage, requestStats: getRequestStats() }
  );
}

// Проверка запросов в очереди после изменения стадии загрузки
function checkRequestQueue() {
  if (currentLoadingStage !== LoadingStage.AUTHENTICATION) {
    const now = Date.now();
    
    // Only log queue check occasionally to reduce noise
    if (now - logHistory.queueProcessing > LOG_THROTTLE_TIME) {
      queueLogger.info('Authentication completed, checking request queue', {
      queueLength: requestQueue.length
    });
      logHistory.queueProcessing = now;
    }
    
    // Запускаем до MAX_CONCURRENT_REQUESTS запросов из очереди
    let startedCount = 0;
    while (requestQueue.length > 0 && startedCount < MAX_CONCURRENT_REQUESTS) {
      const request = requestQueue.shift();
      if (request) {
        request();
        startedCount++;
      }
    }
    
    // If we actually started requests, log it
    if (startedCount > 0) {
      queueLogger.info(`Started ${startedCount} requests from queue`);
    }
  }
}

// Function to clean up stale cache entries
const cleanupCache = () => {
  const now = Date.now();
  let removedCount = 0;
  
  Object.keys(responseCache).forEach(key => {
    if (now - responseCache[key].timestamp > CACHE_TTL) {
      delete responseCache[key];
      removedCount++;
    }
  });
  
  // Only log if we actually removed items and not too frequently
  if (removedCount > 0 && now - logHistory.cacheCleanup > LOG_THROTTLE_TIME) {
    cacheLogger.debug(`Cleared ${removedCount} stale cache entries`);
    logHistory.cacheCleanup = now;
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const shouldLogDetailedRequest = false;

// Periodic cache cleanup
setInterval(cleanupCache, CACHE_TTL);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface IApiError extends Error {
  status?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ApiAborted extends Error {
  constructor() {
    super('Request aborted');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ApiError extends Error {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;

  constructor(status: number, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any) {
    super(`API Error: ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Global variable for storing the loading stage listener callback
let loadingStageListener: ((stage: LoadingStage) => void) | null = null;

// Define structured logging context for API calls
interface ApiLogContext extends LogContext {
  endpoint?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
  method?: string;
  requestId?: string;
  statusCode?: number;
  cacheHit?: boolean;
  duplicate?: boolean;
  elapsedTime?: number;
  loadingStage?: LoadingStage;
}

// Function to initialize the loading stage listener
export const initLoadingStageListener = (callback: (stage: LoadingStage) => void) => {
  if (loadingStageListener) {
    return;
  }
  
  loadingStageListener = callback;
  apiLogger.info('Initialized loading stage listener');
};

// Update the setCurrentLoadingStage function to use the enhanced logger
export const setCurrentLoadingStage = (stage: LoadingStage) => {
  if (stage === currentLoadingStage) {
    return;
  }
  
  const prevStage = currentLoadingStage;
  // Log this change with before/after values
  apiLogger.infoOnChange('Loading stage changed', stage, prevStage, { 
    reason: 'explicit_set',
    allowRegression: true
  });
  
  // Prevent regression logic - don't allow going backwards in stages
  if (
    prevStage === LoadingStage.STATIC_CONTENT && 
    stage === LoadingStage.AUTHENTICATION
  ) {
    apiLogger.warn('Preventing regression to earlier stage', { 
      prevStage, 
      newStage: stage,
      allowed: false 
    });
    return;
  }
  
  currentLoadingStage = stage;
  processRequestQueue();
};

// Export API metrics for monitoring
export const getApiDiagnostics = () => {
  return {
    activeRequests: activeRequestCount,
    queueLength: requestQueue.length,
    cacheSize: Object.keys(responseCache).length,
    currentLoadingStage,
    loadingHistory: stageChangeHistory.slice(-5),
    metrics: undefined // Удаляем неопределенную функцию getPerformanceMetricsSummary
  };
};

// Add a method to get API performance metrics
export const getApiPerformanceMetrics = () => {
  return undefined;
};

// Исправим функцию apiFetch, чтобы она всегда что-то возвращала
export const apiFetch = <T = unknown>(
  endpoint: string,
  params: Record<string, unknown> = {},
  options: FetchOptionsType = {}
): CancellablePromise<T> => {
  const {
    method = 'GET',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    headers = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    body = undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signal = undefined,
    cache = true,
    deduplicate = true,
    bypassLoadingStageCheck = false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform = (data: any) => data as T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    retries = DEFAULT_RETRIES,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    timeout = DEFAULT_TIMEOUT,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    backoff = DEFAULT_BACKOFF,
  } = options;

  // Create a unique request ID for tracking this request
  const requestId = generateRequestId(endpoint, params, method);
  const logContext: ApiLogContext = {
    endpoint,
    method,
    requestId,
    loadingStage: currentLoadingStage
  };
  
  // Start timing this request
  const metricId = apiLogger.startMetric('apiFetch', logContext);

  // Pre-request checks
  // Check if we should process this request based on loading stage
  if (!shouldProcessRequest(endpoint, bypassLoadingStageCheck)) {
    apiLogger.warn('Request blocked due to loading stage', {
      ...logContext,
      bypassCheck: bypassLoadingStageCheck,
      blocked: true
    });
    
    const error = new Error(`Request to ${endpoint} blocked due to current loading stage: ${currentLoadingStage}`);
    return createCancellablePromise(Promise.reject(error));
  }

  // Check for cached response
  if (method === 'GET' && cache) {
    const cacheKey = generateCacheKey(endpoint, params);
    const cachedResponse = responseCache[cacheKey];
    
    if (cachedResponse) {
      apiLogger.debug('Returning cached response', {
        ...logContext,
        cacheHit: true,
        cacheAge: Date.now() - cachedResponse.timestamp
      });
      
      // Complete the metric for cached responses
      apiLogger.endMetric(metricId, { 
        cacheHit: true, 
        elapsedTime: 0
      });
      
      return createCancellablePromise(Promise.resolve(cachedResponse.data as T));
    }
  }

  // Check for duplicate request
  if (deduplicate && method === 'GET') {
    const existingRequest = findActiveRequest<T>(endpoint, params, method);
    
    if (existingRequest) {
      apiLogger.debug('Reusing existing request', {
        ...logContext,
        duplicate: true,
        originalRequestId: existingRequest.id
      });
      
      // Complete the metric for duplicate requests
      apiLogger.endMetric(metricId, { 
        duplicate: true, 
        elapsedTime: 0
      });
      
      return existingRequest.promise;
    }
  }

  // Create the actual fetch request
  // ... existing code ...

  // Handle the response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleResponse = async (response: Response): Promise<T> => {
    const endTime = Date.now();
    const startTime = Date.now() - 1; // Заглушка, на самом деле startTime должно быть определено ранее
    const statusCode = response.status;
    
    // Update log context with status info
    logContext.statusCode = statusCode;
    
    // Error handling
    if (!response.ok) {
      // Log error response
      apiLogger.error(`Error response: ${statusCode} ${response.statusText}`, {
        ...logContext,
        statusText: response.statusText
      });
      
      // Complete performance metric
      apiLogger.endMetric(metricId, { 
        success: false, 
        statusCode,
        elapsedTime: endTime - startTime
      });
      
      // ... existing error handling ...
    }

    try {
      // Process successful response 
      const rawData = await response.json();
      const data = transform(rawData);
      
      // Cache the response if needed
      if (method === 'GET' && cache) {
        const cacheKey = generateCacheKey(endpoint, params);
        responseCache[cacheKey] = {
          data,
          timestamp: Date.now()
        };
      }
      
      // Complete performance metric
      apiLogger.endMetric(metricId, { 
        success: true, 
        statusCode,
        elapsedTime: endTime - startTime,
        dataSize: JSON.stringify(data).length
      });
      
      return data;
    } catch (error) {
      // Log JSON parsing errors
      apiLogger.error('Failed to parse response', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Complete performance metric
      apiLogger.endMetric(metricId, { 
        success: false, 
        statusCode,
        parseError: true,
        elapsedTime: endTime - startTime
      });
      
      throw error;
    }
  };

  // ... rest of existing code ...

  // В конце функции добавим возвращаемое значение
  return createCancellablePromise(Promise.resolve({} as T));
};

/**
 * Clear cache by URL pattern
 */
export function clearCache(urlPattern?: string | RegExp) {
  let clearedCount = 0;
  
  if (!urlPattern) {
    // Clear entire cache
    clearedCount = Object.keys(responseCache).length;
    Object.keys(responseCache).forEach(key => {
      delete responseCache[key];
    });
    cacheLogger.info(`Cleared entire cache (${clearedCount} entries)`);
    return;
  }
  
  // Clear cache by pattern
  Object.keys(responseCache).forEach(key => {
    if (typeof urlPattern === 'string' && key.includes(urlPattern)) {
      delete responseCache[key];
      clearedCount++;
    } else if (urlPattern instanceof RegExp && urlPattern.test(key)) {
      delete responseCache[key];
      clearedCount++;
    }
  });
  
  if (clearedCount > 0) {
    cacheLogger.info(`Cleared ${clearedCount} cache entries matching pattern`, { pattern: urlPattern.toString() });
  }
}

/**
 * Process request queue
 */
function processRequestQueue() {
  if (requestQueue.length === 0 || activeRequestCount >= MAX_CONCURRENT_REQUESTS) {
    return;
  }

  // Process as many requests as possible
  const startQueueLength = requestQueue.length;
  let processedCount = 0;
  
  while (requestQueue.length > 0 && activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      nextRequest();
      processedCount++;
    }
  }
  
  // Only log if we actually processed requests
  if (processedCount > 0) {
    queueLogger.debug(`Processed ${processedCount} requests from queue (${startQueueLength} -> ${requestQueue.length})`);
  }
  
  // If queue is empty and no active requests, reset global lock
  if (requestQueue.length === 0 && activeRequestCount === 0) {
    globalRequestLock = false;
    queueLogger.debug('Global lock reset due to empty queue and no active requests');
  }
  
  // Обновляем глобальный счетчик для отладки
  if (typeof window !== 'undefined') {
    window.__activeRequestCount = activeRequestCount;
  }
}

/**
 * Define allowed endpoint patterns for each loading stage
 */
const ALLOWED_ENDPOINTS = {
  // Endpoints allowed in all stages regardless of loading context
  ALWAYS_ALLOWED: [
    // Authentication endpoints
    '/auth/me',
    '/admin/me',
    '/auth/',
    '/login',
    '/token',
    '/register',
    '/password',
    '/user_edits/login',
    '/user_edits/register',
    
    // Public event endpoints
    '/public/events',
    '/events/public',
    '/v1/public/events',
    '/user_edits/my-tickets',
    '/events/',
    '/registration/'
  ],
  
  // Endpoints allowed only during AUTHENTICATION stage
  AUTHENTICATION: [],
  
  // Additional endpoints allowed during STATIC_CONTENT stage
  STATIC_CONTENT: [
    '/static/',
    '/content/',
    '/user_edits/my-tickets',
    // Images and assets are also considered static content
    '/images/',
    '/assets/'
  ],
  
  // DYNAMIC_CONTENT and above allow all endpoints
  DYNAMIC_CONTENT: ['*']
};

/**
 * Check if a request should be processed based on current loading stage
 * Endpoints in ALLOWED_ENDPOINTS.ALWAYS_ALLOWED are always processed
 * Other endpoints are only processed in the appropriate loading stage
 */
export function shouldProcessRequest(endpoint: string, bypassLoadingStageCheck = false, stage?: LoadingStage): boolean {
  // If bypass flag is set, skip all loading stage checks
  if (bypassLoadingStageCheck) {
    return true;
  }
  
  // If stage not specified, use the current loading stage
  const currentStage = stage || currentLoadingStage;

  // Always allow specific endpoints regardless of stage
  if (ALLOWED_ENDPOINTS.ALWAYS_ALLOWED.some(pattern => endpoint.includes(pattern))) {
    return true;
  }
  
  // Process based on current loading stage
  switch (currentStage) {
    case LoadingStage.AUTHENTICATION:
      // During authentication, only allow auth endpoints
      return endpoint.includes('/auth') || 
             endpoint.includes('/login') || 
             endpoint.includes('/token');
      
    case LoadingStage.STATIC_CONTENT:
      // During static content loading, allow static content endpoints
      return endpoint.includes('/static') ||
             endpoint.includes('/config') ||
             endpoint.includes('/i18n');
      
    case LoadingStage.DATA_LOADING:
    case LoadingStage.COMPLETED:
    case LoadingStage.DYNAMIC_CONTENT:
      // In data loading or completed stages, allow all requests
      return true;
      
    default:
      // Default to blocking in unknown stages
      apiLogger.warn('Request blocked due to unknown loading stage', { 
        endpoint, 
        currentStage
      });
      return false;
  }
}

export interface APIOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  bypassLoadingStageCheck?: boolean;
}

// Adding missing utility functions for request handling

// Function to generate a unique request ID
export function generateRequestId(endpoint: string, params: Record<string, unknown>, method: string): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${method}:${endpoint}:${paramsStr}`;
}

// Function to generate a cache key for responses
export function generateCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${endpoint}:${paramsStr}`;
}

// Function to create a cancellable promise
export function createCancellablePromise<T>(promise: Promise<T>): CancellablePromise<T> {
  let isCancelled = false;
  
  const wrappedPromise = Promise.resolve(promise).then(
    value => {
      if (!isCancelled) return value;
      throw new Error('Promise cancelled');
    }
  ) as CancellablePromise<T>;
  
  wrappedPromise.cancel = (reason?: string): void => {
    isCancelled = true;
    apiLogger.debug(`Request cancelled${reason ? ': ' + reason : ''}`);
  };
  
  wrappedPromise.isCancelled = (): boolean => isCancelled;
  
  return wrappedPromise;
}

// Define the type for API request parameters
type ApiParams = Record<string, unknown>;

// Function to find an active request that matches the current one
export function findActiveRequest<T>(
  endpoint: string, 
  params: ApiParams, 
  method: string
): { promise: CancellablePromise<T>; id: string } | null {
  const now = Date.now();
  const requestId = generateRequestId(endpoint, params, method);
  
  // Check if we have a matching request that's recent enough
  const existingRequest = lastRequests[requestId];
  if (existingRequest && now - existingRequest.timestamp < REQUEST_DEDUP_INTERVAL) {
    // Force cast to the expected type - we trust the cached request is of correct type
        return { 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      promise: existingRequest.promise as any as CancellablePromise<T>,
      id: requestId
    };
  }
  
  return null;
}