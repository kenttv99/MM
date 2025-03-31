// frontend/src/hooks/useEventForm.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { EventFormData, EventData } from '@/types/events';
import { createEvent, updateEvent, fetchEvent } from '@/utils/eventService';

// Global event cache to persist across renders
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
  
  // Track component lifecycle and prevent duplicate calls
  const mounted = useRef(true);
  const loadedEventId = useRef<string | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);

  // Handle component unmount
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pendingRequest.current) {
        pendingRequest.current.abort();
      }
    };
  }, []);

  // Update a single field in the form
  const setFieldValue = useCallback((name: keyof EventFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  // Handle form input changes
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

  // Handle file upload/removal
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

  // Submit the form
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mounted.current) return;
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    // Abort any pending request
    if (pendingRequest.current) {
      pendingRequest.current.abort();
    }
    pendingRequest.current = new AbortController();

    try {
      // Create or update event
      const result = formData.id
        ? await updateEvent(formData.id, formData)
        : await createEvent(formData);
      
      // Update cache
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
      pendingRequest.current = null;
    }
  }, [formData, onSuccess, onError]);

  // Load event data
  const loadEvent = useCallback(async (eventId: string): Promise<void> => {
    // Skip if already loaded or unmounted
    if (!mounted.current || loadedEventId.current === eventId) {
      return;
    }
    
    // Try cache first
    if (eventCache[eventId]) {
      console.log(`Loading event ${eventId} from cache`);
      const eventData = eventCache[eventId];
      
      // Parse dates from cached data
      const startDate = new Date(eventData.start_date);
      const endDate = eventData.end_date ? new Date(eventData.end_date) : undefined;
      
      const updatedFormData: EventFormData = {
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
      
      setFormData(updatedFormData);
      setImagePreview(eventData.image_url || null);
      loadedEventId.current = eventId;
      return;
    }
    
    // Need to fetch from API
    if (!mounted.current) return;
    setIsLoading(true);
    
    // Abort any pending request
    if (pendingRequest.current) {
      pendingRequest.current.abort();
    }
    pendingRequest.current = new AbortController();
    
    try {
      console.log(`Fetching event with ID: ${eventId}`);
      const eventData = await fetchEvent(eventId);
      
      // Cache the result
      eventCache[eventId] = eventData;
      
      if (!mounted.current) return;
      
      // Parse dates
      const startDate = new Date(eventData.start_date);
      const endDate = eventData.end_date ? new Date(eventData.end_date) : undefined;
      
      const updatedFormData: EventFormData = {
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
      
      setFormData(updatedFormData);
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
      pendingRequest.current = null;
    }
  }, [onError]);

  // Reset form to initial values
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