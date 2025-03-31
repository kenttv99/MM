// src/utils/api.ts
export interface CustomError extends Error {
  code?: string;
  isServerError?: boolean;
  status?: number;
}

// Cache for pending API requests
const pendingRequests: Record<string, Promise<unknown>> = {};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Create a unique key for this request to enable deduplication
  const requestKey = `${endpoint}-${JSON.stringify(options)}`;
  
  // If there's already a pending request with the same parameters, return that promise
  if (requestKey in pendingRequests) {
    return pendingRequests[requestKey] as Promise<T>;
  }
  
  // Create a new request promise
  const requestPromise: Promise<T> = (async () => {
    // Use relative path, relying on next.config.ts
    const url = endpoint;
  
    // Set up authentication headers
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
      response = await fetch(url, { ...options, headers });
    } catch {
      const networkError: CustomError = new Error("Не удалось подключиться к серверу. Проверьте соединение.");
      networkError.code = "ECONNREFUSED";
      throw networkError;
    }
  
    // Handle server errors
    if (!response.ok && response.status >= 500) {
      const errorText = await response.text();
      let errorMessage = "Произошла ошибка на сервере";
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // Keep default message if parsing fails
      }
      
      const serverError: CustomError = new Error(errorMessage);
      serverError.isServerError = true;
      serverError.status = response.status;
      throw serverError;
    }
  
    // Handle token refresh if provided
    const newToken = response.headers.get("X-Refresh-Token");
    if (newToken) {
      if (url.includes("/admin")) {
        localStorage.setItem("admin_token", newToken);
      } else {
        localStorage.setItem("token", newToken);
      }
    }
  
    // Update user data in local storage if applicable
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
      } catch {
        console.error("Error processing user data in API response");
        // Continue with the request - don't throw here as the original request might be successful
      }
    }
  
    // Handle client-side errors
    if (!response.ok) {
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
  
    // Handle successful responses
    if (response.status === 204) return null as unknown as T;
    
    const data = await response.json();
    return data as T;
  })();
  
  // Store the promise in our cache
  pendingRequests[requestKey] = requestPromise;
  
  // Remove from cache when complete (whether success or failure)
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