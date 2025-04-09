// frontend/src/utils/eventService.ts
import { EventFormData, EventData, EventResponse } from '@/types/events';
import { apiFetch } from '@/utils/api';

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
    // Проверка сессии на сервере вместо локальной проверки
    const isSessionValid = await ensureAdminSession();
    if (!isSessionValid) {
      console.log("eventService: Admin session is invalid");
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
    
    // При отправке формы с файлами используем обычный fetch вместо apiFetch
    const response = await fetch('/admin_edits/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      credentials: 'include',
      body: formData // Отправляем FormData, а не formDataDebug
    });
    
    console.log(`eventService: Create event response status: ${response.status}`);
    
    // Обработка ошибок
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in createEvent, clearing session");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    
    if (response.status === 403) {
      console.log("eventService: Authorization error 403 in createEvent, NOT clearing session");
      
      // Проверяем токен еще раз для отладки
      const adminData = localStorage.getItem("admin_data");
      console.log("eventService: Admin data in localStorage:", adminData ? JSON.parse(adminData) : "missing");
      
      // Пробуем получить текст ошибки
      const errorText = await response.text();
      console.log("eventService: Error response body:", errorText);
      
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции. Проверьте, что вы авторизованы как администратор.",
        authError: true,
      };
    }
    
    // Обрабатываем успешный ответ или другие ошибки
    try {
      const responseData = await response.json();
      console.log("eventService: Response data:", responseData);
      
      if (response.status === 200 || response.status === 201) {
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
          message: responseData.message || responseData.detail || `Неизвестная ошибка при создании события (${response.status})`,
        };
      }
    } catch (error) {
      console.error("eventService: Error parsing response:", error);
      return {
        success: false,
        message: "Ошибка обработки ответа от сервера",
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

export const updateEvent = async (
  id: string,
  data: EventFormData,
  token?: string
): Promise<{ success: boolean; event?: Event; message?: string; authError?: boolean }> => {
  console.log("eventService: Starting updateEvent", { id, data });

  try {
    // Проверяем сессию на сервере
    const isSessionValid = await ensureAdminSession();
    if (!isSessionValid) {
      console.log("eventService: Admin session is invalid");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
        authError: true
      };
    }
    
    // Prepare form data
    const formData = prepareEventFormData(data);

    // Получаем токен из localStorage, если он не передан
    const adminToken = token || localStorage.getItem("admin_token");
    if (!adminToken) {
      console.log("eventService: No admin token found");
      return {
        success: false,
        message: "Отсутствует админ-токен. Необходимо войти в систему.",
        authError: true
      };
    }

    // Send PUT request to update the event (используем маршрут /admin_edits/:id)
    const response = await fetch(`/admin_edits/${id}/`, {
      method: "PUT",
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      credentials: 'include',
      body: formData
    });

    console.log(`eventService: Update response status: ${response.status}`);
    
    // Обработка ошибок
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in updateEvent, clearing session");
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
      
      // Пробуем получить текст ошибки
      const errorText = await response.text();
      console.log("eventService: Error response body:", errorText);
      
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции.",
        authError: true, // Указываем, что это ошибка авторизации, но не очищаем токены
      };
    }
    
    // Обрабатываем успешный ответ или другие ошибки
    try {
      const responseData = await response.json();
      console.log("eventService: Response data:", responseData);
      
      if (response.status === 200 || response.status === 201) {
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
          message: responseData.message || responseData.detail || `Неизвестная ошибка при обновлении события (${response.status})`,
        };
      }
    } catch (error) {
      console.error("eventService: Error parsing response:", error);
      return {
        success: false,
        message: "Ошибка обработки ответа от сервера",
      };
    }
  } catch (error) {
    console.error("eventService: Error updating event:", error);
    
    // Определяем тип ошибки для более детального сообщения пользователю
    let errorMessage: string;
    
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      errorMessage = "Ошибка подключения к серверу. Проверьте ваше интернет-соединение или обратитесь к администратору.";
      console.error("eventService: Network connection error - Failed to fetch");
    } else if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Запрос отменен. Пожалуйста, попробуйте снова.";
      console.error("eventService: Request was aborted");
    } else if (error instanceof Error) {
      errorMessage = `Ошибка при обновлении события: ${error.message}`;
      console.error(`eventService: Error with message: ${error.message}`);
    } else {
      errorMessage = "Неизвестная ошибка при обновлении события.";
      console.error("eventService: Unknown error type:", error);
    }
    
    return {
      success: false,
      message: errorMessage,
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
    // Проверка сессии на сервере
    const isSessionValid = await ensureAdminSession();
    if (!isSessionValid) {
      console.log("eventService: Admin session is invalid");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
        authError: true
      };
    }
    
    console.log(`eventService: Making API request to fetch event ${eventId}`);
    
    // Проверяем порт текущего окна для отладки
    console.log(`eventService: Current window location: ${window.location.href}`);
    console.log(`eventService: Current window origin: ${window.location.origin}`);
    
    // Добавлено credentials: 'include' и проверка URL на завершающий слеш
    const url = eventId.endsWith('/') 
      ? `/admin_edits/${eventId}` 
      : `/admin_edits/${eventId}/`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    });

    console.log(`eventService: Fetch event response status: ${response.status}`);
    
    // Обработка ошибок аутентификации
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in fetchEvent, clearing session");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    
    if (response.status === 403) {
      console.log("eventService: Authorization error 403 in fetchEvent, NOT clearing session");
      
      // Пробуем получить текст ошибки
      const errorText = await response.text();
      console.log("eventService: Error response body:", errorText);
      
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
    
    // Обрабатываем успешный ответ или другие ошибки
    try {
      const responseData = await response.json();
      console.log("eventService: Response data:", responseData);
      
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
          message: responseData.message || responseData.detail || `Неизвестная ошибка при загрузке события (${response.status})`,
        };
      }
    } catch (error) {
      console.error("eventService: Error parsing response:", error);
      return {
        success: false,
        message: "Ошибка обработки ответа от сервера",
      };
    }
  } catch (error) {
    console.error("eventService: Error fetching event:", error);
    
    // Определяем тип ошибки для более детального сообщения пользователю
    let errorMessage: string;
    
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      errorMessage = "Ошибка подключения к серверу. Проверьте ваше интернет-соединение или обратитесь к администратору.";
      console.error("eventService: Network connection error - Failed to fetch");
    } else if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Запрос отменен. Пожалуйста, попробуйте снова.";
      console.error("eventService: Request was aborted");
    } else if (error instanceof Error) {
      errorMessage = `Ошибка при загрузке события: ${error.message}`;
      console.error(`eventService: Error with message: ${error.message}`);
    } else {
      errorMessage = "Неизвестная ошибка при загрузке события.";
      console.error("eventService: Unknown error type:", error);
    }
    
    return {
      success: false,
      message: errorMessage,
    };
  }
};

