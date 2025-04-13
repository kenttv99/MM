// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable @typescript-eslint/no-unsafe-member-access */
// /* eslint-disable @typescript-eslint/no-unsafe-assignment */
// /* eslint-disable @typescript-eslint/no-unsafe-argument */
// /* eslint-disable @typescript-eslint/no-unsafe-return */
// "use client";
// import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
// import Image from "next/image";
// import Link from "next/link";
// import FormattedDescription from "@/components/FormattedDescription";
// import { EventData } from "@/types/events";
// import { useInView } from "react-intersection-observer";
// import { createLogger, LogLevel, configureModuleLogging } from '@/utils/logger';
// // Импортируем все необходимые хуки из системы загрузки в едином импорте
// import { useLoading, useLoadingError, LoadingStage } from '@/contexts/loading';
// // Импортируем функцию fetchEvents из eventService
// import { fetchEvents as fetchEventsService } from '@/utils/eventService';
// // Импорты для фильтрации
// import { FaCalendarAlt, FaTimes, FaFilter } from "react-icons/fa";

// // Настройка логирования для модуля согласно принципам документации
// configureModuleLogging('EventsPage', {
//   level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.INFO,
//   enabled: true,
//   persistentContext: { component: 'EventsPage' }
// });

// // Создаем единый логгер для компонента
// const logger = createLogger('EventsPage');

// // API_BASE_URL is not needed as we use Next.js rewrites for all API calls

// // Интерфейс для API ответа с событиями
// interface ApiResponse<T> {
//   status: string;
//   data: T[];
//   page: number;
//   totalPages: number;
//   hasMore: boolean;
// }

// // Тип ответа с событиями
// type EventsResponse = {
//   data: EventData[];
//   page: number;
//   totalPages: number;
//   hasMore: boolean;
// } | null;

// // Параметры для fetchEvents
// interface FetchOptions {
//   forceTrigger?: boolean;
// }

// // Интерфейс для состояния фильтров
// interface DateFilters {
//   startDate: string;
//   endDate: string;
// }

// // Компонент фильтра по датам
// const DateFilter: React.FC<{
//   startDate: string;
//   endDate: string;
//   onStartDateChange: (value: string) => void;
//   onEndDateChange: (value: string) => void;
//   onApply: () => void;
//   onClose: () => void;
//   onReset: () => void;
//   startDateRef: React.RefObject<HTMLInputElement>;
//   endDateRef: React.RefObject<HTMLInputElement>;
// }> = ({ startDate, endDate, onStartDateChange, onEndDateChange, onApply, onClose, onReset, startDateRef, endDateRef }) => {
//   const handleCalendarClick = (ref: React.RefObject<HTMLInputElement>) => {
//     if (ref.current && typeof ref.current.showPicker === "function") ref.current.showPicker();
//   };

//   return (
//     <div
//       className="absolute top-[60px] right-0 z-10 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-[300px]"
//     >
//       <div className="flex justify-between items-center mb-4">
//         <h3 className="text-lg font-medium">Фильтр по датам</h3>
//         <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><FaTimes size={16} /></button>
//       </div>
//       <div className="space-y-4">
//         <div className="space-y-2">
//           <label className="block text-sm text-gray-600">От:</label>
//           <div className="relative">
//             <input
//               type="date"
//               value={startDate}
//               onChange={(e) => onStartDateChange(e.target.value)}
//               className="w-full p-2 pl-3 pr-9 border rounded-md"
//               ref={startDateRef}
//             />
//             <div 
//               className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
//               onClick={() => handleCalendarClick(startDateRef)}
//             >
//               <FaCalendarAlt size={16} />
//             </div>
//           </div>
//         </div>
//         <div className="space-y-2">
//           <label className="block text-sm text-gray-600">До:</label>
//           <div className="relative">
//             <input
//               type="date"
//               value={endDate}
//               onChange={(e) => onEndDateChange(e.target.value)}
//               className="w-full p-2 pl-3 pr-9 border rounded-md"
//               ref={endDateRef}
//             />
//             <div 
//               className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
//               onClick={() => handleCalendarClick(endDateRef)}
//             >
//               <FaCalendarAlt size={16} />
//             </div>
//           </div>
//         </div>
//       </div>
//       <div className="flex justify-between pt-4 border-t">
//         <button onClick={onReset} className="px-3 py-2 bg-gray-100 rounded-lg flex items-center gap-1">
//           <FaTimes size={10} /> Сбросить
//         </button>
//         <button onClick={onApply} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Применить</button>
//       </div>
//     </div>
//   );
// };

