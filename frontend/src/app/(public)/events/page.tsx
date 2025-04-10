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
import { LoadingStage } from "@/contexts/LoadingContext";

// Добавляем уровни логирования для оптимизации вывода
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

// Устанавливаем уровень логирования (можно менять при разработке/продакшене)
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.WARN 
  : LOG_LEVEL.INFO;

// Вспомогательные функции для логирования с разными уровнями
const logDebug = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
    console.log(`EventsPage: ${message}`, data);
  }
};

const logInfo = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
    console.log(`EventsPage: ${message}`, data);
  }
};

const logWarn = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
    console.log(`EventsPage: ⚠️ ${message}`, data);
  }
};

const logError = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
    console.error(`EventsPage: ⛔ ${message}`, data);
  }
};

const ITEMS_PER_PAGE = 6;
// API_BASE_URL is not needed as we use Next.js rewrites for all API calls

interface EventsResponse {
  data: EventData[];
  total: number;
}

interface FilterState {
  startDate: string;
  endDate: string;
}

const generateSlug = (event: EventData): string => {
  // Если есть url_slug, используем его
  if (event.url_slug) {
    return event.url_slug;
  }
  
  // Иначе генерируем из названия (для обратной совместимости)
  const title = event.title || 'event';
  const id = event.id;
  const startYear = event.start_date ? new Date(event.start_date).getFullYear() : new Date().getFullYear();
  
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-"
  };
  
  // Транслитерация названия
  let slug = title.toLowerCase().split("").map(char => translitMap[char] || char).join("")
    .replace(/[^a-z0-9-]+/g, "-") // заменяем все не букво-цифровые символы на дефис
    .replace(/-+/g, "-")          // заменяем множественные дефисы одним
    .replace(/^-+|-+$/g, "");     // удаляем начальные и конечные дефисы
  
  // Если после обработки слаг пустой, используем запасной вариант
  slug = slug || "event";
  
  // Формируем финальный слаг в новом формате с годом
  return `${slug}-${startYear}-${id}`;
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
        <Link href={`/events/${generateSlug(event)}`}>
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
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
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

