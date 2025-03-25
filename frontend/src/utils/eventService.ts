// frontend/src/utils/eventService.ts
import { EventFormData, EventData } from '@/types/events';

// Преобразование формы события в FormData для отправки на сервер
export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();
  
  // Базовые поля
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
  
  // Информация о билетах
  formData.append("ticket_type_name", eventData.ticket_type_name);
  formData.append("ticket_type_available_quantity", String(eventData.ticket_type_available_quantity));
  formData.append("ticket_type_free_registration", String(eventData.ticket_type_free_registration));
  
  // Обработка изображения
  if (eventData.image_file) {
    formData.append("image_file", eventData.image_file);
  }
  
  formData.append("remove_image", String(!!eventData.remove_image));
  
  return formData;
};

// Функции для работы с API
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
    throw new Error(`Ошибка API: ${response.status}`);
  }

  return response.json();
};