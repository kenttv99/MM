// frontend/src/types/events.ts
export interface TicketType {
    name: string;
    price: number;
    available_quantity: number;
    free_registration: boolean;
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
  }
  
  export interface EventFormData extends Omit<EventData, "start_date" | "end_date" | "price"> {
    start_date: string;
    start_time?: string;
    end_date?: string;
    end_time?: string;
    price: number;
    image_file?: File | null;
    remove_image?: boolean;
    ticket_type_name: string;
    ticket_type_available_quantity: number;
    ticket_type_free_registration: boolean;
  }