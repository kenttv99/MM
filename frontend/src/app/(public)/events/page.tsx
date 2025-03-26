"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/utils/api";
import { FaCalendarAlt } from "react-icons/fa";

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

const generateSlug = (title: string, id: number): string => {
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-"
  };
  return (
    title
      .toLowerCase()
      .split("")
      .map((char) => translitMap[char] || char)
      .join("")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") + `-${id}`
  );
};

const EventsPage = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);

  const ITEMS_PER_PAGE = 6;

  const fetchEvents = useCallback(async (pageNum: number, reset: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const response = await apiFetch(`/v1/public/events?${params.toString()}`, {
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка загрузки: ${response.status} - ${errorText}`);
      }

      const data: EventData[] = await response.json();
      const filteredData = data.filter((event) => event.published);

      setEvents((prev) => {
        const newEvents = filteredData.filter(
          (newEvent) => !prev.some((existing) => existing.id === newEvent.id)
        );
        return reset ? filteredData : [...prev, ...newEvents];
      });
      setHasMore(filteredData.length === ITEMS_PER_PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить мероприятия");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Первая загрузка при монтировании
  useEffect(() => {
    if (pathname === "/events") {
      setEvents([]);
      setPage(1);
      setStartDate("");
      setEndDate("");
      fetchEvents(1, true);
    }
  }, [pathname, fetchEvents]);

  // Реактивное обновление при изменении фильтров
  useEffect(() => {
    setEvents([]);
    setPage(1);
    fetchEvents(1, true);
  }, [startDate, endDate, fetchEvents]);

  // Бесконечная прокрутка
  useEffect(() => {
    if (!hasMore || isLoading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 1.0 }
    );

    const currentLoadMore = loadMoreRef.current;
    if (currentLoadMore) observerRef.current.observe(currentLoadMore);

    return () => {
      if (observerRef.current && currentLoadMore) observerRef.current.unobserve(currentLoadMore);
    };
  }, [hasMore, isLoading]);

  // Загрузка следующей страницы
  useEffect(() => {
    if (page > 1) fetchEvents(page);
  }, [page, fetchEvents]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  };

  const groupEventsByDate = (events: EventData[]) => {
    const grouped: { [key: string]: EventData[] } = {};
    events.forEach((event) => {
      const dateKey = formatDate(event.start_date);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  const getStatusStyles = (status: EventData["status"]) => {
    switch (status) {
      case "registration_open": return "bg-green-500/80 text-white";
      case "registration_closed": return "bg-red-500/80 text-white";
      case "completed": return "bg-gray-500/80 text-white";
      default: return "bg-gray-500/80 text-white";
    }
  };

  const handleCalendarClick = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) {
      ref.current.showPicker();
    }
  };

  const handleDateChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault(); // Предотвращаем возможную отправку формы
    setter(e.target.value);
  };

  const groupedEvents = groupEventsByDate(events);

  if (isLoading && page === 1) {
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

          <div className="mb-6 flex justify-end gap-4">
            <div className="relative flex items-center gap-2 group">
              <label className="text-sm text-gray-400 group-hover:text-gray-500 transition-colors duration-200 cursor-pointer">От:</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={handleDateChange(setStartDate)}
                  placeholder="Выберите дату"
                  className="p-1 pl-2 pr-8 text-sm text-gray-600 bg-transparent border border-gray-200 rounded-md focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-gray-300 transition-all duration-200 w-40"
                  ref={startDateInputRef}
                />
                <FaCalendarAlt
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors duration-200 cursor-pointer"
                  onClick={() => handleCalendarClick(startDateInputRef)}
                />
              </div>
            </div>
            <div className="relative flex items-center gap-2 group">
              <label className="text-sm text-gray-400 group-hover:text-gray-500 transition-colors duration-200 cursor-pointer">До:</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={handleDateChange(setEndDate)}
                  placeholder="Выберите дату"
                  className="p-1 pl-2 pr-8 text-sm text-gray-600 bg-transparent border border-gray-200 rounded-md focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-gray-300 transition-all duration-200 w-40"
                  ref={endDateInputRef}
                />
                <FaCalendarAlt
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors duration-200 cursor-pointer"
                  onClick={() => handleCalendarClick(endDateInputRef)}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500 text-center">
              {error}
            </div>
          )}

          {events.length === 0 && !isLoading ? (
            <p className="text-center text-gray-600">Нет доступных мероприятий</p>
          ) : (
            Object.entries(groupedEvents).map(([date, eventsForDate]) => (
              <div key={date} className="mb-8">
                <h2 className="text-base font-medium text-gray-500 mb-3">{date}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {eventsForDate.map((event) => (
                    <Link href={`/event/${generateSlug(event.title, event.id)}`} key={event.id}>
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
                          <span className={`absolute top-2 right-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(event.status)}`}>
                            {event.status === "registration_open" && "Регистрация открыта"}
                            {event.status === "registration_closed" && "Регистрация закрыта"}
                            {event.status === "completed" && "Завершено"}
                          </span>
                        </div>
                        <div className="p-5 relative">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">{event.title}</h3>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-3">{event.description || "Описание отсутствует"}</p>
                          <div className="text-gray-500 text-sm">
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formatDate(event.start_date)}
                            </span>
                          </div>
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
              </div>
            ))
          )}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoading && (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              )}
            </div>
          )}
          {!hasMore && events.length > 0 && (
            <p className="text-center text-gray-600 py-8">Все мероприятия загружены</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EventsPage;