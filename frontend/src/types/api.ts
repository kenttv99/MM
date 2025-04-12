// Common API response type
export interface ApiResponse<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T = any
> {
  data: T;
  success: boolean;
  error?: string;
  status?: number;
}

// API error response
export interface ApiErrorResponse {
  error: string;
  status: number;
}

// API aborted response
export interface ApiAbortedResponse {
  aborted: boolean;
  reason?: string;
}

// Type for fetch options
export interface FetchOptionsType {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null | undefined;
  signal?: AbortSignal;
  cache?: boolean;
  deduplicate?: boolean;
  bypassLoadingStageCheck?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (data: any) => any;
  retries?: number;
  timeout?: number;
  backoff?: number;
}

// Type for cancellable promise
export interface CancellablePromise<T> extends Promise<T> {
  cancel: (reason?: string) => void;
  isCancelled: () => boolean;
}

// Default values
export const DEFAULT_RETRIES = 3;
export const DEFAULT_TIMEOUT = 15000; // 15 seconds
export const DEFAULT_BACKOFF = 300; // 300ms 