// // Хук для отслеживания монтирования компонента
// const useIsMounted = () => {
//   const isMounted = useRef(true);
  
//   useEffect(() => {
//     return () => {
//       isMounted.current = false;
//     };
//   }, []);
  
//   return isMounted;
// };

// const generateSlug = (event: EventData): string => {
//   if (!event || !event.id) return "";
  
//   const eventId = event.id;
//   const startYear = event.date ? new Date(event.date).getFullYear() : new Date().getFullYear();
//   const idStr = String(eventId);

//   // Проверяем url_slug от сервера
//   if (event.url_slug) {
//     // Если url_slug уже содержит правильный формат year-id, возвращаем его как есть
//     if (event.url_slug.endsWith(`-${startYear}-${idStr}`)) {
//       return event.url_slug;
//     }
    
//     // Проверяем, не содержит ли url_slug какой-то другой формат year-id
//     const parts = event.url_slug.split('-');
//     if (parts.length >= 2) {
//       const lastPart = parts[parts.length - 1];
//       const preLast = parts[parts.length - 2];
      
//       // Если слаг уже содержит какой-то год и ID, но не те, которые нам нужны
//       if (/^\d{4}$/.test(preLast) && /^\d+$/.test(lastPart)) {
//         // Извлекаем базовый слаг без года и ID
//         const baseSlug = parts.slice(0, -2).join('-');
//         return `${baseSlug}-${startYear}-${idStr}`;
//       }
//     }
    
//     // Если url_slug не содержит формат year-id, добавляем его
//     return `${event.url_slug}-${startYear}-${idStr}`;
//   }
  
//   // Для случаев, когда url_slug не задан
//   // Создаем безопасный слаг из названия
//   const safeSlug = event.title ? 
//     event.title.toLowerCase()
//       .replace(/[^a-zA-Z0-9\s-]/g, '')
//       .replace(/\s+/g, '-')
//       .replace(/-+/g, '-')
//       .replace(/^-+|-+$/g, '')
//     : 'event';
    
//   // Формируем канонический URL в формате slug-year-id
//   return `${safeSlug}-${startYear}-${idStr}`;
// };

// // Вспомогательные функции для работы с датами и слагами
// const formatDateForDisplay = (dateString: string): string => {
//   try {
//     return new Date(dateString).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
//   } catch {
//     return dateString;
//   }
// };

// const formatDateForAPI = (dateString: string): string => {
//   if (!dateString) return "";
//   try {
//     // Преобразуем строку даты в объект Date
//     const date = new Date(dateString);
//     // Форматируем в YYYY-MM-DD - формат, ожидаемый сервером (ISO без времени)
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 т.к. месяцы от 0 до 11
//     const day = String(date.getDate()).padStart(2, '0');
//     return `${year}-${month}-${day}`;
//   } catch (error) {
//     logger.error('Error formatting date for API', { dateString, error });
//     return "";
//   }
// };

// const getStatusStyles = (status: EventData["status"]) => {
//   switch (status) {
//     case "registration_open": return { 
//       bgColor: "bg-green-500/80", 
//       textColor: "text-white",
//       label: "Регистрация открыта"
//     };
//     case "registration_closed": return { 
//       bgColor: "bg-red-500/80", 
//       textColor: "text-white",
//       label: "Регистрация закрыта"
//     };
//     case "completed": return { 
//       bgColor: "bg-gray-500/80", 
//       textColor: "text-white",
//       label: "Завершено"
//     };
//     default: return { 
//       bgColor: "bg-gray-500/80", 
//       textColor: "text-white",
//       label: "Статус не определен"
//     };
//   }
// };

// const EventCard: React.FC<{ event: EventData; lastCardRef?: (node?: Element | null) => void }> = React.memo(
//   ({ event, lastCardRef }) => {
//     const isCompleted = event.status === "completed";
//     // Генерируем слаг для использования в ссылке
//     const generatedSlug = generateSlug(event);
    
