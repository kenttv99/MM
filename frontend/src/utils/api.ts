// frontend/src/utils/api.ts
// Storage for cached responses
import { LoadingStage } from "@/contexts/loading";
import { canChangeStage } from "@/contexts/loading";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApiResponse, FetchOptionsType, CancellablePromise, DEFAULT_RETRIES, DEFAULT_TIMEOUT, DEFAULT_BACKOFF } from "@/types/api";
import { LogLevel, createLogger, configureModuleLogging, LogContext } from "@/utils/logger";
import { API_RATE_LIMITS, RateLimitConfig } from "@/config/rateLimits";

// Интерфейс для окна с состоянием загрузки
interface WindowWithLoadingStage extends Window {
  __loading_stage__?: LoadingStage;
  __activeRequestCount?: number;
  __loadingErrorHandler?: (error: string) => void;
}

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

// Отслеживание использования API для соблюдения лимитов
interface RateLimitTracker {
  count: number;
  resetTime: number;
}

// Хранилище для отслеживания лимитов запросов
const rateLimitTrackers: Record<string, RateLimitTracker> = {};

// Функция для проверки ограничений запросов
function checkRateLimit(endpoint: string): boolean {
  // Определяем категорию и тип запроса
  let limitConfig: RateLimitConfig | null = null;
  
  // Проверяем авторизационные запросы
  if (endpoint.includes('/auth/login')) {
    limitConfig = API_RATE_LIMITS.AUTH.login;
  } else if (endpoint.includes('/auth/register')) {
    limitConfig = API_RATE_LIMITS.AUTH.register;
  } else if (endpoint.includes('/auth/me')) {
    limitConfig = API_RATE_LIMITS.AUTH.accessMe;
  } else if (endpoint.includes('/admin/me')) {
    limitConfig = API_RATE_LIMITS.AUTH.verifyTokenAdmin;
  }
  // Публичные запросы 
  else if (endpoint.includes('/events') && !endpoint.includes('user_edits')) {
    if (endpoint.match(/\/events\/\d+$/)) {
      limitConfig = API_RATE_LIMITS.PUBLIC.getEventById;
    } else {
      limitConfig = API_RATE_LIMITS.PUBLIC.getEvents;
    }
  } 
  // Пользовательские запросы
  else if (endpoint.includes('/profile')) {
    if (endpoint.includes('PUT') || endpoint.includes('POST')) {
      limitConfig = API_RATE_LIMITS.USER.updateProfile;
    } else {
      limitConfig = API_RATE_LIMITS.USER.getProfile;
    }
  } else if (endpoint.includes('/user_edits/my-tickets')) {
    limitConfig = API_RATE_LIMITS.USER.getTickets;
  } else if (endpoint.includes('/registration/')) {
    limitConfig = API_RATE_LIMITS.USER.registerForEvent;
  }
  // Админские запросы
  else if (endpoint.includes('/admin_edits/')) {
    if (endpoint.includes('DELETE')) {
      limitConfig = API_RATE_LIMITS.ADMIN.deleteEvent;
    } else if (endpoint.includes('POST')) {
      limitConfig = API_RATE_LIMITS.ADMIN.addEvent;
    } else {
      limitConfig = API_RATE_LIMITS.ADMIN.updateEvent;
    }
  }
  
  // Если не определены лимиты, пропускаем запрос
  if (!limitConfig) return true;
  
  const now = Date.now();
  const trackerKey = endpoint.split('?')[0]; // Убираем параметры URL
  
  // Если нет записи для этого endpoint или истекло время сброса,
  // создаем новую запись
  if (!rateLimitTrackers[trackerKey] || rateLimitTrackers[trackerKey].resetTime < now) {
    rateLimitTrackers[trackerKey] = {
      count: 1,
      resetTime: now + limitConfig.interval
    };
    return true;
  }
  
  // Увеличиваем счетчик и проверяем лимит
  rateLimitTrackers[trackerKey].count++;
  
  // Если лимит превышен, блокируем запрос
  if (rateLimitTrackers[trackerKey].count > limitConfig.limit) {
    apiLogger.warn('Rate limit exceeded', { 
      endpoint, 
      limit: limitConfig.limit,
      interval: limitConfig.interval,
      count: rateLimitTrackers[trackerKey].count,
      description: limitConfig.description || 'No description'
    });
    return false;
  }
  
  return true;
}

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
  if (typeof window === 'undefined') return;
  
  apiLogger.info('Initializing loading stage listener');
  
  // Обработчик для событий изменения стадии загрузки
  window.addEventListener('loadingStageChange', handleStageChange as EventListener);
  
  // Обработчик для событий ошибок загрузки
  window.addEventListener('loading-error', (event: Event) => {
    const customEvent = event as CustomEvent;
    const error = customEvent.detail?.error || 'Unknown error';
    
    apiLogger.error('Loading error event received', { 
      error, 
      source: customEvent.detail?.source || 'unknown'
    });
    
    // Если окно имеет обработчик ошибок загрузки, вызываем его
    const windowWithLoadingStage = window as WindowWithLoadingStage;
    if (windowWithLoadingStage.__loadingErrorHandler) {
      windowWithLoadingStage.__loadingErrorHandler(error);
    }
    
    // Устанавливаем глобальную стадию загрузки в ERROR
    if (windowWithLoadingStage.__loading_stage__ !== LoadingStage.ERROR) {
      windowWithLoadingStage.__loading_stage__ = LoadingStage.ERROR;
      dispatchStatusChange(LoadingStage.ERROR);
    }
  });
  
  // Обработчик для событий ошибок авторизации
  window.addEventListener('auth-error', (event: Event) => {
    const customEvent = event as CustomEvent;
    const message = customEvent.detail?.message || 'Authentication error';
    
    apiLogger.warn('Auth error event received', { message });
    
    // Сбрасываем стадию загрузки на AUTHENTICATION
    if (window.__loading_stage__ !== LoadingStage.AUTHENTICATION) {
      window.__loading_stage__ = LoadingStage.AUTHENTICATION;
      dispatchStatusChange(LoadingStage.AUTHENTICATION, true);
    }
  });
  
  // Декларируем глобальный обработчик ошибок загрузки - используем undefined вместо null
  (window as WindowWithLoadingStage).__loadingErrorHandler = undefined;
}

