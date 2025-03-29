// frontend/src/utils/eventService.ts
import { EventFormData, EventData } from '@/types/events';

export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();
  
  formData.append("title", eventData.title);
  formData.append("description", eventData.description || "");
  formData.append("start_date", eventData.start_date + (eventData.start_time ? `T${eventData.start_time}:00Z` : ""));
  
  if (eventData.end_date) {
    formData.append("end_date", eventData.end_date + (eventData.end_time ? `T${eventData.end_time}:00Z` : ""));
  }
  
  if (eventData.location) {
    formData.append("location", eventData.location);
  }
  
  formData.append("price", String(eventData.price));
  formData.append("published", String(eventData.published));
  formData.append("created_at", eventData.created_at || new Date().toISOString());
  formData.append("updated_at", eventData.updated_at || new Date().toISOString());
  formData.append("status", eventData.status);
  
  formData.append("ticket_type_name", eventData.ticket_type_name);
  formData.append("ticket_type_available_quantity", String(eventData.ticket_type_available_quantity));
  formData.append("ticket_type_free_registration", String(eventData.ticket_type_free_registration));
  
  if (eventData.image_file) {
    formData.append("image_file", eventData.image_file);
  }
  
  formData.append("remove_image", String(!!eventData.remove_image));
  
  return formData;
};

export const fetchAdminEvents = async (
  token: string,
  setData: React.Dispatch<React.SetStateAction<EventData[]>>,
  setLoading: (value: boolean) => void,
  setError: (value: string | null) => void,
  urlParams: string = "",
  append: boolean = false // Добавляем параметр append
): Promise<EventData[]> => {
  setLoading(true);
  setError(null);
  try {
    if (!token) throw new Error("Не авторизован");

    const response = await fetch(`/admin_edits/events${urlParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Не удалось загрузить мероприятия");
    }

    const data: EventData[] = await response.json();
    console.log("Raw data from server:", data); // Логируем сырые данные с сервера
    setData((prevEvents) => {
      const mappedData = data.map((event) => ({
        ...event,
        ticket_type: event.ticket_type ? {
          ...event.ticket_type,
          // Убираем принудительное установление sold_quantity в 0
          sold_quantity: event.ticket_type.sold_quantity,
        } : undefined
      }));
      return append ? [...prevEvents, ...mappedData] : mappedData;
    });
    return data;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    setData((prev) => append ? prev : []);
    return [];
  } finally {
    setLoading(false);
  }
};

export const createEvent = async (eventData: EventFormData): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    throw new Error("Не авторизован");
  }
  
  const formData = prepareEventFormData(eventData);
  
  const response = await fetch("/admin_edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Ошибка при создании мероприятия");
  }
  
  return response.json();
};

export const updateEvent = async (eventId: number, eventData: EventFormData): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    throw new Error("Не авторизован");
  }
  
  const formData = prepareEventFormData(eventData);
  
  const response = await fetch(`/admin_edits/${eventId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Ошибка при обновлении мероприятия");
  }
  
  return response.json();
};

export const fetchEvent = async (eventId: string): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    throw new Error("Не авторизован");
  }

  const response = await fetch(`/admin_edits/${eventId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Ошибка при загрузке мероприятия");
  }

  const data = await response.json();
  data.registrations_count = data.registrations_count || 0;
  return data;
};