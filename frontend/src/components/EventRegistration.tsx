// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { FaTicketAlt, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { EventRegistrationProps } from "@/types/index";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/api";
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';

// Интерфейс для билета пользователя с учетом разных вариантов написания статусов
interface UserTicket {
  id: number;
  event: {
    id: number;
    title: string;
    start_date: string;
    end_date?: string;
    location?: string;
  };
  ticket_type: string;
  registration_date: string;
  status: "pending" | "confirmed" | "cancelled" | "canceled" | "completed";
  ticket_number?: string;
  created_at?: string;
  updated_at?: string;
}

// Ticket response structure can vary, so we need this interface for the raw response
interface TicketResponse {
  data?: UserTicket[] | UserTicket;
  items?: UserTicket[] | UserTicket;
  tickets?: UserTicket[] | UserTicket;
  [key: string]: unknown;
}

// Функции для работы с билетами
const isTicketCancelled = (status: string): boolean => {
  return status === 'cancelled' || status === 'canceled';
};

// Helper to parse ticket response into an array of UserTicket
const parseTicketResponse = (response: TicketResponse | UserTicket[]): UserTicket[] => {
  let allTickets: UserTicket[] = [];
  
  if (Array.isArray(response)) {
    allTickets = response;
  } else if (response.data) {
    allTickets = Array.isArray(response.data) ? response.data : [response.data];
  } else if (response.items) {
    allTickets = Array.isArray(response.items) ? response.items : [response.items];
  } else if (response.tickets) {
    allTickets = Array.isArray(response.tickets) ? response.tickets : [response.tickets];
  }
  
  return allTickets;
};

