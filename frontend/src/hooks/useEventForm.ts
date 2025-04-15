import { useState, useCallback, useRef, useEffect } from 'react';
import { EventFormData, EventData } from '@/types/events';
import {
  updateEvent,
  fetchEvent,
  ensureAdminSession,
  prepareEventFormData,
  EventUpdateData,
} from "@/utils/eventAdminService";
import { apiFetch } from '@/utils/api';

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
        console.error(`Error fetching event: ${response.message || 'Unknown error'}`);
        if ('authError' in response && response.authError) {
          throw new Error("Сессия администратора истекла. Выполняется перенаправление на страницу входа...");
        } else {
          throw new Error('message' in response && response.message ? response.message : "Событие не найдено");
        }
      }
      
      if (!response.event) {
        throw new Error("Событие не найдено");
      }
      
      // Проверяем, что response.event имеет структуру EventData перед сохранением в кэш
      if ('title' in response.event && 
          'start_date' in response.event && 
          'price' in response.event && 
          'published' in response.event &&
          'created_at' in response.event &&
          'updated_at' in response.event) {
        // Приводим тип к EventData
        eventCache[eventId] = response.event as EventData;
      } else {
        console.warn('useEventForm: Received event data has unexpected structure');
        throw new Error("Полученные данные события имеют неверный формат");
      }
      
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

  const createEvent = useCallback(async (data: EventFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isSessionValid = await ensureAdminSession();
      if (!isSessionValid) {
        throw new Error("Сессия администратора истекла.");
      }

      const preparedData = prepareEventFormData(data);

      // Используем apiFetch для создания
      const result = await apiFetch<EventData>("/admin_edits/", {
        method: "POST",
        data: preparedData,
        isAdminRequest: true, // Указываем, что это админский запрос
      });

      if (mounted.current) {
        setSuccess("Мероприятие успешно создано");
        if (onSuccess) onSuccess(result);
      }
      return result;
    } catch (err) {
      if (mounted.current) {
        const errorMessage = (err as Error).message || "Ошибка при создании мероприятия";
        setError(errorMessage);
        if (onError) onError(err as Error);
      }
      return null;
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [onSuccess, onError]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Добавляем валидацию URL slug перед отправкой
    if (formData.url_slug && formData.url_slug.length < 3) {
      setError("URL мероприятия должен содержать не менее 3 символов.");
      setIsLoading(false);
      return;
    }
    if (formData.url_slug && /[^a-z0-9-]/.test(formData.url_slug)) {
      setError("URL мероприятия может содержать только латинские буквы, цифры и дефисы.");
      setIsLoading(false);
      return;
    }

    try {
      let response;
      if (formData.id) {
        // Используем updateEvent из eventAdminService
        // Передаем данные, убедившись, что image_file не null и исключив image_url
        const { image_url, ...restFormData } = formData; // Исключаем image_url
        const updateData: EventUpdateData = {
           ...restFormData,
           image_file: formData.image_file || undefined // Заменяем null на undefined
        };
        response = await updateEvent(String(formData.id), updateData);
      } else {
        // Используем createEvent (уже использует apiFetch)
        // createEvent теперь возвращает EventData
        const createdEventData = await createEvent(formData);
        // Передаем созданные данные в response для единообразия
        response = { success: true, message: "Мероприятие успешно создано", event: createdEventData };
      }

      if (!mounted.current) return;

      if (response.success) {
        setSuccess(response.message || (formData.id ? "Мероприятие обновлено" : "Мероприятие создано"));
        // Если есть данные события в ответе, передаем их в onSuccess
        if (response.event && typeof response.event === 'object' && 'id' in response.event) {
          // Убедимся, что передаем EventData
          if (onSuccess) onSuccess(response.event as EventData);
        } else {
           // Этот случай больше не должен происходить, так как createEvent возвращает EventData
           console.warn("onSuccess called without event data after creation/update");
           if (onSuccess) onSuccess(null as unknown as EventData); // Передаем null, если данных нет
        }
      } else {
        setError(response.message || "Произошла ошибка");
        if (onError) onError(new Error(response.message || "Произошла ошибка"));
      }
    } catch (err) {
      if (mounted.current) {
        setError((err as Error).message || "Произошла неизвестная ошибка");
        if (onError) onError(err as Error);
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [formData, onSuccess, onError, createEvent]);

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
    setError,
    setSuccess,
  };
};