// Function to ensure the admin session is valid before making requests
export const ensureAdminSession = async (): Promise<boolean> => {
  console.log("eventService: Checking admin session validity");
  
  // Проверяем токен на сервере
  try {
    const isValid = await checkAdminSession();
    console.log(`eventService: Server validation result: ${isValid}`);
    
    if (!isValid) {
      // Если сервер подтвердил, что сессия недействительна, удаляем токены
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
};

// Function to check admin session on the server
export const checkAdminSession = async (): Promise<boolean> => {
  const adminToken = localStorage.getItem("admin_token");
  
  if (!adminToken) {
    console.log("eventService: No admin token found for checking");
    return false;
  }

  try {
    console.log("eventService: Sending admin session check request");
    const response = await fetch('/admin/me', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      credentials: 'include'
    });

    // Обрабатываем различные статусы ответа
    if (response.status === 200) {
      console.log("eventService: Admin session is valid");
      
      // Обновляем данные админа из ответа
      try {
        const data = await response.json();
        if (data.success && data.data) {
          localStorage.setItem("admin_data", JSON.stringify(data.data));
          console.log("eventService: Admin data updated from session check");
        }
      } catch (error) {
        console.error("eventService: Error parsing admin data:", error);
        // Сессия всё равно валидна, даже если не удалось распарсить данные
      }
      
      return true;
    } else if (response.status === 401) {
      console.log("eventService: Admin session is invalid (401 Unauthorized)");
      return false;
    } else if (response.status === 403) {
      console.log("eventService: Admin session lacks permissions (403 Forbidden)");
      return false;
    } else {
      console.error(`eventService: Unexpected status code: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("eventService: Error checking admin session:", error);
    return false;
  }
};