//     return (
//       <div ref={lastCardRef}>
//         <Link href={`/events/${generatedSlug}`}>
//           <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 min-h-[300px] flex flex-col">
//             <div className="relative h-48">
//               {event.image ? (
//                 <Image src={event.image} alt={event.title} fill className="object-cover rounded-t-xl" />
//               ) : (
//                 <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-xl">
//                   <span className="text-gray-500">Нет изображения</span>
//                 </div>
//               )}
//               <span className={`absolute top-2 right-2 px-2 py-1 text-xs rounded-full ${getStatusStyles(event.status).bgColor} ${getStatusStyles(event.status).textColor}`}>
//                 {getStatusStyles(event.status).label}
//               </span>
//             </div>
//             <div className="p-4 flex-grow flex flex-col">
//               <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
//               <FormattedDescription
//                 content={event.description || "Описание отсутствует"}
//                 className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow"
//                 disableFontSize={true}
//                 disableLinks={true}
//               />
//               <div className="text-gray-500 text-sm mt-auto flex flex-col sm:flex-row justify-between">
//                 <span className="flex items-center mb-2 sm:mb-0">
//                   <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
//                   </svg>
//                   {formatDateForDisplay(event.date || event.start_date)}
//                 </span>
//                 {event.ticket_type && !isCompleted && (
//                   <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">
//                     {event.status === "registration_open" && event.ticket_type.remaining_quantity !== undefined && event.ticket_type.remaining_quantity > 0
//                       ? `Осталось мест: ${event.ticket_type.remaining_quantity}`
//                       : "Места распределены"}
//                   </span>
//                 )}
//               </div>
//             </div>
//           </div>
//         </Link>
//       </div>
//     );
//   }
// );
// EventCard.displayName = "EventCard";

// // Компонент скелетона для карточки мероприятия
// const EventCardSkeleton: React.FC = () => (
//   <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 h-[300px] flex flex-col overflow-hidden">
//     <div className="relative h-48 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded-t-xl animate-shimmer bg-[length:200%_100%]"></div>
//     <div className="p-4 flex-grow flex flex-col">
//       <div className="h-6 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-3/4 mb-3 animate-shimmer bg-[length:200%_100%]"></div>
//       <div className="space-y-2 flex-grow">
//         <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded animate-shimmer bg-[length:200%_100%]"></div>
//         <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-5/6 animate-shimmer bg-[length:200%_100%]"></div>
//         <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-4/6 animate-shimmer bg-[length:200%_100%]"></div>
//       </div>
//       <div className="flex justify-between items-center mt-4">
//         <div className="flex items-center">
//           <div className="w-4 h-4 rounded-full bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 mr-2 animate-shimmer bg-[length:200%_100%]"></div>
//           <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-20 animate-shimmer bg-[length:200%_100%]"></div>
//         </div>
//         <div className="h-5 bg-gradient-to-r from-orange-200 via-orange-100 to-orange-200 rounded-full w-24 animate-shimmer bg-[length:200%_100%]"></div>
//       </div>
//     </div>
//   </div>
// );

// // Компонент для отображения сетки скелетона мероприятий
// const EventsSkeletonGrid: React.FC = () => {
//   // Генерируем разное количество карточек в разных группах для реалистичности
//   const skeletonGroups = [
//     { title: 'Ближайшие мероприятия', count: 3 },
//     { title: 'Будущие мероприятия', count: 3 },
//     { title: 'Прошедшие мероприятия', count: 2 }
//   ];
  
//   return (
//     <>
//       <style jsx global>{`
//         @keyframes shimmer {
//           0% { background-position: -200% 0; }
//           100% { background-position: 200% 0; }
//         }
//         .animate-shimmer {
//           animation: shimmer 1.5s infinite;
//         }
//       `}</style>
//       {skeletonGroups.map((group, groupIndex) => (
//         <div key={`skeleton-group-${groupIndex}`} className="mb-8">
//           <div className="h-6 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-48 mb-3 animate-shimmer bg-[length:200%_100%]"></div>
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//             {Array.from({ length: group.count }).map((_, i) => (
//               <EventCardSkeleton key={`skeleton-${groupIndex}-${i}`} />
//             ))}
//           </div>
//         </div>
//       ))}
//     </>
//   );
// };

// const EventsPage = () => {
//   // Генерируем уникальный ID для текущего монтирования
//   const mountId = useRef(Math.random().toString(36).substring(2, 10)).current;
  
