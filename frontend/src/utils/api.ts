export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Accept": "application/json",
    };
  
    const response = await fetch(url, { ...options, headers });
    
    // Проверяем и обновляем токен из заголовка X-Refresh-Token
    const newToken = response.headers.get("X-Refresh-Token");
    if (newToken) {
      if (url.includes("/admin")) {
        localStorage.setItem("admin_token", newToken);
      } else {
        localStorage.setItem("token", newToken);
      }
    }
  
    return response;
  }