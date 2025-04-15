/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
"use client";
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import FormattedDescription from "@/components/FormattedDescription";
import { EventData } from "@/types/events";
import { useInView } from "react-intersection-observer";
import { createLogger, LogLevel, configureModuleLogging } from '@/utils/logger';
// Импортируем необходимые хуки из соответствующих контекстов
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
// Импортируем функцию fetchEvents из eventService
import { fetchEvents as fetchEventsService } from '@/utils/eventService';
// Импорты для фильтрации
import { FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";
// Импортируем компонент Footer
import Footer from "@/components/Footer";
import { LoadingStage } from '@/contexts/loading/types';

// Настройка логирования для модуля согласно принципам документации
configureModuleLogging('EventsPage', {
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.INFO,
  enabled: true,
  persistentContext: { component: 'EventsPage' }
});

// Создаем единый логгер для компонента
const logger = createLogger('EventsPage');

// API_BASE_URL is not needed as we use Next.js rewrites for all API calls

// Интерфейс для API ответа с событиями
interface ApiResponse<T> {
  status: string;
  data: T[];
  page: number;
  totalPages: number;
  hasMore: boolean;
}

// Тип ответа с событиями
type EventsResponse = {
  data: EventData[];
  page: number;
  totalPages: number;
  hasMore: boolean;
} | null;

// Параметры для fetchEvents
interface FetchOptions {
  forceTrigger?: boolean;
}

// Интерфейс для состояния фильтров
interface DateFilters {
  startDate: string;
  endDate: string;
}

// Компонент фильтра по датам
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

// Хук для отслеживания монтирования компонента
const useIsMounted = () => {
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  return isMounted;
};

const generateSlug = (event: EventData): string => {
  if (!event || !event.id) return "";
  
  const eventId = event.id;
  const startYear = event.date ? new Date(event.date).getFullYear() : new Date().getFullYear();
  const idStr = String(eventId);

  // Проверяем url_slug от сервера
  if (event.url_slug) {
    // Если url_slug уже содержит правильный формат year-id, возвращаем его как есть
    if (event.url_slug.endsWith(`-${startYear}-${idStr}`)) {
      return event.url_slug;
    }
    
    // Проверяем, не содержит ли url_slug какой-то другой формат year-id
    const parts = event.url_slug.split('-');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const preLast = parts[parts.length - 2];
      
      // Если слаг уже содержит какой-то год и ID, но не те, которые нам нужны
      if (/^\d{4}$/.test(preLast) && /^\d+$/.test(lastPart)) {
        // Извлекаем базовый слаг без года и ID
        const baseSlug = parts.slice(0, -2).join('-');
        return `${baseSlug}-${startYear}-${idStr}`;
      }
    }
    
    // Если url_slug не содержит формат year-id, добавляем его
    return `${event.url_slug}-${startYear}-${idStr}`;
  }
  
  // Для случаев, когда url_slug не задан
  // Создаем безопасный слаг из названия
  const safeSlug = event.title ? 
    event.title.toLowerCase()
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    : 'event';
    
  // Формируем канонический URL в формате slug-year-id
  return `${safeSlug}-${startYear}-${idStr}`;
};

// Вспомогательные функции для работы с датами и слагами
const formatDateForDisplay = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateString;
  }
};

const formatDateForAPI = (dateString: string): string => {
  if (!dateString || dateString.trim() === "") return "";
  try {
    // Преобразуем строку даты в объект Date
    const date = new Date(dateString);
    // Форматируем в YYYY-MM-DD - формат, ожидаемый сервером (ISO без времени)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 т.к. месяцы от 0 до 11
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    logger.error('Error formatting date for API', { dateString, error });
    return "";
  }
};

const getStatusStyles = (status: EventData["status"]) => {
  switch (status) {
    case "registration_open": return { 
      bgColor: "bg-green-500/80", 
      textColor: "text-white",
      label: "Регистрация открыта"
    };
    case "registration_closed": return { 
      bgColor: "bg-orange-500/80", 
      textColor: "text-white",
      label: "Регистрация закрыта"
    };
    case "completed": return { 
      bgColor: "bg-gray-500/80", 
      textColor: "text-white",
      label: "Завершено"
    };
    default: return { 
      bgColor: "bg-gray-500/80", 
      textColor: "text-white",
      label: "Статус не определен"
    };
  }
};