// Функция для отправки события изменения стадии загрузки
function dispatchStatusChange(stage: LoadingStage, isUnauthorizedResponse = false) {
  if (typeof window === 'undefined') return;
  
  window.dispatchEvent(new CustomEvent('loadingStageChange', {
    detail: { 
      stage, 
      timestamp: Date.now(), 
      isUnauthorizedResponse 
    }
  }));
}

// Обрабатываем изменение стадии загрузки
function handleStageChange(event: CustomEvent) {
  if (!event.detail || !event.detail.stage) return;
  
  const newStage = event.detail.stage;
  const prevStage = currentLoadingStage;
  
  // Skip if the stage hasn't actually changed
  if (newStage === prevStage) return;
  
  // Добавляем защиту от быстрых циклических изменений между стадиями
  // Проверяем историю и ищем чередования INITIAL <-> AUTHENTICATION
  const now = Date.now();
  const recentChanges = stageChangeHistory
    .filter(entry => now - entry.timestamp < 2000) // Последние 2 секунды
    .map(entry => entry.stage);
  
  // Проверяем на паттерн циклических изменений между INITIAL и AUTHENTICATION
  if (recentChanges.length >= 4) {
    const lastFourChanges = recentChanges.slice(-4);
    const isIACycle = 
      (lastFourChanges[0] === LoadingStage.INITIAL && lastFourChanges[1] === LoadingStage.AUTHENTICATION &&
       lastFourChanges[2] === LoadingStage.INITIAL && lastFourChanges[3] === LoadingStage.AUTHENTICATION) ||
      (lastFourChanges[0] === LoadingStage.AUTHENTICATION && lastFourChanges[1] === LoadingStage.INITIAL &&
       lastFourChanges[2] === LoadingStage.AUTHENTICATION && lastFourChanges[3] === LoadingStage.INITIAL);
    
    if (isIACycle) {
      stageLogger.error('Detected INITIAL <-> AUTHENTICATION cycle, forcing STATIC_CONTENT stage', {
        history: lastFourChanges,
        current: prevStage,
        attempted: newStage
      });
      
      // Принудительно переходим к STATIC_CONTENT, чтобы разорвать цикл
      currentLoadingStage = LoadingStage.STATIC_CONTENT;
      if (typeof window !== 'undefined') {
        window.__loading_stage__ = LoadingStage.STATIC_CONTENT;
        
        // Диспатчим новое событие с принудительной стадией
        window.dispatchEvent(new CustomEvent('loadingStageChange', {
          detail: { stage: LoadingStage.STATIC_CONTENT }
        }));
        
        // Очищаем историю изменений
        stageChangeHistory.length = 0;
      }
      
      // Логируем и выходим
      apiLogger.info('Loading stage changed [module=api version=1.0.0 reason=cycle_break allowRegression=true]', {
        prev: prevStage,
        current: LoadingStage.STATIC_CONTENT
      });
      return;
    }
  }
  
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

// Создаем универсальную трансформацию данных
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultTransform = <T>(data: any): T => data as T;

// Определение интерфейса для ошибок API если его нет
interface ApiErrorData {
  error: string;
  status: number;
}

export interface APIOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  bypassLoadingStageCheck?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (data: any) => any;
}

