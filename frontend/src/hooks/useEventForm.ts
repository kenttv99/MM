import { useState, useCallback, useRef, useEffect } from 'react';
import { EventFormData, EventData } from '@/types/events';
import { createEvent, updateEvent, fetchEvent, ensureAdminSession } from '@/utils/eventService';

const eventCache: Record<string, EventData> = {};

interface UseEventFormOptions {
  initialValues: EventFormData;
  onSuccess?: (data: EventData) => void;
  onError?: (error: Error) => void;
}

export const useEventForm = ({ initialValues, onSuccess, onError }: UseEventFormOptions) => {
  const [formData, setFormData] = useState<EventFormData>(initialValues);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialValues.image_url || null);
  
  const mounted = useRef(true);
  const isFetching = useRef(false);
  const loadedEventId = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (controller.current) {
        controller.current.abort();
        controller.current = null;
      }
    };
  }, []);

  const setFieldValue = useCallback((name: keyof EventFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Валидация для url_slug (только латиница, цифры и дефисы)
    if (name === 'url_slug') {
      // Фильтруем входную строку, оставляя только разрешенные символы
      const filteredValue = value.toLowerCase().split('').filter(char => {
        return /[a-z0-9\-]/.test(char);
      }).join('');
      
      // Заменяем множественные дефисы одним
      const processedValue = filteredValue.replace(/\-{2,}/g, '-');
      
      setFieldValue(name as keyof EventFormData, processedValue);
      return;
    }
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFieldValue(name as keyof EventFormData, checked);
    } else if (type === "number") {
      // Убираем ведущие нули и преобразуем в число
      const cleanedValue = value.replace(/^0+(?=\d)/, ""); // Удаляем ведущие нули, если за ними следуют цифры
      const numericValue = cleanedValue === "" ? 0 : parseFloat(cleanedValue) || 0;
      setFieldValue(name as keyof EventFormData, numericValue);
      // Синхронизируем значение в DOM
      e.target.value = numericValue.toString();
    } else {
      setFieldValue(name as keyof EventFormData, value);
    }
  }, [setFieldValue]);

  const handleFileChange = useCallback((file: File | null, isRemoved = false) => {
    setFormData(prev => ({
      ...prev,
      image_file: file,
      remove_image: isRemoved,
    }));

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else if (isRemoved) {
      setImagePreview(null);
    }
  }, []);

  const loadEvent = useCallback(async (eventId: string, forceRefresh = false): Promise<void> => {
    if (loadedEventId.current === eventId && !forceRefresh) {
      console.log(`Event ${eventId} already loaded, skipping fetch`);
      return;
    }
    
    if (isFetching.current) {
      console.log('Fetch already in progress, skipping duplicate request');
      return;
    }

    isFetching.current = true;
    
    if (forceRefresh && eventCache[eventId]) {
      console.log(`Force refreshing event ${eventId}, clearing cache`);
      delete eventCache[eventId];
    } else if (eventCache[eventId] && !forceRefresh) {
      console.log(`Loading event ${eventId} from cache`);
      const cachedData = eventCache[eventId];
      const startDate = new Date(cachedData.start_date);
      const endDate = cachedData.end_date ? new Date(cachedData.end_date) : undefined;
      
      // Извлекаем слаг без года и ID (формат: slug-год-ID)
      let cleanSlug = '';
      if (cachedData.url_slug) {
        // Разбиваем по дефисам и удаляем две последние части (год и ID)
        const slugParts = cachedData.url_slug.split('-');
        if (slugParts.length > 2) {
          cleanSlug = slugParts.slice(0, -2).join('-');
        } else {
          // Если частей меньше 3, используем как есть (возможно, это уже чистый слаг)
          cleanSlug = cachedData.url_slug;
        }
        console.log(`Processing slug: ${cachedData.url_slug} -> ${cleanSlug}`);
      }
      
      const mappedData: EventFormData = {
        ...cachedData,
        start_date: startDate.toISOString().split("T")[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate?.toISOString().split("T")[0] || "",
        end_time: endDate?.toTimeString().slice(0, 5) || "",
        ticket_type_name: cachedData.ticket_type?.name || "standart",
        ticket_type_available_quantity: cachedData.ticket_type?.available_quantity || 0,
        ticket_type_sold_quantity: cachedData.ticket_type?.sold_quantity || 0,
        registrations_count: cachedData.registrations_count || 0,
        image_file: null,
        remove_image: false,
        url_slug: cleanSlug,
        status: cachedData.status || 'draft',
        published: !!cachedData.published,
      };
      
      if (mounted.current) {
        setFormData(mappedData);
        if (cachedData.image_url) {
          setImagePreview(cachedData.image_url);
        }
        loadedEventId.current = eventId;
      }
      
      isFetching.current = false;
      return;
    }
    
    if (!mounted.current) {
      isFetching.current = false;
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    if (controller.current) {
      controller.current.abort();
    }
    
    controller.current = new AbortController();
    
    try {
      // Check admin session validity before loading
      const isSessionValid = await ensureAdminSession();
      if (!isSessionValid) {
        throw new Error("Сессия администратора истекла. Выполняется перенаправление на страницу входа...");
      }
      
      console.log(`Fetching event with ID: ${eventId}`);
      const response = await fetchEvent(eventId);
      
      if (!response.success) {
        console.error(`Error fetching event: ${response.message}`);
        if (response.authError) {
          throw new Error("Сессия администратора истекла. Выполняется перенаправление на страницу входа...");
        } else {
          throw new Error(response.message);
        }
      }
      
      if (!response.event) {
        throw new Error("Событие не найдено");
      }
      
      eventCache[eventId] = response.event;
      
      if (!mounted.current) return;
      
      const eventData = response.event;
      const startDate = new Date(eventData.start_date);
      const endDate = eventData.end_date ? new Date(eventData.end_date) : undefined;
      
      // Извлекаем слаг без года и ID (формат: slug-год-ID)
      let cleanSlug = '';
      if (eventData.url_slug) {
        // Разбиваем по дефисам и удаляем две последние части (год и ID)
        const slugParts = eventData.url_slug.split('-');
        if (slugParts.length > 2) {
          cleanSlug = slugParts.slice(0, -2).join('-');
        } else {
          // Если частей меньше 3, используем как есть (возможно, это уже чистый слаг)
          cleanSlug = eventData.url_slug;
        }
        console.log(`Processing slug from server: ${eventData.url_slug} -> ${cleanSlug}`);
      }
      
      const mappedData: EventFormData = {
        ...eventData,
        start_date: startDate.toISOString().split("T")[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate?.toISOString().split("T")[0] || "",
        end_time: endDate?.toTimeString().slice(0, 5) || "",
        ticket_type_name: eventData.ticket_type?.name || "standart",
        ticket_type_available_quantity: eventData.ticket_type?.available_quantity || 0,
        ticket_type_sold_quantity: eventData.ticket_type?.sold_quantity || 0,
        registrations_count: eventData.registrations_count || 0,
        image_file: null,
        remove_image: false,
        url_slug: cleanSlug,
        status: eventData.status || 'draft',
        published: !!eventData.published,
      };
      
      setFormData(mappedData);
      if (eventData.image_url) {
        setImagePreview(eventData.image_url);
      }
      
      loadedEventId.current = eventId;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.log("Fetch request aborted");
        return;
      }
      
      if (!mounted.current) return;
      
      const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки мероприятия";
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
      
      isFetching.current = false;
      controller.current = null;
    }
  }, [onError]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('useEventForm: Starting form submission');
      
      // Проверяем токен напрямую вместо вызова ensureAdminSession
      const token = localStorage.getItem("admin_token");
      let isValidSession = false;
      
      if (token) {
        try {
          // Проверяем токен локально
          const payload = JSON.parse(atob(token.split('.')[1]));
          const now = Math.floor(Date.now() / 1000);
          isValidSession = payload && payload.exp && payload.exp > now;
          console.log(`useEventForm: Token validation: expires ${new Date(payload.exp * 1000).toISOString()}, now ${new Date(now * 1000).toISOString()}`);
        } catch (e) {
          console.error('useEventForm: Error validating token locally:', e);
          isValidSession = false;
        }
      }
      
      if (!isValidSession) {
        console.log('useEventForm: Admin session is invalid');
        setError('Сессия истекла. Перенаправление на страницу входа...');
        
        // Store form data for recovery
        localStorage.setItem('event_form_draft', JSON.stringify(formData));
        
        setTimeout(() => {
          window.location.href = "/admin-login";
        }, 1500);
        
        setIsLoading(false);
        return;
      }
      
      console.log('useEventForm: Admin session is valid, proceeding with submission');
      
      // Store form data in localStorage in case we need to restore it after login
      localStorage.setItem('event_form_draft', JSON.stringify(formData));
      
      // Clean up the URL slug before submission by removing leading/trailing hyphens
      const cleanedFormData = { ...formData };
      if (cleanedFormData.url_slug) {
        cleanedFormData.url_slug = cleanedFormData.url_slug.replace(/^\-|\-$/g, '');
      }
      
      // Убедимся, что URL slug не пустой
      if (!cleanedFormData.url_slug || cleanedFormData.url_slug.trim() === '') {
        // Генерируем URL slug из названия, если он не задан
        const titleSlug = cleanedFormData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-') // заменяем все не букво-цифровые символы на дефис
          .replace(/^\-+|\-+$/g, '');   // убираем начальные и конечные дефисы
        
        if (titleSlug) {
          cleanedFormData.url_slug = titleSlug;
          console.log('useEventForm: Generated URL slug from title:', titleSlug);
        } else {
          cleanedFormData.url_slug = `event-${Date.now()}`;
          console.log('useEventForm: Generated fallback URL slug:', cleanedFormData.url_slug);
        }
      }

      console.log(`useEventForm: Submitting ${formData.id ? 'update' : 'create'} request`);
      console.log('useEventForm: FormData keys:', Object.keys(cleanedFormData));
      console.log('useEventForm: URL slug:', cleanedFormData.url_slug);
      
      const result = formData.id
        ? await updateEvent(formData.id, cleanedFormData)
        : await createEvent(cleanedFormData);
      
      // Handle structured error responses
      if (!result.success) {
        console.log('useEventForm: Received error response:', result);
        
        if (result.authError) {
          // Проверяем сообщение об ошибке 403 Forbidden (недостаточно прав)
          const isForbiddenError = result.message && (
            result.message.includes('недостаточно прав') || 
            result.message.includes('не авторизованы') ||
            result.message.includes('нет доступа')
          );
          
          if (isForbiddenError) {
            // Показываем ошибку о недостатке прав, но не делаем редирект
            console.log('useEventForm: Forbidden error (403), no redirect needed');
            setError(result.message);
            
            // Сохраняем черновик формы на случай повторной попытки
            localStorage.setItem('event_form_draft', JSON.stringify(formData));
            console.log('useEventForm: Form draft saved for later retry');
            
            setIsLoading(false);
            return;
          }
          
          // Проверяем текущий токен, чтобы выяснить статус авторизации
          const token = localStorage.getItem("admin_token");
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              console.log('useEventForm: Current token sub:', payload.sub);
              console.log('useEventForm: Current token exp:', new Date(payload.exp * 1000).toISOString());
            } catch (e) {
              console.error('useEventForm: Could not parse current token:', e);
            }
          } else {
            console.log('useEventForm: No token found on auth error');
          }
          
          // Другая ошибка авторизации - сохраняем данные формы и делаем редирект
          setError(`${result.message} Перенаправление на страницу входа...`);
          
          // Wait a moment to show the error message
          setTimeout(() => {
            console.log('useEventForm: Redirecting to login due to auth error');
            window.location.href = "/admin-login";
          }, 2000);
          
          setIsLoading(false);
          return;
        } else {
          // Regular error - just show the message
          setError(result.message);
          setIsLoading(false);
          return;
        }
      }
      
      // Success case
      console.log('useEventForm: Submission successful');
      if (result.event && result.event.id) {
        eventCache[result.event.id.toString()] = result.event;
        // Clear the draft on success
        localStorage.removeItem('event_form_draft');
      }
      
      if (mounted.current) {
        setSuccess(formData.id ? "Мероприятие успешно обновлено" : "Мероприятие успешно создано");
      }
      
      if (onSuccess && result.event) onSuccess(result.event);
    } catch (err) {
      console.error('useEventForm: Unhandled error during submission:', err);
      const errorMessage = err instanceof Error ? err.message : 'Произошла неизвестная ошибка';
      
      // Only show error message if component is still mounted
      if (mounted.current) {
        setError(errorMessage);
      }
      
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      // Only update loading state if component is still mounted
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [formData, isLoading, onSuccess, onError]);

  const resetForm = useCallback(() => {
    if (!mounted.current) return;
    
    setFormData(initialValues);
    setImagePreview(initialValues.image_url || null);
    setError(null);
    setSuccess(null);
    loadedEventId.current = null;
  }, [initialValues]);

  return {
    formData,
    isLoading,
    error,
    success,
    imagePreview,
    handleChange,
    handleFileChange,
    handleSubmit,
    resetForm,
    loadEvent,
    setFieldValue,
    setImagePreview,
  };
};