//   // Сервисные состояния компонента
//   const isMounted = useIsMounted();
//   const abortControllerRef = useRef<AbortController | null>(null);
//   const lastFetchTime = useRef<number>(0);
//   const hasInitialData = useRef<boolean>(false);
//   const hasAttemptedInitialFetch = useRef<boolean>(false);
//   const fetchEventsRef = useRef<string | null>(null);
//   const errorRetryCount = useRef<number>(0);
  
//   // Добавляем референс для кэширования сгруппированных событий
//   const prevEventsRef = useRef<Record<string, unknown>>({});
  
//   // Статусы и состояния загрузки из контекста
//   const { 
//     setStage, 
//     currentStage, 
//     isStaticLoading, 
//     isDynamicLoading, 
//     setStaticLoading, 
//     setDynamicLoading
//   } = useLoading();
  
//   // Локальные состояния загрузки для UI
//   const [isFetching, setIsFetching] = useState(false);
//   const [showInitialSkeleton, setShowInitialSkeleton] = useState<boolean>(true);
//   const { error: loadingErrorFromContext, setError } = useLoadingError();
  
//   // Состояние данных
//   const [data, setData] = useState<EventsResponse | null>(null);
//   const [page, setPage] = useState<number>(1);
//   const [hasMore, setHasMore] = useState<boolean>(true);
//   const minFetchInterval = 1000; // Минимальный интервал между запросами (мс)
  
//   // Состояние фильтров
//   const [isFilterOpen, setIsFilterOpen] = useState(false);
//   const [activeFilters, setActiveFilters] = useState<DateFilters>({
//     startDate: "",
//     endDate: ""
//   });
//   const startDateInputRef = useRef<HTMLInputElement | null>(null);
//   const endDateInputRef = useRef<HTMLInputElement | null>(null);
  
//   // Ref для отслеживания бесконечной прокрутки
//   const { ref: lastElementRef, inView } = useInView({
//     threshold: 0.1,
//     rootMargin: '400px'
//   });
  
//   // При монтировании компонента устанавливаем стадию загрузки
//   useEffect(() => {
//     logger.info('Events page mounted - initializing loading stage', { mountId });
    
//     // При первом монтировании устанавливаем стадию DATA_LOADING
//     if (currentStage !== LoadingStage.ERROR) {
//       setStage(LoadingStage.DATA_LOADING);
      
//       // Включаем индикатор динамической загрузки
//       setDynamicLoading(true);
//     }
    
//     return () => {
//       logger.info('Events page unmounting', { mountId });
//     };
//   }, [mountId, currentStage, setStage, setDynamicLoading]);
  
//   // Функция группировки событий по датам
//   const groupEventsByDate = useCallback((events: EventData[]) => {
//     if (!events || events.length === 0) return {};
    
//     // Создаем ключ на основе ID событий для определения изменений
//     const eventsKey = events.map(e => e.id || '').join('-');
    
//     // Проверяем, есть ли кэшированный результат
//     if (prevEventsRef.current[eventsKey]) {
//       return prevEventsRef.current[eventsKey] as Record<string, EventData[]>;
//     }
    
//     // Группируем события по дате
//     const grouped: Record<string, EventData[]> = {};
//     events.forEach(event => {
//       const dateKey = formatDateForDisplay(event.start_date);
//       if (!grouped[dateKey]) {
//         grouped[dateKey] = [];
//       }
//       grouped[dateKey].push(event);
//     });
    
//     // Кэшируем результат
//     prevEventsRef.current[eventsKey] = grouped;
    
//     return grouped;
//   }, []);

//   // Мемоизируем сгруппированные события
//   const groupedEvents = useMemo(() => {
//     if (!data?.data || !data.data.length) return {};
//     return groupEventsByDate(data.data);
//   }, [data?.data, groupEventsByDate]);
  
//   // Вычисляем активность фильтров
//   const isFilterActive = useMemo(() => {
//     return activeFilters.startDate !== "" || activeFilters.endDate !== "";
//   }, [activeFilters]);

//   // Функция для сброса фильтров
//   const handleResetFilters = useCallback(() => {
//     logger.info('Resetting filters', { activeFilters });
    
