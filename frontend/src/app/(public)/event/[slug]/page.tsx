// frontend/src/app/(public)/event/[slug]/page.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import EventDetails from "@/components/EventDetails";
import FormattedDescription from "@/components/FormattedDescription";
import { notFound } from "next/navigation";
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
import { useLoading } from "@/contexts/LoadingContext";

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
  const parts = slug.split("-");
  const id = parts.pop() || "";
  return id;
};

const extractTitleFromSlug = (slug: string): string => {
  const parts = slug.split("-");
  // Remove the last part (id)
  parts.pop();
  // Join the remaining parts and convert to title case
  return parts.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [hasServerError, setHasServerError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { isAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
  const { setDynamicLoading } = useLoading();
  const fetchInProgressRef = useRef(false);
  const hasInitialFetchRef = useRef(false);
  const isMountedRef = useRef(false);
  const lastLogTimeRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const globalLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountCountRef = useRef(0);
  
  // Функции логирования с разными уровнями
  const logDebug = (message: string, data?: any) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
      if (data) {
        console.debug(`EventPage: ${message}`, data);
      } else {
        console.debug(`EventPage: ${message}`);
      }
    }
  };

  const logInfo = (message: string, data?: any) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
      if (data) {
        console.log(`EventPage: ${message}`, data);
      } else {
        console.log(`EventPage: ${message}`);
      }
    }
  };

  const logWarn = (message: string, data?: any) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
      if (data) {
        console.warn(`EventPage: ⚠️ ${message}`, data);
      } else {
        console.warn(`EventPage: ⚠️ ${message}`);
      }
    }
  };

  const logError = (message: string, data?: any) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
      if (data) {
        console.error(`EventPage: ⛔ ${message}`, data);
      } else {
        console.error(`EventPage: ⛔ ${message}`);
      }
    }
  };
  
  // Функция для проверки, можно ли делать новый запрос
  const canMakeNewRequest = useCallback(() => {
    const now = Date.now();
    // Не делаем запросы чаще чем раз в 2 секунды
    if (now - lastFetchTimeRef.current < 2000) {
      logDebug("Skipping fetch due to rate limiting");
      return false;
    }
    return true;
  }, []);
  
  // Функция для сброса глобальной блокировки
  const resetGlobalLock = useCallback(() => {
    if (globalLockTimeoutRef.current) {
      clearTimeout(globalLockTimeoutRef.current);
      globalLockTimeoutRef.current = null;
    }
    
    // Устанавливаем таймаут для сброса глобальной блокировки
    globalLockTimeoutRef.current = setTimeout(() => {
      logDebug("Resetting global lock timeout");
      fetchInProgressRef.current = false;
      globalLockTimeoutRef.current = null;
    }, 5000); // Сбрасываем через 5 секунд
  }, []);
  
  // Handle auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      logInfo("Auth change detected");
      // Только сбрасываем флаг начальной загрузки
      hasInitialFetchRef.current = false;
    };
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, []);

  // Fetch event data with improved error handling and loading state
  useEffect(() => {
    if (!slug) {
      logWarn("No slug provided");
      setIsLoading(false);
      setShowInitialSkeleton(false);
      return;
    }
    
    if (event && hasInitialFetchRef.current) {
      logDebug("Event data already loaded");
      setIsLoading(false);
      setShowInitialSkeleton(false);
      return;
    }
    
    if (fetchInProgressRef.current) {
      logDebug("Fetch already in progress");
      return;
    }
    
    // Устанавливаем таймер для гарантированного скрытия скелетона
    const skeletonTimer = setTimeout(() => {
      if (isMountedRef.current) {
        logInfo('Hiding skeleton regardless of data state');
        setShowInitialSkeleton(false);
      }
    }, 3000); // Максимальное время показа скелетона
    
    let isRequestCancelled = false;
    
    const fetchEventData = async () => {
      if (isRequestCancelled) return;
      
      try {
        fetchInProgressRef.current = true;
        setIsLoading(true);
        setDynamicLoading(true);
        
        const eventId = extractIdFromSlug(slug);
        const timestamp = Date.now();
        const url = `/v1/public/events/${eventId}?t=${timestamp}`;
        
        logInfo(`Fetching event data`, { url, eventId });
        
        const controller = new AbortController();
        
        const response = await apiFetch<EventData>(url, {
          signal: controller.signal,
          bypassLoadingStageCheck: true // Обходим проверку стадии загрузки
        });
        
        if (isRequestCancelled) return;
        
        logInfo("Raw response data", response);
        
        if ('error' in response) {
          logError("Error in response", response.error);
          setFetchError(response.error?.message || "Ошибка загрузки");
          setHasServerError(response.error?.status ? response.error.status >= 500 : false);
          return;
        }
        
        // At this point, response must be EventData
        if ('title' in response) {
          // Обеспечиваем типобезопасный кастинг
          const eventData = response as unknown as EventData;
          setEvent(eventData);
          
          // Если название не совпадает со slug, обновляем его из slug
          if (!eventData.title || eventData.title === "Мероприятие " + eventId) {
            const titleFromSlug = extractTitleFromSlug(slug);
            logInfo("Using title from slug", { titleFromSlug });
            eventData.title = titleFromSlug;
          }
          
          // Сохраняем заголовок в localStorage для быстрых ссылок
          try {
            localStorage.setItem(`event-title-${eventId}`, String(eventData.title));
            localStorage.setItem(`event-slug-${eventId}`, slug);
            logDebug("Saved to localStorage", {
              title: eventData.title,
              slug: slug
            });
          } catch (error) {
            logError("Error saving to localStorage", error);
          }
          
          setFetchError(null);
          setHasServerError(false);
          hasInitialFetchRef.current = true;
        } else {
          logWarn("Invalid event data received", response);
          setFetchError("Мероприятие не найдено");
        }
      } catch (err) {
        if (!isRequestCancelled) {
          logError("Error fetching event", err);
          setFetchError(err instanceof Error ? err.message : "Ошибка загрузки мероприятия");
        }
      } finally {
        if (!isRequestCancelled) {
          setIsLoading(false);
          setDynamicLoading(false);
          fetchInProgressRef.current = false;
          setShowInitialSkeleton(false);
        }
      }
    };
    
    // Добавляем небольшую задержку перед запуском запроса
    const initDelay = setTimeout(() => {
      if (!isRequestCancelled) {
        fetchEventData();
      }
    }, 100);

    return () => {
      isRequestCancelled = true;
      clearTimeout(initDelay);
      clearTimeout(skeletonTimer);
      fetchInProgressRef.current = false;
    };
  }, [slug, event, setDynamicLoading]);
  
  // Component mount/unmount handling
  useEffect(() => {
    const currentMountCount = mountCountRef.current;
    mountCountRef.current++;
    isMountedRef.current = true;
    logInfo(`Component mounted (${currentMountCount + 1})`);
    
    return () => {
      isMountedRef.current = false;
      logInfo(`Component unmounted (${currentMountCount + 1})`);
      
      // Сбрасываем состояние при размонтировании
      setIsLoading(false);
      setDynamicLoading(false);
      fetchInProgressRef.current = false;
      
      // Очищаем таймауты
      if (globalLockTimeoutRef.current) {
        clearTimeout(globalLockTimeoutRef.current);
        globalLockTimeoutRef.current = null;
      }
    };
  }, [setDynamicLoading]);

  // Event handlers
  const handleBookingClick = useCallback(() => logDebug("Booking click triggered"), []);
  const handleLoginClick = useCallback(() => {
    setIsRegisterMode(false);
    setIsModalOpen(true);
  }, []);
  const handleModalClose = useCallback(() => setIsModalOpen(false), []);
  const toggleToLogin = useCallback(() => setIsRegisterMode(false), []);
  const toggleToRegister = useCallback(() => setIsRegisterMode(true), []);

  // Handle booking success with improved request handling
  const handleBookingSuccess = useCallback(() => {
    if (!slug || fetchInProgressRef.current) return;
    if (!canMakeNewRequest()) return;
    
    // Set loading state
    setIsLoading(true);
    setShowInitialSkeleton(true);
    setDynamicLoading(true);
    fetchInProgressRef.current = true;
    lastFetchTimeRef.current = Date.now();
    
    // Create an AbortController for this fetch
    const controller = new AbortController();
    
    // Fetch updated event data
    apiFetch<EventData>(`/v1/public/events/${slug}?t=${Date.now()}`, {
      signal: controller.signal,
      bypassLoadingStageCheck: true
    })
      .then((response) => {
        // Check if response is an aborted response
        if ('aborted' in response) {
          logInfo("Request was aborted", { reason: response.reason });
          
          // Если запрос был отклонен из-за глобальной блокировки, установим таймаут для сброса
          if (response.reason === "global_lock") {
            resetGlobalLock();
          }
          return;
        }

        // Check if response contains an error
        if ('error' in response) {
          logError("Error in response", response.error);
          setFetchError(response.error?.message || "Ошибка загрузки");
          setHasServerError(response.error?.status ? response.error.status >= 500 : false);
          return;
        }
        
        // At this point, response must be EventData
        const eventData = response as unknown as EventData;
        setEvent(eventData);
        setFetchError(null);
        setHasServerError(false);
        logInfo("Event data updated after booking success");
      })
      .catch((err) => {
        // Check if the error is due to abort
        if (err.name === 'AbortError') {
          logInfo("Request was aborted by the browser");
          return;
        }
        
        logError("Error fetching updated event data", err);
        setFetchError(err.message);
        setHasServerError(true);
      })
      .finally(() => {
        setIsLoading(false);
        setShowInitialSkeleton(false);
        setDynamicLoading(false);
        fetchInProgressRef.current = false;
      });
      
    // Return the controller for cleanup
    return controller;
  }, [slug, canMakeNewRequest, resetGlobalLock, setDynamicLoading]);

  // Debug render states
  useEffect(() => {
    if (isMountedRef.current) {
      logDebug(`Render state`, { 
        isLoading, 
        hasEvent: !!event, 
        fetchError,
        showingSkeleton: showInitialSkeleton
      });
    }
  }, [isLoading, event, fetchError, showInitialSkeleton]);

  // Render error states
  if (hasServerError) {
    logWarn("Rendering server error");
    return <ErrorPlaceholder />;
  }
  
  if (fetchError) {
    logWarn("Rendering fetch error");
    return notFound();
  }
  
  // Render loading state with improved skeleton
  if (!event || isLoading || showInitialSkeleton) {
    logInfo("Rendering loading state with improved skeleton");
    return <EventDetailsSkeleton />;
  }

  // Render event content
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
              <Image src={event.image_url} alt={event.title} fill className="object-cover" priority />
            ) : (
              <AnimatedGradientBackground>
              </AnimatedGradientBackground>
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
                date={format(new Date(event.start_date), "d MMMM yyyy", { locale: ru })}
                time={format(new Date(event.start_date), "HH:mm", { locale: ru })}
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

              <EventRegistration
                eventId={event.id || parseInt(extractIdFromSlug(slug))}
                eventTitle={event.title}
                eventDate={format(new Date(event.start_date), "d MMMM yyyy", { locale: ru })}
                eventTime={format(new Date(event.start_date), "HH:mm", { locale: ru })}
                eventLocation={event.location || "Не указано"}
                ticketType={event.ticket_type?.name || "Стандартный"}
                availableQuantity={event.ticket_type?.available_quantity || 0}
                soldQuantity={event.ticket_type?.sold_quantity || 0}
                price={event.price}
                freeRegistration={event.ticket_type?.free_registration || false}
                onBookingClick={handleBookingClick}
                onLoginClick={handleLoginClick}
                onBookingSuccess={handleBookingSuccess}
                displayStatus={event.status === "registration_open" && 
                             (event.ticket_type?.available_quantity || 0) - (event.ticket_type?.sold_quantity || 0) <= 0 
                              ? "Регистрация закрыта (мест нет)"
                              : event.status === "registration_open" 
                                ? "Регистрация открыта"
                                : event.status === "registration_closed" 
                                  ? "Регистрация закрыта"
                                  : event.status === "completed" 
                                    ? "Мероприятие завершено" 
                                    : "Черновик"}
              />

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
            onClose={handleModalClose} 
            title={isRegisterMode ? "Регистрация" : "Вход"}
          >
            {isRegisterMode ? (
              <Registration 
                isOpen={isModalOpen} 
                onClose={handleModalClose} 
                toggleMode={toggleToLogin} 
              />
            ) : (
              <Login 
                isOpen={isModalOpen} 
                onClose={handleModalClose} 
                toggleMode={toggleToRegister} 
              />
            )}
          </AuthModal>
        )}
      </AnimatePresence>
    </div>
  );
}