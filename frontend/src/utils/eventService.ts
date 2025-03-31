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
  append: boolean = false
): Promise<EventData[]> => {
  setLoading(true);
  setError(null);
  try {
    if (!token) throw new Error("Не авторизован");

    console.log(`Fetching admin events from: /admin_edits/events${urlParams}`);
    const response = await fetch(`/admin_edits/events${urlParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Fetch admin events error:", errorData);
      throw new Error(errorData.detail || "Не удалось загрузить мероприятия");
    }

    const data: EventData[] = await response.json();
    console.log("Received admin events data:", data);
    setData((prevEvents) => {
      const mappedData = data.map((event) => ({
        ...event,
        ticket_type: event.ticket_type ? {
          ...event.ticket_type,
          sold_quantity: event.ticket_type.sold_quantity,
        } : undefined
      }));
      return append ? [...prevEvents, ...mappedData] : mappedData;
    });
    return data;
  } catch (err) {
    console.error("Fetch admin events failed:", err);
    setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    setData((prev) => append ? prev : []);
    return [];
  } finally {
    setLoading(false);
  }
};

export const createEvent = async (eventData: EventFormData): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");
  
  const formData = prepareEventFormData(eventData);
  
  console.log("Creating event at: /admin_edits");
  const response = await fetch("/admin_edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Create event error:", errorData);
    throw new Error(errorData.detail || "Ошибка при создании мероприятия");
  }
  
  const data = await response.json();
  console.log("Created event data:", data);
  return data;
};

export const updateEvent = async (eventId: number, eventData: EventFormData): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");
  
  const formData = prepareEventFormData(eventData);
  
  console.log(`Updating event at: /admin_edits/${eventId}`);
  const response = await fetch(`/admin_edits/${eventId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Update event error:", errorData);
    throw new Error(errorData.detail || "Ошибка при обновлении мероприятия");
  }
  
  const data = await response.json();
  console.log("Updated event data:", data);
  return data;
};

export const fetchEvent = async (eventId: string): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");

  console.log(`Fetching event from: /admin_edits/${eventId}`);
  const response = await fetch(`/admin_edits/${eventId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept": "application/json",
    },
    cache: "no-store", // Отключаем кэширование для свежести данных
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Fetch event error:", errorData);
    throw new Error(errorData.detail || "Ошибка при загрузке мероприятия");
  }

  const data = await response.json();
  console.log("Received event data:", data);
  data.registrations_count = data.registrations_count || 0;
  return data;
};