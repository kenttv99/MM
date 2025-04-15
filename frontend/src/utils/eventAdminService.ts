import { createLogger } from "@/utils/logger";
import { apiFetch, ApiError, APIOptions } from "@/utils/api";
// Импортируем типы из правильных мест
import type { AdminProfile } from "@/types/index"; // Импортируем из index.ts
import type { EventData } from "@/types/events";

// Создаем логгер для админского сервиса
const logger = createLogger("eventAdminService");

// --- Перенесенные функции из eventService.ts ---

// УДАЛЯЕМ функцию prepareEventFormData
// export const prepareEventFormData = (eventData: EventFormData): FormData => {
//     // ... (old code)
// };

// Helper function to prepare URL slug with year and ID suffix
export const prepareUrlSlug = (
  slug: string | undefined,
  eventId?: number
): string | undefined => {
  if (!slug || slug.trim() === "") {
    logger.debug("prepareUrlSlug: slug is empty, returning undefined");
    return undefined;
  }

  logger.debug("prepareUrlSlug: Original input slug", { slug });

  // First step: comprehensive sanitization - remove non-ASCII characters and normalize
  let processedSlug = slug.replace(/[^\x00-\x7F]+/g, "");

  // Convert to lowercase and replace any non-alphanumeric characters with hyphens
  processedSlug = processedSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens

  if (processedSlug !== slug) {
    logger.debug("prepareUrlSlug: Sanitized slug", { from: slug, to: processedSlug });
  }

  // Check for reserved words
  const reservedSlugs = [
    "admin", "api", "dashboard", "auth", "login", "register", "settings", "profile",
  ];
  const slugLower = processedSlug.toLowerCase();

  for (const reserved of reservedSlugs) {
    if (slugLower === reserved || slugLower.startsWith(`${reserved}-`)) {
      logger.warn("prepareUrlSlug: Slug contains reserved word, adding prefix", { slugLower, reserved });
      processedSlug = `event-${processedSlug}`;
      break;
    }
  }

  // Extract base slug without year and ID suffixes
  const baseSlug = extractBaseSlug(processedSlug);
   logger.debug("prepareUrlSlug: Extracted base slug", { baseSlug, from: processedSlug });

  // Re-sanitize the base slug just to be sure
  let cleanSlug = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  // If the slug is empty or too short after processing, use a fallback
  if (!cleanSlug || cleanSlug.length < 3) {
    const prefix = eventId ? `event-${eventId}` : "event";

    // If we have the original slug, try to use at least the first few characters
    if (slug.length >= 3) {
      const fixedSlug = slug
        .substring(0, 3)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "");
      if (fixedSlug.length >= 3) {
        cleanSlug = fixedSlug;
      } else {
        cleanSlug = prefix;
      }
    } else {
      cleanSlug = prefix;
    }

    logger.warn("prepareUrlSlug: Slug was empty or too short, using fallback", { cleanSlug });
  }

  // Truncate if the slug is too long (leave room for year-ID suffix)
  const maxBaseLength = 40; // Leave room for year and ID suffixes
  if (cleanSlug.length > maxBaseLength) {
    cleanSlug = cleanSlug.substring(0, maxBaseLength).replace(/-+$/g, ""); // Remove trailing hyphens
    logger.warn("prepareUrlSlug: Slug was too long, truncated", { length: cleanSlug.length, cleanSlug });
  }

  // Make a final check to ensure the slug is valid
  if (cleanSlug !== baseSlug) {
     logger.debug("prepareUrlSlug: Final base slug differs from extracted", { final: cleanSlug, extracted: baseSlug });
  }

  // Return the base slug for database storage - without year and ID suffix
  // The UI will display the full URL with suffixes
   logger.debug("prepareUrlSlug: Final processed slug", { input: slug, output: cleanSlug });
  return cleanSlug;
};