//     // Проверяем текущее состояние и отменяем запрос, если он выполняется
//     if (abortControllerRef.current) {
//       abortControllerRef.current.abort('Filter reset');
//       abortControllerRef.current = null;
//     }
    
//     // Сбрасываем фильтры и закрываем панель фильтрации
//     setActiveFilters({ startDate: "", endDate: "" });
//     setIsFilterOpen(false);
    
//     // Сбрасываем страницу и устанавливаем состояние загрузки
//     setPage(1);
//     setData(null);
//     setShowInitialSkeleton(true);
    
//     // Сбрасываем флаг начальных данных для принудительной перезагрузки
//     hasInitialData.current = false;
    
//     // Устанавливаем соответствующую стадию загрузки
//     setStage(LoadingStage.DATA_LOADING);
//     setDynamicLoading(true);
    
//     // Запускаем обновленный запрос с короткой задержкой
//     setTimeout(() => {
//       if (isMounted.current) {
//         fetchEvents({ forceTrigger: true });
//       }
//     }, 50);
//   }, [activeFilters, setStage, setDynamicLoading]);

//   // Функция для применения фильтров
//   const handleApplyFilters = useCallback(() => {
//     logger.info('Applying filters', { filters: activeFilters });
    
//     // Проверяем текущее состояние и отменяем запрос, если он выполняется
//     if (abortControllerRef.current) {
//       abortControllerRef.current.abort('Filter apply');
//       abortControllerRef.current = null;
//     }
    
//     // Сбрасываем страницу на первую и закрываем панель фильтрации
//     setPage(1);
//     setIsFilterOpen(false);
//     setData(null);
    
//     // Показываем скелетон загрузки и сбрасываем флаг начальных данных
//     setShowInitialSkeleton(true);
//     hasInitialData.current = false;
    
//     // Устанавливаем соответствующую стадию загрузки
//     setStage(LoadingStage.DATA_LOADING);
//     setDynamicLoading(true);
    
//     // Запускаем запрос данных с примененными фильтрами
//     setTimeout(() => {
//       if (isMounted.current) {
//         fetchEvents({ forceTrigger: true });
//       }
//     }, 50);
//   }, [activeFilters, setStage, setDynamicLoading]);

//   // Основная функция получения событий
//   const fetchEvents = useCallback(async (options: FetchOptions = {}) => {
//     // Проверяем, смонтирован ли компонент
//     if (!isMounted.current) {
//       logger.info('Fetch events called but component is not mounted, skipping', { ref: fetchEventsRef.current });
//       return;
//     }

//     // Создаем уникальный ID для запроса
//     const localRef = Math.random().toString(36).substring(2, 10);
//     fetchEventsRef.current = localRef;
    
//     logger.info('Direct API events fetch initiated', { 
//       ref: localRef,
//       page,
//       filters: activeFilters,
//       isInitialLoad: !hasInitialData.current
//     });
    
//     // Устанавливаем состояние загрузки
//     setIsFetching(true);
    
//     // Если это первая загрузка данных, устанавливаем соответствующие флаги загрузки
//     if (!hasInitialData.current) {
//       setShowInitialSkeleton(true);
//       setDynamicLoading(true);
//       setStage(LoadingStage.DATA_LOADING);
//     }
    
//     // Отменяем предыдущий запрос если он есть
//     if (abortControllerRef.current) {
//       abortControllerRef.current.abort('New request started');
//       abortControllerRef.current = null;
//     }
    
//     // Создаем новый контроллер для отмены
//     abortControllerRef.current = new AbortController();
//     const signal = abortControllerRef.current.signal;
    
//     try {
//       // Проверяем наличие непустых фильтров
//       const hasActiveStartDate = activeFilters.startDate && activeFilters.startDate.trim() !== '';
//       const hasActiveEndDate = activeFilters.endDate && activeFilters.endDate.trim() !== '';
//       const filterActive = hasActiveStartDate || hasActiveEndDate;
      
//       // Подготавливаем фильтры, если они активны
//       const serviceFilters = filterActive ? {
//         startDate: hasActiveStartDate ? formatDateForAPI(activeFilters.startDate) : undefined,
//         endDate: hasActiveEndDate ? formatDateForAPI(activeFilters.endDate) : undefined
//       } : undefined;
      
//       // Отмечаем, что была попытка загрузки
//       hasAttemptedInitialFetch.current = true;
      
