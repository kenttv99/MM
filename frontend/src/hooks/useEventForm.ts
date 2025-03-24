// frontend/src/hooks/useEventForm.ts
import { useState, useCallback } from 'react';
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

  // Установка значения поля формы
  const setFieldValue = useCallback((name: keyof EventFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  // Обработчик изменений полей формы
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === "number") {
      const numericValue = parseFloat(value) || 0;
      
      if (name === "ticket_type_available_quantity") {
        setFormData(prev => ({
          ...prev,
          ticket_type_available_quantity: numericValue
        }));
      } else if (name === "price") {
        setFormData(prev => ({ ...prev, price: numericValue }));
      } else {
        setFormData(prev => ({ ...prev, [name]: numericValue }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  // Обработчик изменения файла изображения
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

  // Отправка формы
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const result = formData.id 
        ? await updateEvent(formData.id, formData)
        : await createEvent(formData);
      
      setSuccess(formData.id ? "Мероприятие успешно обновлено" : "Мероприятие успешно создано");
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData, onSuccess, onError]);

  // Загрузка данных события
  const loadEvent = useCallback(async (eventId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const eventData = await fetchEvent(eventId);
      
      // Преобразуем даты и время
      const startDate = new Date(eventData.start_date);
      const endDate = eventData.end_date ? new Date(eventData.end_date) : undefined;
      
      setFormData({
        ...eventData,
        start_date: startDate.toISOString().split('T')[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate?.toISOString().split('T')[0],
        end_time: endDate?.toTimeString().slice(0, 5),
        ticket_type_name: eventData.ticket_type?.name || "standart",
        ticket_type_available_quantity: eventData.ticket_type?.available_quantity || 0,
        ticket_type_free_registration: eventData.ticket_type?.free_registration || false,
      });
      
      // Установка превью изображения
      if (eventData.image_url) {
        setImagePreview(eventData.image_url);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки данных";
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Сброс формы
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