// frontend/src/utils/eventService.ts
import { EventFormData, EventData, EventResponse } from '@/types/events';

export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();
  
  console.log("eventService: Preparing form data with fields:", Object.keys(eventData));
  
  // Проверяем, что все основные поля присутствуют
  if (!eventData.title) {
    console.warn("eventService: Missing required field 'title'");
  }
  
  formData.append("title", eventData.title);
  formData.append("description", eventData.description || "");
  
  if (eventData.start_date) {
    const startDateStr = eventData.start_date + (eventData.start_time ? `T${eventData.start_time}:00` : "");
    formData.append("start_date", startDateStr);
    console.log("eventService: Prepared start_date:", startDateStr);
  } else {
    console.warn("eventService: Missing start_date");
  }
  
  if (eventData.end_date) {
    const endDateStr = eventData.end_date + (eventData.end_time ? `T${eventData.end_time}:00` : "");
    formData.append("end_date", endDateStr);
    console.log("eventService: Prepared end_date:", endDateStr);
  }
  
  if (eventData.location) {
    formData.append("location", eventData.location);
  }
  
  // Преобразуем числовые значения в строки
  formData.append("price", String(eventData.price || 0));
  formData.append("published", String(eventData.published || false));
  formData.append("status", eventData.status || "draft");
  formData.append("ticket_type_name", eventData.ticket_type_name || "standart");
  formData.append("ticket_type_available_quantity", String(eventData.ticket_type_available_quantity || 0));
  
  // Обработка файла изображения
  if (eventData.image_file) {
    formData.append("image_file", eventData.image_file);
    console.log("eventService: Added image file to form data:", eventData.image_file.name, eventData.image_file.size + " bytes");
  }
  
  // Явно приводим булево значение к строке
  formData.append("remove_image", String(eventData.remove_image || false));
  
  // Добавляем url_slug, если он указан
  if (eventData.url_slug) {
    formData.append("url_slug", eventData.url_slug);
    console.log("eventService: Added url_slug:", eventData.url_slug);
  }
  
  // Добавляем created_at и updated_at с текущей датой в формате ISO
  const now = new Date().toISOString();
  formData.append("created_at", now);
  formData.append("updated_at", now);
  console.log("eventService: Added timestamps:", now);

  // Log the form data entries for debugging
  console.log("eventService: Form data prepared with entries:");
  for (const pair of formData.entries()) {
    // Don't log the actual file content, just note that it exists
    if (pair[0] === "image_file" && pair[1] instanceof File) {
      console.log(`${pair[0]}: [File: ${(pair[1] as File).name}, ${(pair[1] as File).size} bytes]`);
    } else {
      console.log(`${pair[0]}: ${pair[1]}`);
    }
  }

  return formData;
};

