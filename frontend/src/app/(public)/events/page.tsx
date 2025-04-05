// frontend/src/app/(public)/events/page.tsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";
import FormattedDescription from "@/components/FormattedDescription";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch, clearCache } from "@/utils/api";
import { EventData } from "@/types/events";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import { useLoading } from "@/contexts/LoadingContext";

const ITEMS_PER_PAGE = 6;

const generateSlug = (title: string, id: number): string => {
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "н", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-",
  };
  const slug = title.toLowerCase().split("").map(char => translitMap[char] || char).join("")
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return slug ? `${slug}-${id}` : `event-${id}`;
};

const formatDateForDisplay = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateString;
  }
};

const formatDateForAPI = (dateString: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const groupEventsByDate = (events: EventData[]) => {
  const grouped: { [key: string]: EventData[] } = {};
  events.forEach(event => {
    const dateKey = formatDateForDisplay(event.start_date);
    grouped[dateKey] = grouped[dateKey] || [];
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

const DateFilter: React.FC<{
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
  startDateRef: React.RefObject<HTMLInputElement | null>;
  endDateRef: React.RefObject<HTMLInputElement | null>;
}> = ({ startDate, endDate, onStartDateChange, onEndDateChange, onApply, onClose, onReset, startDateRef, endDateRef }) => {
  const handleCalendarClick = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current && typeof ref.current.showPicker === "function") ref.current.showPicker();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-[60px] right-0 z-10 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-[300px]"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Фильтр по датам</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><FaTimes size={16} /></button>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">От:</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full p-2 pl-3 pr-9 border rounded-md"
              ref={startDateRef}
            />
            <FaCalendarAlt
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
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
              className="w-full p-2 pl-3 pr-9 border rounded-md"
              ref={endDateRef}
            />
            <FaCalendarAlt
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
              onClick={() => handleCalendarClick(endDateRef)}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-between pt-4 border-t">
        <button onClick={onReset} className="px-3 py-2 bg-gray-100 rounded-lg flex items-center gap-1">
          <FaTimes size={10} /> Сбросить
        </button>
        <button onClick={onApply} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Применить</button>
      </div>
    </motion.div>
  );
};

const EventCard: React.FC<{ event: EventData; lastCardRef?: React.RefObject<HTMLDivElement | null> }> = React.memo(
  ({ event, lastCardRef }) => {
    const isCompleted = event.status === "completed";
    return (
      <div ref={lastCardRef}>
        <Link href={`/event/${generateSlug(event.title, event.id || 0)}`}>
          <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 min-h-[300px] flex flex-col">
            <div className="relative h-48">
              {event.image_url ? (
                <Image src={event.image_url} alt={event.title} fill className="object-cover rounded-t-xl" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-xl">
                  <span className="text-gray-500">Нет изображения</span>
                </div>
              )}
              <span className={`absolute top-2 right-2 px-2 py-1 text-xs rounded-full ${getStatusStyles(event.status)}`}>
                {event.status === "registration_open" ? "Регистрация открыта" : event.status === "registration_closed" ? "Регистрация закрыта" : "Завершено"}
              </span>
            </div>
            <div className="p-4 flex-grow flex flex-col">
              <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
              <FormattedDescription
                content={event.description || "Описание отсутствует"}
                className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow"
                disableFontSize={true}
                disableLinks={true}
              />
              <div className="text-gray-500 text-sm mt-auto flex flex-col sm:flex-row justify-between">
                <span className="flex items-center mb-2 sm:mb-0">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDateForDisplay(event.start_date)}
                </span>
                {event.ticket_type && !isCompleted && (
                  <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">
                    {event.status === "registration_open" && event.ticket_type.remaining_quantity !== undefined && event.ticket_type.remaining_quantity > 0
                      ? `Осталось мест: ${event.ticket_type.remaining_quantity}`
                      : "Места распределены"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }
);
EventCard.displayName = "EventCard";

interface FilterState {
  startDate: string;
  endDate: string;
}

const EventsPage = () => {
  const { setStaticLoading, setDynamicLoading, isDynamicLoading } = useLoading();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({ startDate: "", endDate: "" });
  const [events, setEvents] = useState<EventData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const lastCardRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasLoadedInitial = useRef<boolean>(false);
  const isInitialMount = useRef<boolean>(true);
  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadEvents = useCallback(async (pageNum: number, append = false, filters: FilterState) => {
    if (loadingTimeout.current) {
      clearTimeout(loadingTimeout.current);
    }

    loadingTimeout.current = setTimeout(async () => {
      setDynamicLoading(true);
      setError(null);
      setServerError(false);

      const abortController = new AbortController();
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (filters.startDate) params.append("start_date", formatDateForAPI(filters.startDate));
      if (filters.endDate) params.append("end_date", formatDateForAPI(filters.endDate));
      const endpoint = `/v1/public/events?${params.toString()}`;

      try {
        const data = await apiFetch<EventData[]>(endpoint, {
          signal: abortController.signal,
          cache: pageNum === 1 ? "no-store" : "default",
        }, setDynamicLoading);
        setEvents(prev => (append ? [...prev, ...data] : data));
        setHasMore(data.length === ITEMS_PER_PAGE);
      } catch (err) {
        if (err instanceof Error && err.message === "Request aborted") return;
        const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки мероприятий";
        if (errorMessage.includes("HTTP error! Status: 5")) setServerError(true);
        else setError(errorMessage);
        setHasMore(false);
      } finally {
        setDynamicLoading(false);
      }
    }, 100);
  }, [setDynamicLoading]);

  // Начальная загрузка
  useEffect(() => {
    if (hasLoadedInitial.current) return;
    
    const initializePage = async () => {
      hasLoadedInitial.current = true;
      setStaticLoading(false);
      await loadEvents(1, false, activeFilters);
    };

    initializePage();

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
      }
    };
  }, [loadEvents, activeFilters, setStaticLoading]);

  // Обновление при изменении фильтров
  useEffect(() => {
    if (!hasLoadedInitial.current || isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setPage(1);
    setEvents([]);
    clearCache("/v1/public/events");
    loadEvents(1, false, activeFilters);
  }, [activeFilters, loadEvents]);

  // Настройка Intersection Observer
  useEffect(() => {
    if (!hasMore || isDynamicLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
          loadEvents(page + 1, true, activeFilters);
        }
      },
      { threshold: 0.1 }
    );

    if (lastCardRef.current) {
      observer.observe(lastCardRef.current);
    }

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isDynamicLoading, page, loadEvents, activeFilters]);

  const applyFilters = useCallback(() => {
    const newFilters = { startDate, endDate };
    if (newFilters.startDate === activeFilters.startDate && newFilters.endDate === activeFilters.endDate) {
      setIsFilterOpen(false);
      return;
    }
    setActiveFilters(newFilters);
    setIsFilterOpen(false);
  }, [startDate, endDate, activeFilters]);

  const resetFilters = useCallback(() => {
    if (!activeFilters.startDate && !activeFilters.endDate) {
      setIsFilterOpen(false);
      return;
    }
    setStartDate("");
    setEndDate("");
    setActiveFilters({ startDate: "", endDate: "" });
    setIsFilterOpen(false);
  }, [activeFilters]);

  const removeFilter = useCallback((filter: "startDate" | "endDate") => {
    const newFilters = { ...activeFilters, [filter]: "" };
    if (filter === "startDate") setStartDate("");
    else setEndDate("");
    setActiveFilters(newFilters);
  }, [activeFilters]);

  const groupedEvents = React.useMemo(() => groupEventsByDate(events), [events]);
  const isFilterActive = !!(activeFilters.startDate || activeFilters.endDate);

  if (serverError) return <ErrorPlaceholder />;

  return (
    <>
      <main className="flex-grow pt-24 pb-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Все мероприятия</h1>
          <div className="mb-6 relative">
            <div className="flex justify-end">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFilterActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}
              >
                <FaFilter className={isFilterActive ? "text-orange-500" : "text-gray-500"} />
                <span>Фильтры {isFilterActive ? "(активны)" : ""}</span>
              </button>
            </div>
            <AnimatePresence>
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
            </AnimatePresence>
            {isFilterActive && !isFilterOpen && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 mr-2">Активные фильтры:</span>
                {activeFilters.startDate && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                    <span>От: {formatDateForDisplay(activeFilters.startDate)}</span>
                    <button onClick={() => removeFilter("startDate")}><FaTimes size={10} /></button>
                  </div>
                )}
                {activeFilters.endDate && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                    <span>До: {formatDateForDisplay(activeFilters.endDate)}</span>
                    <button onClick={() => removeFilter("endDate")}><FaTimes size={10} /></button>
                  </div>
                )}
                <button onClick={resetFilters} className="text-xs text-orange-600 hover:underline">Сбросить все</button>
              </div>
            )}
          </div>
          {error && <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>}
          {events.length === 0 && !error && !isDynamicLoading ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-2">
                {isFilterActive ? "Мероприятия не найдены для выбранного диапазона дат" : "Мероприятия не найдены"}
              </h3>
              {isFilterActive && (
                <button onClick={resetFilters} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Сбросить фильтры</button>
              )}
            </div>
          ) : (
            Object.entries(groupedEvents).map(([date, eventsForDate], groupIndex) => (
              <div key={date} className="mb-8">
                <h2 className="text-lg font-medium text-gray-500 mb-3">{date}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {eventsForDate.map((event, index) => {
                    const isLastCard = groupIndex === Object.keys(groupedEvents).length - 1 && index === eventsForDate.length - 1;
                    return <EventCard key={event.id} event={event} lastCardRef={isLastCard ? lastCardRef : undefined} />;
                  })}
                </div>
              </div>
            ))
          )}
          {!hasMore && events.length > 0 && !isDynamicLoading && (
            <p className="text-center text-gray-600 py-8">Все мероприятия загружены</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EventsPage;