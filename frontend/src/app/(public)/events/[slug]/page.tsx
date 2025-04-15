// frontend/src/app/(public)/events/[slug]/page.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import EventDetails from "@/components/EventDetails";
import FormattedDescription from "@/components/FormattedDescription";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Login from "@/components/Login";
import Registration from "@/components/Registration";
import AuthModal from "@/components/common/AuthModal";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { LoadingStage } from '@/contexts/loading/types';
import { ApiErrorResponse, ApiAbortedResponse } from '@/types/api';

// Константы для уровней логирования
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

// Уровень логирования по умолчанию
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.WARN 
  : LOG_LEVEL.INFO;

// Стили для анимированного градиента
const gradientStyles = `
  .animated-gradient {
    position: relative;
    overflow: hidden;
  }
  
  .animated-gradient::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(-45deg, #ffe0c0, #ffcc99, #ffac63, #ff8c2d, #ff7700);
    background-size: 400% 400%;
    animation: moveGradient 18s linear infinite;
    transform-origin: center center;
    filter: blur(50px);
  }
  
  @keyframes moveGradient {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  .event-title {
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
  }
`;

// Компонент анимированного градиента вместо изображения
const AnimatedGradientBackground = ({ className = "", children }: { className?: string, children?: React.ReactNode }) => (
  <div className={`w-full h-full animated-gradient relative ${className}`}>
    <style jsx>{gradientStyles}</style>
    <div className="absolute inset-0 bg-black/20 z-10"></div>
    {children}
  </div>
);

// Компонент скелетона для страницы мероприятия
const EventDetailsSkeleton: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-gray-50">
    <Header />
    <main className="flex-grow">
      {/* Скелетон для обложки мероприятия */}
      <div className="relative h-[400px] w-full px-6 mt-16 mb-8">
        <div className="relative h-full w-full rounded-xl overflow-hidden bg-gradient-to-r from-gray-100 to-orange-100">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-[70%] bg-white/30 backdrop-blur-sm rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Скелетон для блока деталей события */}
        <div className="animate-pulse mb-12">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col items-center p-3">
                <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="flex flex-col items-center p-3">
                <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="flex flex-col items-center p-3">
                <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
              <div className="flex flex-col items-center p-3">
                <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Скелетон для блока регистрации */}
        <div className="animate-pulse mb-12">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
            <div className="h-6 bg-orange-200 rounded w-48 mx-auto mb-6"></div>
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-orange-300 rounded"></div>
            </div>
          </div>
        </div>

        {/* Скелетон для описания */}
        <div className="animate-pulse max-w-3xl mx-auto">
          <div className="h-6 bg-orange-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-[90%]"></div>
            <div className="h-4 bg-gray-200 rounded w-[95%]"></div>
            <div className="h-4 bg-gray-200 rounded w-[85%]"></div>
            <div className="h-4 bg-gray-200 rounded w-[90%]"></div>
          </div>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

