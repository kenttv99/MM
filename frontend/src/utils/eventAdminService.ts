import {
  EventFormData,
  EventResponse,
  EventData,
} from "@/types/events";
import { createLogger } from "@/utils/logger";
import { apiFetch } from "@/utils/api"; // Удаляем неиспользуемый импорт APIOptions

// Создаем логгер для админского сервиса
const logger = createLogger("eventAdminService");

// Интерфейс для ошибок с возможным статус-кодом
interface ExtendedError extends Error {
  status?: number;
}

// --- Перенесенные функции из eventService.ts ---

export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();

  logger.debug("Preparing form data with fields:", { fields: Object.keys(eventData) });

  // Проверяем, что все основные поля присутствуют
  if (!eventData.title) {
    logger.warn("Missing required field 'title'");
  }

  // Добавляем ID события, если он есть
  if (eventData.id) {
    formData.append("id", eventData.id.toString());
    logger.debug("Added ID", { id: eventData.id });
  }

  formData.append("title", eventData.title);
  formData.append("description", eventData.description || "");

  if (eventData.start_date) {
    const startDateStr = eventData.start_date + (eventData.start_time ? `T${eventData.start_time}:00` : "");
    formData.append("start_date", startDateStr);
    logger.debug("Prepared start_date", { startDateStr });
  } else {
    logger.warn("Missing start_date");
  }

  if (eventData.end_date) {
    const endDateStr = eventData.end_date + (eventData.end_time ? `T${eventData.end_time}:00` : "");
    formData.append("end_date", endDateStr);
     logger.debug("Prepared end_date", { endDateStr });
  }

  if (eventData.location) {
    formData.append("location", eventData.location);
  }

  // Преобразуем числовые значения в строки
  formData.append("price", String(eventData.price || 0));
  formData.append("published", String(eventData.published || false));
  formData.append("status", eventData.status || "draft");
  formData.append("ticket_type_name", eventData.ticket_type_name || "standart");
  formData.append(
    "ticket_type_available_quantity",
    String(eventData.ticket_type_available_quantity || 0)
  );

  // Обработка файла изображения
  if (eventData.image_file) {
    formData.append("image_file", eventData.image_file);
    logger.debug("Added image file to form data", { name: eventData.image_file.name, size: eventData.image_file.size });
  }

  // Явно приводим булево значение к строке
  formData.append("remove_image", String(eventData.remove_image || false));

  // Добавляем url_slug, если он указан
  if (eventData.url_slug) {
    // CRITICAL: Final sanitization before adding to FormData
    // Ensure URL slug only contains ASCII a-z, 0-9, and hyphens
    const sanitizedSlug = eventData.url_slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") // Remove anything that's not a-z, 0-9, or hyphen
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens

    // Log the original and sanitized slug
    if (sanitizedSlug !== eventData.url_slug) {
       logger.debug("Re-sanitized URL slug", { from: eventData.url_slug, to: sanitizedSlug });
    }

    // Add the sanitized slug to the form data
    formData.append("url_slug", sanitizedSlug);
    logger.debug("Added url_slug", { sanitizedSlug });
  } else {
    logger.warn("URL slug is empty or undefined!");
  }

  // Добавляем created_at и updated_at с текущей датой в формате ISO
  const now = new Date().toISOString();
  formData.append("created_at", now);
  formData.append("updated_at", now);
  logger.debug("Added timestamps", { now });

  // Log the form data entries for debugging
  logFormDataContent(formData, "Form data prepared");

  return formData;
};

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

// Экспортируем интерфейс EventUpdateData
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
  image_file?: File;
  remove_image?: boolean;
  url_slug?: string;
  [key: string]: string | number | boolean | File | undefined; // More specific index signature
}

// Helper function to log the content of FormData for debugging
function logFormDataContent(formData: FormData, label: string): void {
  const entries: Record<string, string | { name: string, size: number }> = {};
  for (const pair of formData.entries()) {
    if (pair[1] instanceof File) {
      entries[pair[0]] = { name: (pair[1] as File).name, size: (pair[1] as File).size };
    } else {
      entries[pair[0]] = pair[1] as string;
    }
  }
  logger.debug(label, { formDataEntries: entries });
}