// Helper function to extract the base slug without year and ID suffixes
function extractBaseSlug(slug: string): string {
  // Pattern to match potential "-YYYY-ID" or "-ID" suffix
  const yearIdPattern = /-\d{4}-\d+$/; // Matches "-YYYY-ID" at the end
  const idPattern = /-\d+$/; // Matches "-ID" at the end

  if (yearIdPattern.test(slug)) {
    // Remove "-YYYY-ID" suffix
    const baseSlug = slug.replace(yearIdPattern, "");
     logger.debug("extractBaseSlug: Removed year-ID suffix", { from: slug, to: baseSlug });
    return baseSlug;
  } else if (idPattern.test(slug)) {
    // Remove "-ID" suffix
    const baseSlug = slug.replace(idPattern, "");
     logger.debug("extractBaseSlug: Removed ID suffix", { from: slug, to: baseSlug });
    return baseSlug;
  }

  // No suffix found, return the original slug
  return slug;
}

// Интерфейс для данных обновления события (локально)
// Возвращаем export, т.к. тип используется в useEventForm
export interface EventUpdateData {
  id?: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  price?: number;
  published?: boolean;
  status?: string;
  ticket_type_name?: string;
  ticket_type_available_quantity?: number;
  image_file?: File | undefined; // Допускаем undefined для совместимости
  remove_image?: boolean;
  url_slug?: string;
  // Добавляем явную индексную подпись, чтобы разрешить доступ по ключу
  [key: string]: string | number | boolean | File | undefined | null;
}

// Определяем EventCreateData локально (на основе полей, необходимых для создания)
// Примечание: Бэкенд ожидает FormData, а не JSON. Это нужно будет согласовать.
interface EventCreateData {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  price: number;
  published: boolean;
  status: string;
  ticket_type_name: string;
  ticket_type_available_quantity: number;
  remove_image?: boolean;
  url_slug?: string;
  image_file?: File | null; // Добавим поле для файла, хотя оно не сериализуется в JSON
}

// This function specifically fixes the URL slug in the database using apiFetch
// Удаляем неиспользуемую функцию
// async function fixUrlSlug(eventId: string, correctSlug: string): Promise<boolean> { ... }

// Try updating using a direct JSON approach instead of FormData using apiFetch
// Удаляем неиспользуемую функцию
// async function updateEventWithJson(...) { ... }

// Воссоздаем prepareEventFormData с исправлениями для индексации
const prepareEventFormData = (data: EventCreateData | EventUpdateData, isUpdate: boolean = false): FormData => {
  const formData = new FormData();
  logger.debug("Preparing FormData", { isUpdate, dataKeys: Object.keys(data) });

  if (isUpdate) {
    // Для обновления отправляем поля по отдельности
    let imageFile: File | null = null;

    Object.keys(data).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key as keyof typeof data];
        const formKey = key === 'status' ? 'event_status' : key; // Используем event_status для бэкенда

        if (key === 'image_file' && value instanceof File) {
          imageFile = value;
        } 
        else if (key !== 'id' && key !== 'image_file') { 
          if (typeof value === 'boolean') {
            formData.append(formKey, String(value)); 
          } else if (value !== undefined && value !== null) {
            formData.append(formKey, String(value)); 
          }
        }
      }
    });
    
    if (imageFile !== null) {
      formData.append("image_file", imageFile);
      const fileName = (imageFile as File).name;
      logger.debug("Appended image file to FormData", { name: fileName });
    }

  } else { // Логика для создания
     Object.keys(data).forEach(key => {
       if (Object.prototype.hasOwnProperty.call(data, key)) {
         const value = data[key as keyof typeof data];
         const formKey = key === 'status' ? 'event_status' : key; // Используем event_status для бэкенда

         if (key === 'image_file' && value instanceof File) {
           formData.append(formKey, value); 
         } else if (typeof value === 'boolean') {
           formData.append(formKey, String(value));
         } else if (value !== undefined && value !== null) {
           formData.append(formKey, String(value));
         }
       }
    });
    // Для создания добавляем created_at/updated_at
    const now = new Date().toISOString();
    formData.append("created_at", now);
    formData.append("updated_at", now);
  }

  return formData;
};