/**
 * Проверяет, должен ли запрос быть обработан в зависимости от текущей стадии загрузки
 * Упрощенная версия с более четкой логикой допустимых запросов на каждой стадии
 */
export function shouldProcessRequest(endpoint: string, bypassLoadingStageCheck = false, stage?: LoadingStage): boolean {
  // Если установлен флаг обхода проверки, всегда разрешаем запрос
  if (bypassLoadingStageCheck) {
    return true;
  }
  
  // Получаем текущую стадию загрузки
  const currentStage = stage || (typeof window !== 'undefined' ? 
    (window as WindowWithLoadingStage).__loading_stage__ : undefined) || 
    LoadingStage.AUTHENTICATION;
  
  // Список всегда разрешенных запросов на любой стадии (критические эндпоинты)
  const alwaysAllowedPatterns = [
    '/auth/', 
    '/events',
    '/notifications/public',
    '/me'
  ];
  
  // Проверяем, соответствует ли запрос критическим эндпоинтам
  const isAlwaysAllowed = alwaysAllowedPatterns.some(pattern => endpoint.includes(pattern));
  if (isAlwaysAllowed && !endpoint.includes('admin_edits') && !endpoint.includes('user_edits')) {
    return true;
  }
  
  // Разрешения на основе текущей стадии загрузки
  switch (currentStage) {
    case LoadingStage.INITIAL:
    case LoadingStage.AUTHENTICATION:
      // В начальных стадиях разрешаем только авторизационные и базовые запросы
      return endpoint.includes('/auth/') || 
             endpoint.includes('/me') || 
             endpoint.includes('/events') ||
             endpoint.includes('/notifications/public');
    
    case LoadingStage.STATIC_CONTENT:
      // После авторизации добавляем доступ к статическому контенту и профилю
      return !endpoint.includes('/admin_edits/') || 
             endpoint.includes('/static') ||
             endpoint.includes('/config') ||
             endpoint.includes('/i18n') ||
             endpoint.includes('/me') || 
             endpoint.includes('/profile') ||
             endpoint.includes('/events') ||
             endpoint.includes('/notifications/');
    
    case LoadingStage.DYNAMIC_CONTENT:
    case LoadingStage.COMPLETED:
      // В продвинутых стадиях разрешаем все запросы
      return true;
    
    case LoadingStage.ERROR:
      // В состоянии ошибки разрешаем только восстановительные запросы
      return endpoint.includes('/auth/') || 
             endpoint.includes('/me') || 
             endpoint.includes('/events') ||
             endpoint.includes('/notifications/public');
    
    default:
      // По умолчанию блокируем запросы с неизвестной стадией
      return false;
  }
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

// Исправим функцию apiFetch, чтобы она всегда что-то возвращала
export const apiFetch = <T = unknown>(
  endpoint: string,
  options: APIOptions = {}
): CancellablePromise<T> => {
  const {
    method = 'GET',
    headers = {},
    data = undefined,
    params = {},
    signal = undefined,
    bypassLoadingStageCheck = false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform = defaultTransform<T>
  } = options;

  // Create a unique request ID for tracking this request
  const requestId = generateRequestId(endpoint, { ...params, ...data }, method);
  const logContext: ApiLogContext = {
    endpoint,
    method,
    requestId,
    loadingStage: currentLoadingStage
  };
  
  // Create a controller for request cancellation
  const controller = new AbortController();
  const localSignal = controller.signal;
  
  // Prepare the promise
  const promise = new Promise<T>(async (resolve, reject) => {
    try {
      // Start timing this request
      const metricId = apiLogger.startMetric('apiFetch', logContext);
      const startTime = Date.now();
      
      // Pre-request checks
      // Check if we should process this request based on loading stage
      if (!shouldProcessRequest(endpoint, bypassLoadingStageCheck)) {
        apiLogger.warn('Request blocked due to loading stage', {
          ...logContext,
          bypassCheck: bypassLoadingStageCheck,
          blocked: true
        });
        
        const error = new Error(`Request to ${endpoint} blocked due to current loading stage: ${currentLoadingStage}`);
        return reject(error);
      }

      // Проверяем лимиты запросов
      if (!bypassLoadingStageCheck && !checkRateLimit(`${method}:${endpoint}`)) {
        apiLogger.warn('Request blocked due to rate limit', {
          ...logContext,
          endpoint,
          method
        });
        
        const error = new Error(`Request to ${endpoint} blocked due to rate limit`);
        return reject(error);
      }

      // Check for cached response for GET requests
      if (method === 'GET') {
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
          
          return resolve(cachedResponse.data as T);
        }
      }

      // Check for duplicate request for GET requests
      if (method === 'GET') {
        const existingRequest = findActiveRequest<T>(endpoint, { ...params }, method);
        
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
          
          try {
            const result = await existingRequest.promise;
            return resolve(result);
          } catch (error) {
            return reject(error);
          }
        }
      }
      
      // Increment active request counter
      activeRequestCount++;
      if (typeof window !== 'undefined') {
        window.__activeRequestCount = activeRequestCount;
      }
      
      // Prepare request URL with query parameters for GET requests
      let url = endpoint;
      if (method === 'GET' && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
        url = `${endpoint}?${queryParams.toString()}`;
      }
      
      // Prepare headers
      const defaultHeaders: Record<string, string> = {}; // Убрали Content-Type по умолчанию
      if (!(data instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json'; // Добавляем только если не FormData
      }
      const effectiveHeaders = { ...defaultHeaders, ...headers };
      
      // Add Authorization header if token exists
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          effectiveHeaders['Authorization'] = `Bearer ${token}`;
        }
      }
      
      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: effectiveHeaders,
        signal: signal || localSignal
      };
      
      // Add body for non-GET requests
      if (method !== 'GET' && data) {
        if (data instanceof FormData) {
          // Если это FormData, передаем как есть
          requestOptions.body = data;
          // Важно: Удаляем Content-Type, чтобы браузер установил правильный multipart/form-data
          delete effectiveHeaders['Content-Type']; 
        } else {
          // Иначе преобразуем в JSON
          requestOptions.body = JSON.stringify(data);
          // Убедимся, что Content-Type установлен для JSON
          if (!effectiveHeaders['Content-Type']) {
             effectiveHeaders['Content-Type'] = 'application/json';
          }
        }
      }
      
      // Переприсваиваем обновленные заголовки в requestOptions
      requestOptions.headers = effectiveHeaders;
      
      // Log request
      apiLogger.debug(`Sending ${method} request to ${url}`, {
        ...logContext,
        params: method === 'GET' ? params : undefined,
        data: method !== 'GET' ? data : undefined
      });
      
      // Execute the request
      const response = await fetch(url, requestOptions);
      const endTime = Date.now();
      
      // Update log context with status info
      logContext.statusCode = response.status;
      
      // Handle response based on status
      if (!response.ok) {
        // Log error response
        apiLogger.error(`Error response: ${response.status} ${response.statusText}`, {
          ...logContext,
          statusText: response.statusText
        });
        
        // Complete performance metric
        apiLogger.endMetric(metricId, { 
          success: false, 
          statusCode: response.status,
          elapsedTime: endTime - startTime
        });
        
        // Handle 401 Unauthorized error specifically
        if (response.status === 401) {
          apiLogger.warn('Received 401 Unauthorized response, dispatching auth-unauthorized event', {
            endpoint,
            method
          });
          
          if (typeof window !== 'undefined') {
            // Dispatch auth-unauthorized event to trigger authentication reset
            window.dispatchEvent(new CustomEvent('auth-unauthorized', {
              detail: { status: 401, endpoint, method }
            }));
          }
        }
        
        // Create structured error
        let errorData: ApiErrorData;
        try {
          // Try to parse error response
          errorData = await response.json();
        } catch {
          // If parsing fails, create default error
          errorData = {
            error: response.statusText || 'Unknown error',
            status: response.status
          };
        }
        
        // Decrement active request counter
        activeRequestCount--;
        if (typeof window !== 'undefined') {
          window.__activeRequestCount = activeRequestCount;
        }
        
        return reject(errorData);
      }

      try {
        // Process successful response 
        const rawData = await response.json();
        
        // Apply transform if provided
        const data = transform(rawData);
        
        // Cache the response for GET requests
        if (method === 'GET') {
          const cacheKey = generateCacheKey(endpoint, params);
          responseCache[cacheKey] = {
            data,
            timestamp: Date.now()
          };
        }
        
        // Complete performance metric
        apiLogger.endMetric(metricId, { 
          success: true, 
          statusCode: response.status,
          elapsedTime: endTime - startTime,
          dataSize: JSON.stringify(data).length
        });
        
        // Decrement active request counter
        activeRequestCount--;
        if (typeof window !== 'undefined') {
          window.__activeRequestCount = activeRequestCount;
        }
        
        // Process request queue
        processRequestQueue();
        
        return resolve(data);
      } catch (error) {
        // Log JSON parsing errors
        apiLogger.error('Failed to parse response', {
          ...logContext,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Complete performance metric
        apiLogger.endMetric(metricId, { 
          success: false, 
          statusCode: response.status,
          parseError: true,
          elapsedTime: endTime - startTime
        });
        
        // Decrement active request counter
        activeRequestCount--;
        if (typeof window !== 'undefined') {
          window.__activeRequestCount = activeRequestCount;
        }
        
        return reject(error);
      }
    } catch (error) {
      // Handle network errors or other exceptions
      apiLogger.error('Request failed', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Decrement active request counter
      activeRequestCount--;
      if (typeof window !== 'undefined') {
        window.__activeRequestCount = activeRequestCount;
      }
      
      return reject(error);
    }
  });

  // Create cancellable promise
  let isCancelled = false;
  const cancellablePromise = promise as CancellablePromise<T>;
  
  cancellablePromise.cancel = (reason = 'Request cancelled by user') => {
    if (!isCancelled) {
      isCancelled = true;
      controller.abort();
      apiLogger.debug(`Request cancelled: ${reason}`, {
        ...logContext,
        reason
      });
    }
  };
  
  cancellablePromise.isCancelled = () => isCancelled;
  
  return cancellablePromise;
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