// This function specifically fixes the URL slug in the database using apiFetch
async function fixUrlSlug(eventId: string, correctSlug: string): Promise<boolean> {
   logger.debug("Fixing URL slug", { eventId, correctSlug });

  try {
    // Try PATCH first
    try {
       logger.debug("Attempting PATCH with JSON");
      const data = { url_slug: correctSlug };
      const result = await apiFetch<{ url_slug?: string }>(`/admin_edits/${eventId}/`, {
        method: "PATCH",
        data: data,
        isAdminRequest: true, // Mark as admin request
      }).catch(e => { throw e; }); // Ensure promise rejection is caught here

      if (result?.url_slug === correctSlug) {
         logger.debug("URL slug successfully fixed with PATCH", { correctSlug });
        return true;
      } else {
         logger.warn("PATCH returned different slug", { returned: result?.url_slug, expected: correctSlug });
      }
    } catch (patchError) {
       logger.warn("PATCH attempt failed", { error: (patchError as Error).message });
    }

    // Try PUT
    try {
       logger.debug("Attempting PUT with minimal JSON data");
      const data = {
        id: parseInt(eventId),
        url_slug: correctSlug,
        title: "No Change", // Placeholder for required field
      };
      const result = await apiFetch<{ url_slug?: string }>(`/admin_edits/${eventId}/`, {
        method: "PUT",
        data: data,
        isAdminRequest: true, // Mark as admin request
      }).catch(e => { throw e; }); // Ensure promise rejection is caught here

      if (result?.url_slug === correctSlug) {
         logger.debug("URL slug successfully fixed with PUT", { correctSlug });
        return true;
      } else {
         logger.warn("PUT returned different slug", { returned: result?.url_slug, expected: correctSlug });
      }
    } catch (putError) {
       logger.warn("PUT attempt failed", { error: (putError as Error).message });
    }

    // Try special admin endpoint
    try {
       logger.debug("Attempting to use direct admin endpoint for fixing URL");
      const result = await apiFetch<{ success?: boolean }>(`/admin/fix_url_slug/`, {
        method: "POST",
        data: {
          event_id: parseInt(eventId),
          url_slug: correctSlug,
          force: true,
        },
        isAdminRequest: true, // Mark as admin request
      }).catch(e => { throw e; }); // Ensure promise rejection is caught here

      if (result?.success) {
         logger.debug("URL slug successfully fixed with direct method");
        return true;
      } else {
         logger.warn("Direct fix returned failure", { result });
      }
    } catch (directError) {
       logger.warn("Direct fix attempt failed", { error: (directError as Error).message });
    }

    logger.error("All URL slug fix attempts failed");
    return false;
  } catch (error) {
     logger.error("Error in fixUrlSlug", { error: (error as Error).message });
    return false;
  }
}

// Try updating using a direct JSON approach instead of FormData using apiFetch
async function updateEventWithJson(
  eventId: string,
  eventData: EventUpdateData
): Promise<Record<string, unknown>> {
   logger.debug("Attempting to update event with JSON request", { eventId });

  // Prepare JSON data
  const jsonData = {
    ...eventData,
    // Ensure clean URL slug
    url_slug: eventData.url_slug
      ? eventData.url_slug
          .toLowerCase()
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
      : eventData.url_slug,
  };

  // Remove any File objects which can't be serialized to JSON
  delete jsonData.image_file;

  // If we need to remove the image, include that flag
  if (eventData.remove_image) {
    jsonData.remove_image = true;
  }

  logger.debug("JSON update data", { jsonData });
  logger.debug("URL slug for JSON request", { slug: jsonData.url_slug });

  // Make the request using apiFetch
  try {
    const result = await apiFetch<Record<string, unknown>>(`/admin_edits/${eventId}/`, {
        method: "PUT",
        data: jsonData,
        isAdminRequest: true, // Mark as admin request
    }).catch(e => { throw e; }); // Ensure promise rejection is caught here

    logger.debug("JSON update response", { result });
    return result;
  } catch (error) {
    const err = error as ExtendedError;
    logger.error("JSON update error", { status: err.status, message: err.message });
    throw new Error(`Failed to update with JSON: ${err.status || err.message}`);
  }
}