// Функция для создания нового события (отправляет FormData)
export const createEvent = async (eventData: EventCreateData, options?: Partial<APIOptions>): Promise<EventData> => {
  logger.info("Creating new event using FormData");
  try {
    const preparedFormData = prepareEventFormData(eventData, false);
    
    const createdEvent = await apiFetch<EventData>('/admin_edits/', { 
      method: 'POST',
      data: preparedFormData, 
      isAdminRequest: true,
      ...options // Передаем опции
    });
    logger.info(`Event created successfully with ID: ${createdEvent.id}`);
    return createdEvent;
  } catch (error) {
    logger.error("Failed to create event:", error);
    if (error instanceof ApiError) {
      if (error.body?.detail) {
         throw new ApiError(error.status, { ...error.body, error: error.body.detail });
      }
      throw error;
    }
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new ApiError(500, { error: message });
  }
};

// Обновленная функция для обновления события (отправляет FormData)
export const updateEvent = async (eventId: string, eventData: EventUpdateData, options?: Partial<APIOptions>): Promise<EventData> => {
  logger.info(`Updating event with ID: ${eventId} using FormData`);
  try {
    const preparedFormData = prepareEventFormData(eventData, true);

    const updatedEvent = await apiFetch<EventData>(`/admin_edits/${eventId}/`, { 
      method: 'PUT',
      data: preparedFormData,
      isAdminRequest: true,
      ...options // Передаем опции
    });
    logger.info(`Event ${eventId} updated successfully`);
    return updatedEvent;
  } catch (error) {
    logger.error(`Failed to update event ${eventId}:`, error);
     if (error instanceof ApiError) {
      if (error.body?.detail) {
         throw new ApiError(error.status, { ...error.body, error: error.body.detail });
      }
      throw error;
    }
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new ApiError(500, { error: message });
  }
};

// --- Восстановленный код --- 

// Use apiFetch for fetching event details for admin
export const fetchEvent = async (eventId: string, options?: Partial<APIOptions>): Promise<EventData> => {
  logger.info("Starting fetchEvent for admin", { eventId });

  try {
    const url = `/admin_edits/${eventId}/`;
    logger.info("Making GET request for admin", { url });

    // Передаем options в apiFetch, объединяя с базовыми
    const eventData = await apiFetch<EventData>(url, {
        method: "GET",       // Базовые опции
        isAdminRequest: true, 
        ...options,           // Добавляем переданные опции (могут переопределить базовые)
    }).catch(e => { throw e; }); 

    logger.debug("Received event data for admin", { eventId: eventData.id });
    return eventData;

  } catch (error) {
    const err = error as ApiError; 
    logger.error("Error in fetchEvent for admin", { status: err.status, message: err.message });

    if (err.status === 401) {
      logger.warn("Authentication error 401 in fetchEvent (admin), clearing session");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
       throw new ApiError(err.status, { ...err.body, authError: true, message: "Ошибка аутентификации. Пожалуйста, войдите снова." });
    }
    if (err.status === 403) {
      logger.warn("Authorization error 403 in fetchEvent (admin)");
       throw new ApiError(err.status, { ...err.body, authError: true, message: "У вас недостаточно прав для выполнения этой операции." });
    }
    if (error instanceof ApiError) {
        throw error;
    }
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    throw new ApiError(0, { error: `Ошибка при получении данных мероприятия: ${message}` });
  }
};

// Function to ensure the admin session is valid before making requests
export const ensureAdminSession = async (): Promise<boolean> => {
  logger.debug("Checking admin session validity");

  try {
    await checkAdminSession();
    logger.debug("Server validation successful");
    return true;

  } catch (serverError) {
    if (serverError instanceof ApiError && (serverError.status === 401 || serverError.status === 403)) {
      logger.warn("Server validation failed with auth error, session is invalid.", { status: serverError.status });
      return false;
    }
    logger.error("Server validation failed with unexpected error", {
      error: serverError instanceof Error ? serverError.message : String(serverError)
    });
    throw serverError;
  }
};

