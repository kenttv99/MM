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
    throw new Error("Не авторизован");
  }

  const response = await fetch(`/admin_edits/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `Ошибка API: ${response.status}`);
  }

  return response.json();
};

export const updateUser = async (userId: number, userData: UserData): Promise<UserData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    throw new Error("Не авторизован");
  }

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
    const errorData = await response.json();
    throw new Error(errorData.detail || "Ошибка при обновлении пользователя");
  }

  return response.json();
};