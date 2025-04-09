// frontend/src/utils/eventService.ts
import { EventFormData, EventData } from '@/types/events';

export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();
  
  formData.append("title", eventData.title);
  formData.append("description", eventData.description || "");
  
  if (eventData.start_date) {
    const startDateStr = eventData.start_date + (eventData.start_time ? `T${eventData.start_time}:00` : "");
    formData.append("start_date", startDateStr);
  }
  
  if (eventData.end_date) {
    const endDateStr = eventData.end_date + (eventData.end_time ? `T${eventData.end_time}:00` : "");
    formData.append("end_date", endDateStr);
  }
  
  if (eventData.location) {
    formData.append("location", eventData.location);
  }
  
  formData.append("price", String(eventData.price));
  formData.append("published", String(eventData.published));
  formData.append("status", eventData.status);
  formData.append("ticket_type_name", eventData.ticket_type_name);
  formData.append("ticket_type_available_quantity", String(eventData.ticket_type_available_quantity));
  formData.append("ticket_type_free_registration", String(eventData.ticket_type_free_registration));
  
  if (eventData.image_file) {
    formData.append("image_file", eventData.image_file);
  }
  
  formData.append("remove_image", String(eventData.remove_image || false));
  
  // Добавляем url_slug, если он указан
  if (eventData.url_slug) {
    formData.append("url_slug", eventData.url_slug);
  }
  
  // Добавляем created_at и updated_at с текущей датой в формате ISO
  const now = new Date().toISOString();
  formData.append("created_at", now);
  formData.append("updated_at", now);

  return formData;
};

export const createEvent = async (eventData: EventFormData): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");

  const cleanedToken = token.replace(/^Bearer\s+/i, "").trim();
  const formData = prepareEventFormData(eventData);
  const headers = {
    Authorization: `Bearer ${cleanedToken}`,
  };

  const response = await fetch("http://localhost:8001/admin_edits/", {
    method: "POST",
    headers,
    body: formData,
  });

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(responseBody || `HTTP Error: ${response.status}`);
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    throw new Error("Ошибка обработки ответа сервера");
  }
};

export const updateEvent = async (eventId: number, eventData: EventFormData): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");

  const cleanedToken = token.replace(/^Bearer\s+/i, "").trim();
  const formData = prepareEventFormData(eventData);
  const response = await fetch(`/admin_edits/${eventId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${cleanedToken}`,
    },
    body: formData,
  });

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(responseBody || "Ошибка при обновлении мероприятия");
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    throw new Error("Ошибка обработки ответа сервера");
  }
};

export const fetchEvent = async (eventId: string): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");

  const cleanedToken = token.replace(/^Bearer\s+/i, "").trim();
  const response = await fetch(`/admin_edits/${eventId}`, {
    headers: {
      Authorization: `Bearer ${cleanedToken}`,
      "Accept": "application/json",
    },
    cache: "no-store",
  });

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(responseBody || "Ошибка при получении данных мероприятия");
  }

  const data = JSON.parse(responseBody);
  return {
    ...data,
    registrations_count: data.registrations_count || 0,
    ticket_type: data.ticket_type || {
      name: "standart",
      available_quantity: 0,
      sold_quantity: 0,
      free_registration: false
    }
  };
};