export const updateEvent = async (
  eventId: string,
  formData: EventUpdateData
): Promise<{
  success: boolean;
  message?: string;
  warningOnly?: boolean;
  event?: EventData | Record<string, unknown>; // Support both types
}> => {
  logger.info("Starting updateEvent", { eventId });
  try {
    // Validate required fields
    if (!formData.title || !formData.start_date) {
      return {
        success: false,
        message: "Необходимо заполнить обязательные поля",
      };
    }

    // Validate the admin session
    logger.debug("Checking admin session validity");
    const isSessionValid = await ensureAdminSession();
    logger.debug("Server validation result", { isSessionValid });
    if (!isSessionValid) {
      logger.warn("Admin session is invalid");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
      };
    }

    // Store original slug for comparison
    const originalSlug = formData.url_slug;
    logger.debug("Original URL slug", { originalSlug });

    // CRITICAL: Force ASCII-only characters in the URL slug
    const sanitizedSlug = originalSlug
      ? originalSlug
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "") // Remove anything that's not a-z, 0-9, or hyphen
          .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
          .replace(/^-+|-+$/g, "") // Remove leading and trailing hyphens
      : originalSlug;

    if (sanitizedSlug !== originalSlug) {
      logger.debug("Sanitized slug", { from: originalSlug, to: sanitizedSlug });
      // Force replacing the slug with our sanitized version
      formData.url_slug = sanitizedSlug;
    }

    // Create a copy of the form data for our requests
    const formDataCopy = { ...formData };
    logger.debug("Final URL slug for submission", { slug: formDataCopy.url_slug });

    // First try a JSON-based approach
    try {
      logger.debug("Attempting JSON-based update first");
      const jsonResult = await updateEventWithJson(eventId, formDataCopy);

      if (jsonResult && jsonResult.url_slug) {
        const serverSlug = jsonResult.url_slug as string;
        logger.debug("Server returned URL slug from JSON update", { serverSlug });

        // Check if the slug contains non-ASCII characters
        if (/[^\x00-\x7F]/.test(serverSlug)) {
          logger.warn("JSON update resulted in non-ASCII slug", { serverSlug });

          // Clean it
          const cleanServerSlug = serverSlug
            .replace(/[^\x00-\x7F]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "");

          // Fix it with a PATCH request
          logger.info("Fixing slug after JSON update...");
          await fixUrlSlug(eventId, cleanServerSlug);

          // Use the clean version
          jsonResult.url_slug = cleanServerSlug;
        } else {
          logger.debug("JSON update successful with clean slug", { serverSlug });
        }

        // Create display slug
        let fullSlug = jsonResult.url_slug as string;
        if (formData.start_date && formData.id) {
          const year = new Date(formData.start_date).getFullYear();
          fullSlug = `${jsonResult.url_slug as string}-${year}-${formData.id}`;
        }

        // Return success with the JSON result
        return {
          success: true,
          message: "Мероприятие успешно обновлено",
          event: {
            ...jsonResult,
            full_slug: fullSlug,
          },
        };
      } else {
        logger.warn("JSON update completed but no URL slug in response");
      }
    } catch (jsonError) {
      const error = jsonError as Error;
      logger.warn("JSON update failed, falling back to FormData", { message: error.message });
      // Continue with FormData approach on failure
    }

    // If we get here, use FormData approach
    logger.debug("Preparing FormData as fallback");

    // Prepare the form data
    const preparedData = prepareEventFormData(formDataCopy as EventFormData);
    logFormDataContent(preparedData, "BEFORE SENDING TO SERVER (FormData)");

    // Send the update request to the backend using apiFetch
    const updateUrl = `/admin_edits/${eventId}/`;
    logger.info("Making PUT request with FormData", { url: updateUrl });

    try {
      // Execute the request using apiFetch
      const result = await apiFetch<Record<string, unknown>>(updateUrl, {
        method: "PUT",
        data: preparedData, // Pass FormData as data
        isAdminRequest: true, // Mark as admin request
        headers: {
          // Let browser set Content-Type for FormData
        },
      }).catch(e => { throw e; }); // Ensure promise rejection is caught here

      logger.debug("Server response from FormData update", { result });

      // Check if server returned URL with a non-ASCII character
      if (result && result.url_slug) {
        const serverSlug = result.url_slug as string;
        logger.debug("Server returned URL slug from FormData", { serverSlug });

        // Log ASCII codes for debugging
        logger.debug("ASCII codes for server slug", { codes: serverSlug.split("").map((c: string) => c + ` (${c.charCodeAt(0)})`).join(", ") });

        // Force ASCII-only characters in the server response
        const cleanServerSlug = serverSlug
          .replace(/[^\x00-\x7F]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");

        if (cleanServerSlug !== serverSlug) {
          logger.warn("Server returned slug with non-ASCII chars (FormData)", { from: serverSlug, to: cleanServerSlug });
           logger.debug("Character difference at position", { index: [...serverSlug].findIndex((char, i) => i >= cleanServerSlug.length || char !== cleanServerSlug[i]) });

          // If the server returned a different slug, fix it
          logger.info("Server returned incorrect slug (FormData), attempting to fix...");
          const fixResult = await fixUrlSlug(eventId, cleanServerSlug);

          if (fixResult) {
            logger.info("Successfully fixed URL slug in database (FormData)");
            // Update the result with the fixed slug
            result.url_slug = cleanServerSlug;
          } else {
            logger.warn("Failed to fix URL slug (FormData), continuing with clean version in UI");
          }
        }

        // Create the display slug
        let fullSlug = cleanServerSlug;
        if (formData.start_date && formData.id) {
          const year = new Date(formData.start_date).getFullYear();
          fullSlug = `${cleanServerSlug}-${year}-${formData.id}`;
          logger.debug("Generated display slug", { fullSlug });
        }

        // Return the clean version
        return {
          success: true,
          message: "Мероприятие успешно обновлено",
          event: {
            ...result,
            url_slug: cleanServerSlug,
            full_slug: fullSlug,
          },
        };
      }

      // If no slug in result, return as is
      return {
        success: true,
        message: "Мероприятие успешно обновлено",
        event: result,
      };
    } catch (error) {
      // Handle errors from apiFetch
      const err = error as ExtendedError;
      logger.error("Error updating event with FormData", { status: err.status, message: err.message });

      // Handle specific auth errors
      if (err.status === 401) {
        logger.warn("Authentication error 401 in updateEvent (FormData), clearing session");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_data");
        return {
          success: false,
          message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        };
      }
      if (err.status === 403) {
        logger.warn("Authorization error 403 in updateEvent (FormData)");
        return {
          success: false,
          message: "У вас недостаточно прав для выполнения этой операции.",
        };
      }

      // General error message
      return {
        success: false,
        message: `Ошибка при обновлении мероприятия: ${err.message || "Неизвестная ошибка"}`,
      };
    }
  } catch (error) {
    // Catch errors from session check or other initial steps
    const err = error as Error;
    logger.error("Unexpected error in updateEvent", { message: err.message });
    return {
      success: false,
      message: `Ошибка при обновлении мероприятия: ${err.message || "Неизвестная ошибка"}`,
    };
  }
};