//       logger.info('Using eventService to fetch events', { 
//         ref: localRef,
//         page,
//         filters: serviceFilters,
//         filterActive
//       });
      
//       // Делаем запрос с функцией из сервиса
//       const response = await fetchEventsService(page, serviceFilters, signal);
      
//       // Финальная проверка монтирования перед обновлением состояния
//       if (!isMounted.current) {
//         logger.info('Fetch events completed, but component unmounted', { 
//           ref: localRef
//         });
//         return;
//       }
      
//       // Обрабатываем данные
//       if (response.success) {
//         logger.info('Events response received successfully', { 
//           ref: localRef,
//           dataLength: response.data?.length ?? 0
//         });
        
//         // Используем полученные данные из API
//         const parsedData = {
//           data: response.data || [],
//           page: response.page || page,
//           totalPages: response.totalPages || 1,
//           hasMore: response.hasMore || false
//         };
        
//         setData(prev => {
//           // Для первой страницы просто возвращаем новые данные
//           if (page === 1) return parsedData;
          
//           // Для последующих страниц объединяем данные
//           if (prev && parsedData) {
//             return {
//               ...parsedData,
//               data: [...(prev.data || []), ...(parsedData.data || [])]
//             };
//           }
          
//           return parsedData;
//         });
        
//         // Обновляем hasMore
//         setHasMore(parsedData.hasMore);
        
//         // Устанавливаем флаг наличия данных и скрываем скелетон
//         hasInitialData.current = true;
//         setShowInitialSkeleton(false);
        
//         // Сбрасываем флаги загрузки
//         setDynamicLoading(false);
        
//         // Устанавливаем стадию COMPLETED
//         setStage(LoadingStage.COMPLETED);
        
//         // Сбрасываем ошибку, если она была
//         if (loadingErrorFromContext) {
//           setError(null);
//         }
        
//         logger.info('Events data processed successfully', { 
//           ref: localRef,
//           hasData: parsedData?.data && parsedData.data.length > 0
//         });
//       } else {
//         // Если получили неуспешный ответ от сервиса, выбрасываем ошибку
//         throw new Error(response.error || 'Failed to fetch events data');
//       }
//     } catch (error) {
//       // Обрабатываем случай отмены запроса
//       if (error instanceof Error && error.name === 'AbortError') {
//         logger.info('Fetch aborted', { ref: localRef, reason: error.message });
//         return;
//       }
      
//       // Логируем ошибку
//       logger.error('Error fetching events data', {
//         ref: localRef,
//         error: error instanceof Error ? error.message : String(error)
//       });
      
//       // Обновляем состояние ошибки и скрываем скелетон
//       if (isMounted.current) {
//         setShowInitialSkeleton(false);
        
//         // Устанавливаем стадию ошибки
//         setStage(LoadingStage.ERROR);
        
//         // Устанавливаем текст ошибки в контекст
//         setError(error instanceof Error ? 
//           error.message : 
//           'Произошла ошибка при загрузке мероприятий'
//         );
//       }
//     } finally {
//       // Сбрасываем состояние загрузки
//       if (isMounted.current) {
//         setIsFetching(false);
//         lastFetchTime.current = Date.now();
        
//         // Синхронизируем флаги состояния для корректного рендеринга
//         if (hasInitialData.current) {
//           setShowInitialSkeleton(false);
//         }
//       }
      
//       // Очищаем контроллер прерывания
//       if (abortControllerRef.current) {
//         abortControllerRef.current = null;
//       }
      
//       logger.info('Fetch events operation completed', { 
//         ref: localRef,
//         isMounted: isMounted.current,
//         hasData: hasInitialData.current
//       });
//     }
//   }, [page, activeFilters, isMounted, setStage, setData, setHasMore, setShowInitialSkeleton, 
//       setDynamicLoading, loadingErrorFromContext, setError]);

//   // Эффект для загрузки начальных данных при монтировании
//   useEffect(() => {
//     logger.info('Initial data loading effect triggered', { mountId, currentStage });
    
//     // Устанавливаем флаг монтирования
//     isMounted.current = true;
    
