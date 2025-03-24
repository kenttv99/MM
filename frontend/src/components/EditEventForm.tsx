// frontend/src/components/EditEventForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import InputField from "./common/InputField";
import { FaPencilAlt, FaTrash } from "react-icons/fa";

interface TicketType {
  name: string;
  price: number;
  available_quantity: number;
  free_registration: boolean;
}

interface EventData {
  id: number;
  title: string;
  description?: string;
  status: string;
  start_date: string;
  end_date?: string;
  location?: string;
  image_url?: string;
  price: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  ticket_type?: TicketType;
}

const EditEventForm = () => {
  const { isAdminAuth } = useAdminAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Получение аутентифицированного запроса
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      throw new Error("Не авторизован");
    }
    
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>)
      }
    });
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!isAdminAuth) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth("/admin_edits/events");
      if (!response.ok) throw new Error("Не удалось загрузить мероприятия");
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [isAdminAuth, fetchWithAuth]);

  const updateEvent = useCallback(async (eventId: number, data: FormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth(`/admin_edits/${eventId}`, {
        method: "PUT",
        body: data
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Ошибка при обновлении");
      }
      
      const updatedEvent = await response.json();
      setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const handleFileChange = useCallback(async (eventId: number, file: File | null, remove = false) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    const formData = new FormData();
    
    // Добавление всех полей события в formData
    Object.entries(event).forEach(([key, value]) => {
      if (key !== "ticket_type" && key !== "image_url" && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    
    // Добавление данных о билете
    if (event.ticket_type) {
      formData.append("ticket_type_name", event.ticket_type.name);
      formData.append("ticket_type_available_quantity", event.ticket_type.available_quantity.toString());
      formData.append("ticket_type_free_registration", event.ticket_type.free_registration.toString());
    }
    
    // Добавление флага удаления изображения и самого изображения
    formData.append("remove_image", remove.toString());
    if (file) formData.append("image_file", file);
    
    return updateEvent(eventId, formData);
  }, [events, updateEvent]);

  useEffect(() => {
    if (isAdminAuth) {
      fetchEvents();
    }
  }, [isAdminAuth, fetchEvents]);

  if (!isAdminAuth) {
    return <p className="text-red-500">Доступ только для администраторов</p>;
  }

  return (
    <div className="container mx-auto p-4">
      {loading && <p>Загрузка...</p>}
      {error && <div className="text-red-500 bg-red-50 p-2 rounded-lg mb-4">{error}</div>}
      <h1 className="text-2xl font-bold mb-4">Редактирование мероприятий</h1>
      {events.length === 0 ? (
        <p>Нет мероприятий для редактирования</p>
      ) : (
        events.map((event) => (
          <div key={event.id} className="card p-4 mb-4">
            <InputField
              type="text"
              value={event.title}
              onChange={(e) => {
                const formData = new FormData();
                formData.append("title", e.target.value);
                Object.entries(event).forEach(([key, value]) => {
                  if (key !== "title" && key !== "ticket_type" && value !== undefined) {
                    formData.append(key, String(value));
                  }
                });
                if (event.ticket_type) {
                  formData.append("ticket_type_name", event.ticket_type.name);
                  formData.append("ticket_type_available_quantity", event.ticket_type.available_quantity.toString());
                  formData.append("ticket_type_free_registration", event.ticket_type.free_registration.toString());
                }
                updateEvent(event.id, formData);
              }}
              placeholder="Название мероприятия"
              icon={FaPencilAlt}
              name="title"
            />
            <div className="mt-4">
              <label className="block text-gray-700 mb-2">Статус</label>
              <select
                value={event.status}
                onChange={(e) => {
                  const formData = new FormData();
                  formData.append("status", e.target.value);
                  Object.entries(event).forEach(([key, value]) => {
                    if (key !== "status" && key !== "ticket_type" && value !== undefined) {
                      formData.append(key, String(value));
                    }
                  });
                  if (event.ticket_type) {
                    formData.append("ticket_type_name", event.ticket_type.name);
                    formData.append("ticket_type_available_quantity", event.ticket_type.available_quantity.toString());
                    formData.append("ticket_type_free_registration", event.ticket_type.free_registration.toString());
                  }
                  updateEvent(event.id, formData);
                }}
                className="form-input w-full"
              >
                <option value="draft">Черновик</option>
                <option value="registration_open">Регистрация открыта</option>
                <option value="registration_closed">Регистрация закрыта</option>
                <option value="completed">Завершено</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-gray-700 mb-2">Обложка</label>
              {event.image_url && (
                <div className="flex items-center mb-2">
                  {/*eslint-disable-next-line @next/next/no-img-element*/}
                  <img
                    src={`/admin_edits${event.image_url}`}
                    alt="Обложка мероприятия"
                    className="w-32 h-32 object-cover rounded-lg mr-4"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder-image.jpg";
                    }}
                  />
                  <button
                    onClick={() => handleFileChange(event.id, null, true)}
                    className="text-red-500 hover:text-red-700 flex items-center"
                  >
                    <FaTrash className="mr-1" /> Удалить
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(event.id, file);
                }}
                className="form-input w-full"
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default EditEventForm;