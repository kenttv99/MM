"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { apiFetch, CustomError } from "@/utils/api";
import { FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";
import FormattedDescription from "@/components/FormattedDescription"; 
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";

interface TicketType {
  name: string;
  price: number;
  available_quantity: number;
  free_registration: boolean;
  remaining_quantity?: number;
}

export interface EventData {
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
  if (!title || title.trim() === "") {
    return `event-${id}`;
  }
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-"
  };
  const slugifiedTitle = title
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] || char)
    .join("")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slugifiedTitle ? `${slugifiedTitle}-${id}` : `event-${id}`;
};

const ITEMS_PER_PAGE = 6;

const formatDateForDisplay = (dateString: string) => {
  try {
    const options: Intl.DateTimeFormatOptions = { 
      day: "numeric", 
      month: "long", 
      year: "numeric" 
    };
    return new Date(dateString).toLocaleDateString("ru-RU", options);
  } catch {
    return dateString;
  }
};

const groupEventsByDate = (events: EventData[]) => {
  const grouped: { [key: string]: EventData[] } = {};
  events.forEach((event) => {
    const dateKey = formatDateForDisplay(event.start_date);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  });
  return grouped;
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

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
  startDateRef: React.RefObject<HTMLInputElement | null>;
  endDateRef: React.RefObject<HTMLInputElement | null>;
}

const DateFilter: React.FC<DateFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onClose,
  onReset,
  startDateRef,
  endDateRef
}) => {
  const handleCalendarClick = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current && typeof ref.current.showPicker === "function") {
      ref.current.showPicker();
    }
  };

  return (
    <div className="absolute top-12 right-0 z-10 p-5 bg-white rounded-lg shadow-lg border border-gray-200 w-80 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Фильтр по датам</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FaTimes size={16} />
        </button>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">От:</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full p-2 pl-3 pr-9 text-sm text-gray-600 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-gray-300"
              ref={startDateRef}
            />
            <FaCalendarAlt
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-orange-500 transition-colors duration-200 cursor-pointer"
              onClick={() => handleCalendarClick(startDateRef)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">До:</label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full p-2 pl-3 pr-9 text-sm text-gray-600 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none hover:border-gray-300"
              ref={endDateRef}
            />
            <FaCalendarAlt
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-orange-500 transition-colors duration-200 cursor-pointer"
              onClick={() => handleCalendarClick(endDateRef)}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button
          onClick={onReset}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm flex items-center gap-1"
        >
          <FaTimes size={10} />
          Сбросить
        </button>
        <button
          onClick={onApply}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200 text-sm"
        >
          Применить
        </button>
      </div>
    </div>
  );
};

interface EventCardProps {
  event: EventData;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  return (
    <Link href={`/event/${generateSlug(event.title, event.id)}`} key={event.id}>
      <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden relative h-full flex flex-col">
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
        <div className="p-5 flex-grow flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">{event.title}</h3>
          <FormattedDescription
            content={event.description || "Описание отсутствует"}
            className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow [&_*]:!text-sm [&_h1]:!text-sm [&_h2]:!text-sm [&_h3]:!text-sm [&_h4]:!text-sm [&_h5]:!text-sm [&_h6]:!text-sm"
          />
          <div className="text-gray-500 text-sm mt-auto flex justify-between items-center">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDateForDisplay(event.start_date)}
            </span>
            {event.ticket_type && (
              <span className="bg-orange-100 text-orange-600 text-xs font-semibold px-2 py-1 rounded-full">
                {event.status === "registration_open" && event.ticket_type.remaining_quantity !== undefined && event.ticket_type.remaining_quantity > 0
                  ? `Осталось мест: ${event.ticket_type.remaining_quantity}`
                  : "Места распределены"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

const EventsPage = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasServerError, setHasServerError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const initialLoadComplete = useRef(false);
  const currentFilters = useRef({ startDate: "", endDate: "" });

  const fetchEvents = useCallback(async (pageNum: number, reset: boolean = false) => {
    setIsLoading(true);
    setError(null);
    setHasServerError(false);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      if (currentFilters.current.startDate) {
        params.append("start_date", currentFilters.current.startDate);
      }
      if (currentFilters.current.endDate) {
        params.append("end_date", currentFilters.current.endDate);
      }
      
      const response = await apiFetch(`/v1/public/events?${params.toString()}`, {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Не удалось загрузить мероприятия";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Оставляем общее сообщение
        }
        if (response.status >= 500) {
          setHasServerError(true);
          return;
        } else if (response.status === 429) {
          errorMessage = "Частые запросы. Попробуйте немного позже.";
        }
        setError(errorMessage);
        return;
      }

      const data: EventData[] = await response.json();
      const filteredData = data.filter((event) => event.published);
      setEvents((prev) => {
        if (reset) return filteredData;
        const newEvents = filteredData.filter(
          (newEvent) => !prev.some((existing) => existing.id === newEvent.id)
        );
        return [...prev, ...newEvents];
      });
      setHasMore(filteredData.length === ITEMS_PER_PAGE);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const customErr = err as CustomError;
        if (customErr.code === "ECONNREFUSED" || customErr.isServerError) {
          setHasServerError(true);
        } else {
          setError(err.message || "Не удалось загрузить мероприятия");
        }
      } else {
        setHasServerError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applyFilters = useCallback(() => {
    currentFilters.current = { startDate, endDate };
    setIsFilterActive(startDate !== "" || endDate !== "");
    setPage(1);
    setEvents([]);
    fetchEvents(1, true);
    setIsFilterOpen(false);
  }, [startDate, endDate, fetchEvents]);

  const resetFilters = useCallback(() => {
    setStartDate("");
    setEndDate("");
    currentFilters.current = { startDate: "", endDate: "" };
    setIsFilterActive(false);
    setPage(1);
    setEvents([]);
    fetchEvents(1, true);
    setIsFilterOpen(false);
  }, [fetchEvents]);

  useEffect(() => {
    if (!initialLoadComplete.current) {
      initialLoadComplete.current = true;
      fetchEvents(1, true);
    }
  }, [fetchEvents]);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.5 }
    );
    const currentLoadMore = loadMoreRef.current;
    if (currentLoadMore) observerRef.current.observe(currentLoadMore);
    return () => {
      if (observerRef.current && currentLoadMore) observerRef.current.unobserve(currentLoadMore);
    };
  }, [hasMore, isLoading]);

  useEffect(() => {
    if (page > 1 && hasMore) fetchEvents(page);
  }, [page, fetchEvents, hasMore]);

  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);

