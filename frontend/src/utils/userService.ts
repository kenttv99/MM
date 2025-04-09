// frontend/src/services/userService.ts

export interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  avatar_url?: string;
  is_blocked?: boolean;
  is_partner?: boolean;
  created_at?: string;
  updated_at?: string;
  last_active?: string;
}

// Класс ошибки с информацией о статусе HTTP
export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Преобразование данных пользователя для отправки на сервер
export const prepareUserFormData = (userData: UserData): FormData => {
  const formData = new FormData();
  
  formData.append("fio", userData.fio);
  formData.append("email", userData.email);
  formData.append("telegram", userData.telegram);
  formData.append("whatsapp", userData.whatsapp);
  if (userData.avatar_url) formData.append("avatar_url", userData.avatar_url);
  formData.append("is_blocked", String(userData.is_blocked ?? false));
  formData.append("is_partner", String(userData.is_partner ?? false));
  
  return formData;
};

// Функции для работы с API
export const fetchUser = async (userId: string): Promise<UserData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    throw new ApiError("Не авторизован", 401);
  }

  try {
    const response = await fetch(`/admin_edits/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const status = response.status;
      let errorMessage;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || `Ошибка API: ${status}`;
      } catch (e) {
        errorMessage = `Ошибка API: ${status}`;
      }
      
      // Создаем экземпляр ApiError с сообщением об ошибке и статусом
      throw new ApiError(errorMessage, status);
    }

    return response.json();
  } catch (error) {
    // Если ошибка уже является ApiError, просто пробрасываем её
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Иначе, создаем новый экземпляр ApiError
    console.error("Ошибка при загрузке данных пользователя:", error);
    throw new ApiError(
      error instanceof Error ? error.message : "Неизвестная ошибка при загрузке данных", 
      500
    );
  }
};

export const updateUser = async (userId: number, userData: UserData): Promise<UserData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    throw new ApiError("Не авторизован", 401);
  }

  try {
    // Используем JSON вместо FormData для совместимости с серверным маршрутом PUT /admin_edits/users/{user_id}
    const response = await fetch(`/admin_edits/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        fio: userData.fio,
        email: userData.email,
        telegram: userData.telegram,
        whatsapp: userData.whatsapp,
        avatar_url: userData.avatar_url,
        is_blocked: userData.is_blocked,
        is_partner: userData.is_partner,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      let errorMessage;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || `Ошибка при обновлении пользователя: ${status}`;
      } catch (e) {
        errorMessage = `Ошибка при обновлении пользователя: ${status}`;
      }
      
      throw new ApiError(errorMessage, status);
    }

    return response.json();
  } catch (error) {
    // Если ошибка уже является ApiError, просто пробрасываем её
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Иначе, создаем новый экземпляр ApiError
    console.error("Ошибка при обновлении пользователя:", error);
    throw new ApiError(
      error instanceof Error ? error.message : "Неизвестная ошибка при обновлении пользователя", 
      500
    );
  }
};