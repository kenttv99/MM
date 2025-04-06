"use client";
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";
import FormattedDescription from "@/components/FormattedDescription";
import { EventData } from "@/types/events";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import { useLoading } from "@/contexts/LoadingContext";
import { useInView } from "react-intersection-observer";
import { apiFetch } from "@/utils/api";
import Header from "@/components/Header";

const ITEMS_PER_PAGE = 6;

interface EventsResponse {
  data: EventData[];
  total: number;
}

interface FilterState {
  startDate: string;
  endDate: string;
}

const generateSlug = (title: string, id: number): string => {
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-"
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
  startDateRef: React.RefObject<HTMLInputElement>;
  endDateRef: React.RefObject<HTMLInputElement>;
}> = ({ startDate, endDate, onStartDateChange, onEndDateChange, onApply, onClose, onReset, startDateRef, endDateRef }) => {
  const handleCalendarClick = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current && typeof ref.current.showPicker === "function") ref.current.showPicker();
  };

  return (
    <div
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
            <div 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
              onClick={() => handleCalendarClick(startDateRef)}
            >
              <FaCalendarAlt size={16} />
            </div>
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
            <div 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
              onClick={() => handleCalendarClick(endDateRef)}
            >
              <FaCalendarAlt size={16} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between pt-4 border-t">
        <button onClick={onReset} className="px-3 py-2 bg-gray-100 rounded-lg flex items-center gap-1">
          <FaTimes size={10} /> Сбросить
        </button>
        <button onClick={onApply} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Применить</button>
      </div>
    </div>
  );
};

