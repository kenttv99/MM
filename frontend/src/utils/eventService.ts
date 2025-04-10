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
  } else {
    console.warn("eventService: URL slug is empty or undefined!");
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

// Helper function to prepare URL slug with year and ID suffix
export const prepareUrlSlug = (slug: string | undefined, eventId?: number, startDate?: string): string | undefined => {
  if (!slug || slug.trim() === '') {
    console.log("prepareUrlSlug: slug is empty, returning undefined");
    return undefined;
  }
  
  // Очищаем слаг от возможных уже добавленных суффиксов
  const slugParts = slug.split('-');
  let cleanSlug = slug;
  
  // Если слаг содержит больше 2 частей, пробуем убрать потенциальный год и ID
  if (slugParts.length > 2) {
    // Проверяем, является ли предпоследняя часть годом (4 цифры)
    const potentialYear = slugParts[slugParts.length - 2];
    if (/^\d{4}$/.test(potentialYear)) {
      cleanSlug = slugParts.slice(0, -2).join('-');
    }
  }
  
  // Получаем год из даты начала события или используем текущий год
  let year = new Date().getFullYear().toString();
  if (startDate) {
    const eventDate = new Date(startDate);
    year = eventDate.getFullYear().toString();
  }
  
  // Если есть ID события, добавляем его как суффикс
  let result;
  if (eventId) {
    result = `${cleanSlug}-${year}-${eventId}`;
  } else {
    // Для новых событий не добавляем ID (будет добавлен сервером)
    result = `${cleanSlug}-${year}`;
  }
  
  console.log(`prepareUrlSlug: Input slug "${slug}" processed to "${result}"`);
  return result;
};

export const createEvent = async (eventData: EventFormData): Promise<EventResponse> => {
  console.log("eventService: Starting createEvent");
  const token = localStorage.getItem("admin_token");
  if (!token) {
    console.log("eventService: No admin token found for createEvent");
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
    
    console.log("eventService: Preparing event data for creation");
    
    // Prepare form data for upload
    const formData = prepareEventFormData({
      ...eventData,
      url_slug: prepareUrlSlug(eventData.url_slug, undefined, eventData.start_date)
    });
    
    // Логируем данные формы (без файла, если он есть)
    const formDataDebug = Object.fromEntries(
      Array.from(formData.entries())
        .filter(([key, value]) => !(value instanceof File))
    );
    console.log("eventService: Prepared form data:", formDataDebug);

    console.log("eventService: Making API request to create event");
    
    // При отправке FormData с файлами, браузер автоматически устанавливает правильный Content-Type
    // Убедимся, что URL точно заканчивается слешем для избежания перенаправления
    const createUrl = '/admin_edits/';
    
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // НЕ устанавливаем Content-Type вручную для FormData с файлами!
      },
      // Используем same-origin вместо include, это решает проблему с перенаправлением и cookies
      credentials: 'same-origin',
      body: formData
    });
    
    // Проверяем наличие обновленного токена в заголовках
    handleTokenRefresh(createResponse);
    
    console.log(`eventService: Create event response status: ${createResponse.status}`);
    
    // Логируем полный ответ для отладки
    try {
      const responseText = await createResponse.clone().text();
      console.log(`eventService: Raw response: ${responseText}`);
    } catch (err) {
      console.error("eventService: Failed to log raw response:", err);
    }
    
    // Обработка ошибок
    if (createResponse.status === 401) {
      console.log("eventService: Authentication error 401 in createEvent, clearing session");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    
    if (createResponse.status === 403) {
      console.log("eventService: Authorization error 403 in createEvent, NOT clearing session");
      
      // Проверяем токен еще раз для отладки
      const adminData = localStorage.getItem("admin_data");
      console.log("eventService: Admin data in localStorage:", adminData ? JSON.parse(adminData) : "missing");
      
      // Пробуем получить текст ошибки
      const errorText = await createResponse.text();
      console.log("eventService: Error response body:", errorText);
      
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции. Проверьте, что вы авторизованы как администратор.",
        authError: true,
      };
    }
    
    // Обрабатываем успешный ответ или другие ошибки
    try {
      const responseData = await createResponse.json();
      console.log("eventService: Response data:", responseData);
      
      if (createResponse.status === 200 || createResponse.status === 201) {
        console.log("eventService: Event created successfully");
        return {
          success: true,
          event: responseData,
          message: "Событие успешно создано",
        };
      } else {
        console.warn(`eventService: Unexpected response status: ${createResponse.status}`);
        return {
          success: false,
          message: responseData.message || responseData.detail || `Неизвестная ошибка при создании события (${createResponse.status})`,
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

export const updateEvent = async (id: number | string, data: EventFormData): Promise<EventResponse> => {
  console.log(`eventService: Updating event with ID ${id}`);
  
  if (!id) {
    console.error("eventService: No event ID provided for update");
    return {
      success: false,
      message: "Не указан ID события для обновления",
    };
  }
  
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
    // Проверяем обязательные поля
    if (!data.title) {
      console.error("eventService: Missing required field: title");
      return {
        success: false, 
        message: "Не заполнено обязательное поле: Название"
      };
    }
    
    if (!data.start_date) {
      console.error("eventService: Missing required field: start_date");
      return {
        success: false,
        message: "Не заполнено обязательное поле: Дата начала"
      };
    }

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
    
    console.log(`eventService: Preparing event data for update, event ID: ${id}`);
    
    // Prepare form data for upload
    const formData = prepareEventFormData({
      ...data,
      url_slug: prepareUrlSlug(data.url_slug, typeof id === 'string' ? parseInt(id) : id, data.start_date)
    });
    
    // Логируем данные формы (без файла, если он есть)
    const formDataForLog = { ...data };
    if (formDataForLog.image_file) {
      formDataForLog.image_file = `[File object: ${(formDataForLog.image_file as File).name}]` as any;
    }
    console.log("eventService: Sending update form data:", formDataForLog);
    
    // Определяем URL для запроса
    // Убедимся, что URL заканчивается слешем для избежания перенаправления
    const updateUrl = id.toString().endsWith('/') 
      ? `/admin_edits/${id}` 
      : `/admin_edits/${id}/`;
    
    console.log(`eventService: Sending update request to ${updateUrl}`);
    
    // Отправляем запрос
    const response = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        'Authorization': `Bearer ${adminToken}`
        // НЕ устанавливаем Content-Type вручную для FormData с файлами!
      },
      body: formData,
      credentials: 'same-origin'
    });

    // Проверяем наличие обновленного токена в заголовках
    handleTokenRefresh(response);
    
    console.log(`eventService: Update response status: ${response.status}`);
    
    // Обработка ошибок аутентификации
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
    
    // Убедимся, что URL заканчивается слешем для избежания перенаправления
    const fetchUrl = eventId.endsWith('/') 
      ? `/admin_edits/${eventId}` 
      : `/admin_edits/${eventId}/`;
    
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'same-origin'
    });

    // Проверяем наличие обновленного токена в заголовках
    handleTokenRefresh(response);

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
    // Выбрасываем ошибку авторизации с кодом 401
    const error = new Error("Не авторизован");
    (error as any).status = 401;
    throw error;
  }

  // Получаем время последней проверки токена
  const lastCheckTime = parseInt(localStorage.getItem("admin_last_check_time") || '0');
  const now = Date.now();

  // Проверяем срок истечения токена локально
  const tokenExpiry = getTokenExpiration(adminToken);
  const isExpiringSoon = tokenExpiry && 
    (tokenExpiry - Math.floor(now / 1000) < 300); // Менее 5 минут до истечения

  // Если токен недавно проверялся (менее 2 минут назад)
  // и не близок к истечению срока, используем кэшированный результат
  if (now - lastCheckTime < 120000 && !isExpiringSoon) {
    console.log("eventService: Using cached session check result");
    return true;
  }

  try {
    console.log("eventService: Sending admin session check request");
    const response = await fetch('/admin/me', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      credentials: 'same-origin' // Используем same-origin вместо include
    });

    // Проверяем наличие обновленного токена в заголовках
    handleTokenRefresh(response);

    // Обрабатываем различные статусы ответа
    if (response.status === 200) {
      // Обновляем время последней проверки
      localStorage.setItem("admin_last_check_time", now.toString());
      return true;
    } else if (response.status === 401 || response.status === 403) {
      console.log(`eventService: Session invalid with status ${response.status}`);
      // Удаляем токен и данные пользователя при ошибке авторизации
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      
      // Выбрасываем ошибку авторизации с кодом статуса
      const error = new Error(`Ошибка авторизации: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    } else {
      console.warn(`eventService: Unexpected response status: ${response.status}`);
      
      // Если статус не 2xx, выбрасываем ошибку с кодом статуса
      if (response.status >= 400) {
        let errorMessage = `Ошибка сервера: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (e) {
          // Игнорируем ошибки при попытке получить JSON
        }
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }
      
      // При других ошибках проверяем токен локально
      return validateTokenLocally(adminToken);
    }
  } catch (error) {
    console.error("eventService: Error checking admin session:", error);
    
    // Сохраняем статус ошибки при ее наличии
    if (error instanceof Error && 'status' in error) {
      throw error; // Пробрасываем ошибку дальше с сохранением статуса
    }
    
    // При ошибке сети проверяем валидность токена локально
    if (validateTokenLocally(adminToken)) {
      return true;
    }
    
    // Если локальная валидация не прошла, создаем ошибку авторизации
    const authError = new Error("Токен недействителен");
    (authError as any).status = 401;
    throw authError;
  }
};

// Вспомогательная функция для локальной валидации токена
function validateTokenLocally(token: string): boolean {
  try {
    const expiry = getTokenExpiration(token);
    if (!expiry) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return expiry > now;
  } catch (error) {
    console.error("eventService: Error validating token locally:", error);
    return false;
  }
}

// Вспомогательная функция для получения времени истечения токена
function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.exp || null;
  } catch (error) {
    console.error("eventService: Error getting token expiration:", error);
    return null;
  }
}

// Handle token refresh from response headers
export const handleTokenRefresh = (response: Response): void => {
  const refreshToken = response.headers.get("X-Refresh-Token");
  if (refreshToken) {
    // Проверяем, изменился ли токен по сравнению с тем, что у нас уже есть
    const currentToken = localStorage.getItem("admin_token");
    if (currentToken !== refreshToken) {
      console.log("handleTokenRefresh: Token changed, updating in localStorage");
      localStorage.setItem("admin_token", refreshToken);
      
      // Устанавливаем время последней проверки токена
      const now = Date.now();
      localStorage.setItem("admin_last_check_time", now.toString());
    } else {
      console.log("handleTokenRefresh: Token unchanged, skipping update");
    }
  }
};