//     // Если у нас нет данных и не было попытки загрузки, запускаем запрос
//     if (!hasInitialData.current && !hasAttemptedInitialFetch.current) {
//       // Небольшая задержка для избежания проблем с быстрым монтированием/размонтированием
//       const initialFetchTimer = setTimeout(() => {
//         if (isMounted.current) {
//           logger.info('Triggering initial data fetch', { mountId });
//           fetchEvents({ forceTrigger: true });
//         }
//       }, 50);
      
//       return () => {
//         clearTimeout(initialFetchTimer);
//       };
//     }
    
//     return () => {
//       // Ничего не делаем, если уже была загрузка
//     };
//   }, [mountId, fetchEvents, currentStage]);
  
//   // Обработчик автоматической загрузки следующей страницы при прокрутке
//   useEffect(() => {
//     if (inView && hasMore && !isFetching && hasInitialData.current) {
//       // Проверяем, прошло ли минимальное время с последнего запроса
//       const now = Date.now();
//       if (now - lastFetchTime.current >= minFetchInterval) {
//         logger.info('Loading next page on scroll', { 
//           currentPage: page,
//           inView,
//           hasMore
//         });
        
//         // Увеличиваем номер страницы и запускаем загрузку
//         setPage(prevPage => prevPage + 1);
//       } else {
//         // Если прошло недостаточно времени, откладываем загрузку
//         const delay = minFetchInterval - (now - lastFetchTime.current);
//         const timer = setTimeout(() => {
//           if (isMounted.current && inView) {
//             logger.info('Delayed next page load', { currentPage: page });
//             setPage(prevPage => prevPage + 1);
//           }
//         }, delay);
        
//         return () => clearTimeout(timer);
//       }
//     }
//   }, [inView, hasMore, isFetching, page, minFetchInterval]);
  
//   // Эффект для загрузки данных при изменении номера страницы
//   useEffect(() => {
//     if (page > 1 && hasInitialData.current && !isFetching) {
//       logger.info('Loading additional page', { page });
//       fetchEvents();
//     }
//   }, [page, fetchEvents, isFetching]);
  
//   // Эффект для отмены запросов при размонтировании
//   useEffect(() => {
//     return () => {
//       logger.info('Events page unmounting, cleaning up resources', { mountId });
      
//       // Устанавливаем флаг размонтирования
//       isMounted.current = false;
      
//       // Отменяем любые незавершенные запросы
//       if (abortControllerRef.current) {
//         abortControllerRef.current.abort('Component unmounted');
//         abortControllerRef.current = null;
//       }
//     };
//   }, [mountId]);
  
//   // Фильтр должен отображаться только если мы успешно загрузили данные
//   const showFilter = hasInitialData.current && currentStage === LoadingStage.COMPLETED;
  
//   // Упрощаем условия рендеринга до минимума
//   return (
//     <div className="min-h-screen flex flex-col bg-gray-50">
//       <style jsx global>{`
//         @keyframes shimmer {
//           0% { background-position: -200% 0; }
//           100% { background-position: 200% 0; }
//         }
//         .animate-shimmer {
//           animation: shimmer 1.5s infinite;
//         }
//       `}</style>
      
//       {currentStage === LoadingStage.ERROR && (
//         <div className="p-8 text-center">
//           <h2 className="text-xl font-semibold text-red-600 mb-4">Произошла ошибка при загрузке мероприятий</h2>
//           <p className="text-gray-700 mb-4">{loadingErrorFromContext || "Не удалось загрузить данные. Попробуйте позже."}</p>
//           <button 
//             onClick={() => {
//               setError(null);
//               setPage(1);
//               hasInitialData.current = false;
//               hasAttemptedInitialFetch.current = false;
//               fetchEvents({ forceTrigger: true });
//             }}
//             className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
//           >
//             Попробовать снова
//           </button>
//         </div>
//       )}
      
//       {currentStage !== LoadingStage.ERROR && (
//         <div className="container mx-auto p-4 pt-8">
//           <h1 className="text-3xl font-bold mb-8 text-center">Все мероприятия</h1>
          
//           {/* Панель фильтров */}
//           {showFilter && (
//             <div className="mb-6 relative">
//               <div className="flex justify-end">
//                 <button
//                   onClick={() => setIsFilterOpen(!isFilterOpen)}
//                   className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFilterActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}
//                 >
//                   <div className={isFilterActive ? "text-orange-500" : "text-gray-500"}>
//                     <FaFilter size={16} />
//                   </div>
//                   <span>Фильтры {isFilterActive ? "(активны)" : ""}</span>
//                 </button>
//               </div>