// Use apiFetch for fetching event details for admin
export const fetchEvent = async (eventId: string): Promise<EventResponse> => {
  logger.info("Starting fetchEvent for admin", { eventId });

  try {
    const url = `/admin_edits/${eventId}/`;
    logger.info("Making GET request for admin", { url });

    const result = await apiFetch<EventData>(url, {
        method: "GET",
        isAdminRequest: true, // Mark as admin request
    }).catch(e => { throw e; }); // Ensure promise rejection is caught here

    logger.debug("Received event data for admin", { eventId: result.id });

    // Check data structure (basic check)
    if (result && typeof result === 'object' && 'title' in result && 'start_date' in result) {
      return {
        success: true,
        message: "Данные мероприятия успешно получены",
        event: result,
      };
    } else {
      logger.warn("Received event data has unexpected structure", { result });
      return {
        success: false,
        message: "Полученные данные имеют неожиданную структуру",
      };
    }
  } catch (error) {
    const err = error as ExtendedError;
    logger.error("Error in fetchEvent for admin", { status: err.status, message: err.message });

    // Handle specific auth errors
    if (err.status === 401) {
      logger.warn("Authentication error 401 in fetchEvent (admin), clearing session");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
        authError: true,
      };
    }
    if (err.status === 403) {
      logger.warn("Authorization error 403 in fetchEvent (admin)");
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции.",
        authError: true,
      };
    }

    return {
      success: false,
      message: `Ошибка при получении данных мероприятия: ${err.message || "Неизвестная ошибка"}`,
    };
  }
};

