// frontend/src/hooks/useEventForm.ts
import { useState, useCallback, useRef } from 'react';
import { EventFormData, EventData } from '@/types/events';
import { createEvent, updateEvent, fetchEvent } from '@/utils/eventService';

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
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialValues.image_url || null
  );
  
  const currentRequestRef = useRef<AbortController | null>(null);
  // Удаляем loadEventAttempted, так как он блокирует повторные запросы
  // const loadEventAttempted = useRef<Set<string>>(new Set());

  const setFieldValue = useCallback((name: keyof EventFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFieldValue(name as keyof EventFormData, checked);
    } else if (type === "number") {
      const numericValue = parseFloat(value) || 0;
      setFieldValue(name as keyof EventFormData, numericValue);
    } else {
      setFieldValue(name as keyof EventFormData, value);
    }
  }, [setFieldValue]);

  const handleFileChange = useCallback((file: File | null, isRemoved = false) => {
    setFormData(prev => ({ 
      ...prev, 
      image_file: file,
      remove_image: isRemoved 
    }));

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else if (isRemoved) {
      setImagePreview(null);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
      currentRequestRef.current = new AbortController();
      
      const result = formData.id 
        ? await updateEvent(formData.id, formData)
        : await createEvent(formData);
      
      setSuccess(formData.id ? "Мероприятие успешно обновлено" : "Мероприятие успешно создано");
      if (onSuccess) onSuccess(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Submit request aborted');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(errorMessage);
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      currentRequestRef.current = null;
    }
  }, [formData, onSuccess, onError]);

  const loadEvent = useCallback(async (eventId: string) => {
    // Удаляем проверку loadEventAttempted
    setIsLoading(true);
    setError(null);
    
    try {
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
      currentRequestRef.current = new AbortController();
      
      console.log(`Fetching event with ID: ${eventId}`);
      const eventData = await fetchEvent(eventId);
      console.log("Fetched event data:", eventData);
      
      const startDate = new Date(eventData.start_date);
      const endDate = eventData.end_date ? new Date(eventData.end_date) : undefined;
      
      const updatedFormData = {
        ...eventData,
        start_date: startDate.toISOString().split('T')[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate?.toISOString().split('T')[0] || "",
        end_time: endDate?.toTimeString().slice(0, 5) || "",
        ticket_type_name: eventData.ticket_type?.name || "standart",
        ticket_type_available_quantity: eventData.ticket_type?.available_quantity || 0,
        ticket_type_free_registration: eventData.ticket_type?.free_registration || false,
        ticket_type_sold_quantity: eventData.ticket_type?.sold_quantity || 0,
        registrations_count: eventData.registrations_count || 0,
      };
      
      setFormData(updatedFormData);
      if (eventData.image_url) setImagePreview(eventData.image_url);
      setSuccess(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Load event request aborted');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки данных";
      console.error("Load event error:", errorMessage);
      setError(errorMessage);
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      currentRequestRef.current = null;
    }
  }, [onError]);

  const resetForm = useCallback(() => {
    setFormData(initialValues);
    setImagePreview(initialValues.image_url || null);
    setError(null);
    setSuccess(null);
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
    setFieldValue
  };
};