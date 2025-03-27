// frontend/src/utils/api.ts - Updated to handle avatar URLs
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
  
  // Create a new Headers object from existing headers (if any)
  const headers = new Headers(options.headers);
  
  // Add authentication header if token exists
  if (token) {
    headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
  }
  
  // Add Accept header
  headers.set("Accept", "application/json");
  
  const response = await fetch(url, { ...options, headers });
  
  // Process response to update token if needed
  const newToken = response.headers.get("X-Refresh-Token");
  if (newToken) {
    if (url.includes("/admin")) {
      localStorage.setItem("admin_token", newToken);
    } else {
      localStorage.setItem("token", newToken);
    }
  }
  
  // For user profile or avatar-related endpoints, normalize avatarUrl in localStorage
  if (response.ok && (url.includes("/user_edits/me") || url.includes("/upload-avatar"))) {
    try {
      const clone = response.clone();
      const userData = await clone.json();
      
      if (userData) {
        // Нормализация avatar_url
        if (userData.avatar_url && !userData.avatar_url.startsWith('/')) {
          userData.avatar_url = `/${userData.avatar_url}`;
        }
        // Полностью обновляем user_data в localStorage
        localStorage.setItem("user_data", JSON.stringify(userData));
      }
    } catch (error) {
      console.error("Error processing user data in API response:", error);
    }
  }
  
  return response;
}