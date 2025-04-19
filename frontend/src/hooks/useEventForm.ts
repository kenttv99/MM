import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EventFormData, EventData } from '@/types/events';
import {
  updateEvent,
  fetchEvent,
  ensureAdminSession,
  EventUpdateData,
} from "@/utils/eventAdminService";
import { createEvent } from "@/utils/eventAdminService";
import { ApiError } from '@/utils/api';

// Интерфейс для детализации ошибок валидации FastAPI
interface ValidationErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// Определяем EventCreateData локально (как и в eventAdminService)
// TODO: Вынести общие типы в отдельный файл
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
  image_file?: File | null;
}

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
  
  const router = useRouter();
  
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

  // Синхронизация formData и imagePreview с initialValues при их изменении
  useEffect(() => {
    setFormData(initialValues);
    setImagePreview(initialValues.image_url || null);
  }, [initialValues]);

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
      
      // Правильно извлекаем дату и время из datetime строк
      const startDateObj = new Date(cachedData.start_date);
      let startDate = '';
      let startTime = '';
      
      if (!isNaN(startDateObj.getTime())) {
        startDate = startDateObj.toISOString().split("T")[0];
        startTime = startDateObj.toTimeString().slice(0, 5);
      } else {
        console.warn('Invalid start date detected in cached data', cachedData.start_date);
        startDate = new Date().toISOString().split("T")[0];
        startTime = '00:00';
      }
      
      let endDate = '';
      let endTime = '';
      
      if (cachedData.end_date) {
        const endDateObj = new Date(cachedData.end_date);
        if (!isNaN(endDateObj.getTime())) {
          endDate = endDateObj.toISOString().split("T")[0];
          endTime = endDateObj.toTimeString().slice(0, 5);
        } else {
          console.warn('Invalid end date detected in cached data', cachedData.end_date);
        }
      }
      
      let cleanSlug = '';
      if (cachedData.url_slug) {
        const slugParts = cachedData.url_slug.split('-');
        if (slugParts.length > 2) {
          cleanSlug = slugParts.slice(0, -2).join('-');
        } else {
          cleanSlug = cachedData.url_slug;
        }
        console.log(`Processing slug: ${cachedData.url_slug} -> ${cleanSlug}`);
      }
      
      const mappedData: EventFormData = {
        ...cachedData,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
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
        throw new ApiError(401, { error: "Сессия администратора истекла. Обновите страницу или войдите заново.", authError: true });
      }
      
      console.log(`Fetching event with ID: ${eventId}`);
      const eventData = await fetchEvent(eventId, { bypassLoadingStageCheck: true });
      
      // Сохраняем в кеш
      eventCache[eventId] = eventData;
            
      if (!mounted.current) return;
      
      // Правильно извлекаем дату и время из datetime строк
      const startDateObj = new Date(eventData.start_date);
      let startDate = '';
      let startTime = '';
      
      if (!isNaN(startDateObj.getTime())) {
        startDate = startDateObj.toISOString().split("T")[0];
        startTime = startDateObj.toTimeString().slice(0, 5);
      } else {
        console.warn('Invalid start date detected from server', eventData.start_date);
        startDate = new Date().toISOString().split("T")[0];
        startTime = '00:00';
      }
      
      let endDate = '';
      let endTime = '';
      
      if (eventData.end_date) {
        const endDateObj = new Date(eventData.end_date);
        if (!isNaN(endDateObj.getTime())) {
          endDate = endDateObj.toISOString().split("T")[0];
          endTime = endDateObj.toTimeString().slice(0, 5);
        } else {
          console.warn('Invalid end date detected from server', eventData.end_date);
        }
      }
      
      let cleanSlug = '';
      if (eventData.url_slug) {
        const slugParts = eventData.url_slug.split('-');
        if (slugParts.length > 2) {
          cleanSlug = slugParts.slice(0, -2).join('-');
        } else {
          cleanSlug = eventData.url_slug;
        }
        console.log(`Processing slug from server: ${eventData.url_slug} -> ${cleanSlug}`);
      }
      
      const mappedData: EventFormData = {
        ...eventData,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
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
      
      let errorMessage = "Ошибка загрузки мероприятия";
      let errorToReport: Error = new Error(errorMessage);

      if (err instanceof ApiError) {
        errorToReport = err;
        // Пытаемся извлечь детализированное сообщение
        if (err.body?.detail) {
          if (Array.isArray(err.body.detail)) {
            // Указываем тип для e
            errorMessage = err.body.detail.map((e: ValidationErrorDetail) => `${e.loc?.join('.') || 'field'}: ${e.msg}`).join('; ');
          } else if (typeof err.body.detail === 'string') {
            errorMessage = err.body.detail;
          } else {
             errorMessage = JSON.stringify(err.body.detail); // Если detail не строка/массив
          }
        } else {
           // Фоллбэк на другие поля или стандартное сообщение
           errorMessage = err.body?.message || err.body?.error || err.message || errorMessage;
        }
        
        if (err.body?.authError) {
           console.warn("Auth error during loadEvent, redirecting...");
           router.push('/admin-login'); 
           return; 
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
        errorToReport = err;
      } else {
        // Для неизвестных типов ошибок
        errorMessage = "Произошла неизвестная ошибка при загрузке.";
        errorToReport = new Error(errorMessage);
      }

      // Убедимся, что устанавливаем строку
      setError(String(errorMessage)); 
      
      if (onError) {
        onError(errorToReport);
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
      
      isFetching.current = false;
      controller.current = null;
    }
  }, [onError, router]);

  const createEventInternal = useCallback(async (data: EventFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isSessionValid = await ensureAdminSession();
      if (!isSessionValid) {
        throw new ApiError(401, { error: "Сессия администратора истекла.", authError: true });
      }

      // ВАЖНО: eventAdminService.createEvent отправляет JSON, а не FormData
      // eventAdminService.createEvent был импортирован отдельно
      // Передаем bypassLoadingStageCheck
      const createdEventData = await createEvent(data as unknown as EventCreateData, { bypassLoadingStageCheck: true }); 

      if (mounted.current) {
        setSuccess("Мероприятие успешно создано");
        if (onSuccess) onSuccess(createdEventData);
      }
      return createdEventData; // Возвращаем EventData
    } catch (err) {
      if (mounted.current) {
        let errorMessage = "Ошибка при создании мероприятия";
        let errorToReport: Error = new Error(errorMessage);

        if (err instanceof ApiError) {
          errorToReport = err;
           if (err.body?.detail) {
            if (Array.isArray(err.body.detail)) {
              // Указываем тип для e
              errorMessage = err.body.detail.map((e: ValidationErrorDetail) => `${e.loc?.join('.') || 'field'}: ${e.msg}`).join('; ');
            } else if (typeof err.body.detail === 'string') {
              errorMessage = err.body.detail;
            } else {
              errorMessage = JSON.stringify(err.body.detail); 
            }
          } else {
             errorMessage = err.body?.message || err.body?.error || err.message || errorMessage;
          }
          
          if (err.body?.authError) {
             console.warn("Auth error during createEventInternal, redirecting...");
             router.push('/admin-login'); 
             return null; 
          }
        } else if (err instanceof Error) {
          errorMessage = err.message;
          errorToReport = err;
        } else {
          errorMessage = "Произошла неизвестная ошибка при создании.";
          errorToReport = new Error(errorMessage);
        }
        setError(String(errorMessage)); 
        if (onError) onError(errorToReport);
      }
      return null; 
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [onSuccess, onError, router]); // Добавляем eventAdminService.createEvent в зависимости, если нужно

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Валидация URL
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
      // Комбинируем дату и время перед отправкой на сервер
      const dataToSubmit = { ...formData };
      
      // Преобразуем дату и время начала в формат ISO для сервера
      if (dataToSubmit.start_date && dataToSubmit.start_time) {
        try {
          const startDateTime = new Date(`${dataToSubmit.start_date}T${dataToSubmit.start_time}`);
          if (!isNaN(startDateTime.getTime())) {
            dataToSubmit.start_date = startDateTime.toISOString();
          }
        } catch (err) {
          console.error("Error formatting start date:", err);
        }
      }
      
      // Преобразуем дату и время окончания в формат ISO для сервера
      if (dataToSubmit.end_date && dataToSubmit.end_time) {
        try {
          const endDateTime = new Date(`${dataToSubmit.end_date}T${dataToSubmit.end_time}`);
          if (!isNaN(endDateTime.getTime())) {
            dataToSubmit.end_date = endDateTime.toISOString();
          }
        } catch (err) {
          console.error("Error formatting end date:", err);
        }
      }
      
      let resultEventData: EventData;
      if (formData.id) {
        // updateEvent ожидает EventUpdateData
        // Явно создаем объект updateData с нужными полями и типами
        const updateData: EventUpdateData = {
          // Обязательные и опциональные поля из EventUpdateData
          id: formData.id,
          title: formData.title,
          description: formData.description,
          start_date: dataToSubmit.start_date,
          end_date: dataToSubmit.end_date,
          location: formData.location,
          price: Number(formData.price || 0),
          published: Boolean(formData.published),
          status: formData.status,
          ticket_type_name: formData.ticket_type_name,
          ticket_type_available_quantity: Number(formData.ticket_type_available_quantity || 0),
          image_file: formData.image_file || undefined, // Передаем File или undefined
          remove_image: formData.remove_image,
          url_slug: formData.url_slug,
          // Не включаем: start_time, end_time, image_url, ticket_type_sold_quantity, registrations_count, url_slug_changed
          // т.к. их нет в определении EventUpdateData в eventAdminService.ts
        };

        // Передаем bypassLoadingStageCheck
        resultEventData = await updateEvent(String(formData.id), updateData, { bypassLoadingStageCheck: true });
      } else {
        // Для создания нового события подготавливаем данные формы
        // Изменяем start_date и end_date в formData для отправки
        const formDataCopy = { ...formData };
        formDataCopy.start_date = dataToSubmit.start_date;
        formDataCopy.end_date = dataToSubmit.end_date;
        
        // Используем адаптированную внутреннюю функцию
        const createdEvent = await createEventInternal(formDataCopy);
        if (!createdEvent) { // Если createEventInternal вернула null (ошибка)
          // Ошибка уже установлена в setError внутри createEventInternal
          return; // Прерываем выполнение handleSubmit
        }
        resultEventData = createdEvent;
      }

      if (!mounted.current) return;

      // Успех
      setSuccess(formData.id ? "Мероприятие успешно обновлено" : "Мероприятие успешно создано");
      if (onSuccess) {
        onSuccess(resultEventData); // Передаем полученные EventData
      }

    } catch (err) {
      if (mounted.current) {
        let errorMessage = formData.id ? "Ошибка при обновлении мероприятия" : "Ошибка при создании мероприятия";
        let errorToReport: Error = new Error(errorMessage);

         if (err instanceof ApiError) {
          errorToReport = err;
           if (err.body?.detail) {
            if (Array.isArray(err.body.detail)) {
              // Указываем тип для e
              errorMessage = err.body.detail.map((e: ValidationErrorDetail) => `${e.loc?.join('.') || 'field'}: ${e.msg}`).join('; ');
            } else if (typeof err.body.detail === 'string') {
              errorMessage = err.body.detail;
            } else {
              errorMessage = JSON.stringify(err.body.detail);
            }
          } else {
            errorMessage = err.body?.message || err.body?.error || err.message || errorMessage;
          }
          
           if (err.body?.authError) {
             console.warn("Auth error during handleSubmit, redirecting...");
             router.push('/admin-login'); 
             return; 
          }
        } else if (err instanceof Error) {
          errorMessage = err.message;
          errorToReport = err;
        } else {
          errorMessage = "Произошла неизвестная ошибка при сохранении.";
          errorToReport = new Error(errorMessage);
        }
        setError(String(errorMessage)); 
        if (onError) onError(errorToReport);
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, onSuccess, onError, createEventInternal, updateEvent, router]); // Добавили updateEvent

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