// frontend/src/utils/eventService.ts
import { EventFormData, EventData } from '@/types/events';

// Format form data for API with required fields
export const prepareEventFormData = (eventData: EventFormData): FormData => {
  const formData = new FormData();
  
  // Basic event data
  formData.append("title", eventData.title);
  formData.append("description", eventData.description || "");
  
  // Format date-time properly - without Z timezone suffix
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
  
  // Event metadata
  formData.append("price", String(eventData.price));
  formData.append("published", String(eventData.published));
  formData.append("status", eventData.status);
  
  // REQUIRED: Add created_at and updated_at fields
  formData.append("created_at", eventData.created_at || new Date().toISOString());
  formData.append("updated_at", new Date().toISOString()); // Always use current time for updated_at
  
  // Ticket data
  formData.append("ticket_type_name", eventData.ticket_type_name);
  formData.append("ticket_type_available_quantity", String(eventData.ticket_type_available_quantity));
  formData.append("ticket_type_free_registration", String(eventData.ticket_type_free_registration));
  
  // Image handling
  if (eventData.image_file) {
    formData.append("image_file", eventData.image_file);
  }
  
  if (eventData.remove_image) {
    formData.append("remove_image", "true");
  } else {
    formData.append("remove_image", "false");
  }
  
  // Debug the form data
  console.log("Form data prepared with the following fields:");
  for (const pair of formData.entries()) {
    if (pair[0] !== "image_file") { // Skip logging large binary data
      console.log(`${pair[0]}: ${pair[1]}`);
    } else {
      console.log(`${pair[0]}: [binary data]`);
    }
  }
  
  return formData;
};

// Log response details for debugging
const logResponseError = async (response: Response): Promise<string> => {
  const text = await response.text();
  console.error(`Error response (${response.status}):`, text);
  
  try {
    const json = JSON.parse(text);
    console.error("Parsed error:", json);
    if (typeof json === 'object') {
      // Handle both string and object error formats
      if (json.detail) {
        if (Array.isArray(json.detail)) {
          // Format validation errors in a readable way
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return json.detail.map((err: any) => 
            `Field ${err.loc.join('.')} error: ${err.msg}`
          ).join(', ');
        } else {
          return json.detail;
        }
      } else {
        return JSON.stringify(json);
      }
    }
    return text;
  } catch {
    return text || `HTTP Error: ${response.status}`;
  }
};

// Create a new event
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
    const errorMessage = await logResponseError(response);
    throw new Error(errorMessage);
  }
  
  return await response.json();
};

// Update an existing event
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
    const errorMessage = await logResponseError(response);
    throw new Error(errorMessage);
  }
  
  return await response.json();
};

// Fetch event data
export const fetchEvent = async (eventId: string): Promise<EventData> => {
  const token = localStorage.getItem("admin_token");
  if (!token) throw new Error("Не авторизован");

  console.log(`Fetching event from: /admin_edits/${eventId}`);
  const response = await fetch(`/admin_edits/${eventId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await logResponseError(response);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log("Received event data:", data);
  
  // Ensure consistent structure
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