// frontend/src/types/events.ts
export interface TicketType {
  name: string;
  price: number;
  available_quantity: number;
  sold_quantity?: number;
  free_registration: boolean;
  remaining_quantity?: number;
}

export interface EventData {
  id?: number;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  image_url?: string;
  price: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  status: "draft" | "registration_open" | "registration_closed" | "completed";
  ticket_type?: TicketType;
  registrations_count?: number;
  notificationSent?: boolean; // Добавлено новое поле для отслеживания отправки уведомлений
  url_slug?: string;
}

export interface EventResponse {
  success: boolean;
  message: string;
  event?: EventData;
  authError?: boolean;
}

export interface EventFormData {
  id?: number;  // Добавлено
  title: string;
  description?: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  image_file?: File | null;
  image_url?: string | null;
  price: number;
  published: boolean;
  status: EventStatus;
  ticket_type_name: string;
  ticket_type_available_quantity: number;
  ticket_type_sold_quantity?: number;
  registrations_count?: number;  // Добавлено
  remove_image?: boolean;
  url_slug?: string;
}

export type EventStatus = "draft" | "registration_open" | "registration_closed" | "completed";

export enum TicketTypeEnum {
  free = "free",
  standart = "standart",
  vip = "vip",
  org = "org",
}