const extractIdFromSlug = (slug: string): string => {
  if (!slug) return "";
  const parts = slug.split("-");
  const lastPart = parts[parts.length - 1];
  
  // Если последняя часть - число, считаем её ID
  if (lastPart && /^\d+$/.test(lastPart)) {
    return lastPart;
  }
  
  // Если предпоследняя часть - год (4 цифры), а последняя - ID
  if (parts.length >= 2) {
    const preLast = parts[parts.length - 2];
    if (preLast && /^\d{4}$/.test(preLast) && /^\d+$/.test(lastPart)) {
      return lastPart;
    }
  }
  
  // Иначе используем весь слаг
  return slug;
};

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [validatedEventId, setValidatedEventId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { isAuth } = useAuth();
  const { currentStage, setStage } = useLoadingStage();
  const { error: loadingErrorFromContext, setError } = useLoadingError();
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const previousSlugRef = useRef<string | null>(null);
  const eventCacheRef = useRef<Record<string, EventData>>({});

  // Функции логирования с разными уровнями
  type LogData = unknown;
  
  const logDebug = useCallback((message: string, data?: LogData) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
      if (data) {
        console.debug(`EventPage: ${message}`, data);
      } else {
        console.debug(`EventPage: ${message}`);
      }
    }
  }, []);

  const logInfo = useCallback((message: string, data?: LogData) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
      if (data) {
        console.log(`EventPage: ${message}`, data);
      } else {
        console.log(`EventPage: ${message}`);
      }
    }
  }, []);

  const logWarn = useCallback((message: string, data?: LogData) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
      if (data) {
        console.warn(`EventPage: ⚠️ ${message}`, data);
      } else {
        console.warn(`EventPage: ⚠️ ${message}`);
      }
    }
  }, []);

  const logError = useCallback((message: string, data?: LogData) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
      if (data) {
        console.error(`EventPage: ⛔ ${message}`, data);
      } else {
        console.error(`EventPage: ⛔ ${message}`);
      }
    }
  }, []);
  
  // Функция для получения данных мероприятия
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchEventData = useCallback(async (targetSlug: string): Promise<EventData | null> => {
    if (!isMountedRef.current) {
      logInfo("Component not stable yet, skipping fetch");
      return null;
    }
    if (fetchAbortControllerRef.current) {
      logInfo("Fetch already in progress, skipping");
      return null;
    }

    const eventId = extractIdFromSlug(targetSlug);
    logInfo(`Fetching event data for slug: ${targetSlug}, extracted eventId: ${eventId}`);
    fetchAbortControllerRef.current = new AbortController();

    try {
      const timestamp = Date.now();
      const url = `/v1/public/events/${eventId}?t=${timestamp}`;
      logInfo(`Making API request`, { url, targetSlug });

      const response = await apiFetch<EventData>(url, {
        signal: fetchAbortControllerRef.current.signal,
        bypassLoadingStageCheck: true
      });

      if (!isMountedRef.current) return null;
      logInfo("Raw response data", response);

      if ('aborted' in response) {
        const abortedResponse = response as unknown as ApiAbortedResponse;
        logError("Request was aborted", abortedResponse.reason);
        setError("Запрос был прерван");
        setStage(LoadingStage.ERROR);
        return null;
      }

      if ('error' in response) {
        const errorResponse = response as unknown as ApiErrorResponse;
        logError("Error in response", errorResponse.error);
        const errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка загрузки";
        setError(errorMessage);
        setStage(LoadingStage.ERROR);
        return null;
      }

      if ('title' in response) {
        const eventData = response as unknown as EventData;
        return eventData;
      } else {
        logWarn("Invalid event data received", response);
        setError("Мероприятие не найдено");
        setStage(LoadingStage.ERROR);
        return null;
      }
    } catch (err) {
      if (isMountedRef.current) {
        logError("Error fetching event", err);
        const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки мероприятия";
        setError(errorMessage);
        setStage(LoadingStage.ERROR);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        fetchAbortControllerRef.current = null;
      }
    }
  }, [setStage, setError, logInfo, logError, logWarn]);
  
  // Simplified page navigation effect
  useEffect(() => {
    // Function to handle page navigation events
    const handleNavigation = () => {
      logInfo("Navigation detected - updating registration component");
    };
    
    // Add event listeners for navigation and focus events
    window.addEventListener('pageshow', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    
    return () => {
      window.removeEventListener('pageshow', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [logInfo]);
  
  // Simplified event handlers
  const handleBookingClick = useCallback(() => {
    // Use simple function that doesn't trigger any page updates
    logDebug("Booking click triggered");
  }, [logDebug]);
  
  const handleLoginClick = useCallback(() => {
    setIsRegisterMode(false);
    setIsModalOpen(true);
  }, []);
  
  // Simplified booking success handler
  const handleBookingSuccess = useCallback(() => {
    logInfo("Booking successful");
    // No additional action needed - component updates itself
  }, [logInfo]);

  // Handle auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      logInfo("Auth change detected");
      // Только сбрасываем флаг начальной загрузки
      // hasInitialFetchRef.current = false;
    };
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [logInfo]);

  // Save event data to localStorage for breadcrumb navigation
  const saveEventToLocalStorage = useCallback((eventData: EventData, currentSlug: string) => {
    if (eventData.id && eventData.title) {
      try {
        const eventId = String(eventData.id);
        logInfo(`Saving event title to localStorage: event-title-${eventId}`);
        localStorage.setItem(`event-title-${eventId}`, eventData.title);
        
        // Save slug for more complete data
        logInfo(`Saving event slug to localStorage: event-slug-${eventId}`);
        localStorage.setItem(`event-slug-${eventId}`, currentSlug);
      } catch (error) {
        logError("Error saving event data to localStorage", error);
      }
    }
  }, [logInfo, logError]);

  // Основной useEffect для загрузки данных
  useEffect(() => {
    isMountedRef.current = true;
    let currentEventId: number | null = null;
    try {
        const extractedId = extractIdFromSlug(slug);
        if (extractedId && /^\d+$/.test(extractedId)) {
            currentEventId = parseInt(extractedId, 10);
        } else {
            throw new Error("Invalid ID extracted from slug");
        }
    } catch (e) {
        logError("Failed to parse event ID from slug", { slug, error: e });
        setError("Некорректный идентификатор мероприятия в URL.");
        setStage(LoadingStage.ERROR);
        setValidatedEventId(null); // Сбрасываем ID
        return;
    }

    setValidatedEventId(currentEventId); // Сохраняем валидный ID в state
    logInfo(`Effect triggered for slug: '${slug}', eventId: ${currentEventId}`);

    if (!slug || currentEventId === null) { // Проверяем и slug, и ID
      logWarn("Slug or parsed eventId is missing/invalid, cannot fetch event data.");
      // Ошибка уже должна быть установлена выше, если ID невалидный
      if (!loadingErrorFromContext) {
          setError("Не удалось определить ID мероприятия.");
          setStage(LoadingStage.ERROR);
      }
      return;
    }

    // Проверяем, изменился ли slug с предыдущего рендера
    const slugChanged = previousSlugRef.current !== slug;
    previousSlugRef.current = slug;

    // Проверяем кэш перед выполнением нового запроса
    if (!slugChanged && eventCacheRef.current[slug]) {
      logInfo(`Using cached event data for slug: ${slug}`);
      // Используем кэшированные данные вместо нового запроса
      if (!event) {
        setEvent(eventCacheRef.current[slug]);
        
        // Обновляем стадию загрузки, если нужно
        if (currentStage === LoadingStage.STATIC_CONTENT) {
          setStage(LoadingStage.DYNAMIC_CONTENT);
        }
      }
      return;
    }

    // Отменяем предыдущий запрос, если он еще выполняется
    if (fetchAbortControllerRef.current) {
      logInfo(`Aborting previous fetch request for slug: ${slug}`);
      fetchAbortControllerRef.current.abort();
    }

    // Создаем новый AbortController для текущего запроса
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;
    const signal = controller.signal;

    // Асинхронная функция для выполнения запроса
    const fetchData = async () => {
      // Используем currentEventId, т.к. он точно number здесь
      logInfo(`Starting fetch for eventId: ${currentEventId}`);
      
      // Устанавливаем стадию загрузки, только если она еще не началась или ниже
      // Это предотвратит сброс стадии при перемонтировании в StrictMode
      if (currentStage < LoadingStage.STATIC_CONTENT) { 
          setStage(LoadingStage.STATIC_CONTENT); 
      }
      
      setError(null); // Сбрасываем предыдущую ошибку
      
      // Сбрасываем данные только если изменился slug или это первая загрузка
      if (slugChanged || !event) {
        setEvent(null);
      }

      try {
        const timestamp = Date.now();
        const url = `/v1/public/events/${currentEventId}?t=${timestamp}`;
        logInfo(`Making API request`, { url });

        const response = await apiFetch<EventData>(url, {
          signal: signal, // Передаем сигнал для возможности отмены
          bypassLoadingStageCheck: true
        });

        // Если компонент размонтирован или запрос отменен до завершения, выходим
        if (!isMountedRef.current || signal.aborted) {
          logInfo(`Fetch aborted or component unmounted for eventId: ${currentEventId}`);
          return;
        }

        // Проверяем на признак отмены запроса
        if (response && 'aborted' in response) {
          logInfo(`Request properly aborted, no error needed for eventId: ${currentEventId}`);
          return;
        }

        logInfo("Raw response data", response);

        // Проверяем, что ответ содержит нужную структуру данных
        if (response && 'title' in response) {
          const eventData = response as EventData;
          logInfo(`Fetch successful for eventId: ${currentEventId}. Setting stage to DYNAMIC_CONTENT.`);
          
          // Сохраняем данные в кэше
          eventCacheRef.current[slug] = eventData;
          
          setEvent(eventData);
          saveEventToLocalStorage(eventData, slug); // Сохраняем в LS
          
          // Правильная последовательность стадий загрузки согласно документации
          if (currentStage === LoadingStage.STATIC_CONTENT) {
            setStage(LoadingStage.DYNAMIC_CONTENT);
          } else if (currentStage === LoadingStage.DYNAMIC_CONTENT) {
            // Если мы уже на этапе загрузки динамического контента, можно перейти к COMPLETED
            setStage(LoadingStage.COMPLETED);
          }
        } else {
          // Неожиданный формат ответа
          logWarn("Invalid event data received", response);
          setError("Некорректный ответ от сервера.");
          setStage(LoadingStage.ERROR);
        }
      } catch (err) {
        // Обработка ошибок fetch или других непредвиденных ошибок
        if (err instanceof Error && err.name === 'AbortError') {
          // Используем currentEventId в логе
          logInfo(`Fetch explicitly aborted for eventId: ${currentEventId}`);
          // Это ожидаемое поведение при быстрой смене slug или размонтировании, не ошибка
        } else if (isMountedRef.current) {
          // Обрабатываем другие ошибки только если компонент все еще смонтирован
          // Используем currentEventId в логе
          logError(`Unexpected error fetching event eventId: ${currentEventId}`, err);
          
          // Специальная обработка сетевых ошибок
          const errorMessage = err instanceof Error 
            ? (err.message.includes("fetch") ? "Ошибка сети при загрузке мероприятия" : err.message)
            : "Неизвестная ошибка при загрузке мероприятия";
          
          setError(errorMessage);
          setStage(LoadingStage.ERROR);
        }
      } finally {
          // Сбрасываем AbortController только если он принадлежит этому запросу
          if (fetchAbortControllerRef.current === controller) {
             fetchAbortControllerRef.current = null;
             // Используем currentEventId в логе
             logInfo(`Fetch process finished for eventId: ${currentEventId}, AbortController cleared.`);
          }
      }
    };

    fetchData();

    // Функция очистки useEffect
    return () => {
      isMountedRef.current = false;
      // Используем currentEventId в логе
      logInfo(`Cleanup effect for slug: '${slug}', eventId: ${currentEventId}. Aborting controller.`);
      controller.abort(); // Отменяем запрос при размонтировании или смене slug
      // Обнуляем ref контроллера, если он соответствует текущему
      if (fetchAbortControllerRef.current === controller) {
           fetchAbortControllerRef.current = null;
      }
    };
    // Зависимость только от slug (и стабильных функций контекста)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, currentStage, setStage, setError, logInfo, logWarn, logError, saveEventToLocalStorage, event]);

  // 1. Сначала проверяем на ошибку
  if (currentStage === LoadingStage.ERROR) {
    logWarn("Rendering error state from context");
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <ErrorPlaceholder error={loadingErrorFromContext ? new Error(loadingErrorFromContext) : null} />
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Показываем скелетон, ТОЛЬКО если данных мероприятия еще нет
  // Не зависим напрямую от currentStage для показа скелетона, только от наличия event
  if (!event) {
    // Логируем только при первом рендере скелетона или если currentStage изменился
    logInfo(`Rendering loading state (Skeleton because !event)`, { currentStage }); 
    return <EventDetailsSkeleton />;
  }

  // 3. Если дошли сюда - ошибки нет, данные event есть. Рендерим контент.
  logInfo("Rendering event content", { currentStage, eventId: event.id });
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-[400px] w-full px-6 mt-16 mb-8"
        >
          <div className="relative h-full w-full rounded-xl overflow-hidden">
            {event.image_url ? (
              <Image src={event.image_url} alt={event.title} fill className="object-cover" priority unoptimized />
            ) : (
              <AnimatedGradientBackground />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-4xl font-bold text-white text-center px-4 max-w-[90vw] event-title"
                style={{ fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }}
              >
                {event.title}
              </motion.h1>
            </div>
          </div>
        </motion.section>

        <div className="container mx-auto px-6 py-12">
          {event.ticket_type && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <EventDetails
                date={(() => {
                  try {
                    const dateObj = new Date(event.start_date);
                    if (isNaN(dateObj.getTime())) {
                      return "Загрузка...";
                    }
                    return format(dateObj, "d MMMM yyyy", { locale: ru });
                  } catch (e) {
                    console.error("Error formatting start_date:", e);
                    return "Загрузка...";
                  }
                })()}
                time={(() => {
                  try {
                    const startDate = new Date(event.start_date);
                    
                    if (isNaN(startDate.getTime())) {
                      return "Загрузка...";
                    }

                    if (event.end_date) {
                      const endDate = new Date(event.end_date);
                      
                      if (isNaN(endDate.getTime())) {
                        return format(startDate, "HH:mm", { locale: ru });
                      }
                      
                      return `${format(startDate, "HH:mm", { locale: ru })} - ${format(endDate, "HH:mm", { locale: ru })}`;
                    }
                    
                    return format(startDate, "HH:mm", { locale: ru });
                  } catch (e) {
                    console.error("Error formatting time interval:", e);
                    return "Загрузка...";
                  }
                })()}
                location={event.location || "Не указано"}
                price={event.price}
                freeRegistration={event.ticket_type.free_registration}
              />
            </motion.section>
          )}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className={`bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto ${
              event.status !== "registration_open" ||
              (event.ticket_type?.available_quantity || 0) - (event.ticket_type?.sold_quantity || 0) <= 0
                ? "opacity-50 pointer-events-none"
                : ""
            }`}>
              <h2 className="text-2xl font-semibold mb-4 text-center">
                {event.status === "registration_open" &&
                 (event.ticket_type?.available_quantity || 0) - (event.ticket_type?.sold_quantity || 0) <= 0
                  ? "Регистрация закрыта (мест нет)"
                  : event.status === "registration_open"
                    ? "Регистрация открыта"
                    : event.status === "registration_closed"
                      ? "Регистрация закрыта"
                      : event.status === "completed"
                        ? "Мероприятие завершено"
                        : "Черновик"}
              </h2>

              {validatedEventId !== null && (
                <EventRegistration
                  eventId={validatedEventId}
                  eventTitle={event.title}
                  eventDate={event.start_date}
                  eventTime={(() => {
                    try {
                      const startDate = new Date(event.start_date);
                      return isNaN(startDate.getTime()) ? "" : format(startDate, "HH:mm", { locale: ru });
                    } catch (e) {
                      console.error("Error formatting event time:", e);
                      return "";
                    }
                  })()}
                  eventLocation={event.location || "Не указано"}
                  ticketType={event.ticket_type?.name || "Стандартный"}
                  availableQuantity={event.ticket_type?.available_quantity || 0}
                  soldQuantity={event.ticket_type?.sold_quantity || 0}
                  price={event.price}
                  freeRegistration={event.ticket_type?.free_registration || false}
                  onBookingClick={handleBookingClick}
                  onLoginClick={handleLoginClick}
                  onBookingSuccess={handleBookingSuccess}
                  displayStatus={event.status === "registration_closed" || event.status === "completed" ? "Регистрация закрыта" : undefined}
                />
              )}

              {!isAuth && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mt-6 text-gray-700 bg-orange-50 py-3 px-6 rounded-full"
                >
                  Для бронирования билета{" "}
                  <button
                    onClick={handleLoginClick}
                    className="text-orange-600 font-semibold hover:underline"
                  >
                    войдите в аккаунт
                  </button>
                </motion.p>
              )}
            </div>
          </motion.section>
          
          {event.description && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-2xl font-semibold mb-4">Описание</h2>
              <FormattedDescription
                content={event.description}
                className="text-gray-600 max-w-full overflow-wrap-break-word"
                disableFontSize={false}
              />
            </motion.section>
          )}
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {isModalOpen && (
          <AuthModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={isRegisterMode ? "Регистрация" : "Вход"}
          >
            {isRegisterMode ? (
              <Registration
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                toggleMode={() => setIsRegisterMode(false)}
              />
            ) : (
              <Login
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                toggleMode={() => setIsRegisterMode(true)}
              />
            )}
          </AuthModal>
        )}
      </AnimatePresence>
    </div>
  );
}