const EventCard: React.FC<{ event: EventData; lastCardRef?: (node?: Element | null) => void }> = React.memo(
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

const EventsPage = () => {
  const { setDynamicLoading, isDynamicLoading } = useLoading();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({ startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<EventsResponse | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchTime = useRef<number>(0);
  const minFetchInterval = 2000; // 2 секунды между запросами
  const prevEventsRef = useRef<{ [key: string]: EventData[] }>({});
  const isMounted = useRef(true);
  const hasInitialData = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingStateRef = useRef({ isLoading: false, isFetching: false });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isMounted.current) return;

    const currentTime = Date.now();
    if (currentTime - lastFetchTime.current < minFetchInterval) {
      console.log('Events: Skipping request due to rate limiting');
      return;
    }

    lastFetchTime.current = currentTime;
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      setIsFetching(true);
      if (!hasInitialData.current) {
        setIsLoading(true);
      }
      
      setDynamicLoading(true);
      
      const endpoint = `/v1/public/events?page=${page}&limit=${ITEMS_PER_PAGE}&search=&start_date=${activeFilters.startDate ? formatDateForAPI(activeFilters.startDate) : ''}&end_date=${activeFilters.endDate ? formatDateForAPI(activeFilters.endDate) : ''}`;
      
      const response = await apiFetch<EventsResponse | EventData[]>(endpoint, {
        signal: abortControllerRef.current.signal
      });
      
      if (!isMounted.current) return;
      
      if ('error' in response) {
        throw new Error(response.error);
      }
      
      if ('aborted' in response) {
        throw new Error('Request was aborted: ' + response.reason);
      }
      
      // Format the response
      const formattedResponse = Array.isArray(response) 
        ? { data: response, total: response.length } 
        : response;
      
      // Check if we have more pages to load
      setHasMore(formattedResponse.data.length === ITEMS_PER_PAGE);
      
      setData(formattedResponse);
      setError(null);
      hasInitialData.current = true;
      
    } catch (err: any) {
      if (!isMounted.current) return;
      
      // Only set error if it's not an abort error
      if (err.name !== 'AbortError') {
        console.error("Error fetching events:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetching(false);
        setDynamicLoading(false);
      }
    }
  }, [page, activeFilters, setDynamicLoading]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Мемоизируем isFilterActive
  const isFilterActive = useMemo(() => {
    return activeFilters.startDate !== "" || activeFilters.endDate !== "";
  }, [activeFilters]);

  // Настройка бесконечной прокрутки
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false,
  });

  // Эффект для загрузки следующей страницы при прокрутке
  useEffect(() => {
    if (!isMounted.current) return;
    
    if (inView && hasMore && !isLoading && !isFetching && hasInitialData.current) {
      const now = Date.now();
      if (now - lastFetchTime.current >= minFetchInterval) {
        console.log('EventsPage: Loading next page', { 
          currentPage: page, 
          hasMore, 
          isLoading, 
          isFetching 
        });
        
        lastFetchTime.current = now;
        setPage(prev => prev + 1);
      }
    }
  }, [inView, hasMore, isLoading, isFetching, page, minFetchInterval]);

  // Мемоизируем функцию сброса фильтров
  const handleResetFilters = useCallback(() => {
    setActiveFilters({ startDate: "", endDate: "" });
    setIsFilterOpen(false);
    setPage(1);
  }, []);

  // Мемоизируем функцию применения фильтров
  const handleApplyFilters = useCallback(() => {
    setPage(1);
    setIsFilterOpen(false);
  }, []);

  // Мемоизируем функцию группировки событий
  const groupedEvents = useMemo(() => {
    if (!data?.data) return {};
    return groupEventsByDate(data.data);
  }, [data?.data]);

  // Обновляем состояние загрузки только при изменении isLoading
  useEffect(() => {
    if (!isMounted.current) return;
    
    console.log('EventsPage: Loading state effect', { 
      isLoading, 
      isFetching, 
      currentState: loadingStateRef.current 
    });
    
    // Обновляем ссылку на текущее состояние
    loadingStateRef.current = { isLoading, isFetching };
    
    // Если состояние загрузки изменилось, обновляем глобальное состояние
    if (isLoading !== undefined) {
      console.log('EventsPage: Updating global loading state', { isLoading });
      setDynamicLoading(isLoading);
    }
  }, [isLoading, isFetching, setDynamicLoading]);

  const groupEventsByDate = (events: EventData[]) => {
    // Проверяем, изменились ли события
    if (JSON.stringify(prevEventsRef.current) === JSON.stringify(events)) {
      return prevEventsRef.current;
    }
    
    console.log('Grouping events:', events);
    const grouped: { [key: string]: EventData[] } = {};
    events.forEach(event => {
      const dateKey = formatDateForDisplay(event.start_date);
      console.log('Event date key:', dateKey, 'for event:', event);
      grouped[dateKey] = grouped[dateKey] || [];
      grouped[dateKey].push(event);
    });
    console.log('Grouped events:', grouped);
    
    // Сохраняем сгруппированные события
    prevEventsRef.current = grouped;
    
    return grouped;
  };

  if (error) return <ErrorPlaceholder />;

  return (
    <>
      <Header />
      <main className="flex-grow pt-24 pb-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Все мероприятия</h1>
          
          {/* Filter UI */}
          <div className="mb-6 relative">
            <div className="flex justify-end">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFilterActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}
              >
                <div className={isFilterActive ? "text-orange-500" : "text-gray-500"}>
                  <FaFilter size={16} />
                </div>
                <span>Фильтры {isFilterActive ? "(активны)" : ""}</span>
              </button>
            </div>

            {/* Filter dropdown */}
              {isFilterOpen && (
                <DateFilter
                  startDate={activeFilters.startDate}
                  endDate={activeFilters.endDate}
                  onStartDateChange={(value) => setActiveFilters(prev => ({ ...prev, startDate: value }))}
                  onEndDateChange={(value) => setActiveFilters(prev => ({ ...prev, endDate: value }))}
                onApply={handleApplyFilters}
                  onClose={() => setIsFilterOpen(false)}
                onReset={handleResetFilters}
                  startDateRef={startDateInputRef}
                  endDateRef={endDateInputRef}
                />
              )}
            
            {/* Active filters display */}
            {isFilterActive && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">Активные фильтры:</span>
                <div className="flex flex-wrap items-center gap-2">
                {activeFilters.startDate && (
                    <div className="inline-flex items-center h-5 px-2 bg-orange-100 text-orange-700 rounded-full text-xs">
                      <span className="leading-none">От: {formatDateForDisplay(activeFilters.startDate)}</span>
                  </div>
                )}
                {activeFilters.endDate && (
                    <div className="inline-flex items-center h-5 px-2 bg-orange-100 text-orange-700 rounded-full text-xs">
                      <span className="leading-none">До: {formatDateForDisplay(activeFilters.endDate)}</span>
                  </div>
                )}
                  <button 
                    onClick={handleResetFilters} 
                    className="text-xs text-orange-600 hover:text-orange-700 hover:underline whitespace-nowrap h-5 flex items-center"
                  >
                    Сбросить все
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {error && <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>}
          {!data?.data?.length && !error && !isDynamicLoading ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-2">
                {isFilterActive ? "Мероприятия не найдены для выбранного диапазона дат" : "Мероприятия не найдены"}
              </h3>
              {isFilterActive && (
                <button onClick={handleResetFilters} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Сбросить фильтры</button>
              )}
            </div>
          ) : (
            Object.entries(groupedEvents).map(([date, eventsForDate], groupIndex) => (
                  <div key={date} className="mb-8">
                <h2 className="text-lg font-medium text-gray-500 mb-3">{date}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {eventsForDate.map((event, index) => {
                    const isLastCard = groupIndex === Object.keys(groupedEvents).length - 1 && index === eventsForDate.length - 1;
                    return <EventCard key={event.id} event={event} lastCardRef={isLastCard ? ref : undefined} />;
                      })}
                    </div>
                  </div>
            ))
          )}
          {!hasMore && data?.data && data.data.length > 0 && !isDynamicLoading && (
            <p className="text-center text-gray-600 py-8">Все мероприятия загружены</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EventsPage;