export const createEvent = async (eventData: EventFormData): Promise<EventResponse> => {
  console.log("eventService: Starting createEvent");
  const adminToken = localStorage.getItem("admin_token");
  
  if (!adminToken) {
    console.log("eventService: No admin token found");
    return {
      success: false,
      message: "Отсутствует админ-токен. Необходимо войти в систему.",
      authError: true
    };
  }

  try {
    // Упрощенная проверка сессии без вызова ensureAdminSession
    const payload = JSON.parse(atob(adminToken.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    // Дополнительное логирование для отладки
    console.log(`eventService: Token payload:`, {
      exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'undefined',
      sub: payload.sub || 'undefined',
      now: new Date(now * 1000).toISOString(),
      isExpired: payload.exp && payload.exp <= now
    });
    
    if (payload.exp && payload.exp <= now) {
      console.log("eventService: Admin token is expired");
      // Токен истёк, удаляем его
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
        authError: true
      };
    }

    // Подготовка FormData для отправки на сервер
    const formData = prepareEventFormData(eventData);
    
    // Логируем данные формы (без файла, если он есть)
    const formDataDebug = Object.fromEntries(
      Array.from(formData.entries())
        .filter(([key, value]) => !(value instanceof File))
    );
    console.log("eventService: Prepared form data:", formDataDebug);

    console.log("eventService: Making API request to create event");
    
    // Проверяем порт текущего окна для отладки
    console.log(`eventService: Current window location: ${window.location.href}`);
    console.log(`eventService: Current window origin: ${window.location.origin}`);
    
    // Используем обычный fetch, next.config.js уже настроен на проксирование запросов
    const response = await fetch('/admin_edits', {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: formData
    });
    
    console.log(`eventService: Create event response status: ${response.status}`);
    console.log(`eventService: Response URL: ${response.url}`);
    
    // Логируем заголовки ответа для отладки
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log("eventService: Response headers:", headers);
    
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in createEvent, clearing session");
      // Удаляем токен только при ошибке 401 Unauthorized
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    
    // Для ошибки 403 Forbidden сохраняем данные сессии, но возвращаем ошибку с флагом авторизации
    if (response.status === 403) {
      console.log("eventService: Authorization error 403 in createEvent, NOT clearing session");
      console.log("eventService: Full URL that caused 403:", response.url);
      
      // Проверяем токен еще раз для отладки
      const adminData = localStorage.getItem("admin_data");
      console.log("eventService: Admin data in localStorage:", adminData ? JSON.parse(adminData) : "missing");
      
      // Пробуем получить текст ответа с ошибкой
      let errorText = "";
      try {
        errorText = await response.text();
        console.log("eventService: Error response body:", errorText);
      } catch (e) {
        console.error("eventService: Could not read error response:", e);
      }
      
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции. Проверьте, что вы авторизованы как администратор.",
        authError: true, // Указываем, что это ошибка авторизации, но не очищаем токены
      };
    }

    // Пробуем получить данные ответа, даже если статус не 200/201
    let responseData;
    try {
      responseData = await response.json();
      console.log("eventService: Response data:", responseData);
    } catch (error) {
      console.error("eventService: Error parsing response:", error);
      
      // Пробуем получить ответ как текст
      try {
        const textResponse = await response.text();
        console.log("eventService: Text response:", textResponse);
      } catch (e) {
        console.error("eventService: Could not get text response:", e);
      }
      
      responseData = { message: "Ошибка обработки ответа от сервера" };
    }
    
    if (response.status === 201 || response.status === 200) {
      console.log("eventService: Event created successfully");
      return {
        success: true,
        event: responseData,
        message: "Событие успешно создано",
      };
    } else {
      console.warn(`eventService: Unexpected response status: ${response.status}`);
      return {
        success: false,
        message: responseData.message || `Неизвестная ошибка при создании события (${response.status})`,
      };
    }
  } catch (error) {
    console.error("eventService: Error creating event:", error);
    
    // Определяем тип ошибки для более детального сообщения пользователю
    let errorMessage: string;
    
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      errorMessage = "Ошибка подключения к серверу. Проверьте ваше интернет-соединение или обратитесь к администратору.";
      console.error("eventService: Network connection error - Failed to fetch");
    } else if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Запрос отменен. Пожалуйста, попробуйте снова.";
      console.error("eventService: Request was aborted");
    } else if (error instanceof Error) {
      errorMessage = `Ошибка при создании события: ${error.message}`;
      console.error(`eventService: Error with message: ${error.message}`);
    } else {
      errorMessage = "Неизвестная ошибка при создании события.";
      console.error("eventService: Unknown error type:", error);
    }
    
    return {
      success: false,
      message: errorMessage,
    };
  }
};