// Function to check admin session on the server using apiFetch
export const checkAdminSession = async (): Promise<AdminProfile> => {
    try {
        return await apiFetch<AdminProfile>('/admin/me', {
            method: 'GET',
            isAdminRequest: true,
        });
    } catch (error) {
        // Логируем ошибку перед пробросом
        logger.error('Error checking admin session:', { 
            error: error instanceof Error ? error.message : String(error),
            status: error instanceof ApiError ? error.status : undefined
        });
        // Очищаем токены при 401/403 ошибке
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            localStorage.removeItem("admin_token");
            localStorage.removeItem("admin_data");
        }
        // Пробрасываем ошибку дальше для обработки в ensureAdminSession
        throw error; 
    }
};


// Handle token refresh from response headers (assuming apiFetch might handle this internally,
// but keeping it here if direct fetch calls are needed)
// This might become redundant if apiFetch handles token refresh globally.
export const handleTokenRefresh = (response: Response): void => {
  const refreshToken = response.headers.get("X-Refresh-Token");
  if (refreshToken) {
    const currentToken = localStorage.getItem("admin_token");
    if (currentToken !== refreshToken) {
      logger.info("Token changed, updating in localStorage");
      localStorage.setItem("admin_token", refreshToken);
      localStorage.setItem("admin_last_check_time", Date.now().toString());
    } else {
      logger.debug("Token unchanged, skipping update");
    }
  }
};


// Function for client-side slug availability check (basic validation)
export const checkSlugAvailability = async (
  slug: string
): Promise<{
  available: boolean;
  reason?: string;
  error?: string;
}> => {
  logger.debug("Checking availability of slug (client-side only)", { slug });

  // Basic validation on the client side
  if (!slug || slug.trim() === "") {
    return {
      available: false,
      reason: "URL не может быть пустым",
    };
  }

  if (slug.length < 3) {
    return {
      available: false,
      reason: "URL должен быть не менее 3 символов",
    };
  }

  if (/[^\x00-\x7F]/.test(slug)) {
    return {
      available: false,
      reason: "URL может содержать только латинские буквы, цифры и дефисы",
    };
  }

  const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (sanitizedSlug !== slug.toLowerCase()) {
    return {
      available: false,
      reason: "URL содержит недопустимые символы",
    };
  }

  // Check for reserved words
  const reservedSlugs = [
    "admin", "api", "dashboard", "auth", "login", "register", "settings", "profile",
  ];
  const slugLower = slug.toLowerCase();

  for (const reserved of reservedSlugs) {
    if (slugLower === reserved || slugLower.startsWith(`${reserved}-`)) {
      return {
        available: false,
        reason: `URL содержит зарезервированное слово "${reserved}"`,
      };
    }
  }

  // All checks passed, assume it's available (no server check)
  // In a real scenario, you'd call an API endpoint here.
  logger.info("Slug passed client-side validation", { slug });
  return {
    available: true,
  };
};

// Экспортируем интерфейс, если он нужен в других местах
// Убираем export для EventUpdateData, т.к. он теперь локальный
// export type { EventUpdateData }; 

export const getAdminProfile = async (adminId: string): Promise<AdminProfile> => {
  logger.info(`Fetching admin profile for ID: ${adminId}`);
  try {
    // Предполагаем, что такой эндпоинт существует
    const profile = await apiFetch<AdminProfile>(`/admins/${adminId}/profile`, {
      isAdminRequest: true // Убедимся, что это админский запрос
    });
    logger.info(`Admin profile for ${adminId} fetched successfully`);
    return profile;
  } catch (error) {
    logger.error(`Failed to fetch admin profile for ${adminId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new ApiError(500, { error: message });
  }
};