// Function to ensure the admin session is valid before making requests
export const ensureAdminSession = async (): Promise<boolean> => {
  logger.debug("Checking admin session validity");

  try {
    const isValid = await checkAdminSession();
    logger.debug("Server validation result", { isValid });

    if (!isValid) {
      // Clear tokens if server says session is invalid
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
    }

    return isValid;
  } catch (serverError) {
    const err = serverError as Error;
    logger.error("Server validation failed", { message: err.message });
    // Clear tokens on any error during server validation
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    return false;
  }
};

// Function to check admin session on the server using apiFetch
export const checkAdminSession = async (): Promise<boolean> => {
  const adminToken = localStorage.getItem("admin_token");

  if (!adminToken) {
    logger.debug("No admin token found for checking");
    const error: ExtendedError = new Error("Не авторизован");
    error.status = 401;
    throw error;
  }

  // Check token locally first
  if (!validateTokenLocally(adminToken)) {
    logger.warn("Admin token is expired locally");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    const error: ExtendedError = new Error("Токен истек");
    error.status = 401;
    throw error;
  }

  // Check last check time for potential caching (optional, maybe remove for simplicity)
  const lastCheckTime = parseInt(localStorage.getItem("admin_last_check_time") || '0');
  const now = Date.now();
  if (now - lastCheckTime < 120000) { // Cache for 2 minutes
    logger.debug("Using cached session check result");
    return true;
  }

  try {
    logger.debug("Sending admin session check request to /admin/me");
    // Use apiFetch to check the session
    await apiFetch("/admin/me", {
      method: "GET",
      isAdminRequest: true, // Crucial: Mark as admin request
    }).catch(e => { throw e; }); // Ensure promise rejection is caught here

    // If apiFetch succeeds (status 200), session is valid
    localStorage.setItem("admin_last_check_time", now.toString());
    return true;

  } catch (error) {
    const err = error as ExtendedError;
    logger.error("Error checking admin session via apiFetch", { status: err.status, message: err.message });

    // If error is 401 or 403, clear tokens and re-throw
    if (err.status === 401 || err.status === 403) {
      logger.warn(`Session invalid with status ${err.status}`);
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      // Re-throw the original error with status
      throw error;
    }

    // For other errors (network, etc.), rely on local validation if token still seems valid
    if (validateTokenLocally(adminToken)) {
        logger.warn("Server check failed, but token valid locally. Assuming session OK.", { message: err.message });
        // Optionally update last check time to avoid rapid retries on network errors
        // localStorage.setItem("admin_last_check_time", now.toString());
        return true; // Cautiously return true based on local validation
    } else {
        // If local validation also fails, treat as auth error
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_data");
        const authError: ExtendedError = new Error("Токен недействителен (локальная проверка)");
        authError.status = 401;
        throw authError;
    }
  }
};

// --- Вспомогательные функции для токена ---
function validateTokenLocally(token: string): boolean {
  try {
    const expiry = getTokenExpiration(token);
    if (!expiry) return false;

    const now = Math.floor(Date.now() / 1000);
    return expiry > now;
  } catch (error) {
    logger.error("Error validating token locally", { error: (error as Error).message });
    return false;
  }
}

function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.exp || null;
  } catch (error) {
    logger.error("Error getting token expiration", { error: (error as Error).message });
    return null;
  }
}

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