export const updateEvent = async (eventId: number | string, eventData: EventFormData): Promise<EventResponse> => {
  console.log(`eventService: Starting updateEvent for event ID ${eventId}`);
  const token = localStorage.getItem("admin_token");
  if (!token) {
    console.log("eventService: No admin token found");
    return { 
      success: false,
      message: "Сессия истекла. Необходима авторизация.",
      authError: true
    };
  }

  try {
    // Упрощенная проверка сессии без вызова ensureAdminSession
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp <= now) {
      console.log("eventService: Admin token is expired");
      // Токен истёк, удаляем его
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
        authError: true
      };
    }

    console.log("eventService: Preparing form data");
    const formData = prepareEventFormData(eventData);

    console.log(`eventService: Making API request to update event ${eventId}`);
    
    // Используем обычный fetch
    const response = await fetch(`/admin_edits/${eventId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    console.log(`eventService: Update response status: ${response.status}`);
    
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in updateEvent, clearing session");
      // Удаляем токен только при ошибке 401 Unauthorized
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    
    // Для ошибки 403 Forbidden сохраняем данные сессии, но возвращаем ошибку с флагом авторизации
    if (response.status === 403) {
      console.log("eventService: Authorization error 403 in updateEvent, NOT clearing session");
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции.",
        authError: true, // Указываем, что это ошибка авторизации, но не очищаем токены
      };
    }
    
    // Пробуем получить данные ответа, даже если статус не 200/201
    let responseData;
    try {
      responseData = await response.json();
    } catch (error) {
      console.error("eventService: Error parsing response:", error);
      responseData = { message: "Ошибка обработки ответа от сервера" };
    }

    if (response.status === 200) {
      console.log("eventService: Event updated successfully");
      return {
        success: true,
        event: responseData,
        message: "Событие успешно обновлено",
      };
    } else {
      console.warn(`eventService: Unexpected response status: ${response.status}`);
      return {
        success: false,
        message: responseData.message || `Неизвестная ошибка при обновлении события (${response.status})`,
      };
    }
  } catch (error) {
    console.error("eventService: Error updating event:", error);
    
    return {
      success: false,
      message: error instanceof Error ? error.message : "Ошибка сети при обновлении события. Пожалуйста, проверьте подключение.",
    };
  }
};

export const fetchEvent = async (eventId: string): Promise<EventResponse> => {
  console.log(`eventService: Starting fetchEvent for event ID ${eventId}`);
  const token = localStorage.getItem("admin_token");
  if (!token) {
    console.log("eventService: No admin token found for fetchEvent");
    return { 
      success: false,
      message: "Необходима авторизация администратора",
      authError: true 
    };
  }

  try {
    // Упрощенная проверка сессии без вызова ensureAdminSession
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp <= now) {
      console.log("eventService: Admin token is expired");
      // Токен истёк, удаляем его
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
        authError: true
      };
    }

    console.log(`eventService: Making API request to fetch event ${eventId}`);
    
    // Используем обычный fetch
    const response = await fetch(`/admin_edits/${eventId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });

    console.log(`eventService: Fetch event response status: ${response.status}`);
    
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in fetchEvent, clearing session");
      // Удаляем токен только при ошибке 401 Unauthorized
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    
    // Для ошибки 403 Forbidden сохраняем данные сессии, но возвращаем ошибку с флагом авторизации
    if (response.status === 403) {
      console.log("eventService: Authorization error 403 in fetchEvent, NOT clearing session");
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции.",
        authError: true, // Указываем, что это ошибка авторизации, но не очищаем токены
      };
    }
    
    if (response.status === 404) {
      return {
        success: false,
        message: "Событие не найдено",
      };
    }
    
    // Пробуем получить данные ответа, даже если статус не 200
    let responseData;
    try {
      responseData = await response.json();
    } catch (error) {
      console.error("eventService: Error parsing response:", error);
      responseData = { message: "Ошибка обработки ответа от сервера" };
    }

    if (response.status === 200) {
      console.log("eventService: Event fetched successfully");
      return {
        success: true,
        event: responseData,
        message: "Событие успешно загружено",
      };
    } else {
      console.warn(`eventService: Unexpected response status: ${response.status}`);
      return {
        success: false,
        message: responseData.message || `Неизвестная ошибка при загрузке события (${response.status})`,
      };
    }
  } catch (error) {
    console.error("eventService: Error fetching event:", error);
    
    return {
      success: false,
      message: error instanceof Error ? error.message : "Ошибка сети при загрузке события. Пожалуйста, проверьте подключение.",
    };
  }
};

// Function to ensure the admin token is valid before making requests
export const ensureAdminSession = async (): Promise<boolean> => {
  console.log("eventService: Checking admin session validity");
  
  // Сначала проверяем токен локально
  const adminToken = localStorage.getItem("admin_token");
  
  if (!adminToken) {
    console.log("eventService: No admin token found in localStorage");
    return false;
  }
  
  try {
    // Декодируем и проверяем токен локально
    const payload = JSON.parse(atob(adminToken.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    // Проверяем срок действия токена
    if (payload.exp && payload.exp > now) {
      // Токен действителен
      const expiryDate = new Date(payload.exp * 1000);
      console.log(`eventService: Admin token is valid until ${expiryDate.toISOString()}`);
      return true;
    } else {
      console.log("eventService: Admin token has expired locally");
      // Токен истёк, удаляем его
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return false;
    }
  } catch (error) {
    console.error("eventService: Error during local token validation:", error);
    
    // Если локальная валидация не удалась, проверяем на сервере
    try {
      const isValid = await checkAdminSession();
      console.log(`eventService: Server validation result: ${isValid}`);
      
      if (!isValid) {
        // Если сервер также подтвердил, что сессия недействительна, удаляем токены
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_data");
      }
      
      return isValid;
    } catch (serverError) {
      console.error("eventService: Server validation failed:", serverError);
      // Очищаем токены в случае ошибки
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return false;
    }
  }
};

// Function to check admin session on the server
export const checkAdminSession = async (): Promise<boolean> => {
  try {
    const token = localStorage.getItem("admin_token");
    if (!token) return false;

    // Проверка сессии через эндпоинт /admin/me
    const response = await fetch(`/admin/me`, {
      method: "GET", 
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (response.ok) {
      return true;
    }

    // Если получаем 401 или 403, значит сессия истекла
    if (response.status === 401 || response.status === 403) {
      console.log("eventService: Session check failed with status", response.status);
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return false;
    }

    console.warn("eventService: Unexpected status checking admin session:", response.status);
    return false;
  } catch (error) {
    console.error("eventService: Error checking admin session:", error);
    return false;
  }
};