  if (hasServerError) {
    return <ErrorPlaceholder />;
  }

  return (
    <>
      <main className="flex-grow pt-24 pb-16 px-4 min-h-[calc(100vh-120px)] bg-gray-50">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Все мероприятия</h1>

          <div className="mb-6 relative">
            <div className="flex justify-end">
              <button 
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  isFilterActive 
                    ? "bg-orange-100 text-orange-700 hover:bg-orange-200" 
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <FaFilter className={isFilterActive ? "text-orange-500" : "text-gray-500"} />
                <span>Фильтры {isFilterActive ? "(активны)" : ""}</span>
              </button>
            </div>
            {isFilterOpen && (
              <DateFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onApply={applyFilters}
                onClose={() => setIsFilterOpen(false)}
                onReset={resetFilters}
                startDateRef={startDateInputRef}
                endDateRef={endDateInputRef}
              />
            )}
            {isFilterActive && !isFilterOpen && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 mr-2">Активные фильтры:</span>
                {currentFilters.current.startDate && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                    <span>От: {formatDateForDisplay(currentFilters.current.startDate)}</span>
                    <button
                      onClick={() => {
                        setStartDate("");
                        applyFilters();
                      }}
                      className="ml-1 hover:text-orange-900"
                    >
                      <FaTimes size={10} />
                    </button>
                  </div>
                )}
                {currentFilters.current.endDate && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                    <span>До: {formatDateForDisplay(currentFilters.current.endDate)}</span>
                    <button
                      onClick={() => {
                        setEndDate("");
                        applyFilters();
                      }}
                      className="ml-1 hover:text-orange-900"
                    >
                      <FaTimes size={10} />
                    </button>
                  </div>
                )}
                <button
                  onClick={resetFilters}
                  className="text-xs text-orange-600 hover:text-orange-800 hover:underline"
                >
                  Сбросить все
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500 text-center">
              {error}
            </div>
          )}

          {isLoading && events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
              <p className="text-gray-600">Загрузка мероприятий...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <FaCalendarAlt className="text-orange-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Мероприятия не найдены</h3>
              <p className="text-gray-600 text-center max-w-md mb-6">
                {isFilterActive 
                  ? "Не найдено мероприятий, соответствующих выбранным критериям. Попробуйте изменить фильтры."
                  : "В настоящее время нет доступных мероприятий."}
              </p>
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedEvents).map(([date, eventsForDate]) => (
              <div key={date} className="mb-8 animate-fade-in">
                <h2 className="text-base font-medium text-gray-500 mb-3">{date}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {eventsForDate.map((event) => (
                    <EventCard event={event} key={event.id} />
                  ))}
                </div>
              </div>
            ))
          )}

          {hasMore && events.length > 0 && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              ) : (
                <div className="h-8 w-8"></div>
              )}
            </div>
          )}
          {!hasMore && events.length > 0 && (
            <p className="text-center text-gray-600 py-8">
              Все мероприятия загружены
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EventsPage;