const EventsPage = () => {
  const { setDynamicLoading, isDynamicLoading, currentStage, setStage } = useLoading();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({ startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<EventsResponse | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchTime = useRef<number>(0);
  const minFetchInterval = 2000; // 2 секунды между запросами
  const prevEventsRef = useRef<{ [key: string]: EventData[] }>({});
  const isMounted = useRef(true);
  const hasInitialData = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const firstLoadRef = useRef(true);

  // Определяем мемоизированное значение isFilterActive перед его использованием
  const isFilterActive = useMemo(() => {
    return activeFilters.startDate !== "" || activeFilters.endDate !== "";
  }, [activeFilters]);

  // Функция загрузки данных - максимально упрощенная версия
  const fetchEvents = useCallback(async (pageNum = page) => {
    if (!isMounted.current) return;
    
    // Защита от слишком частых запросов
    const currentTime = Date.now();
    if (currentTime - lastFetchTime.current < minFetchInterval) {
      logDebug('Skipping fetch - rate limiting active');
      return;
    }
    
    // Обновляем время последнего запроса
    lastFetchTime.current = currentTime;
    
    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Создаем новый контроллер
    abortControllerRef.current = new AbortController();
    
    // Обновляем состояние загрузки
    setIsFetching(true);
    setIsLoading(!hasInitialData.current);
    setDynamicLoading(true);
    
    // Проверяем, активны ли фильтры
    const isFiltersActive = activeFilters.startDate !== "" || activeFilters.endDate !== "";
    
    // Определяем источник запроса для логов
    const requestSource = new Error().stack?.includes('placeholder') 
      ? 'placeholder_reset' 
      : isFiltersActive ? 'filter_active' : 'filter_reset';
    
    // Формируем URL запроса с обязательным временным штампом для предотвращения кэширования
    const nocacheParam = `&_nocache=${Date.now()}`;
    const endpoint = `/v1/public/events?page=${pageNum}&limit=${ITEMS_PER_PAGE}&search=&start_date=${
      activeFilters.startDate ? formatDateForAPI(activeFilters.startDate) : ''
    }&end_date=${
      activeFilters.endDate ? formatDateForAPI(activeFilters.endDate) : ''
    }${nocacheParam}`;
    
    // Логируем запрос с полным URL
    logInfo('Fetching events', { 
      page: pageNum, 
      hasInitialData: hasInitialData.current,
      source: requestSource,
      fullUrl: endpoint,
      filters: {
        startDate: activeFilters.startDate ? formatDateForAPI(activeFilters.startDate) : 'none',
        endDate: activeFilters.endDate ? formatDateForAPI(activeFilters.endDate) : 'none',
        active: isFiltersActive
      }
    });
    
    try {
      // Выполняем запрос, всегда используя обход проверки стадии загрузки
      const response = await apiFetch<EventsResponse | EventData[]>(endpoint, {
        signal: abortControllerRef.current.signal,
        bypassLoadingStageCheck: true
      });
      
      // Проверяем, что компонент не был размонтирован
      if (!isMounted.current) return;
      
      // Обрабатываем возможные ошибки
      if ('error' in response) {
        logError('API returned error', response.error);
        setError(new Error(typeof response.error === 'string' ? response.error : 'API error'));
        return;
      }
      
      // Обрабатываем случай, когда запрос был отменен
      if ('aborted' in response) {
        logWarn('Request was aborted', response.reason);
        
        // Если запрос был заблокирован из-за стадии загрузки, пробуем еще раз через таймаут
        if (response.reason?.includes('loading_stage')) {
          logInfo('Request blocked due to loading stage, retrying after timeout');
          setTimeout(() => {
            if (isMounted.current) {
              fetchEvents(pageNum);
            }
          }, 500);
        }
        
        return;
      }
      
      // Детальное логирование полученного ответа
      logInfo('Raw API response', {
        responseType: typeof response,
        hasDataProp: response.hasOwnProperty('data'), 
        isArray: Array.isArray(response),
        arrayLength: Array.isArray(response) ? response.length : 'not array',
        responseKeys: typeof response === 'object' ? Object.keys(response) : 'not object'
      });
      
      let formattedResponse = {} as EventsResponse;
      
      // Обрабатываем разные форматы ответа
      if (Array.isArray(response)) {
        formattedResponse = { data: response, total: response.length };
      } else if ('data' in response && Array.isArray(response.data)) {
        formattedResponse = response as EventsResponse;
      } else if (typeof response === 'object') {
        // Пробуем извлечь данные из разных возможных свойств
        const data = (response as any).items || (response as any).events || (response as any).results || [];
        const responseTotal = typeof (response as any).total === 'number' ? (response as any).total : (Array.isArray(data) ? data.length : 0);
        
        formattedResponse = {
          data: Array.isArray(data) ? data : [],
          total: responseTotal
        };
      }
      
      // Подробное логирование отформатированного ответа
      logInfo('Formatted response', {
        hasData: !!formattedResponse.data,
        dataLength: Array.isArray(formattedResponse.data) ? formattedResponse.data.length : 'not array',
        total: formattedResponse.total
      });
      
      // Обновляем состояние компонента
      setData(formattedResponse);
      setHasMore(Array.isArray(formattedResponse.data) && formattedResponse.data.length === ITEMS_PER_PAGE);
      setError(null);
      
      // ВАЖНО: устанавливаем флаг, что данные загружены - это предотвратит повторные загрузки
      hasInitialData.current = true;
      
      logInfo('Events data loaded successfully', { 
        count: formattedResponse.data.length,
        total: formattedResponse.total
      });
    } catch (err: any) {
      if (!isMounted.current) return;
      
      logError('Error fetching events', {
        name: err?.name,
        message: err?.message
      });
      
      if (err.name !== 'AbortError') {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        // Сбрасываем все статусы загрузки
        setIsLoading(false);
        setIsFetching(false);
        setDynamicLoading(false);
      }
    }
  }, [page, activeFilters.startDate, activeFilters.endDate, setDynamicLoading, ITEMS_PER_PAGE]);

  // Один эффект для инициализации и загрузки данных - максимально упрощенный
  useEffect(() => {
    // Устанавливаем флаги при монтировании
    isMounted.current = true;
    hasInitialData.current = false; // Важно сбросить при каждом монтировании
    
    logInfo('Events page mounted - initializing');

    // Одна простая функция, которая гарантированно загрузит данные
    const performInitialDataFetch = () => {
      if (!isMounted.current || hasInitialData.current) return; // Загружаем только один раз
      
      logInfo('Performing guaranteed initial data fetch');
      fetchEvents();
    };

    // Запускаем таймер безусловной загрузки данных через 200мс
    const fetchTimer = setTimeout(() => {
      if (isMounted.current && !hasInitialData.current) {
        logInfo('Initial data fetch timer triggered - loading data unconditionally');
        performInitialDataFetch();
      }
    }, 200);
    
    // Запускаем таймер скрытия скелетона через определенное время,
    // чтобы гарантировать, что пользователь не увидит пустую страницу
    const skeletonTimer = setTimeout(() => {
      if (isMounted.current) {
        logInfo('Hiding skeleton regardless of data state');
        setShowInitialSkeleton(false);
      }
    }, 2000); // Даем 2 секунды на загрузку, потом в любом случае скрываем
    
    // Очистка при размонтировании
    return () => {
      isMounted.current = false;
      clearTimeout(fetchTimer);
      clearTimeout(skeletonTimer);
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Сбрасываем все статусы загрузки при размонтировании
      setIsLoading(false);
      setIsFetching(false);
      setDynamicLoading(false);
    };
  }, []); // Пустой массив зависимостей - запуск только при монтировании

  // Отдельный эффект для изменения page
  useEffect(() => {
    if (!isMounted.current || page === 1 || !hasInitialData.current) return;
    
    logInfo('Page changed, fetching new data', { page });
    fetchEvents(page);
  }, [page, fetchEvents]);

  // Бесконечная прокрутка
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false,
  });

  // Эффект для бесконечной прокрутки
  useEffect(() => {
    if (!isMounted.current || !inView || !hasMore || isLoading || isFetching || !hasInitialData.current) {
      return;
    }
    
    const currentTime = Date.now();
    if (currentTime - lastFetchTime.current >= minFetchInterval) {
      logInfo('Loading next page via infinite scroll');
        setPage(prev => prev + 1);
    }
  }, [inView, hasMore, isLoading, isFetching, minFetchInterval]);

  // Мемоизированные функции для фильтров
  const handleResetFilters = useCallback(() => {
    // Важно: вычисляем актуальное значение isFilterActive в момент вызова
    const currentFilterActive = activeFilters.startDate !== "" || activeFilters.endDate !== "";
    logInfo('Resetting filters and reloading data', { isFilterActive: currentFilterActive });
    
    // Устанавливаем новое состояние фильтров
    setActiveFilters({ startDate: "", endDate: "" });
    setIsFilterOpen(false);
    setPage(1);
    setData(null); // Сбрасываем данные, чтобы гарантировать перезагрузку
    
    // Отменяем текущий запрос если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Показываем скелетон на короткое время
    setShowInitialSkeleton(true);
    
    // Сбрасываем флаг hasInitialData для гарантированной перезагрузки
    hasInitialData.current = false;
    firstLoadRef.current = true; // Сбрасываем флаг первой загрузки
    
    // Очистка кэша API перед новым запросом
    window.dispatchEvent(new CustomEvent('clear-api-cache', { detail: { pattern: '/v1/public/events' }}));
    
    // Создаем новый контроллер для прямого запроса
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // Прямой API запрос без фильтров и с уникальным временным штампом
    setTimeout(() => {
      if (!isMounted.current) return;
      
      logInfo('Performing direct API call with empty filters');
      
      // Указываем пустые значения фильтров в URL
      const directEndpoint = `/v1/public/events?page=1&limit=${ITEMS_PER_PAGE}&search=&start_date=&end_date=&_nocache=${Date.now()}`;
      
      logInfo('Direct API endpoint', { url: directEndpoint });
      
      // Устанавливаем состояние загрузки
      setIsFetching(true);
      setIsLoading(true);
      setDynamicLoading(true);
      
      apiFetch<EventsResponse | EventData[]>(directEndpoint, {
        signal: controller.signal,
        bypassLoadingStageCheck: true
      })
      .then(response => {
        if (!isMounted.current) return;
        
        // Подробно логируем полученные данные
        logInfo('Direct API response', { 
          type: typeof response,
          isArray: Array.isArray(response),
          keys: typeof response === 'object' ? Object.keys(response) : []
        });
        
        // Обрабатываем ответ
        let formattedResponse: EventsResponse = { data: [], total: 0 };
        
        if (Array.isArray(response)) {
          formattedResponse.data = response;
          formattedResponse.total = response.length;
        } else if ('data' in response && Array.isArray(response.data)) {
          formattedResponse = response as EventsResponse;
        } else if (typeof response === 'object') {
          const data = (response as any).items || (response as any).events || (response as any).results || [];
          formattedResponse.data = Array.isArray(data) ? data : [];
          formattedResponse.total = typeof (response as any).total === 'number' ? 
            (response as any).total : formattedResponse.data.length;
        }
        
        // Обновляем состояние
        setData(formattedResponse);
        setHasMore(formattedResponse.data.length === ITEMS_PER_PAGE);
        hasInitialData.current = true;
        
        logInfo('Direct API data loaded', { 
          count: formattedResponse.data.length,
          total: formattedResponse.total
        });
      })
      .catch(error => {
        if (!isMounted.current) return;
        logError('Error in direct API call', error);
        if (error.name !== 'AbortError') {
          setError(error instanceof Error ? error : new Error(String(error)));
        }
      })
      .finally(() => {
        if (!isMounted.current) return;
        
        // Сбрасываем состояние загрузки
        setIsLoading(false);
        setIsFetching(false);
        setDynamicLoading(false);
        
        // Гарантированно скрываем скелетон
        setTimeout(() => {
          if (isMounted.current) {
            setShowInitialSkeleton(false);
          }
        }, 1000);
      });
    }, 200);
  }, [fetchEvents]);

  const handleApplyFilters = useCallback(() => {
    setPage(1);
    setIsFilterOpen(false);
    
    // Инициируем загрузку данных с новыми фильтрами
    setTimeout(() => {
      if (isMounted.current) {
        fetchEvents(1);
      }
    }, 0);
  }, [fetchEvents]);

  // Функция группировки событий
  const groupEventsByDate = useCallback((events: EventData[]) => {
    // Проверяем, изменились ли события
    if (JSON.stringify(prevEventsRef.current) === JSON.stringify(events)) {
      return prevEventsRef.current;
    }
    
    const grouped: { [key: string]: EventData[] } = {};
    events.forEach(event => {
      const dateKey = formatDateForDisplay(event.start_date);
      grouped[dateKey] = grouped[dateKey] || [];
      grouped[dateKey].push(event);
    });
    
    prevEventsRef.current = grouped;
    return grouped;
  }, []);

  // Мемоизируем сгруппированные события
  const groupedEvents = useMemo(() => {
    if (!data?.data) return {};
    return groupEventsByDate(data.data);
  }, [data?.data, groupEventsByDate]);

  // Определяем, нужно ли показывать скелетон
  const shouldShowSkeleton = isLoading || isFetching || isDynamicLoading || showInitialSkeleton;

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
          
          {shouldShowSkeleton ? (
            // Показываем скелетон во время загрузки или при первоначальном рендере
            <EventsSkeletonGrid />
          ) : !data?.data?.length ? (
            // Если нет данных и не идет загрузка
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-2">
                {isFilterActive ? "Мероприятия не найдены для выбранного диапазона дат" : "Мероприятия не найдены"}
              </h3>
              {isFilterActive && (
                <button 
                  onClick={() => {
                    // Полностью очищаем состояние перед сбросом
                    logInfo('Reset triggered from placeholder button - FULL RESET');
                    
                    // Полностью сбрасываем все состояния
                    setData(null);
                    setActiveFilters({ startDate: "", endDate: "" });
                    setIsFilterOpen(false);
                    setPage(1);
                    setHasMore(true);
                    
                    // Отменяем текущий запрос если есть
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                    
                    // Принудительно показываем скелетон
                    setShowInitialSkeleton(true);
                    
                    // Сбрасываем все флаги для гарантированной перезагрузки
                    hasInitialData.current = false;
                    firstLoadRef.current = true;
                    prevEventsRef.current = {};
                    
                    // Очистка кэша API перед новым запросом
                    window.dispatchEvent(new CustomEvent('clear-api-cache', { detail: { pattern: '/v1/public/events' }}));
                    
                    // Создаем новый контроллер для прямого запроса
                    const controller = new AbortController();
                    abortControllerRef.current = controller;
                    
                    // Прямой API запрос без фильтров и с уникальным временным штампом
                    setTimeout(() => {
                      if (!isMounted.current) return;
                      
                      logInfo('Performing direct API call with empty filters');
                      
                      // Указываем пустые значения фильтров в URL
                      const directEndpoint = `/v1/public/events?page=1&limit=${ITEMS_PER_PAGE}&search=&start_date=&end_date=&_nocache=${Date.now()}`;
                      
                      logInfo('Direct API endpoint', { url: directEndpoint });
                      
                      // Устанавливаем состояние загрузки
                      setIsFetching(true);
                      setIsLoading(true);
                      setDynamicLoading(true);
                      
                      apiFetch<EventsResponse | EventData[]>(directEndpoint, {
                        signal: controller.signal,
                        bypassLoadingStageCheck: true
                      })
                      .then(response => {
                        if (!isMounted.current) return;
                        
                        // Подробно логируем полученные данные
                        logInfo('Direct API response', { 
                          type: typeof response,
                          isArray: Array.isArray(response),
                          keys: typeof response === 'object' ? Object.keys(response) : []
                        });
                        
                        // Обрабатываем ответ
                        let formattedResponse: EventsResponse = { data: [], total: 0 };
                        
                        if (Array.isArray(response)) {
                          formattedResponse.data = response;
                          formattedResponse.total = response.length;
                        } else if ('data' in response && Array.isArray(response.data)) {
                          formattedResponse = response as EventsResponse;
                        } else if (typeof response === 'object') {
                          const data = (response as any).items || (response as any).events || (response as any).results || [];
                          formattedResponse.data = Array.isArray(data) ? data : [];
                          formattedResponse.total = typeof (response as any).total === 'number' ? 
                            (response as any).total : formattedResponse.data.length;
                        }
                        
                        // Обновляем состояние
                        setData(formattedResponse);
                        setHasMore(formattedResponse.data.length === ITEMS_PER_PAGE);
                        hasInitialData.current = true;
                        
                        logInfo('Direct API data loaded', { 
                          count: formattedResponse.data.length,
                          total: formattedResponse.total
                        });
                      })
                      .catch(error => {
                        if (!isMounted.current) return;
                        logError('Error in direct API call', error);
                        if (error.name !== 'AbortError') {
                          setError(error instanceof Error ? error : new Error(String(error)));
                        }
                      })
                      .finally(() => {
                        if (!isMounted.current) return;
                        
                        // Сбрасываем состояние загрузки
                        setIsLoading(false);
                        setIsFetching(false);
                        setDynamicLoading(false);
                        
                        // Гарантированно скрываем скелетон
                        setTimeout(() => {
                          if (isMounted.current) {
                            setShowInitialSkeleton(false);
                          }
                        }, 1000);
                      });
                    }, 200);
                  }} 
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            // Показываем сгруппированные мероприятия
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