// Добавляем проп index
const EventCard: React.FC<{ event: EventData; index: number; lastCardRef?: (node?: Element | null) => void }> = React.memo(
  ({ event, index, lastCardRef }) => {
    const isCompleted = event.status === "completed";
    // Генерируем слаг для использования в ссылке
    const generatedSlug = generateSlug(event);
    
    return (
      <div ref={lastCardRef}>
        <Link href={`/events/${generatedSlug}`}>
          <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 flex flex-col">
            <div className="relative h-48">
              {event.image_url ? (
                <Image 
                  src={event.image_url} 
                  alt={event.title} 
                  fill 
                  className="object-cover rounded-t-xl" 
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  priority={index < 6} // Добавляем priority для первых 6 изображений
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-xl">
                  <span className="text-gray-500">Нет изображения</span>
                </div>
              )}
              {/* Создаем более сложный градиент с темным сверху и оранжевым снизу */}
              {event.image_url && (
                <div className="absolute inset-0 rounded-t-xl" style={{
                  background: 'linear-gradient(to top, rgba(249, 115, 22, 0.6) 0%, rgba(0, 0, 0, 0.4) 30%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)'
                }}></div>
              )}
              {/* Статус мероприятия теперь будет поверх оверлея */}
              <span className={`absolute top-2 right-2 px-2 py-1 text-xs rounded-full ${getStatusStyles(event.status).bgColor} ${getStatusStyles(event.status).textColor} z-10`}>
                {getStatusStyles(event.status).label}
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
              {/* Добавляем разные стили для разных breakpoints: 
                  - flex-col для экранов < 640px и 640px-768px
                  - flex-row только от 768px и выше */}
              <div className="text-gray-500 text-sm mt-auto flex flex-col items-start gap-1 
                sm:items-start 
                md:flex-row md:items-baseline md:justify-between">
                <span className="flex items-center mb-1 md:mb-0">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDateForDisplay(event.date || event.start_date)}
                </span>
                {event.ticket_type && !isCompleted && (
                  <span className={`bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full w-fit`}>
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

// Компонент скелетона для карточки мероприятия
const EventCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 h-[300px] flex flex-col overflow-hidden">
    <div className="relative h-48 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded-t-xl animate-shimmer bg-[length:200%_100%]"></div>
    <div className="p-4 flex-grow flex flex-col">
      <div className="h-6 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-3/4 mb-3 animate-shimmer bg-[length:200%_100%]"></div>
      <div className="space-y-2 flex-grow">
        <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded animate-shimmer bg-[length:200%_100%]"></div>
        <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-5/6 animate-shimmer bg-[length:200%_100%]"></div>
        <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-4/6 animate-shimmer bg-[length:200%_100%]"></div>
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 mr-2 animate-shimmer bg-[length:200%_100%]"></div>
          <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-20 animate-shimmer bg-[length:200%_100%]"></div>
        </div>
        <div className="h-5 bg-gradient-to-r from-orange-200 via-orange-100 to-orange-200 rounded-full w-24 animate-shimmer bg-[length:200%_100%]"></div>
      </div>
    </div>
  </div>
);

// Компонент для отображения сетки скелетона мероприятий
const EventsSkeletonGrid: React.FC = () => {
  // Генерируем разное количество карточек в разных группах для реалистичности
  const skeletonGroups = [
    { title: 'Ближайшие мероприятия', count: 3 },
    { title: 'Будущие мероприятия', count: 3 },
    { title: 'Прошедшие мероприятия', count: 2 }
  ];
  
  return (
    <>
      {skeletonGroups.map((group, groupIndex) => (
        <div key={`skeleton-group-${groupIndex}`} className="mb-8">
          <div className="h-6 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-48 mb-3 animate-shimmer bg-[length:200%_100%]"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: group.count }).map((_, i) => (
              <EventCardSkeleton key={`skeleton-${groupIndex}-${i}`} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

// Простой компонент спиннера (можно вынести в отдельный файл)
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
);

const EventsPage = () => {
  // Рефы и состояния компонента
  const isMounted = useIsMounted(); // Хук для отслеживания монтирования
  const [data, setData] = useState<EventsResponse>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState<DateFilters>({ startDate: "", endDate: "" });
  const [activeFilters, setActiveFilters] = useState<DateFilters>({ startDate: "", endDate: "" });
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true); // Показываем скелетон при первой загрузке
  const [mountId, setMountId] = useState(0); // Используется для принудительного перезапуска useEffect

  // Рефы для AbortController и отслеживания состояния загрузки
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasInitialData = useRef(false); // Флаг для отслеживания первичной загрузки данных
  const hasAttemptedInitialFetch = useRef(false); // Отслеживаем, была ли попытка первичной загрузки
  const lastFetchTime = useRef(Date.now()); // Отслеживание времени последнего запроса
  const minFetchInterval = 500; // Минимальный интервал между запросами (мс)
  const fetchEventsRef = useRef<string | null>(null); // Реф для хранения параметров последнего запроса
  const prevEventsRef = useRef<Record<string, unknown>>({}); // Реф для кеширования сгруппированных событий

  // Рефы для инпутов дат
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  // Рефы для закрытия фильтра по клику вне окна
  const filterRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Хуки из новой системы загрузки
  const { setStage, currentStage } = useLoadingStage();
  const { setDynamicLoading, setStaticLoading } = useLoadingFlags(); // Предполагая, что setStaticLoading тоже нужен
  const { setError, error: loadingErrorFromContext } = useLoadingError(); // Возвращаем имя loadingErrorFromContext

  // Ref для отслеживания бесконечной прокрутки
  const { ref: lastElementRef, inView } = useInView({
    threshold: 0,
    rootMargin: '0px'
  });
  
  // При монтировании компонента устанавливаем стадию загрузки - УБРАНО ПРИНУДИТЕЛЬНОЕ УПРАВЛЕНИЕ СТАДИЕЙ
  useEffect(() => {
    // Логирование при монтировании можно оставить для отладки, но не управляем стадией
    // if (currentStage !== LoadingStage.ERROR) {
    //   setStage(LoadingStage.DYNAMIC_CONTENT); // <-- Удалено
    //   setDynamicLoading(true); // <-- Удалено
    // }
    
    // Доп. логика для обеспечения перехода в COMPLETED ПОСЛЕ загрузки данных
    const completionTimer = setTimeout(() => {
      if (isMounted.current && hasInitialData.current && currentStage !== LoadingStage.COMPLETED) {
        // Логируем попытку установить COMPLETED
        logger.info('Attempting to set COMPLETED stage via timer', { currentStage });
        setStage(LoadingStage.COMPLETED);
      }
    }, 3000); // Увеличим немного задержку для надежности
    
    return () => {
      clearTimeout(completionTimer);
    };
  }, [mountId, currentStage, setStage, isMounted]);
  
  // Упрощенная группировка без ручного кэширования
  const groupEventsByDate = (events: EventData[]) => {
    if (!events || events.length === 0) return {};
    const grouped: Record<string, EventData[]> = {};
    events.forEach(event => {
      // Используем start_date для группировки, как и раньше
      const dateKey = formatDateForDisplay(event.start_date);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  // Мемоизация сгруппированных событий - используем data.data напрямую
  const groupedEvents = useMemo(() => {
    // Проверяем, что data и data.data существуют
    if (!data?.data) return {};
    return groupEventsByDate(data.data);
    // Зависимость только от data.data
  }, [data?.data]); // Убираем groupEventsByDate из зависимостей, т.к. она стабильна
  
  // Вычисляем активность фильтров на основе применённых фильтров
  const isFilterActive = useMemo(() => {
    return activeFilters.startDate !== "" || activeFilters.endDate !== "";
  }, [activeFilters]);

  // Вспомогательная функция для запуска fetchEvents с заданными фильтрами
  const fetchEventsWithFilters = useCallback(async (filters: DateFilters) => {
    logger.info('Fetching events data', { page, hasFilters: filters.startDate || filters.endDate });
    setIsFetching(true);

    // ---> ИЗМЕНЕНИЕ ЗДЕСЬ: Устанавливаем скелетон ТОЛЬКО для первичной загрузки <--- 
    if (!hasInitialData.current) {
      setShowInitialSkeleton(true);
      // Эти флаги/стадии могут быть нужны для общей системы загрузки,
      // но showInitialSkeleton отвечает только за первый рендер
      setDynamicLoading(true);
      setStage(LoadingStage.DYNAMIC_CONTENT);
    }
    // ---> КОНЕЦ ИЗМЕНЕНИЯ <---

    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New request started');
      abortControllerRef.current = null;
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      const hasActiveStartDate = filters.startDate && filters.startDate.trim() !== '';
      const hasActiveEndDate = filters.endDate && filters.endDate.trim() !== '';
      const serviceFilters = {
        startDate: hasActiveStartDate ? formatDateForAPI(filters.startDate) : '',
        endDate: hasActiveEndDate ? formatDateForAPI(filters.endDate) : ''
      };
      hasAttemptedInitialFetch.current = true;
      fetchEventsService(page, serviceFilters, signal)
        .then(response => {
          if (!isMounted.current) return;
          if (response.success) {
            const parsedData = {
              data: response.data || [],
              page: response.page || page,
              totalPages: response.totalPages || 1,
              hasMore: response.hasMore || false
            };

             setData(prev => {
                const existingData = prev?.data || [];
                const newData = parsedData?.data || [];

                if (page === 1) {
                   return {
                       ...parsedData,
                       data: newData
                   };
                }

                const existingIds = new Set(existingData.map(e => e.id));
                const uniqueNewData = newData.filter(event => !existingIds.has(event.id));

                if (uniqueNewData.length < newData.length) {
                    logger.warn('Filtered out duplicate events received from API', {
                        originalCount: newData.length,
                        uniqueCount: uniqueNewData.length
                    });
                }

                return {
                  ...parsedData,
                  data: [...existingData, ...uniqueNewData]
                };
              });

            setHasMore(parsedData.hasMore);
            const wasAlreadyInitialized = hasInitialData.current;
            hasInitialData.current = true; // Устанавливаем ДО проверки

            // ---> ИЗМЕНЕНИЕ ЗДЕСЬ: Скрываем ИМЕННО начальный скелетон при УСПЕШНОЙ загрузке <---
            // Скрываем только если это была ПЕРВАЯ успешная загрузка
            if (!wasAlreadyInitialized) {
               setShowInitialSkeleton(false);
            }
            // ---> КОНЕЦ ИЗМЕНЕНИЯ <---

            setDynamicLoading(false);
            setStage(LoadingStage.COMPLETED);
            if (loadingErrorFromContext) {
              setError(null);
            }
          } else {
            throw new Error(response.error || 'Failed to fetch events data');
          }
        })
        .catch(error => {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          logger.error('Error fetching events data', {
            error: error instanceof Error ? error.message : String(error)
          });
          if (isMounted.current) {
            // Скрываем начальный скелетон даже при ошибке, чтобы показать сообщение
            setShowInitialSkeleton(false);
            setStage(LoadingStage.ERROR);
            setError(error instanceof Error ?
              error.message :
              'Произошла ошибка при загрузке мероприятий'
            );
          }
        })
        .finally(() => {
          if (isMounted.current) {
            setIsFetching(false);
            lastFetchTime.current = Date.now();
             // Убрали отсюда setShowInitialSkeleton(false)
          }
          if (abortControllerRef.current) {
            abortControllerRef.current = null;
          }
        });
    } catch (error) {
      logger.error('Critical error initiating fetch', {
        error: error instanceof Error ? error.message : String(error)
      });
      setIsFetching(false);
      // Скрываем начальный скелетон при критической ошибке
      setShowInitialSkeleton(false);
    }
  }, [page, setStage, setDynamicLoading, loadingErrorFromContext, setError, isMounted]); // Зависимости useCallback

  // Функция для сброса фильтров
  const handleResetFilters = useCallback(() => {
    logger.info('Resetting filters', { activeFilters });
    
    // Проверяем текущее состояние и отменяем запрос, если он выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Filter reset');
      abortControllerRef.current = null;
    }
    
    // Сбрасываем временные и активные фильтры
    setTempFilters({ startDate: "", endDate: "" });
    setActiveFilters({ startDate: "", endDate: "" });
    setIsFilterOpen(false);
    
    // Сбрасываем страницу и устанавливаем состояние загрузки
    setPage(1);
    setData(null);
    setShowInitialSkeleton(true);
    
    // Сбрасываем флаг начальных данных для принудительной перезагрузки
    hasInitialData.current = false;
    
    // Устанавливаем соответствующую стадию загрузки
    setStage(LoadingStage.DYNAMIC_CONTENT);
    setDynamicLoading(true);
    
    // Запускаем обновленный запрос с короткой задержкой
    setTimeout(() => {
      if (isMounted.current) {
        fetchEventsWithFilters({ startDate: "", endDate: "" });
      }
    }, 50);
  }, [activeFilters, setStage, setDynamicLoading, fetchEventsWithFilters, isMounted]);

  // Функция для применения фильтров
  const handleApplyFilters = useCallback(() => {
    logger.info('Applying filters', { tempFilters });
    
    // Проверяем текущее состояние и отменяем запрос, если он выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Filter apply');
      abortControllerRef.current = null;
    }
    
    // Применяем временные фильтры как активные
    setActiveFilters(tempFilters);
    
    // Сбрасываем страницу на первую и закрываем панель фильтрации
    setPage(1);
    setIsFilterOpen(false);
    setData(null);
    
    // Показываем скелетон загрузки и сбрасываем флаг начальных данных
    setShowInitialSkeleton(true);
    hasInitialData.current = false;
    
    // Устанавливаем соответствующую стадию загрузки
    setStage(LoadingStage.DYNAMIC_CONTENT);
    setDynamicLoading(true);
    
    // Запускаем запрос данных с примененными фильтрами
    setTimeout(() => {
      if (isMounted.current) {
        // Напрямую используем актуальные значения tempFilters
        fetchEventsWithFilters(tempFilters);
      }
    }, 50);
  }, [tempFilters, setStage, setDynamicLoading, fetchEventsWithFilters, isMounted]);

  // Обработчик автоматической загрузки следующей страницы при прокрутке
  useEffect(() => {
    // Этот хук ТОЛЬКО увеличивает номер страницы, когда условия выполнены.
    // Он НЕ зависит от самого номера страницы.
    logger.info('[InfiniteScroll Trigger Check]', { inView, hasMore, isFetching, hasInitialData: hasInitialData.current });

    if (inView && hasMore && !isFetching && hasInitialData.current) {
      const now = Date.now();
      if (now - lastFetchTime.current >= minFetchInterval) {
        logger.info('[InfiniteScroll Trigger] Threshold met, incrementing page from', { page });
        setPage(prevPage => prevPage + 1); // Используем функциональное обновление
        lastFetchTime.current = now; // Обновляем время сразу
      } else {
        // Дебаунс
        const delay = minFetchInterval - (now - lastFetchTime.current);
        logger.info('[InfiniteScroll Trigger] Debounce timer set', { delay });
        const timer = setTimeout(() => {
          // Повторная проверка условий внутри таймера
          if (isMounted.current && inView && hasMore && !isFetching) {
            logger.info('[InfiniteScroll Trigger] Debounce timer fired, incrementing page from', { page });
            setPage(prevPage => prevPage + 1); // Используем функциональное обновление
            lastFetchTime.current = Date.now(); // Обновляем время сразу
          } else {
            logger.warn('[InfiniteScroll Trigger] Debounce timer fired, but conditions no longer met', { inView, hasMore, isFetching });
          }
        }, delay);
        return () => clearTimeout(timer);
      }
    }
    // Убираем 'page' из зависимостей!
  }, [inView, hasMore, isFetching, minFetchInterval, isMounted, hasInitialData]); // Добавлен hasInitialData для полноты

  // Эффект для ЗАГРУЗКИ данных при изменении номера страницы (кроме первой)
  useEffect(() => {
    // Добавляем проверку hasMore!
    // Fetch only if it's not the first page, we *expect* more data,
    // initial data is loaded, and we are not already fetching.
    if (page > 1 && hasMore && hasInitialData.current && !isFetching) {
      logger.info('[Page Change Effect] Fetching data for new page', { page, hasMore, activeFilters });
      fetchEventsWithFilters(activeFilters);
    } else if (page > 1 && !hasMore) {
        logger.info('[Page Change Effect] Page changed, but hasMore is false. No fetch.', { page });
    } else if (page > 1 && isFetching) {
       logger.warn('[Page Change Effect] Page changed, but already fetching', { page });
    }
    // Добавляем hasMore в зависимости!
  }, [page, hasMore, activeFilters, fetchEventsWithFilters, hasInitialData, isFetching]);

  // Эффект для загрузки НАЧАЛЬНЫХ данных при монтировании (page === 1)
  useEffect(() => {
    isMounted.current = true;
    // Загружаем только если нет данных, не было попытки и не идет загрузка
    if (!hasInitialData.current && !hasAttemptedInitialFetch.current && !isFetching) {
      const initialFetchTimer = setTimeout(() => {
        // Повторная проверка монтирования и статуса загрузки
        if (isMounted.current && !isFetching) {
          logger.info('[Initial Load Effect] Initial fetch timer fired');
          fetchEventsWithFilters({ startDate: "", endDate: "" }); // page === 1 по умолчанию
        }
      }, 50);
      return () => clearTimeout(initialFetchTimer);
    }
    // Добавлена зависимость от isFetching, чтобы предотвратить запуск, если загрузка уже инициирована
  }, [mountId, fetchEventsWithFilters, isMounted, isFetching]);
  
  // Эффект для отслеживания стадии загрузки и контроля корректных переходов
  useEffect(() => {
    // Если данные загружены, но стадия загрузки не COMPLETED, устанавливаем COMPLETED
    if (hasInitialData.current && 
        !isFetching && 
        currentStage !== LoadingStage.COMPLETED && 
        currentStage !== LoadingStage.ERROR) {
      
      // Небольшая задержка для предотвращения конфликтов с другими переходами
      const stageChangeTimer = setTimeout(() => {
        if (isMounted.current && hasInitialData.current) {
          setStage(LoadingStage.COMPLETED);
        }
      }, 500);
      
      return () => clearTimeout(stageChangeTimer);
    }
  }, [currentStage, isFetching, setStage, isMounted]);
  
  // Эффект для закрытия фильтра по клику вне его области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Проверяем, открыт ли фильтр и был ли клик вне области фильтра и вне кнопки открытия
      if (
        isFilterOpen &&
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    // Добавляем слушатель, если фильтр открыт
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      // Убираем слушатель, если фильтр закрыт
      document.removeEventListener("mousedown", handleClickOutside);
    }

    // Очистка слушателя при размонтировании компонента
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFilterOpen]); // Зависимость только от isFilterOpen

  // Рендер состояния ошибки
  if (currentStage === LoadingStage.ERROR) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Произошла ошибка при загрузке мероприятий</h2>
          <p className="text-gray-700 mb-4">{loadingErrorFromContext || "Не удалось загрузить данные. Попробуйте позже."}</p>
          <button 
            onClick={() => {
              setError(null);
              setPage(1);
              hasInitialData.current = false;
              hasAttemptedInitialFetch.current = false;
              fetchEventsWithFilters({ startDate: "", endDate: "" });
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Фильтр должен отображаться только если мы успешно загрузили данные
  const showFilter = hasInitialData.current || (data && data.data.length > 0) || currentStage === LoadingStage.COMPLETED;

  // Проверка состояния загрузки
  const isLoadingCompleted = currentStage === LoadingStage.COMPLETED;
  
  // Рендер страницы с событиями или скелетоном загрузки
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      
      <div className="container mx-auto p-4 pt-8">
        <h1 className="text-3xl font-bold mb-8 text-center">Все мероприятия</h1>
        
        {/* Панель фильтров */}
        {showFilter && (
          <div className="mb-6 relative">
            <div className="flex justify-end">
              <button
                ref={filterButtonRef}
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFilterActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}
              >
                <div className={isFilterActive ? "text-orange-500" : "text-gray-500"}>
                  <FaFilter size={16} />
                </div>
                <span>Фильтры {isFilterActive ? "(активны)" : ""}</span>
              </button>
            </div>

            {/* Выпадающий фильтр */}
            {isFilterOpen && (
              <div ref={filterRef}>
                <DateFilter
                  startDate={tempFilters.startDate}
                  endDate={tempFilters.endDate}
                  onStartDateChange={(value) => {
                    setTempFilters(prev => ({ ...prev, startDate: value }));
                  }}
                  onEndDateChange={(value) => {
                    setTempFilters(prev => ({ ...prev, endDate: value }));
                  }}
                  onApply={() => {
                    handleApplyFilters();
                  }}
                  onClose={() => setIsFilterOpen(false)}
                  onReset={handleResetFilters}
                  startDateRef={startDateInputRef}
                  endDateRef={endDateInputRef}
                />
              </div>
            )}
            
            {/* Отображение активных фильтров */}
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
        )}
        
        {/* Показываем ИЗНАЧАЛЬНЫЙ скелетон */} 
        {!data && showInitialSkeleton && (
          <EventsSkeletonGrid />
        )}
        
        {/* Показываем данные, когда они загружены */} 
        {/* Важно: Не рендерим данные, если активен начальный скелетон */}
        {data && !showInitialSkeleton && (
          <>
            {data.data.length > 0 ? (
              // Отображаем события, сгруппированные по датам
              Object.entries(groupedEvents).map(([date, eventsForDate], groupIndex) => (
                <div key={date} className="mb-8">
                  <h2 className="text-lg font-medium text-gray-700 mb-3">{date}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {eventsForDate.map((event, index) => {
                      const globalIndex = data.data.findIndex(e => e.id === event.id);
                      const isLastItem = groupIndex === Object.keys(groupedEvents).length - 1 &&
                                         index === eventsForDate.length - 1;
                      return (
                        <EventCard
                          key={event.id}
                          event={event}
                          index={globalIndex}
                          lastCardRef={isLastItem ? lastElementRef : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="text-4xl mb-4">🎭</div>
                <h3 className="text-2xl font-semibold mb-2 text-gray-700">Нет доступных мероприятий</h3>
                <p className="text-gray-600">
                  {isFilterActive 
                    ? "Нет мероприятий, соответствующих выбранным фильтрам." 
                    : "В данный момент нет запланированных мероприятий. Загляните позже!"}
                </p>
                {isFilterActive && (
                  <button
                    onClick={handleResetFilters}
                    className="mt-6 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Сообщение об ошибке */}
        {(currentStage as LoadingStage) === LoadingStage.ERROR && !showInitialSkeleton && (
           <div className="p-8 text-center">
             <h2 className="text-xl font-semibold text-red-600 mb-4">Произошла ошибка</h2>
             <p className="text-gray-700 mb-4">{loadingErrorFromContext || "Не удалось загрузить данные."}</p>
             {/* Кнопка Повторить? */} 
           </div>
        )}
        
        {/* ---> ИЗМЕНЕНИЕ ЗДЕСЬ: Добавляем локальный спиннер при подгрузке <--- */}
        {isFetching && page > 1 && <LoadingSpinner />}
        
        {/* Элемент для отслеживания бесконечной прокрутки */}
        {hasMore && !isFetching && (
          <div ref={lastElementRef} className="h-20 flex items-center justify-center">
            {/* Убрали текст */}
          </div>
        )}
        
        {!hasMore && data?.data && data.data.length > 0 && !isFetching && (
          <p className="text-center text-gray-600 py-8">Все мероприятия загружены</p>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default EventsPage;