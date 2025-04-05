"use client";
import React, { useState, useRef, useCallback } from "react";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";
import FormattedDescription from "@/components/FormattedDescription";
import { AnimatePresence, motion } from "framer-motion";
import { EventData } from "@/types/events";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import { useLoading } from "@/contexts/LoadingContext";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/api";
import Header from "@/components/Header";

const ITEMS_PER_PAGE = 6;

interface EventsResponse {
  data: EventData[];
  total: number;
}

interface EventsFilters {
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

// Skeleton loader component for event cards
const EventCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-md min-h-[300px] flex flex-col">
      <div className="relative h-48 bg-gray-200 animate-pulse rounded-t-xl"></div>
      <div className="p-4 flex-grow flex flex-col">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
        <div className="space-y-2 mb-4 flex-grow">
          <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse"></div>
        </div>
        <div className="flex justify-between mt-auto">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

// Skeleton loader for a group of events
const EventGroupSkeleton: React.FC = () => {
  return (
    <div className="mb-8">
      <div className="h-6 bg-gray-200 rounded w-1/4 mb-3 animate-pulse"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};

const EventsPage: React.FC = () => {
  const { setDynamicLoading } = useLoading();
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<EventsFilters>({ startDate: "", endDate: "" });
  const [tempFilters, setTempFilters] = useState<EventsFilters>({ startDate: "", endDate: "" });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Используем React Query для управления данными
  const { data, isLoading, error, isFetching } = useQuery<EventsResponse>({
    queryKey: ['events', currentPage, activeFilters.startDate, activeFilters.endDate],
    queryFn: async () => {
      console.log("Fetching events with params:", {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        startDate: formatDateForAPI(activeFilters.startDate),
        endDate: formatDateForAPI(activeFilters.endDate)
      });
      
      const response = await apiFetch<EventData[] | EventsResponse>(
        `/v1/public/events?page=${currentPage}&limit=${ITEMS_PER_PAGE}&start_date=${formatDateForAPI(activeFilters.startDate)}&end_date=${formatDateForAPI(activeFilters.endDate)}`,
        {
          cache: currentPage === 1 ? "no-store" : "default"
        }
      );

      console.log("API response:", response);

      if ('aborted' in response) {
        throw new Error(response.reason || "Request was aborted");
      }

      // Handle both response formats - array or object with data property
      if (Array.isArray(response)) {
        console.log("Converting array response to EventsResponse format");
        return {
          data: response,
          total: response.length
        };
      }

      return response as EventsResponse;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Используем react-intersection-observer для бесконечной прокрутки
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  });

  // Обработка загрузки следующей страницы
  React.useEffect(() => {
    if (inView && data?.data?.length === ITEMS_PER_PAGE && !isFetching) {
      setCurrentPage(prev => prev + 1);
    }
  }, [inView, data?.data?.length, isFetching]);

  // Обновляем состояние загрузки
  React.useEffect(() => {
    // Set global loading state only for initial load
    if (isInitialLoad) {
      setDynamicLoading(isLoading);
    }
    
    // Update initial load state after first data fetch
    if (isInitialLoad && !isLoading && data) {
      setIsInitialLoad(false);
    }
  }, [isLoading, isFetching, setDynamicLoading, data, isInitialLoad]);

  // Memoize filter functions to prevent unnecessary re-renders
  const applyFilters = useCallback(() => {
    if (tempFilters.startDate === "" && tempFilters.endDate === "") {
      setIsFilterOpen(false);
      return;
    }
    setActiveFilters(tempFilters);
    setIsFilterOpen(false);
    setCurrentPage(1); // Сбрасываем страницу при применении фильтров
  }, [tempFilters]);

  const resetFilters = useCallback(() => {
    if (!activeFilters.startDate && !activeFilters.endDate) {
      setIsFilterOpen(false);
      return;
    }
    setActiveFilters({ startDate: "", endDate: "" });
    setTempFilters({ startDate: "", endDate: "" });
    setIsFilterOpen(false);
    setCurrentPage(1); // Сбрасываем страницу при сбросе фильтров
  }, [activeFilters]);

  // Reset temp filters when filter modal is opened
  React.useEffect(() => {
    if (isFilterOpen) {
      setTempFilters(activeFilters);
    }
  }, [isFilterOpen, activeFilters]);

  const groupedEvents = React.useMemo(() => {
    // Skip grouping if data is not available yet
    if (!data?.data) {
      return {};
    }
    
    // Only log when we actually have data to group
    console.log("Grouping events by date, count:", data.data.length);
    return groupEventsByDate(data.data);
  }, [data?.data]); // Only depend on data.data to prevent unnecessary re-renders

  const isFilterActive = !!(activeFilters.startDate || activeFilters.endDate);

  if (error) return <ErrorPlaceholder />;

  // Determine if we should show loading state
  const showInitialLoading = isInitialLoad && isLoading;
  const showPaginationLoading = isFetching && !isInitialLoad && data?.data && data.data.length > 0;
  const showNoData = !data?.data || data.data.length === 0;

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
                <FaFilter className={isFilterActive ? "text-orange-500" : "text-gray-500"} />
                <span>Фильтры {isFilterActive ? "(активны)" : ""}</span>
              </button>
            </div>
            
            {/* Filter dropdown */}
            <AnimatePresence>
              {isFilterOpen && (
                <DateFilter
                  startDate={tempFilters.startDate}
                  endDate={tempFilters.endDate}
                  onStartDateChange={(value) => setTempFilters(prev => ({ ...prev, startDate: value }))}
                  onEndDateChange={(value) => setTempFilters(prev => ({ ...prev, endDate: value }))}
                  onApply={applyFilters}
                  onClose={() => setIsFilterOpen(false)}
                  onReset={resetFilters}
                  startDateRef={startDateInputRef}
                  endDateRef={endDateInputRef}
                />
              )}
            </AnimatePresence>
            
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
                    onClick={resetFilters} 
                    className="text-xs text-orange-600 hover:text-orange-700 hover:underline whitespace-nowrap h-5 flex items-center"
                  >
                    Сбросить все
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Initial loading state with skeleton loaders */}
          {showInitialLoading ? (
            <div className="space-y-8">
              <EventGroupSkeleton />
              <EventGroupSkeleton />
            </div>
          ) : showNoData ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-2">
                {isFilterActive ? "Мероприятия не найдены для выбранного диапазона дат" : "Мероприятия не найдены"}
              </h3>
              {isFilterActive && (
                <button onClick={resetFilters} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Сбросить фильтры</button>
              )}
            </div>
          ) : (
            <>
              {/* Render grouped events */}
              {Object.entries(groupedEvents).map(([date, eventsForDate], groupIndex) => (
                <div key={date} className="mb-8">
                  <h2 className="text-lg font-medium text-gray-500 mb-3">{date}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {eventsForDate.map((event, index) => {
                      const isLastCard = groupIndex === Object.keys(groupedEvents).length - 1 && index === eventsForDate.length - 1;
                      return (
                        <div key={event.id} ref={isLastCard ? loadMoreRef : undefined}>
                          <EventCard event={event} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {/* Loading indicator for pagination */}
              {showPaginationLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <EventCardSkeleton key={`loading-${i}`} />
                  ))}
                </div>
              )}
              
              {/* Show loading more indicator */}
              {data.data.length < data.total && !isFetching && (
                <div className="text-center py-2 mt-2">
                  <p className="text-gray-400 text-sm">Загрузка дополнительных мероприятий...</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EventsPage; 