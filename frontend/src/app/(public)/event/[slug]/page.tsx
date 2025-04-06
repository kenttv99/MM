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
  const fetchInProgressRef = useRef(false);
  const hasInitialFetchRef = useRef(false);
  const isMountedRef = useRef(false);
  const lastLogTimeRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const globalLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountCountRef = useRef(0);
  
  // Функция для логирования с ограничением частоты
  const logWithThrottle = (message: string) => {
    const now = Date.now();
    if (now - lastLogTimeRef.current > 500) { // Логируем не чаще чем раз в 500мс
      console.log(message);
      lastLogTimeRef.current = now;
    }
  };
  
  // Функция для проверки, можно ли делать новый запрос
  const canMakeNewRequest = useCallback(() => {
    const now = Date.now();
    // Не делаем запросы чаще чем раз в 2 секунды
    if (now - lastFetchTimeRef.current < 2000) {
      logWithThrottle("EventPage: Skipping fetch due to rate limiting");
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
      logWithThrottle("EventPage: Resetting global lock timeout");
      fetchInProgressRef.current = false;
      globalLockTimeoutRef.current = null;
    }, 5000); // Сбрасываем через 5 секунд
  }, []);
  
  // Handle auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      logWithThrottle("EventPage: Auth change detected");
      // Только сбрасываем флаг начальной загрузки
      hasInitialFetchRef.current = false;
    };
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, []);

  // Fetch event data
  useEffect(() => {
    if (!slug) {
      logWithThrottle("EventPage: No slug provided");
      setIsLoading(false);
      return;
    }
    
    if (event && hasInitialFetchRef.current) {
      logWithThrottle("EventPage: Event data already loaded");
      setIsLoading(false);
      return;
    }
    
    if (fetchInProgressRef.current) {
      logWithThrottle("EventPage: Fetch already in progress");
      return;
    }
    
    let isRequestCancelled = false;
    
    const fetchEventData = async () => {
      if (isRequestCancelled) return;
      
      try {
        fetchInProgressRef.current = true;
        setIsLoading(true);
        
        const eventId = extractIdFromSlug(slug);
        const timestamp = Date.now();
        const url = `/v1/public/events/${eventId}?t=${timestamp}`;
        
        logWithThrottle(`EventPage: Fetching event data from ${url}`);
        
        const response = await apiFetch<EventData>(url, {
          cache: "no-store"
        });
        
        if (isRequestCancelled) return;
        
        console.log("EventPage: Raw response data:", response);
        
        if (response && typeof response === 'object' && 'title' in response) {
          console.log("EventPage: Event title from API:", response.title);
          console.log("EventPage: Event ID from slug:", eventId);
          console.log("EventPage: Full slug:", slug);
          
          // Если название не совпадает со slug, обновляем его из slug
          if (!response.title || response.title === "Мероприятие " + eventId) {
            const titleFromSlug = extractTitleFromSlug(slug);
            console.log("EventPage: Title from slug:", titleFromSlug);
            response.title = titleFromSlug;
          }
          
          console.log("EventPage: Final event title:", response.title);
          setEvent(response as EventData);
          
          // Сохраняем заголовок в localStorage для быстрых ссылок
          try {
            localStorage.setItem(`event-title-${eventId}`, response.title);
            localStorage.setItem(`event-slug-${eventId}`, slug);
            console.log("EventPage: Saved to localStorage:", {
              title: response.title,
              slug: slug
            });
          } catch (error) {
            console.error("EventPage: Error saving to localStorage:", error);
          }
          
            setFetchError(null);
            setHasServerError(false);
          hasInitialFetchRef.current = true;
          } else {
          logWithThrottle("EventPage: Invalid event data received");
            setFetchError("Мероприятие не найдено");
          }
      } catch (err) {
        if (!isRequestCancelled) {
          console.error("EventPage: Error fetching event:", err);
          setFetchError(err instanceof Error ? err.message : "Ошибка загрузки мероприятия");
        }
      } finally {
        if (!isRequestCancelled) {
          setIsLoading(false);
          fetchInProgressRef.current = false;
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
      fetchInProgressRef.current = false;
    };
  }, [slug, event]);
  
  // Component mount/unmount handling
  useEffect(() => {
    const currentMountCount = mountCountRef.current;
    mountCountRef.current++;
    isMountedRef.current = true;
    logWithThrottle(`EventPage: Component mounted (${currentMountCount + 1})`);
    
    return () => {
      isMountedRef.current = false;
      logWithThrottle(`EventPage: Component unmounted (${currentMountCount + 1})`);
      
      // Сбрасываем состояние при размонтировании
      setIsLoading(false);
      fetchInProgressRef.current = false;
      
      // Очищаем таймауты
      if (globalLockTimeoutRef.current) {
        clearTimeout(globalLockTimeoutRef.current);
        globalLockTimeoutRef.current = null;
      }
    };
  }, []);

  // Event handlers
  const handleBookingClick = useCallback(() => console.log("Booking click triggered"), []);
  const handleLoginClick = useCallback(() => {
    setIsRegisterMode(false);
    setIsModalOpen(true);
  }, []);
  const handleModalClose = useCallback(() => setIsModalOpen(false), []);
  const toggleToLogin = useCallback(() => setIsRegisterMode(false), []);
  const toggleToRegister = useCallback(() => setIsRegisterMode(true), []);

  // Handle booking success
  const handleBookingSuccess = useCallback(() => {
    if (!slug || fetchInProgressRef.current) return;
    if (!canMakeNewRequest()) return;
    
    // Set loading state
    setIsLoading(true);
    fetchInProgressRef.current = true;
    lastFetchTimeRef.current = Date.now();
    
    // Create an AbortController for this fetch
    const controller = new AbortController();
    
    // Fetch updated event data
    apiFetch<EventData>(`/v1/public/events/${slug}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then((response) => {
        // Check if response is an aborted response
        if ('aborted' in response) {
          logWithThrottle("EventPage: Request was aborted: " + response.reason);
          
          // Если запрос был отклонен из-за глобальной блокировки, установим таймаут для сброса
          if (response.reason === "global_lock") {
            resetGlobalLock();
          }
          return;
        }

        // Check if response contains an error
        if ('error' in response) {
          logWithThrottle("EventPage: Error in response: " + response.error);
          setFetchError(response.error);
          setHasServerError(response.status >= 500);
          return;
        }
        
        // At this point, response must be EventData
        setEvent(response);
        setFetchError(null);
        setHasServerError(false);
      })
      .catch((err) => {
        // Check if the error is due to abort
        if (err.name === 'AbortError') {
          logWithThrottle("EventPage: Request was aborted by the browser");
          return;
        }
        
        console.error("EventPage: Error fetching updated event data:", err);
        setFetchError(err.message);
        setHasServerError(true);
      })
      .finally(() => {
        setIsLoading(false);
        fetchInProgressRef.current = false;
      });
      
    // Return the controller for cleanup
    return controller;
  }, [slug, canMakeNewRequest, resetGlobalLock]);

  // Debug render states
  useEffect(() => {
    if (isMountedRef.current) {
      logWithThrottle(`EventPage: Render state - isLoading: ${isLoading} event: ${event ? "exists" : "null"} fetchError: ${fetchError}`);
    }
  }, [isLoading, event, fetchError]);

  // Render error states
  if (hasServerError) {
    logWithThrottle("EventPage: Rendering server error");
    return <ErrorPlaceholder />;
  }
  
  if (fetchError) {
    logWithThrottle("EventPage: Rendering fetch error");
    return notFound();
  }
  
  // Render loading state
  if (!event || isLoading) {
    logWithThrottle("EventPage: Rendering loading state");
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 bg-orange-200 rounded-full mb-4"></div>
            <div className="h-4 bg-orange-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-orange-200 rounded w-32"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
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
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500"></span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-4xl font-bold text-white text-center px-4 max-w-[90vw]"
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