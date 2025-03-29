// frontend/src/utils/api.ts

export interface CustomError extends Error {
  code?: string;
  isServerError?: boolean;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
  }
  headers.set("Accept", "application/json");
  
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    const networkError = new Error("Не удалось подключиться к серверу. Проверьте соединение.") as CustomError;
    networkError.code = "ECONNREFUSED";
    throw networkError;
  }

  if (!response.ok && response.status >= 500) {
    const errorText = await response.text();
    let errorMessage = "Произошла ошибка на сервере";
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // Оставляем общее сообщение
    }
    const serverError = new Error(errorMessage) as CustomError;
    serverError.isServerError = true;
    throw serverError;
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
      console.error("Error processing user data in API response:", error);
      throw new Error("Ошибка обработки данных пользователя");
    }
  }
  
  return response;
}