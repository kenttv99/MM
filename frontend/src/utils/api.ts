// frontend/src/utils/api.ts
// Storage for cached responses
import { LoadingStage } from "@/contexts/LoadingContext";

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
  [LoadingStage.COMPLETED]: 0
};

// Constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
 * Set the current loading stage - called by LoadingContext
 */
export function setCurrentLoadingStage(stage: LoadingStage) {
  const prevStage = currentLoadingStage;
  currentLoadingStage = stage;
  console.log(`API: Loading stage updated to ${stage}`, {
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
    console.log(`API: Global lock reset due to empty queue and no active requests`);
  }
}

/**
 * Check if a request should be processed based on the current loading stage
 */
function shouldProcessRequest(endpoint: string): boolean {
  // Authorization/authentication requests are always allowed
  const isAuthRequest = endpoint === '/user_edits/me' || 
                       endpoint === '/admin/me' || 
                       endpoint.includes('/auth/') ||
                       endpoint.includes('/login') ||
                       endpoint.includes('/token');
  
  if (isAuthRequest) {
    return true;
  }
  
  // Public event requests should be allowed in later stages
  const isPublicEventRequest = endpoint.includes('/public/events') || 
                               endpoint.includes('/events/public');
                               
  // Allow requests based on current loading stage
  switch (currentLoadingStage) {
    case LoadingStage.AUTHENTICATION:
      // Only authentication requests in authentication stage
      console.log(`API: Request check for ${endpoint} in AUTHENTICATION stage - ${isAuthRequest ? 'allowed' : 'blocked'}`);
      return isAuthRequest;
      
    case LoadingStage.STATIC_CONTENT:
      // Static content requests are allowed after authentication
      // Allow basic content and public data during static content loading
      const isStaticAllowed = isAuthRequest || 
                            endpoint.includes('/static/') || 
                            endpoint.includes('/content/') ||
                            isPublicEventRequest;
      console.log(`API: Request check for ${endpoint} in STATIC_CONTENT stage - ${isStaticAllowed ? 'allowed' : 'blocked'}`);
      return isStaticAllowed;
      
    case LoadingStage.DYNAMIC_CONTENT:
      // Dynamic content and static content allowed
      // In dynamic content loading, allow most requests except user-specific ones
      const isDynamicAllowed = isAuthRequest || 
                             !endpoint.includes('/user/') || 
                             isPublicEventRequest;
      console.log(`API: Request check for ${endpoint} in DYNAMIC_CONTENT stage - ${isDynamicAllowed ? 'allowed' : 'blocked'}`);
      return isDynamicAllowed;
      
    case LoadingStage.DATA_LOADING:
    case LoadingStage.COMPLETED:
      // All requests allowed in these stages
      return true;
      
    default:
      console.log(`API: Unknown loading stage ${currentLoadingStage} for request ${endpoint} - blocking`);
      return false;
  }
}

/**
 * Execute API requests with caching and error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { cache?: RequestCache; signal?: AbortSignal } = {}
): Promise<ApiResponse<T>> {
  const requestKey = `${endpoint}-${JSON.stringify(options.body || {})}-${options.method || 'GET'}`;
  const now = Date.now();

  // Track request by stage
  stageRequestCounts[currentLoadingStage]++;

  // Check if the request should be processed based on loading stage
  if (!shouldProcessRequest(endpoint)) {
    console.log(`API: Request to ${endpoint} blocked due to current loading stage: ${currentLoadingStage}`);
    return { aborted: true, reason: `loading_stage_${currentLoadingStage}` };
  }

  // Skip check for critical requests
  const isCriticalRequest = endpoint === '/user_edits/me' || endpoint === '/admin/me';

  // Check cache for GET requests with higher priority during earlier loading stages
  if (options.method === 'GET' || !options.method) {
    const cached = responseCache[requestKey];
    // Use cached response with higher priority during auth and static loading stages
    const shouldUseCachedResponse = cached && (
      now - cached.timestamp < CACHE_TTL || 
      currentLoadingStage === LoadingStage.AUTHENTICATION ||
      currentLoadingStage === LoadingStage.STATIC_CONTENT
    );
    
    if (shouldUseCachedResponse) {
      console.log(`API: Serving cached response for ${endpoint} during ${currentLoadingStage} stage`);
      return cached.data as T;
    }
  }

  // Check request deduplication
  const lastRequest = lastRequests[requestKey];
  if (lastRequest && now - lastRequest.timestamp < REQUEST_DEDUP_INTERVAL) {
    console.log(`API: Deduplicating request for ${endpoint}`);
    return lastRequest.promise as Promise<ApiResponse<T>>;
  }

  // Check lock only for non-critical requests
  if (globalRequestLock && !isCriticalRequest) {
    blockedRequestCount++;
    console.log(`API: Request to ${endpoint} blocked (global lock), active requests: ${activeRequestCount}, blocked requests: ${blockedRequestCount}`);
    
    // If request is blocked but we have cached data, use it with extended TTL
    if (options.method === 'GET' || !options.method) {
      const cached = responseCache[requestKey];
      // During earlier stages, we're more lenient with cache TTL
      const extendedTTL = currentLoadingStage === LoadingStage.AUTHENTICATION || 
                        currentLoadingStage === LoadingStage.STATIC_CONTENT ? 
                        CACHE_TTL * 2 : CACHE_TTL;
                        
      if (cached && now - cached.timestamp < extendedTTL) {
        console.log(`API: Using cached response for ${endpoint} after global lock (extended TTL during ${currentLoadingStage})`);
        return cached.data as T;
      }
    }
    
    // If request is blocked, add it to queue
    if (options.signal && !options.signal.aborted) {
      return new Promise<ApiResponse<T>>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // Remove request from queue on timeout
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
        
        // Add request to queue
        requestQueue.push(queueRequest);
        
        // Try to process queue immediately if there's room for new requests
        if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
          // If active requests are less than maximum, reset lock
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
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
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
            console.error(`API: Failed to parse JSON response for ${endpoint}`, error);
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
        if ((options.method === 'GET' || !options.method) && data) {
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
        
        console.error(`API: Error response for ${endpoint}: ${response.status} ${response.statusText}`);
        return errorData;
      }
    } catch (error: any) {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Handle network errors
      console.error(`API: Network error for ${endpoint}:`, error);
      
      // Check for abort errors
      if (error.name === 'AbortError') {
        return { aborted: true, reason: 'timeout' };
      }
      
      return { error: error.message, status: 0 };
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
}