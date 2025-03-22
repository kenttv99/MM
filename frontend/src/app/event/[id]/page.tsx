// frontend/src/app/event/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import Media from "@/components/Media";
import { notFound } from "next/navigation";

interface EventData {
  id: number;
  title: string;
  description?: string;
  status: "draft" | "registration_open" | "registration_closed" | "completed";
  ticket_type?: { name: string; price: number; available_quantity: number };
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:8001/events/${id}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Event not found");
        }
        const data = await res.json();
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchEvent();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !event) {
    return notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">{event.title}</h1>
        <p className="text-gray-600 mb-6">{event.description || "Нет описания"}</p>

        {event.status === "registration_open" && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Регистрация открыта</h2>
            <EventRegistration eventId={event.id} />
          </div>
        )}

        {event.status === "registration_closed" && (
          <p className="text-gray-500">Регистрация на мероприятие закрыта.</p>
        )}

        {event.status === "completed" && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Мероприятие завершено</h2>
            <Media />
          </div>
        )}

        {event.status === "draft" && (
          <p className="text-gray-500">
            Мероприятие находится в черновике и недоступно для просмотра.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}