//               {/* Выпадающий фильтр */}
//               {isFilterOpen && (
//                 <DateFilter
//                   startDate={activeFilters.startDate}
//                   endDate={activeFilters.endDate}
//                   onStartDateChange={(value) => setActiveFilters(prev => ({ ...prev, startDate: value }))}
//                   onEndDateChange={(value) => setActiveFilters(prev => ({ ...prev, endDate: value }))}
//                   onApply={handleApplyFilters}
//                   onClose={() => setIsFilterOpen(false)}
//                   onReset={handleResetFilters}
//                   startDateRef={startDateInputRef}
//                   endDateRef={endDateInputRef}
//                 />
//               )}
              
//               {/* Отображение активных фильтров */}
//               {isFilterActive && (
//                 <div className="mt-3 flex flex-wrap items-center gap-2">
//                   <span className="text-sm text-gray-600">Активные фильтры:</span>
//                   <div className="flex flex-wrap items-center gap-2">
//                     {activeFilters.startDate && (
//                       <div className="inline-flex items-center h-5 px-2 bg-orange-100 text-orange-700 rounded-full text-xs">
//                         <span className="leading-none">От: {formatDateForDisplay(activeFilters.startDate)}</span>
//                       </div>
//                     )}
//                     {activeFilters.endDate && (
//                       <div className="inline-flex items-center h-5 px-2 bg-orange-100 text-orange-700 rounded-full text-xs">
//                         <span className="leading-none">До: {formatDateForDisplay(activeFilters.endDate)}</span>
//                       </div>
//                     )}
//                     <button 
//                       onClick={handleResetFilters} 
//                       className="text-xs text-orange-600 hover:text-orange-700 hover:underline whitespace-nowrap h-5 flex items-center"
//                     >
//                       Сбросить все
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
          
//           {!data && showInitialSkeleton && (
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//               {Array.from({ length: 6 }).map((_, index) => (
//                 <EventCardSkeleton key={`skeleton-${index}`} />
//               ))}
//             </div>
//           )}
          
//           {/* Показываем данные, когда они загружены */}
//           {!isFetching && (currentStage as LoadingStage) !== LoadingStage.ERROR && data && (
//             <>
//               {data.data.length > 0 ? (
//                 // Отображаем события, сгруппированные по датам
//                 Object.entries(groupedEvents).map(([date, eventsForDate], groupIndex) => (
//                   <div key={date} className="mb-8">
//                     <h2 className="text-lg font-medium text-gray-700 mb-3">{date}</h2>
//                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//                       {eventsForDate.map((event, index) => {
//                         // Последний элемент всех событий для бесконечной прокрутки
//                         const isLastItem = groupIndex === Object.keys(groupedEvents).length - 1 && 
//                                            index === eventsForDate.length - 1;
//                         return (
//                           <EventCard 
//                             key={event.id} 
//                             event={event} 
//                             lastCardRef={isLastItem ? lastElementRef : undefined}
//                           />
//                         );
//                       })}
//                     </div>
//                   </div>
//                 ))
//               ) : (
//                 <div className="p-8 text-center">
//                   <h2 className="text-xl font-semibold text-gray-700 mb-4">
//                     {isFilterActive 
//                       ? "Мероприятия не найдены для выбранного диапазона дат" 
//                       : "Мероприятия не найдены"}
//                   </h2>
//                   {isFilterActive && (
//                     <button
//                       onClick={handleResetFilters}
//                       className="px-4 py-2 bg-orange-500 text-white rounded-lg"
//                     >
//                       Сбросить фильтры
//                     </button>
//                   )}
//                 </div>
//               )}
//             </>
//           )}
          
//           {/* Для бесконечной прокрутки: показываем скелетоны при подгрузке новых данных */}
//           {isFetching && data && (
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
//               {Array.from({ length: 3 }).map((_, index) => (
//                 <EventCardSkeleton key={`more-skeleton-${index}`} />
//               ))}
//             </div>
//           )}
          
//           {!hasMore && data?.data && data.data.length > 0 && !isFetching && (
//             <p className="text-center text-gray-600 py-8">Все мероприятия загружены</p>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default EventsPage;