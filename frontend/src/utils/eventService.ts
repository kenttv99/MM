// frontend/src/utils/eventService.ts
import { EventFormData, EventResponse } from '@/types/events';

export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();
  
  console.log("eventService: Preparing form data with fields:", Object.keys(eventData));
  
  // Проверяем, что все основные поля присутствуют
  if (!eventData.title) {
    console.warn("eventService: Missing required field 'title'");
  }
  
  // Добавляем ID события, если он есть
  if (eventData.id) {
    formData.append("id", eventData.id.toString());
    console.log(`eventService: Added ID: ${eventData.id}`);
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
    // CRITICAL: Final sanitization before adding to FormData
    // Ensure URL slug only contains ASCII a-z, 0-9, and hyphens
    const sanitizedSlug = eventData.url_slug.toLowerCase()
      .replace(/[^a-z0-9-]/g, '')  // Remove anything that's not a-z, 0-9, or hyphen
      .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '');    // Remove leading and trailing hyphens
    
    // Log the original and sanitized slug
    if (sanitizedSlug !== eventData.url_slug) {
      console.log(`eventService: Re-sanitized URL slug from '${eventData.url_slug}' to '${sanitizedSlug}'`);
    }
    
    // Add the sanitized slug to the form data
    formData.append("url_slug", sanitizedSlug);
    console.log("eventService: Added url_slug:", sanitizedSlug);
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
export const prepareUrlSlug = (slug: string | undefined, eventId?: number): string | undefined => {
  if (!slug || slug.trim() === '') {
    console.log("prepareUrlSlug: slug is empty, returning undefined");
    return undefined;
  }
  
  console.log(`prepareUrlSlug: Original input slug before processing: "${slug}"`);
  
  // First step: comprehensive sanitization - remove non-ASCII characters and normalize
  let processedSlug = slug.replace(/[^\x00-\x7F]+/g, '');
  
  // Convert to lowercase and replace any non-alphanumeric characters with hyphens
  processedSlug = processedSlug.toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');    // Remove leading and trailing hyphens
  
  if (processedSlug !== slug) {
    console.log(`prepareUrlSlug: Sanitized slug from "${slug}" to "${processedSlug}"`);
  }
  
  // Skip transliteration step since we've already sanitized all non-ASCII characters
  
  // Check for reserved words
  const reservedSlugs = ['admin', 'api', 'dashboard', 'auth', 'login', 'register', 'settings', 'profile'];
  const slugLower = processedSlug.toLowerCase();
  
  for (const reserved of reservedSlugs) {
    if (slugLower === reserved || slugLower.startsWith(`${reserved}-`)) {
      console.warn(`prepareUrlSlug: Slug "${slugLower}" contains reserved word "${reserved}", adding prefix`);
      processedSlug = `event-${processedSlug}`;
      break;
    }
  }
  
  // Extract base slug without year and ID suffixes
  const baseSlug = extractBaseSlug(processedSlug);
  console.log(`prepareUrlSlug: Extracted base slug: "${baseSlug}" from "${processedSlug}"`);
  
  // Re-sanitize the base slug just to be sure
  let cleanSlug = baseSlug.toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // If the slug is empty or too short after processing, use a fallback
  if (!cleanSlug || cleanSlug.length < 3) {
    const prefix = eventId ? `event-${eventId}` : 'event';
    
    // If we have the original slug, try to use at least the first few characters
    if (slug.length >= 3) {
      const fixedSlug = slug.substring(0, 3).toLowerCase().replace(/[^a-z0-9-]+/g, '');
      if (fixedSlug.length >= 3) {
        cleanSlug = fixedSlug;
      } else {
        cleanSlug = prefix;
      }
    } else {
      cleanSlug = prefix;
    }
    
    console.warn(`prepareUrlSlug: Slug was empty or too short, using "${cleanSlug}" instead`);
  }
  
  // Truncate if the slug is too long (leave room for year-ID suffix)
  const maxBaseLength = 40; // Leave room for year and ID suffixes
  if (cleanSlug.length > maxBaseLength) {
    cleanSlug = cleanSlug.substring(0, maxBaseLength).replace(/-+$/g, ''); // Remove trailing hyphens
    console.warn(`prepareUrlSlug: Slug was too long, truncated to ${cleanSlug.length} chars: "${cleanSlug}"`);
  }
  
  // Make a final check to ensure the slug is valid
  if (cleanSlug !== baseSlug) {
    console.log(`prepareUrlSlug: Final base slug "${cleanSlug}" differs from extracted slug "${baseSlug}"`);
  }
  
  // Return the base slug for database storage - without year and ID suffix
  // The UI will display the full URL with suffixes
  console.log(`prepareUrlSlug: Input slug "${slug}" processed to final slug "${cleanSlug}"`);
  return cleanSlug;
};