const EventRegistration: React.FC<EventRegistrationProps> = ({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  // ticketType is unused but kept for props interface compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketType,
  availableQuantity,
  soldQuantity,
  price,
  freeRegistration,
  onBookingClick,
  onLoginClick,
  // onBookingSuccess is unused but kept for props interface compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBookingSuccess,
  onReady,
  displayStatus,
}) => {
  const { userData, isAuth } = useAuth();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [userTicket, setUserTicket] = useState<UserTicket | null>(null);
  const [isCheckingTicket, setIsCheckingTicket] = useState(false);
  // Add a flag to track active booking state
  const isActiveBooking = useRef(false);

  const remainingQuantity = availableQuantity - soldQuantity;
  const maxVisibleSeats = 10;
  const seatsArray = Array.from(
    { length: Math.min(remainingQuantity, maxVisibleSeats) },
    (_, index) => index
  );

  const isRegistrationClosedOrCompleted =
    displayStatus === "Регистрация закрыта" || displayStatus === "Мероприятие завершено";

  // --- Переработанный useEffect для ПРОВЕРКИ билета при загрузке --- 
  useEffect(() => {
    if (!isAuth || !userData) {
      setUserTicket(null); // Сбрасываем билет, если не авторизован
      if (onReady) {
        console.log('EventRegistration: Notifying parent component that loading is complete (not auth)');
        onReady();
      }
      return;
    }
    
    let isMounted = true;
    let hasCalledReady = false;

    const notifyReady = () => {
      if (isMounted && onReady && !hasCalledReady) {
        console.log('EventRegistration: Notifying parent component that loading is complete');
        hasCalledReady = true;
        onReady();
      }
    };

    // Переименованная функция для получения билета
    const fetchUserTicketForEvent = async () => {
      // Не проверяем билет, если идет процесс бронирования
      if (isActiveBooking.current) {
        console.log('EventRegistration: Skipping ticket check during active booking');
        notifyReady(); // Сразу сообщаем о готовности, т.к. проверка пропускается
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        console.log('EventRegistration: No token found, cannot fetch ticket.');
        setUserTicket(null);
        notifyReady();
        return;
      }

      setIsCheckingTicket(true);
      setError(undefined); // Сбрасываем предыдущие ошибки
      const currentEventId = parseInt(eventId.toString());
      console.log(`EventRegistration: Checking for existing ticket for eventId: ${currentEventId}`);

      try {
        // Используем GET запрос для получения билетов пользователя по ID мероприятия
        // Предполагаемый эндпоинт: /user_edits/my-tickets?event_id={eventId}
        // Если бэкенд не поддерживает фильтрацию, придется получать все и фильтровать:
        // const allTicketsResponse = await apiFetch<TicketResponse>('/user_edits/my-tickets', {...});
        // const allTickets = parseTicketResponse(allTicketsResponse);
        // const foundTicket = allTickets.find(t => t.event.id === currentEventId && !isTicketCancelled(t.status));

        const ticketResponse = await apiFetch<TicketResponse>(`/user_edits/my-tickets?event_id=${currentEventId}`, {
          method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache' // Гарантируем свежие данные
          },
          bypassLoadingStageCheck: true
        });

        console.log('Response for existing ticket check:', ticketResponse);
        
        if (!isMounted) return; // Выходим, если компонент размонтирован

        if ('aborted' in ticketResponse) {
          const abortedResponse = ticketResponse as unknown as ApiAbortedResponse;
          console.warn("EventRegistration: Ticket check request aborted", abortedResponse.reason);
          // Не устанавливаем ошибку, т.к. это может быть просто отмена навигации
        } else if ('error' in ticketResponse) {
          const errorResponse = ticketResponse as unknown as ApiErrorResponse;
          // Ошибка 404 означает, что билет просто не найден - это не ошибка для UI
          if (errorResponse.status === 404) {
            console.log('EventRegistration: No existing ticket found (404).');
            setUserTicket(null);
          } else {
            // Другие ошибки отображаем
            console.error('Error fetching user ticket:', errorResponse);
            const errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при проверке билета.";
            setError(errorMessage);
            setUserTicket(null); // Сбрасываем билет при ошибке
          }
        } else {
            // Успешный ответ - парсим и ищем нужный билет
            const foundTickets = parseTicketResponse(ticketResponse);
            const activeTicket = foundTickets.find(t => t.event.id === currentEventId && !isTicketCancelled(t.status));
            
            if (activeTicket) {
                console.log('EventRegistration: Found existing active ticket:', activeTicket);
                setUserTicket(activeTicket);
            } else {
                console.log('EventRegistration: No active ticket found in the response.');
                setUserTicket(null);
            }
        }
      } catch (err) {
        if (!isMounted) return; 
        // Обработка непредвиденных ошибок (сеть и т.п.)
        console.error('Unexpected error fetching user ticket:', err);
        if (err && typeof err === 'object' && 'detail' in err) {
          console.error('Error details:', (err as any).detail);
        }
        setError(err instanceof Error ? err.message : "Ошибка при проверке билета.");
        setUserTicket(null); // Сбрасываем билет при ошибке
      } finally {
        if (isMounted) {
          setIsCheckingTicket(false);
          notifyReady(); // Сообщаем о готовности после завершения проверки
        }
      }
    };

    // Запускаем проверку билета с небольшой задержкой
    const timeoutId = setTimeout(fetchUserTicketForEvent, 100);
      
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  // Зависимости: isAuth, userData, eventId, onReady
  }, [isAuth, userData?.id, eventId, onReady]); // Добавил userData.id для перезапуска при смене пользователя
  

  // Handle ticket update events
  const handleTicketUpdate = useCallback((event: Event) => {
    // Type guard for CustomEvent
    if (!(event instanceof CustomEvent)) return;

    const detail = event.detail as { 
      eventId?: number; 
      newTicket?: UserTicket | null; 
      action?: 'register' | 'update' | 'cancel';
      source?: string; // Optional: to identify the source
    };

    // Check if the update is relevant to this event instance
    if (detail && detail.eventId === parseInt(eventId.toString())) {
      console.log('EventRegistration: Received relevant ticket update event', detail);

      // If the source is this component itself (internal update), ignore it
      // to prevent loops, unless it's the final server data update.
      // We check if 'isServerData' flag exists and is true.
      if (detail.source === 'event-registration' && !(detail as any).isServerData) {
        console.log('EventRegistration: Ignoring internal ticket update event.');
        return;
      }

      if (detail.action === 'cancel') {
        console.log('EventRegistration: Ticket cancelled via event, resetting userTicket.');
        setUserTicket(null);
      } else if (detail.newTicket) {
        console.log('EventRegistration: Updating userTicket with data from event.');
        setUserTicket(detail.newTicket);
      } else if (detail.newTicket === null) {
        // Explicitly handle null to reset the ticket
        console.log('EventRegistration: Received null ticket via event, resetting userTicket.');
        setUserTicket(null);
      }
    }
  }, [eventId]); // Dependency on eventId to ensure we compare against the correct one

  useEffect(() => {
    // Add event listener when component mounts and isAuth changes
    if (isAuth) {
      window.addEventListener('ticket-update', handleTicketUpdate as EventListener);
      console.log('EventRegistration: Added ticket update event listener');
    }

    // Cleanup function to remove event listener
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate as EventListener);
      console.log('EventRegistration: Removed ticket update event listener');
    };
  }, [handleTicketUpdate, isAuth]); // Depend on the callback and auth state

  const handleConfirmBooking = async () => {
    // Set the flag to prevent event handling during booking
    isActiveBooking.current = true;
    
    setError(undefined);
    setSuccess(undefined);

    try {
      // Check if registration is closed or completed
      if (isRegistrationClosedOrCompleted) {
        throw new Error("Регистрация на это мероприятие закрыта");
      }

      // Check if there are available tickets
      if (remainingQuantity <= 0) {
        throw new Error("К сожалению, все билеты уже распроданы");
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      console.log('Sending registration request with data:', {
        event_id: parseInt(eventId.toString()),
        user_id: userData!.id
      });

      // Use apiFetch for consistent API handling
      const response = await apiFetch<UserTicket>('/registration/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          event_id: parseInt(eventId.toString()),
          user_id: userData!.id
        },
        bypassLoadingStageCheck: true // Обходим проверку стадии загрузки
      });

      console.log('Response received:', response);
      
      if ('aborted' in response) {
        const abortedResponse = response as unknown as ApiAbortedResponse;
        console.error("EventRegistration: Request aborted", abortedResponse.reason);
        throw new Error(abortedResponse.reason || "Запрос был прерван");
      }
      
      if ('error' in response) {
        // Обработка конкретных типов ошибок для более дружелюбных сообщений
        const errorResponse = response as unknown as ApiErrorResponse;
        // Ошибка теперь выводится в лог ниже в catch
        const errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при бронировании";
        
        // Пробуем найти понятное сообщение об ошибке в тексте
        if (errorMessage.includes("Превышен лимит отмен регистраций")) {
          throw new Error("Вы уже отменяли регистрацию на это мероприятие 3 раза. Дальнейшая регистрация недоступна.");
        } else if (errorMessage.includes("Вы уже зарегистрированы")) {
          // Если при явном бронировании получаем эту ошибку, можно ее показать
          throw new Error("Вы уже зарегистрированы на это мероприятие."); 
        } else if (errorMessage.includes("Билеты на это мероприятие распроданы")) {
          throw new Error("К сожалению, все билеты на это мероприятие уже распроданы.");
        } else if (errorMessage.includes("Регистрация на это мероприятие недоступна")) {
          throw new Error("Регистрация на это мероприятие в данный момент недоступна.");
        } else {
          // Другие ошибки из errorResponse.error
          throw new Error(errorMessage); 
        }
      }

      // Use the response directly
      const data = response;
      console.log('Success response:', data);

      setSuccess("Вы успешно забронировали билет!");
      
      // Create a temporary ticket object for immediate UI update
      const tempTicket: UserTicket = {
        id: data?.id || Math.floor(Math.random() * 10000), 
        event: {
          id: parseInt(eventId.toString()),
          title: eventTitle || "Мероприятие",
          start_date: eventDate ? (() => {
            try {
              const date = new Date(eventDate);
              if (isNaN(date.getTime())) {
                console.warn('Invalid event date for start_date, using current date instead');
                return new Date().toISOString();
              }
              return date.toISOString();
            } catch (e) {
              console.warn('Invalid event date format, using current date instead:', e);
              return new Date().toISOString();
            }
          })() : new Date().toISOString(),
          end_date: eventDate ? (() => {
            try {
              const date = new Date(eventDate);
              if (isNaN(date.getTime())) {
                console.warn('Invalid event date for end_date, using undefined');
                return undefined;
              }
              return date.toISOString();
            } catch (e) {
              console.warn('Invalid event date format for end_date, using undefined:', e);
              return undefined;
            }
          })() : undefined,
          location: eventLocation || "Не указано"
        },
        ticket_type: data?.ticket_type || "standart",
        registration_date: new Date().toISOString(),
        status: "confirmed", 
        ticket_number: data?.ticket_number || `Загрузка...`, 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
        
      // Immediately update the local state to show the ticket
      setUserTicket(tempTicket);
        
      // Dispatch ticket update event with the temporary ticket data
      if (typeof window !== 'undefined') {
        const ticketEvent = new CustomEvent('ticket-update', {
          detail: {
            source: 'event-registration',
            action: 'register',
            eventId: parseInt(eventId.toString()),
            ticketId: tempTicket.id,
            newTicket: tempTicket,
            isInternalUpdate: true
          }
        });
        window.dispatchEvent(ticketEvent);
        console.log('EventRegistration: Dispatched ticket update event with temporary ticket data');
        
        sessionStorage.setItem('recent_registration', JSON.stringify({
          event_id: parseInt(eventId.toString()),
          ticket_id: tempTicket.id,
          timestamp: Date.now()
        }));
      }
      
      // Close modal after showing success message
      setTimeout(() => {
        setIsModalOpen(false);
        
        // Create a safety timeout to reset booking flag in case the fetch fails
        const safetyTimeout = setTimeout(() => {
          if (isActiveBooking.current) {
            console.log('EventRegistration: Safety timeout triggered - resetting active booking flag');
            isActiveBooking.current = false;
          }
        }, 10000); // 10 second safety timeout
        
        // After modal closes, fetch the actual ticket data from server
        setTimeout(async () => {
          try {
            console.log('EventRegistration: Fetching actual ticket data after registration');
            const token = localStorage.getItem('token');
            if (!token) {
              console.log('EventRegistration: No token available for fetching actual ticket');
              isActiveBooking.current = false;
              clearTimeout(safetyTimeout);
              return;
            }
            
            const actualTicketResponse = await apiFetch<TicketResponse>('/user_edits/my-tickets', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              bypassLoadingStageCheck: true 
            });
            
            if ('aborted' in actualTicketResponse) {
              const abortedResponse = actualTicketResponse as unknown as ApiAbortedResponse;
              throw new Error(abortedResponse.reason || "Запрос был прерван");
            }
            
            if ('error' in actualTicketResponse) {
              const errorResponse = actualTicketResponse as unknown as ApiErrorResponse;
              throw new Error(typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при получении билетов");
            }
            
            const actualTicketData = actualTicketResponse;
            
            if (actualTicketData) {
              const allTickets = parseTicketResponse(actualTicketData);
              const currentEventId = parseInt(eventId.toString());
              const actualTicket = allTickets.find((t: UserTicket) => 
                t.event.id === currentEventId && !isTicketCancelled(t.status)
              );
              
              if (actualTicket) {
                console.log('EventRegistration: Found actual ticket data', actualTicket);
                setUserTicket(actualTicket);
                
                const updatedEvent = new CustomEvent('ticket-update', {
                  detail: {
                    source: 'event-registration',
                    action: 'update',
                    eventId: currentEventId,
                    ticketId: actualTicket.id,
                    newTicket: actualTicket,
                    isInternalUpdate: false,
                    isServerData: true
                  }
                });
                window.dispatchEvent(updatedEvent);
                console.log('EventRegistration: Dispatched update with actual ticket data');
              } else {
                console.log('EventRegistration: No actual ticket found for event', currentEventId);
              }
            }
          } catch (err) {
            console.error('EventRegistration: Error fetching actual ticket data', err);
          } finally {
            console.log('EventRegistration: Resetting active booking flag');
            isActiveBooking.current = false;
            clearTimeout(safetyTimeout);
          }
        }, 500); 
      }, 1500);
    } catch (err) {
      // Улучшенное логирование ошибки (остается)
      console.error('Booking error in handleConfirmBooking:', err);
      if (err && typeof err === 'object' && 'detail' in err) {
        console.error('Error details:', (err as any).detail);
      }
      // Используем instanceof Error для более точного сообщения
      setError(err instanceof Error ? err.message : "Ошибка при бронировании."); 
      isActiveBooking.current = false;
      console.log('EventRegistration: Reset active booking flag to false (error path)');
    }
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isAuth && userData) {
      setIsModalOpen(true);
    } else {
      onLoginClick();
    }
    onBookingClick();
  };

  // Перенаправление в профиль пользователя при нажатии на кнопку "Активная бронь"
  const handleGoToProfile = () => {
    // Store a flag in sessionStorage to indicate we're coming from an event page with a ticket
    if (userTicket) {
      sessionStorage.setItem('recent_registration', JSON.stringify({
        event_id: userTicket.event.id,
        ticket_id: userTicket.id,
        timestamp: Date.now(),
        from_event_page: true
      }));
    }
    router.push("/profile");
  };

  // Добавляем кнопку для отладки (только в режиме разработки)
  const renderDebugButton = (): JSX.Element | null => {
    // Always return null to hide the debug button in all environments
    return null;
  };

  // Рендер компонента, если у пользователя уже есть билет
  if (userTicket) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
          <div className="flex items-center mb-2 sm:mb-0">
            <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 text-center sm:text-left">
              Доступные места: {remainingQuantity}
            </h3>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGoToProfile}
            className="px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md min-w-[120px] min-h-[44px] text-sm sm:text-base bg-orange-200 text-orange-700 hover:bg-orange-300"
          >
            Активная бронь
          </motion.button>
        </div>
        
        {!isRegistrationClosedOrCompleted && (
          <div className="flex flex-wrap gap-2 justify-center">
            {/* Горизонтальный номер билета */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-3 px-5 shadow-sm flex flex-row items-center">
                {/* Левая часть - заголовок */}
                <div className="flex items-center justify-center pr-3 border-r border-orange-200">
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    НОМЕР БИЛЕТА
                  </p>
                </div>
                
                {/* Правая часть - номер */}
                <div className="flex items-center justify-center pl-3">
                  {userTicket.ticket_number === 'Загрузка...' ? (
                    <div className="flex items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-orange-500 border-r-transparent"></div>
                      <span className="ml-2 text-sm text-orange-600">Загрузка номера...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-orange-600">
                      #{userTicket.ticket_number || userTicket.id}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {renderDebugButton()}
      </div>
    );
  }

  // Рендер стандартного компонента бронирования
  return (
    <>
      <div className="flex flex-col items-center space-y-4">
        {isCheckingTicket ? (
          <div className="flex items-center justify-center h-[120px]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
              <div className="flex items-center mb-2 sm:mb-0">
                <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 text-center sm:text-left">
                  {isRegistrationClosedOrCompleted
                    ? "Места распределены"
                    : `Доступные места: ${remainingQuantity}`}
                </h3>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleButtonClick}
                disabled={remainingQuantity === 0}
                className={`
                  px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md
                  min-w-[120px] min-h-[44px] text-sm sm:text-base
                  ${remainingQuantity === 0
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-orange-500 text-white hover:bg-orange-600"}
                `}
              >
                Забронировать
              </motion.button>
            </div>
            
            {renderDebugButton()}

            {!isRegistrationClosedOrCompleted && remainingQuantity > 0 ? (
              <div className="flex flex-wrap gap-2 justify-center">
                <AnimatePresence>
                  {seatsArray.map((seat) => (
                    <motion.button
                      key={seat}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3, delay: seat * 0.05 }}
                      onClick={handleButtonClick}
                      className="w-10 h-10 rounded-md transition-all duration-200 text-base bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center font-medium min-w-[40px] min-h-[40px]"
                      title={`Место ${seat + 1}`}
                    >
                      {seat + 1}
                    </motion.button>
                  ))}
                </AnimatePresence>
                {remainingQuantity > maxVisibleSeats && (
                  <span className="text-gray-500 text-sm mt-2">+{remainingQuantity - maxVisibleSeats} мест</span>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center text-sm sm:text-base">
                {isRegistrationClosedOrCompleted ? "Места распределены" : "Места закончились"}
              </p>
            )}
          </>
        )}
      </div>

      <AuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Бронирование билета"
        error={error}
        success={success}
        className="max-w-[90vw] min-w-[300px] w-full sm:max-w-md"
      >
        <div className="space-y-6">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-lg sm:text-xl font-semibold text-gray-800 text-center"
          >
            {eventTitle}
          </motion.h3>
          <div className="space-y-3 text-gray-600">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex items-center"
            >
              <FaCalendarAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventDate}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex items-center"
            >
              <FaClock className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventTime}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex items-center"
            >
              <FaMapMarkerAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventLocation}</span>
            </motion.div>
            {!freeRegistration && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="flex items-center"
              >
                <FaRubleSign className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
                <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
                  {price === 0 ? <span className="text-green-600">Свободный взнос</span> : `${price} ₽`}
                </span>
              </motion.div>
            )}
          </div>
          
          <div className="flex flex-row gap-2 pt-4">
            <ModalButton onClick={() => setIsModalOpen(false)} className="w-1/2 bg-gray-100 text-gray-700 hover:bg-gray-200">
              Отмена
            </ModalButton>
            <ModalButton 
              onClick={handleConfirmBooking} 
              className="w-1/2 bg-orange-500 text-white hover:bg-orange-600"
            >
              Подтвердить
            </ModalButton>
          </div>
        </div>
      </AuthModal>
    </>
  );
};

export default EventRegistration;