"use client";
import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaPen } from "react-icons/fa";

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

  if (!event) return <p className="text-gray-900">Загрузка...</p>;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">Редактировать мероприятие</h1>
      <form onSubmit={handleSubmit}>
        <label className="block text-gray-700 mb-2">Название</label>
        <InputField
          type="text"
          value={event.title}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEvent({ ...event, title: e.target.value })
          }
          placeholder="Введите название"
          icon={FaPen}
        />
        <label className="block text-gray-700 mb-2">Описание</label>
        <InputField
          type="text"
          value={event.description}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEvent({ ...event, description: e.target.value })
          }
          placeholder="Введите описание"
          icon={FaPen}
        />
        <ModalButton type="submit">Сохранить</ModalButton>
      </form>
    </div>
  );
}