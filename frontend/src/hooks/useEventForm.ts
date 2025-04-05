import { useState, useCallback, useRef, useEffect } from 'react';
import { EventFormData, EventData } from '@/types/events';
import { createEvent, updateEvent, fetchEvent } from '@/utils/eventService';

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

  const loadEvent = useCallback(async (eventId: string): Promise<void> => {
    if (loadedEventId.current === eventId) {
      console.log(`Event ${eventId} already loaded, skipping fetch`);
      return;
    }
    
    if (isFetching.current) {
      console.log('Fetch already in progress, skipping duplicate request');
      return;
    }

    isFetching.current = true;
    
    if (eventCache[eventId]) {
      console.log(`Loading event ${eventId} from cache`);
      const cachedData = eventCache[eventId];
      const startDate = new Date(cachedData.start_date);
      const endDate = cachedData.end_date ? new Date(cachedData.end_date) : undefined;
      const mappedData: EventFormData = {
        ...cachedData,
        start_date: startDate.toISOString().split("T")[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate?.toISOString().split("T")[0] || "",
        end_time: endDate?.toTimeString().slice(0, 5) || "",
        ticket_type_name: cachedData.ticket_type?.name || "standart",
        ticket_type_available_quantity: cachedData.ticket_type?.available_quantity || 0,
        ticket_type_free_registration: cachedData.ticket_type?.free_registration || false,
        ticket_type_sold_quantity: cachedData.ticket_type?.sold_quantity || 0,
        registrations_count: cachedData.registrations_count || 0,
        image_file: null,
        remove_image: false,
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
      console.log(`Fetching event with ID: ${eventId}`);
      const eventData = await fetchEvent(eventId);
      eventCache[eventId] = eventData;
      
      if (!mounted.current) return;
      
      const startDate = new Date(eventData.start_date);
      const endDate = eventData.end_date ? new Date(eventData.end_date) : undefined;
      const mappedData: EventFormData = {
        ...eventData,
        start_date: startDate.toISOString().split("T")[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate?.toISOString().split("T")[0] || "",
        end_time: endDate?.toTimeString().slice(0, 5) || "",
        ticket_type_name: eventData.ticket_type?.name || "standart",
        ticket_type_available_quantity: eventData.ticket_type?.available_quantity || 0,
        ticket_type_free_registration: eventData.ticket_type?.free_registration || false,
        ticket_type_sold_quantity: eventData.ticket_type?.sold_quantity || 0,
        registrations_count: eventData.registrations_count || 0,
        image_file: null,
        remove_image: false,
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

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!mounted.current) return;
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    if (controller.current) {
      controller.current.abort();
    }
    
    controller.current = new AbortController();
    
    try {
      const result = formData.id
        ? await updateEvent(formData.id, formData)
        : await createEvent(formData);
      
      if (result && result.id) {
        eventCache[result.id.toString()] = result;
      }
      
      if (mounted.current) {
        setSuccess(formData.id ? "Мероприятие успешно обновлено" : "Мероприятие успешно создано");
      }
      
      if (onSuccess) onSuccess(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.log("Request aborted");
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
      
      if (mounted.current) {
        setError(errorMessage);
      }
      
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
      
      controller.current = null;
    }
  }, [formData, onSuccess, onError]);

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
  };
};