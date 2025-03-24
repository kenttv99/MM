"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!isAdminAuth) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch("/admin_edits/events", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-store",
          },
        });
        if (!response.ok) throw new Error("Не удалось загрузить мероприятия");
        const data: EventData[] = await response.json();
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [isAdminAuth]);

  const updateEvent = async (eventId: number, updatedData: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/admin_edits/${eventId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: updatedData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Ошибка при обновлении");
      }
      const updatedEvent: EventData = await response.json();
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? updatedEvent : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (eventId: number, file: File | null, remove = false) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const formData = new FormData();
    formData.append("title", event.title);
    formData.append("description", event.description || "");
    formData.append("start_date", event.start_date);
    formData.append("end_date", event.end_date || "");
    formData.append("location", event.location || "");
    formData.append("price", event.price.toString());
    formData.append("published", event.published.toString());
    formData.append("created_at", event.created_at);
    formData.append("updated_at", event.updated_at);
    formData.append("status", event.status);
    formData.append("ticket_type_name", event.ticket_type?.name || "standart");
    formData.append("ticket_type_available_quantity", event.ticket_type?.available_quantity.toString() || "0");
    formData.append("ticket_type_free_registration", event.ticket_type?.free_registration.toString() || "false");
    formData.append("remove_image", remove.toString());
    if (file) formData.append("image_file", file);

    updateEvent(eventId, formData);
  };

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
                    formData.append(key, value.toString());
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
                      formData.append(key, value.toString());
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
                    onError={(e) => (e.currentTarget.src = "/placeholder-image.jpg")}
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