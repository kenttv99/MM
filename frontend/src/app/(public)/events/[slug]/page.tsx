// frontend/src/app/(public)/events/[slug]/page.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import EventDetails from "@/components/EventDetails";
import FormattedDescription from "@/components/FormattedDescription";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import NotFound404 from "@/components/NotFound404";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Login from "@/components/Login";
import Registration from "@/components/Registration";
import AuthModal from "@/components/common/AuthModal";
import { apiFetch, clear404Cache } from "@/utils/api";
import { EventData } from "@/types/events";
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { LoadingStage } from '@/contexts/loading/types';
import { ApiErrorResponse } from '@/types/api';

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
    {/* Header теперь рендерится в layout */}
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

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [validatedEventId, setValidatedEventId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isEventNotFound, setIsEventNotFound] = useState(false);
  const [retryTimestamp, setRetryTimestamp] = useState<number | null>(null);
  const { isAuth } = useAuth();
  const { currentStage, setStage } = useLoadingStage();
  const { error: loadingErrorFromContext, setError } = useLoadingError();
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const previousSlugRef = useRef<string | null>(null);
  const previousIdRef = useRef<string | null>(null);
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

    const eventId = targetSlug.split("-").pop();
    logInfo(`(fetchEventData) Fetching event data for slug: ${targetSlug}, extracted eventId: ${eventId}`);
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const timestamp = Date.now();
      const url = `/v1/public/events/${eventId}?t=${timestamp}`;
      logInfo(`(fetchEventData) Making API request`, { url, targetSlug });

      const response = await apiFetch<EventData>(url, {
        signal: signal,
        bypassLoadingStageCheck: true
      });

      if (!isMountedRef.current || signal.aborted) return null;
      logInfo("(fetchEventData) Raw response data", response);

      if ('aborted' in response) {
         logWarn("(fetchEventData) Request was aborted"); 
         // Не устанавливаем ошибку глобально здесь, т.к. это вспомогательная функция
         return null;
      }

      if ('error' in response) {
         const errorResponse = response as unknown as ApiErrorResponse;
         logError("(fetchEventData) Error in response", errorResponse);
         // Обрабатываем 404 специфично, если нужно, но не ставим глобальное состояние
         if (errorResponse.status === 404) {
            logWarn("(fetchEventData) Event not found (404)");
            return null; // Возвращаем null, чтобы вызывающий код понял, что не найдено
         }
         // Другие ошибки просто логируем
         return null;
      }

      if ('title' in response) {
        return response as EventData;
      } else {
        logWarn("(fetchEventData) Invalid event data received", response);
        return null;
      }
    } catch (err) {
      if (!isMountedRef.current || (err instanceof Error && err.name === 'AbortError')) {
         // Игнорируем ошибки размонтирования или явной отмены
      } else {
        logError("(fetchEventData) Error fetching event", err);
      }
      return null;
    }
  }, [logInfo, logError, logWarn]);
  
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
    const eventIdParam = searchParams.get('id');
    const currentSlug = slug;
    let currentEventId: number | null = null;

    // Валидация ID
    if (eventIdParam && /^\d+$/.test(eventIdParam)) {
        currentEventId = parseInt(eventIdParam, 10);
    } else {
        logError("Invalid or missing 'id' query parameter", { eventIdParam });
        setError("Некорректный ID мероприятия в URL.");
        setStage(LoadingStage.ERROR);
        setValidatedEventId(null);
        setIsEventNotFound(false); // Сбрасываем на всякий случай
        setEvent(null);
        return; // Выходим, если ID невалидный
    }

    setValidatedEventId(currentEventId);
    logInfo(`Effect triggered for slug: '${currentSlug}', eventId: ${currentEventId}`);

    const idChanged = previousIdRef.current !== eventIdParam;
    const slugChanged = previousSlugRef.current !== currentSlug;
    previousIdRef.current = eventIdParam;
    previousSlugRef.current = currentSlug;
    const cacheKey = `${currentSlug}?id=${currentEventId}`;

    // Сбрасываем состояние ошибки "не найдено" при смене ID или slug
    if (idChanged || slugChanged) {
        logInfo("Slug or ID changed, resetting 'not found' state and event data");
        setIsEventNotFound(false);
        setEvent(null); // Очищаем старые данные
        setError(null); // Очищаем старую ошибку
        // Сбрасываем стадию, чтобы показать скелетон для нового запроса
        setStage(LoadingStage.INITIAL);
    }

    // Проверка на 404 из sessionStorage для предотвращения циклов
    const last404Timestamp = sessionStorage.getItem('last_404_timestamp');
    const last404Endpoint = sessionStorage.getItem('last_404_endpoint');
    
    // Если в последние 2 секунды был 404 для этого же ресурса, прерываем запрос
    if (
      last404Timestamp && 
      last404Endpoint && 
      last404Endpoint.includes(`/events/${currentEventId}`) &&
      Date.now() - parseInt(last404Timestamp) < 2000
    ) {
      logWarn(`Preventing repeat request after recent 404 for eventId: ${currentEventId}`);
      setIsEventNotFound(true);
      setStage(LoadingStage.COMPLETED);
      return;
    }

    // Используем кэш только если ID и slug не менялись
    if (!idChanged && !slugChanged && eventCacheRef.current[cacheKey]) {
      logInfo(`Using cached event data for key: ${cacheKey}`);
      if (!event) { // Устанавливаем только если еще не установлено
        setEvent(eventCacheRef.current[cacheKey]);
      }
      // Если в кэше есть, считаем загрузку завершенной
      if (currentStage !== LoadingStage.COMPLETED && currentStage !== LoadingStage.ERROR) {
          setStage(LoadingStage.COMPLETED);
      }
      // Не делаем новый запрос, если есть в кэше и ID/slug не менялись
      return;
    }
    
    // Если состояние уже "не найдено" для этого URL, не делаем новый запрос
    if (isEventNotFound && !idChanged && !slugChanged) {
        logInfo(`Event previously marked as 'not found' for ${cacheKey}, skipping fetch.`);
        // Убеждаемся, что стадия COMPLETED, чтобы не было скелетона
        if (currentStage !== LoadingStage.COMPLETED) {
           setStage(LoadingStage.COMPLETED);
        }
        return;
    }

    // Отменяем предыдущий запрос, если он есть
    if (fetchAbortControllerRef.current) {
      logInfo(`Aborting previous fetch request`);
      fetchAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;
    const signal = controller.signal;

    const fetchData = async () => {
      logInfo(`Starting fetch for eventId: ${currentEventId}`);
      // Устанавливаем стадию загрузки, только если еще не COMPLETED или ERROR
      if (currentStage < LoadingStage.STATIC_CONTENT) {
          setStage(LoadingStage.STATIC_CONTENT);
      }
      // Очищаем ошибку перед новым запросом (состояние isEventNotFound уже сброшено выше если нужно)
      setError(null);
      // Очищаем event только если ID/slug сменились (сделано выше) или если его еще нет
      // if (idChanged || slugChanged || !event) { setEvent(null); } // Уже сделано выше

      try {
        const timestamp = Date.now();
        const url = `/v1/public/events/${currentEventId}?t=${timestamp}`;
        logInfo(`Making API request`, { url });

        const response = await apiFetch<EventData | ApiErrorResponse>(url, { // Типизируем возможную ошибку
          signal: signal,
          bypassLoadingStageCheck: true
        });

        if (!isMountedRef.current || signal.aborted) {
          logInfo(`Fetch aborted or component unmounted for eventId: ${currentEventId}`);
          return;
        }
        // Явная проверка на 'aborted' после основного запроса
        if (response && typeof response === 'object' && 'aborted' in response) {
          logInfo(`Request properly aborted, no error needed for eventId: ${currentEventId}`);
          return;
        }

        logInfo("Raw response data", response);

        // --- Обработка ответа ---
        if (response && typeof response === 'object' && 'error' in response) {
            const errorResponse = response as ApiErrorResponse;
            if (errorResponse.status === 404) {
                logWarn(`Event not found (404) for eventId: ${currentEventId}. Setting 'not found' state.`);
                
                // Отменяем все активные запросы к API, чтобы предотвратить дальнейшие запросы
                // после обнаружения 404 ошибки
                if (typeof window !== 'undefined' && window.activeAbortControllers) {
                    logInfo("Aborting all active requests due to 404 error");
                    const controllers = window.activeAbortControllers;
                    controllers.forEach(ctrl => {
                        if (ctrl !== controller && !ctrl.signal.aborted) {
                            try {
                                ctrl.abort();
                            } catch (e) {
                                // Игнорируем ошибки при отмене
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const ignored = e;
                            }
                        }
                    });
                }
                
                setIsEventNotFound(true); // <-- Устанавливаем флаг "не найдено"
                setEvent(null); // Убеждаемся, что данных нет
                setError(null); // Очищаем общую ошибку, т.к. это специфичный случай
                setStage(LoadingStage.COMPLETED); // <-- Завершаем загрузку, чтобы убрать скелетон
            } else {
                // Другие ошибки API
                logError(`API error fetching eventId: ${currentEventId}`, errorResponse);
                const errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при загрузке мероприятия.";
                setError(errorMessage);
                setStage(LoadingStage.ERROR);
                setEvent(null);
                setIsEventNotFound(false); // Явно сбрасываем
            }
        } else if (response && typeof response === 'object' && 'title' in response) {
          // Успешный ответ
          const eventData = response as EventData;
          logInfo(`Fetch successful for eventId: ${currentEventId}. Setting stage.`);
          eventCacheRef.current[cacheKey] = eventData;
          setEvent(eventData);
          setIsEventNotFound(false); // Убеждаемся, что флаг сброшен
          saveEventToLocalStorage(eventData, currentSlug);
          // Устанавливаем COMPLETED, только если еще не ERROR
          if (currentStage !== LoadingStage.ERROR) {
            setStage(LoadingStage.COMPLETED);
          }
        } else {
          // Неожиданный формат ответа
          logWarn("Invalid event data received (unexpected format)", response);
          setError("Некорректный ответ от сервера.");
          setStage(LoadingStage.ERROR);
          setEvent(null);
          setIsEventNotFound(false);
        }
      } catch (err) {
        // Обработка ошибок сети или других исключений
        if (err instanceof Error && err.name === 'AbortError') {
          logInfo(`Fetch explicitly aborted for eventId: ${currentEventId}`);
        } else if (isMountedRef.current) {
          logError("Unexpected error fetching event eventId: " + currentEventId, err);
          const errorMessage = err instanceof Error
            ? (err.message.includes("fetch") ? "Ошибка сети при загрузке мероприятия" : err.message)
            : "Неизвестная ошибка при загрузке мероприятия";
          setError(errorMessage);
          setStage(LoadingStage.ERROR);
          setEvent(null);
          setIsEventNotFound(false);
        }
      } finally {
          // Очищаем контроллер только если это был последний запущенный
          if (fetchAbortControllerRef.current === controller) {
             fetchAbortControllerRef.current = null;
             logInfo(`Fetch process finished for eventId: ${currentEventId}, AbortController cleared.`);
          }
      }
    };

    // Запускаем fetchData только если нет кэша и не было ошибки "не найдено"
    if (!eventCacheRef.current[cacheKey] && !isEventNotFound) {
      fetchData();
    } else if (!event && !isEventNotFound && currentStage !== LoadingStage.ERROR) {
        // Если нет event, нет ошибки not found и нет общей ошибки - показываем скелетон
        logInfo("No event data yet, ensuring skeleton stage");
        if (currentStage < LoadingStage.STATIC_CONTENT) {
            setStage(LoadingStage.STATIC_CONTENT);
        }
    }

    // Функция очистки
    return () => {
      isMountedRef.current = false;
      logInfo(`Cleanup effect for eventId: ${currentEventId}. Aborting controller.`);
      controller.abort();
      if (fetchAbortControllerRef.current === controller) {
           fetchAbortControllerRef.current = null;
      }
    };
  // Добавляем retryTimestamp в зависимости, чтобы эффект повторно запускался при повторной попытке
  // Также добавляем event, isEventNotFound, currentStage т.к. они используются в логике эффекта
  }, [slug, searchParams, setStage, setError, logInfo, logWarn, logError, saveEventToLocalStorage, retryTimestamp, event, isEventNotFound, currentStage]);


  // --- Логика Рендеринга ---

  // 1. Сначала проверяем на общую ошибку загрузки (не 404)
  if (currentStage === LoadingStage.ERROR && !isEventNotFound) {
    logWarn("Rendering error state from context (non-404)");
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow flex items-center justify-center">
          {/* Используем стандартный ErrorPlaceholder */}
          <ErrorPlaceholder error={loadingErrorFromContext ? new Error(loadingErrorFromContext) : null} />
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Проверяем флаг "не найдено" (установлен при 404)
  if (isEventNotFound) {
    logInfo("Rendering Event Not Found Placeholder");

    // Функция для очистки флага "не найдено" и принудительного перезапуска загрузки
    const handleRetryFetch = () => {
      logInfo("Retry fetch initiated for not found event");
      // Очищаем sessionStorage от данных о 404
      sessionStorage.removeItem('last_404_endpoint');
      sessionStorage.removeItem('last_404_timestamp');
      
      // Очищаем глобальный кэш 404 ошибок
      // Указываем шаблон "/events/" для очистки только событий
      clear404Cache("/events/");
      
      // Полностью очищаем все состояния, связанные с текущими данными
      setEvent(null);
      setError(null);
      setIsEventNotFound(false);
      
      // Очищаем кэш данных для текущего запроса
      if (validatedEventId) {
        const cacheKey = `${slug}?id=${validatedEventId}`;
        if (eventCacheRef.current[cacheKey]) {
          delete eventCacheRef.current[cacheKey];
          logInfo(`Cleared event cache for key: ${cacheKey}`);
        }
      }
      
      // Сбрасываем стадию загрузки для начала нового запроса
      setStage(LoadingStage.INITIAL);

      // Используем небольшую задержку, чтобы гарантировать, что все состояния очистились
      // перед запуском нового запроса
      setTimeout(() => {
        // Устанавливаем новую метку времени для принудительного перезапуска эффекта
        setRetryTimestamp(Date.now());
        logInfo("Retry effect triggered");
      }, 50);
    };

    return <NotFound404 
      title="Мероприятие не найдено" 
      message="К сожалению, мероприятие, которое вы ищете, не найдено или было снято с публикации." 
      backUrl="/events" 
      backLabel="К списку мероприятий"
      showRetryButton={true}
      onRetry={handleRetryFetch}
    />;
  }

  // 3. Показываем скелетон, ТОЛЬКО если данных мероприятия еще нет И стадия не COMPLETED/ERROR
  // Добавляем проверку !isEventNotFound на всякий случай
  if (!event && currentStage < LoadingStage.COMPLETED && !isEventNotFound) {
    logInfo(`Rendering loading state (Skeleton because !event and stage is ${currentStage})`);
    return <EventDetailsSkeleton />;
  }
  
  // 4. Если данных нет, но стадия COMPLETED (и не isEventNotFound) - это странная ситуация,
  // возможно, стоит показать заглушку или ошибку? Пока оставим скелетон на всякий случай.
  // Можно добавить лог для отладки такого случая.
  if (!event && currentStage === LoadingStage.COMPLETED && !isEventNotFound) {
      logWarn("Rendering Skeleton: Stage is COMPLETED but event data is still null and not 'not found'. This might indicate an issue.");
      return <EventDetailsSkeleton />;
  }

  // 5. Если дошли сюда - данные event есть, ошибки нет, не "не найдено". Рендерим контент.
  if (event) {
      logInfo("Rendering event content", { currentStage, eventId: event.id });
      return (
        <div className="min-h-screen flex flex-col">
          <main className="flex-grow">
            {/* Обложка мероприятия */}
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
              {/* Детали мероприятия */}
              {event.ticket_type && ( // Добавим проверку на наличие ticket_type перед рендерингом деталей
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

              {/* Блок регистрации */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
              >
                <div className={`bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto`}>
                  <h2 className="text-2xl font-semibold mb-4 text-center">
                    {/* Логика заголовка блока регистрации */}
                    {event.status === "registration_open" &&
                     (event.ticket_type?.available_quantity ?? 0) - (event.ticket_type?.sold_quantity ?? 0) <= 0
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
                      availableQuantity={event.ticket_type?.available_quantity ?? 0}
                      soldQuantity={event.ticket_type?.sold_quantity ?? 0}
                      price={event.price}
                      freeRegistration={event.ticket_type?.free_registration ?? false}
                      onBookingClick={handleBookingClick}
                      onLoginClick={handleLoginClick}
                      onBookingSuccess={handleBookingSuccess}
                      displayStatus={event.status === "registration_closed" || event.status === "completed" ? "Регистрация закрыта" : undefined}
                      eventStatus={event.status}
                      // onReady можно убрать, если EventRegistration больше не сигнализирует о готовности
                    />
                  )}

                  {/* Сообщение для неавторизованных пользователей */}
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

              {/* Описание мероприятия */}
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
                    disableFontSize={false} // Убедимся, что размер шрифта применяется
                  />
                </motion.section>
              )}
            </div>
          </main>
          <Footer />

          {/* Модальное окно аутентификации */}
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
  
  // Если дошли сюда, но event все еще null (а не isEventNotFound и не ошибка) -
  // это крайний случай, возвращаем скелетон.
  logWarn("Reached end of render logic without rendering content, returning skeleton as fallback.");
  return <EventDetailsSkeleton />;
}