// frontend/src/utils/api.ts

export interface CustomError extends Error {
  code?: string;
  isServerError?: boolean;
  isNetworkError?: boolean;
  status?: number;
}

const pendingRequests: Record<string, Promise<unknown>> = {};
const FETCH_TIMEOUT = 15000;
const MAX_RETRIES = 3; // Максимальное количество попыток
const RETRY_DELAY = 1000; // Задержка между попытками (1 секунда)

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
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
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    const headers = new Headers(options.headers);
    
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

      // Проверяем количество оставшихся попыток
      if (retries > 0) {
        console.warn(`Network error (${networkError.code}), retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // Задержка перед повторной попыткой
        return apiFetch<T>(endpoint, options, retries - 1); // Рекурсивно вызываем с уменьшением попыток
      }

      throw networkError;
    }
  
    if (!response.ok) {
      if (response.status >= 500) {
        const errorText = await response.text();
        let errorMessage = "Произошла ошибка на сервере";
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        
        const serverError: CustomError = new Error(errorMessage);
        serverError.isServerError = true;
        serverError.status = response.status;
        throw serverError;
      }
      
      const errorText = await response.text();
      let errorMessage = "Произошла ошибка";
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
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
        console.error("Error processing user data in API response", error);
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