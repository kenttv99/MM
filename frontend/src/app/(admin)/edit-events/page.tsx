"use client";
import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { FaPen } from "react-icons/fa";

// Интерфейс для данных мероприятия
interface EventData {
  title: string;
  description: string;
}

export default function EditEventPage() {
  const [event, setEvent] = useState<EventData | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const token = localStorage.getItem("admin_token");

  useEffect(() => {
    const fetchEvent = async () => {
      const response = await fetch(`/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setEvent(data);
    };
    if (eventId) fetchEvent();
  }, [eventId, token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!event) return;
    await fetch(`/events/${eventId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    });
    router.push("/dashboard");
  };

  if (!event) return <p>Загрузка...</p>;

  return (
    <form onSubmit={handleSubmit}>
      <h1>Редактировать мероприятие</h1>
      <label>Название</label> {/* Убираем htmlFor */}
      <InputField
        type="text" // Убираем id
        value={event.title}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setEvent({ ...event, title: e.target.value })
        }
        placeholder="Введите название"
        icon={FaPen}
      />
      <label>Описание</label> {/* Убираем htmlFor */}
      <InputField
        type="text" // Убираем id
        value={event.description}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setEvent({ ...event, description: e.target.value })
        }
        placeholder="Введите описание"
        icon={FaPen}
      />
      <button type="submit">Сохранить</button>
    </form>
  );
}