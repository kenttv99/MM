// frontend/src/app/(public)/events/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";

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
  status: "draft" | "registration_open" | "registration_closed" | "completed";
  start_date: string;
  end_date?: string;
  image_url?: string;
  published: boolean;
  ticket_type?: TicketType;
}

const EventsPage = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/v1/public/events", {
          headers: {
            "Accept": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ошибка загрузки мероприятий: ${response.status} - ${errorText}`);
        }

        const data: EventData[] = await response.json();
        setEvents(data.filter(event => event.published));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить мероприятия");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDateTime = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const options: Intl.DateTimeFormatOptions = { 
      day: "numeric", 
      month: "long", 
      hour: "2-digit", 
      minute: "2-digit" 
    };
    const startFormatted = start.toLocaleString("ru-RU", options);
    
    if (endDate) {
      const end = new Date(endDate);
      const endFormatted = end.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      return `${startFormatted} - ${endFormatted}`;
    }
    return startFormatted;
  };

  const getStatusStyles = (status: EventData["status"]) => {
    switch (status) {
      case "registration_open":
        return "bg-green-500/80 text-white";
      case "registration_closed":
        return "bg-red-500/80 text-white";
      case "completed":
        return "bg-gray-500/80 text-white";
      default:
        return "bg-gray-500/80 text-white";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <main className="flex-grow pt-24 pb-16 px-4 min-h-[calc(100vh-120px)] bg-gray-50">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Все мероприятия</h1>
          
          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500 text-center">
              {error}
            </div>
          )}

          {events.length === 0 ? (
            <p className="text-center text-gray-600">Нет доступных мероприятий</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Link href={`/event/${event.id}`} key={event.id}>
                  <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden relative">
                    <div className="relative h-48">
                      {event.image_url ? (
                        <>
                          <Image
                            src={event.image_url}
                            alt={event.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-300 hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500">Нет изображения</span>
                        </div>
                      )}
                      <span
                        className={`absolute top-2 right-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(
                          event.status
                        )}`}
                      >
                        {event.status === "registration_open" && "Регистрация открыта"}
                        {event.status === "registration_closed" && "Регистрация закрыта"}
                        {event.status === "completed" && "Завершено"}
                      </span>
                    </div>
                    <div className="p-5 relative">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {event.description || "Описание отсутствует"}
                      </p>
                      <div className="text-gray-500 text-sm">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDateTime(event.start_date, event.end_date)}
                        </span>
                      </div>
                      {/* Обновляем отображение мест */}
                      {event.ticket_type && (
                        <span className="absolute bottom-2 right-2 bg-orange-100 text-orange-600 text-xs font-semibold px-2 py-1 rounded-full">
                          {event.status === "registration_open" && event.ticket_type.available_quantity > 0
                            ? `Доступно мест: ${event.ticket_type.available_quantity}`
                            : "Места распределены"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EventsPage;