// Helper function to extract the base slug without year and ID suffixes
function extractBaseSlug(slug: string): string {
  // Pattern to match potential "-YYYY-ID" or "-ID" suffix
  const yearIdPattern = /-\d{4}-\d+$/;  // Matches "-YYYY-ID" at the end
  const idPattern = /-\d+$/;            // Matches "-ID" at the end
  
  if (yearIdPattern.test(slug)) {
    // Remove "-YYYY-ID" suffix
    const baseSlug = slug.replace(yearIdPattern, '');
    console.log(`extractBaseSlug: Removed year-ID suffix from "${slug}" to get "${baseSlug}"`);
    return baseSlug;
  } else if (idPattern.test(slug)) {
    // Remove "-ID" suffix
    const baseSlug = slug.replace(idPattern, '');
    console.log(`extractBaseSlug: Removed ID suffix from "${slug}" to get "${baseSlug}"`);
    return baseSlug;
  }
  
  // No suffix found, return the original slug
  return slug;
}

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
      url_slug: prepareUrlSlug(eventData.url_slug, undefined)
    });
    
    // Логируем данные формы (без файла, если он есть)
    const formDataDebug = Object.fromEntries(
      Array.from(formData.entries())
        .filter(entry => !(entry[1] instanceof File))
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

// Define a type for event data - used for type consistency
interface EventUpdateData {
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
  console.log(`${label} - FormData contents:`);
  
  // Extract and log entries for debugging (FormData can't be directly inspected)
  for (const pair of formData.entries()) {
    // For files, just show name and size
    if (pair[1] instanceof File) {
      console.log(`  ${pair[0]}: [File: ${(pair[1] as File).name}, ${(pair[1] as File).size} bytes]`);
    } 
    // For string values, show the value and character codes if it's the URL slug
    else if (pair[0] === 'url_slug') {
      const value = pair[1] as string;
      console.log(`  ${pair[0]}: "${value}"`);
      console.log(`  ${pair[0]} character codes:`, value.split('').map((c: string) => c + ` (${c.charCodeAt(0)})`).join(', '));
    } 
    // For everything else, show the value
    else {
      console.log(`  ${pair[0]}: ${pair[1]}`);
    }
  }
}

// This function specifically fixes the URL slug in the database
async function fixUrlSlug(eventId: string, correctSlug: string): Promise<boolean> {
  console.log(`eventService: Fixing URL slug for event ${eventId}, setting to "${correctSlug}"`);
  
  const token = localStorage.getItem("admin_token");
  if (!token) {
    console.error("eventService: No admin token found for fixUrlSlug");
    return false;
  }
  
  try {
    // First try: Use PATCH request with JSON
    try {
      console.log(`eventService: Attempting PATCH with JSON`);
      
      // Only send the URL slug field in a dedicated PATCH request
      const data = { url_slug: correctSlug };
      console.log(`eventService: Sending PATCH with data:`, data);
      
      const response = await fetch(`/admin_edits/${eventId}/`, {
        method: 'PATCH',  // Use PATCH to update just one field
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',  // Use JSON instead of FormData
        },
        credentials: 'same-origin',
        body: JSON.stringify(data)  // Stringify the JSON data
      });
      
      console.log(`eventService: PATCH response status: ${response.status}`);
      
      if (response.ok) {
        // Try to parse response
        try {
          const result = await response.json();
          console.log(`eventService: PATCH response:`, result);
          
          if (result?.url_slug === correctSlug) {
            console.log(`eventService: URL slug successfully fixed with PATCH to "${correctSlug}"`);
            return true;
          } else {
            console.warn(`eventService: PATCH returned different slug: "${result?.url_slug}" vs "${correctSlug}"`);
            // Continue with other methods
          }
        } catch (parseError) {
          console.warn(`eventService: Error parsing PATCH response:`, parseError);
          // Continue with other methods
        }
      } else {
        // Log error details but continue with other methods
        const errorText = await response.text();
        console.warn(`eventService: PATCH failed: ${response.status} ${errorText}`);
      }
    } catch (patchError) {
      console.warn(`eventService: PATCH attempt failed:`, patchError);
      // Continue with other methods
    }
    
    // Second try: Use PUT request with JSON
    try {
      console.log(`eventService: Attempting PUT with minimal JSON data`);
      
      // Create minimal data set with just what's needed
      const data = {
        id: parseInt(eventId),
        url_slug: correctSlug,
        // Include required fields
        title: "No Change", // This will be ignored if the server validates properly
      };
      
      console.log(`eventService: Sending PUT with data:`, data);
      
      const response = await fetch(`/admin_edits/${eventId}/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });
      
      console.log(`eventService: PUT response status: ${response.status}`);
      
      if (response.ok) {
        try {
          const result = await response.json();
          console.log(`eventService: PUT response:`, result);
          
          if (result?.url_slug === correctSlug) {
            console.log(`eventService: URL slug successfully fixed with PUT to "${correctSlug}"`);
            return true;
          } else {
            console.warn(`eventService: PUT returned different slug: "${result?.url_slug}" vs "${correctSlug}"`);
            // Continue with other methods
          }
        } catch (parseError) {
          console.warn(`eventService: Error parsing PUT response:`, parseError);
          // Continue with direct SQL approach
        }
      } else {
        // Log error details
        const errorText = await response.text();
        console.warn(`eventService: PUT failed: ${response.status} ${errorText}`);
      }
    } catch (putError) {
      console.warn(`eventService: PUT attempt failed:`, putError);
    }
    
    // Last resort: Try to use a special admin endpoint for direct fixes
    try {
      console.log(`eventService: Attempting to use direct admin endpoint for fixing URL`);
      
      const response = await fetch(`/admin/fix_url_slug/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          event_id: parseInt(eventId),
          url_slug: correctSlug,
          force: true // Tell server to force the update
        })
      });
      
      console.log(`eventService: Direct fix response status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`eventService: Direct fix response:`, result);
        
        if (result?.success) {
          console.log(`eventService: URL slug successfully fixed with direct method`);
          return true;
        } else {
          console.warn(`eventService: Direct fix returned failure:`, result);
        }
      } else {
        const errorText = await response.text();
        console.warn(`eventService: Direct fix failed: ${response.status} ${errorText}`);
      }
    } catch (directError) {
      console.warn(`eventService: Direct fix attempt failed:`, directError);
    }
    
    // All attempts failed
    console.error(`eventService: All URL slug fix attempts failed`);
    return false;
  } catch (error) {
    console.error(`eventService: Error in fixUrlSlug:`, error);
    return false;
  }
}

// Try updating using a direct JSON approach instead of FormData
async function updateEventWithJson(eventId: string, eventData: EventUpdateData): Promise<Record<string, unknown>> {
  console.log(`eventService: Attempting to update event ${eventId} with JSON request`);
  
  const token = localStorage.getItem("admin_token");
  if (!token) {
    console.error(`eventService: No admin token found for JSON update`);
    throw new Error("No admin token available");
  }
  
  // Prepare JSON data
  const jsonData = {
    ...eventData,
    // Ensure clean URL slug
    url_slug: eventData.url_slug
      ? eventData.url_slug.toLowerCase()
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
      : eventData.url_slug
  };
  
  // Remove any File objects which can't be serialized to JSON
  delete jsonData.image_file;
  
  // If we need to remove the image, include that flag
  if (eventData.remove_image) {
    jsonData.remove_image = true;
  }
  
  console.log(`eventService: JSON update data:`, jsonData);
  console.log(`eventService: URL slug for JSON request: "${jsonData.url_slug}"`);
  
  // Make the request
  const response = await fetch(`/admin_edits/${eventId}/`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(jsonData)
  });
  
  console.log(`eventService: JSON update response status: ${response.status}`);
  
  if (!response.ok) {
    // Log the error in detail
    const errorText = await response.text();
    console.error(`eventService: JSON update error: ${response.status} ${errorText}`);
    throw new Error(`Failed to update with JSON: ${response.status}`);
  }
  
  // Parse and return the result
  const result = await response.json();
  console.log(`eventService: JSON update response:`, result);
  return result;
}

export const updateEvent = async (
  eventId: string,
  formData: EventUpdateData
): Promise<{
  success: boolean;
  message?: string;
  warningOnly?: boolean;
  event?: Record<string, unknown>; // Using unknown instead of any
}> => {
  console.log(`eventService: Starting updateEvent for ID: ${eventId}`);
  try {
    // Validate required fields
    if (!formData.title || !formData.start_date) {
      return {
        success: false,
        message: "Необходимо заполнить обязательные поля",
      };
    }

    // Retrieve the admin token from local storage
    const token = localStorage.getItem("admin_token");
    if (!token) {
      console.log("eventService: No admin token found for updateEvent");
      return {
        success: false,
        message: "Необходима авторизация администратора",
      };
    }

    // Validate the admin session
    console.log("eventService: Checking admin session validity");
    const isSessionValid = await ensureAdminSession();
    console.log(`eventService: Server validation result: ${isSessionValid}`);
    if (!isSessionValid) {
      console.log("eventService: Admin session is invalid");
      return {
        success: false,
        message: "Сессия администратора истекла. Необходимо войти заново.",
      };
    }

    // Store original slug for comparison
    const originalSlug = formData.url_slug;
    console.log(`eventService: Original URL slug: ${originalSlug}`);
    
    // CRITICAL: Force ASCII-only characters in the URL slug
    // This is the key fix - we need to ensure no invisible Cyrillic characters
    const sanitizedSlug = originalSlug ? originalSlug.toLowerCase()
      .replace(/[^a-z0-9-]/g, '')  // Remove anything that's not a-z, 0-9, or hyphen
      .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '')     // Remove leading and trailing hyphens
      : originalSlug;
    
    if (sanitizedSlug !== originalSlug) {
      console.log(`eventService: Sanitized slug: "${sanitizedSlug}" (Original: "${originalSlug}")`);
      // Force replacing the slug with our sanitized version
      formData.url_slug = sanitizedSlug;
    }
    
    // Create a copy of the form data for our requests
    const formDataCopy = { ...formData };
    console.log(`eventService: Final URL slug for submission: "${formDataCopy.url_slug}"`);

    // First try a JSON-based approach
    try {
      console.log(`eventService: Attempting JSON-based update first`);
      const jsonResult = await updateEventWithJson(eventId, formDataCopy);
      
      // Check if the server returned the correct slug
      if (jsonResult && jsonResult.url_slug) {
        const serverSlug = jsonResult.url_slug as string;
        console.log(`eventService: Server returned URL slug: "${serverSlug}" from JSON update`);
        
        // Check if the slug contains non-ASCII characters
        if (/[^\x00-\x7F]/.test(serverSlug)) {
          console.warn(`eventService: JSON update resulted in non-ASCII slug: "${serverSlug}"`);
          
          // Clean it
          const cleanServerSlug = serverSlug.replace(/[^\x00-\x7F]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
          
          // Fix it with a PATCH request
          console.log(`eventService: Fixing slug after JSON update...`);
          await fixUrlSlug(eventId, cleanServerSlug);
          
          // Use the clean version
          jsonResult.url_slug = cleanServerSlug;
        } else {
          console.log(`eventService: JSON update successful with clean slug: "${serverSlug}"`);
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
            full_slug: fullSlug
          }
        };
      } else {
        console.warn(`eventService: JSON update completed but no URL slug in response`);
      }
    } catch (jsonError) {
      const error = jsonError as Error;
      console.warn(`eventService: JSON update failed, falling back to FormData: ${error.message}`);
      // Continue with FormData approach on failure
    }

    // If we get here, either the JSON approach didn't work or 
    // we need to continue with the FormData approach
    console.log(`eventService: Preparing FormData as fallback`);
    
    // Prepare the form data
    const preparedData = prepareEventFormData(formDataCopy as EventFormData);
    logFormDataContent(preparedData, "BEFORE SENDING TO SERVER");
    
    // Send the update request to the backend
    const updateUrl = `/admin_edits/${eventId}/`;
    console.log(`eventService: Making PUT request to ${updateUrl}`);
    
    const response = await fetch(updateUrl, {
      method: "PUT", // This method is correct for updating events
      headers: {
        'Authorization': `Bearer ${token}`,
        // Not setting Content-Type for FormData
      },
      credentials: 'same-origin',
      body: preparedData
    });

    // Check for token refresh headers
    handleTokenRefresh(response);
    
    console.log(`eventService: Server response status: ${response.status}`);

    // Handle non-successful HTTP response
    if (response.status === 401) {
      console.log("eventService: Authentication error 401 in updateEvent, clearing session");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_data");
      return {
        success: false,
        message: "Ошибка аутентификации. Пожалуйста, войдите снова.",
      };
    }
    
    if (response.status === 403) {
      console.log("eventService: Authorization error 403 in updateEvent, NOT clearing session");
      
      // Try to get error text
      const errorText = await response.text();
      console.log("eventService: Error response body:", errorText);
      
      return {
        success: false,
        message: "У вас недостаточно прав для выполнения этой операции.",
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`eventService: Error updating event [${response.status}]:`, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          message: errorJson.detail || `Ошибка при обновлении мероприятия: ${response.statusText}`,
        };
      } catch {
        return {
          success: false,
          message: `Ошибка при обновлении мероприятия: ${response.statusText}. ${errorText}`,
        };
      }
    }

    // Get the raw text first to inspect it
    const responseText = await response.text();
    console.log(`eventService: Raw response from server: ${responseText}`);
    
    // Log character codes for specific problematic sequences that might be in the response
    if (responseText.includes("kirtan-mel")) {
      console.log("eventService: Response contains 'kirtan-mel', character codes:");
      const startIndex = responseText.indexOf("kirtan-mel");
      const endIndex = startIndex + "kirtan-mel".length + 5; // Include a few characters after
      const slugPart = responseText.substring(startIndex, endIndex);
      console.log(`  Extracted part: "${slugPart}"`);
      console.log(`  Character codes:`, slugPart.split('').map((c: string) => c + ` (${c.charCodeAt(0)})`).join(', '));
    }
    
    // Parse the successful response
    let result;
    try {
      result = JSON.parse(responseText);
      console.log(`eventService: Server response for event update:`, result);
    } catch (e) {
      console.error("eventService: Error parsing JSON response:", e);
      return {
        success: false,
        message: "Ошибка обработки ответа от сервера"
      };
    }
    
    // Check if server returned URL with a non-ASCII character
    if (result && result.url_slug) {
      const serverSlug = result.url_slug as string;
      console.log(`eventService: Server returned URL slug: "${serverSlug}"`);
      
      // Log ASCII codes for each character to detect invisible characters
      console.log("eventService: ASCII codes for server slug:", 
        serverSlug.split('').map((c: string) => c + ` (${c.charCodeAt(0)})`).join(', '));
      
      // Force ASCII-only characters in the server response
      const cleanServerSlug = serverSlug.replace(/[^\x00-\x7F]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      if (cleanServerSlug !== serverSlug) {
        console.warn(`eventService: Server returned slug with non-ASCII characters: "${serverSlug}" -> "${cleanServerSlug}"`);
        console.log(`eventService: Character difference at position:`, 
          [...serverSlug].findIndex((char, i) => i >= cleanServerSlug.length || char !== cleanServerSlug[i]));
        
        // If the server returned a different slug, make a dedicated PATCH request to fix it
        console.log(`eventService: Server returned incorrect slug, attempting to fix...`);
        const fixResult = await fixUrlSlug(eventId, cleanServerSlug);
        
        if (fixResult) {
          console.log(`eventService: Successfully fixed URL slug in database`);
          // Update the result with the fixed slug
          result.url_slug = cleanServerSlug;
        } else {
          console.warn(`eventService: Failed to fix URL slug, but continuing with clean version in UI`);
          // We'll still return the clean version in the UI
        }
      }
      
      // Create the display slug with year and ID for UI
      let fullSlug = cleanServerSlug;
      if (formData.start_date && formData.id) {
        const year = new Date(formData.start_date).getFullYear();
        fullSlug = `${cleanServerSlug}-${year}-${formData.id}`;
        console.log(`eventService: Generated display slug: ${fullSlug}`);
      }
      
      // Return the clean version
      return {
        success: true,
        message: "Мероприятие успешно обновлено",
        event: {
          ...result,
          url_slug: cleanServerSlug,
          full_slug: fullSlug
        },
      };
    }

    return {
      success: true,
      message: "Мероприятие успешно обновлено",
      event: result,
    };
  } catch (error) {
    const err = error as Error;
    console.error("eventService: Error updating event:", err);
    return {
      success: false,
      message: `Ошибка при обновлении мероприятия: ${err.message || "Неизвестная ошибка"}`,
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

// Extended Error type with status code
interface ExtendedError extends Error {
  status?: number;
}

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
    const error: ExtendedError = new Error("Не авторизован");
    error.status = 401;
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
      const error: ExtendedError = new Error(`Ошибка авторизации: ${response.status}`);
      error.status = response.status;
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
        } catch {
          // Игнорируем ошибки при попытке получить JSON
        }
        
        const error: ExtendedError = new Error(errorMessage);
        error.status = response.status;
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
    const authError: ExtendedError = new Error("Токен недействителен");
    authError.status = 401;
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

// Функция для диагностики проблем с URL
export const checkSlugAvailability = async (slug: string): Promise<{
  available: boolean;
  reason?: string;
  error?: string;
}> => {
  console.log(`eventService: Checking availability of slug "${slug}" (client-side only)`);
  
  // Basic validation on the client side
  if (!slug || slug.trim() === '') {
    return { 
      available: false,
      reason: "URL не может быть пустым"
    };
  }
  
  // Check length
  if (slug.length < 3) {
    return {
      available: false,
      reason: "URL должен быть не менее 3 символов"
    };
  }
  
  // Check for non-ASCII characters
  if (/[^\x00-\x7F]/.test(slug)) {
    return {
      available: false,
      reason: "URL может содержать только латинские буквы, цифры и дефисы"
    };
  }
  
  // Check for invalid characters
  const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  if (sanitizedSlug !== slug.toLowerCase()) {
    return {
      available: false,
      reason: "URL содержит недопустимые символы"
    };
  }
  
  // Check for reserved words
  const reservedSlugs = ['admin', 'api', 'dashboard', 'auth', 'login', 'register', 'settings', 'profile'];
  const slugLower = slug.toLowerCase();
  
  for (const reserved of reservedSlugs) {
    if (slugLower === reserved || slugLower.startsWith(`${reserved}-`)) {
      return {
        available: false,
        reason: `URL содержит зарезервированное слово "${reserved}"`
      };
    }
  }
  
  // All checks passed, assume it's available (no server check)
  return {
    available: true
  };
};