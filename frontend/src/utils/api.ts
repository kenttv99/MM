// frontend/src/utils/api.ts
export interface CustomError extends Error {
  code?: string;
  isServerError?: boolean;
  isNetworkError?: boolean;
  status?: number;
  isAuthError?: boolean;
}

const pendingRequests: Record<string, Promise<unknown>> = {};
const FETCH_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<T> {
  const requestKey = `${endpoint}-${JSON.stringify(options)}`;
  
  if (requestKey in pendingRequests) {
    return pendingRequests[requestKey] as Promise<T>;
  }
  
  const requestPromise: Promise<T> = (async () => {
    const url = endpoint.startsWith('http') ? endpoint : endpoint;
    const headers = new Headers(options.headers);
    const token = endpoint.includes("/admin")
  ? localStorage.getItem("admin_token")
  : localStorage.getItem("token");
if (token) {
  headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
}
    
    headers.set("Accept", "application/json");
    
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  
    let response: Response;
    try {
      response = await fetchWithTimeout(url, { ...options, headers }, FETCH_TIMEOUT);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError: CustomError = new Error("Превышено время ожидания ответа от сервера.");
        timeoutError.code = "TIMEOUT";
        timeoutError.isNetworkError = true;
        throw timeoutError;
      }
      
      const networkError: CustomError = new Error("Не удалось подключиться к серверу. Проверьте соединение.");
      networkError.code = error instanceof Error && error.message.includes('ECONNREFUSED') ? "ECONNREFUSED" : "ECONNRESET";
      networkError.isNetworkError = true;

      if (retries > 0) {
        console.warn(`Network error (${networkError.code}), retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return apiFetch<T>(endpoint, options, retries - 1);
      }

      throw networkError;
    }
  
    if (!response.ok) {
      let errorMessage = "Произошла ошибка";
      let errorText = "";

      try {
        errorText = await response.text();
        const errorData = errorText ? JSON.parse(errorText) : null;
        errorMessage = errorData?.detail || errorText || `HTTP Error: ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP Error: ${response.status}`;
      }

      if (response.status === 401 || response.status === 403) {
        if (endpoint.includes('/login')) {
          const clientError: CustomError = new Error("Неверный логин или пароль");
          clientError.status = response.status;
          clientError.isAuthError = true;
          throw clientError;
        }
        if (endpoint.includes('/me') || endpoint.includes('/profile') || endpoint.includes('/notifications')) {
          const authError: CustomError = new Error("Не авторизован");
          authError.status = response.status;
          authError.isAuthError = true;
          throw authError; // Mark as auth error, not critical
        }
      }
      
      if (response.status >= 500) {
        const serverError: CustomError = new Error(errorMessage);
        serverError.isServerError = true;
        serverError.status = response.status;
        throw serverError;
      }
      
      if (response.status === 404) {
        const notFoundError: CustomError = new Error(errorMessage || "Ресурс не найден");
        notFoundError.status = response.status;
        throw notFoundError;
      }

      const clientError: CustomError = new Error(errorMessage);
      clientError.status = response.status;
      throw clientError;
    }
  
    const newToken = response.headers.get("X-Refresh-Token");
    if (newToken) {
      if (url.includes("/admin")) {
        localStorage.setItem("admin_token", newToken);
      } else {
        localStorage.setItem("token", newToken);
      }
    }
  
    if (response.ok && (url.includes("/user_edits/me") || url.includes("/upload-avatar"))) {
      try {
        const clone = response.clone();
        const userData = await clone.json();
        
        if (userData) {
          if (userData.avatar_url && !userData.avatar_url.startsWith('/')) {
            userData.avatar_url = `/${userData.avatar_url}`;
          }
          localStorage.setItem("user_data", JSON.stringify(userData));
        }
      } catch (error) {
        console.warn("Error processing user data in API response", error);
      }
    }
  
    if (response.status === 204) return null as unknown as T;
    
    try {
      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error("Error parsing JSON response", error);
      throw new Error("Ошибка обработки ответа сервера");
    }
  })();
  
  pendingRequests[requestKey] = requestPromise;
  
  requestPromise
    .then((result) => {
      delete pendingRequests[requestKey];
      return result;
    })
    .catch((err) => {
      delete pendingRequests[requestKey];
      throw err;
    });
  
  return requestPromise;
}