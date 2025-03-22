// frontend/src/components/EditEventForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import InputField from "./common/InputField";
import { FaPencilAlt } from "react-icons/fa";

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
  ticket_type?: { name: string; price: number; available_quantity: number; free_registration: boolean };
}

const EditEventForm = () => {
  const { isAdminAuth, adminData } = useAdminAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuth || !adminData) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch("/events", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-store",
          },
        });
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
        } else {
          setError("Не удалось загрузить мероприятия");
        }
      } catch (err) {
        setError(`Произошла ошибка при загрузке мероприятий: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [isAdminAuth, adminData]);

  const updateEvent = async (eventId: number, updatedData: Partial<EventData>) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`admin_edits/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        const updatedEvent = await response.json();
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? updatedEvent : e))
        );
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Ошибка при обновлении мероприятия");
      }
    } catch (err) {
      setError(`Произошла ошибка при обновлении: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminAuth || !adminData) {
    return <p className="text-red-500">Доступ только для администраторов</p>;
  }

  return (
    <div>
      {loading && <p>Загрузка...</p>}
      {error && (
        <div className="text-red-500 bg-red-50 p-2 rounded-lg mb-4">{error}</div>
      )}
      <h1 className="text-2xl font-bold mb-4">Редактирование мероприятий</h1>
      {events.length === 0 ? (
        <p>Нет мероприятий для редактирования</p>
      ) : (
        events.map((event) => (
          <div key={event.id} className="card p-4 mb-4">
            <InputField
              type="text"
              value={event.title}
              onChange={(e) => updateEvent(event.id, { title: e.target.value })}
              placeholder="Название мероприятия"
              icon={FaPencilAlt}
              name="title"
            />
            <select
              value={event.status}
              onChange={(e) => updateEvent(event.id, { status: e.target.value })}
              className="form-input mt-2"
            >
              <option value="draft">Черновик</option>
              <option value="registration_open">Регистрация открыта</option>
              <option value="registration_closed">Регистрация закрыта</option>
              <option value="completed">Завершено</option>
            </select>
          </div>
        ))
      )}
    </div>
  );
};

export default EditEventForm;