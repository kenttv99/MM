// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { FaTicketAlt, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { FaRegCalendarCheck } from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";
import { EventRegistrationProps } from "@/types/index";
import { apiFetch } from "@/utils/api";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Интерфейс для билета пользователя
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
  status: "pending" | "confirmed" | "cancelled" | "completed";
  ticket_number?: string;
}

// Helper function to format date
const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return format(date, "d MMMM yyyy", { locale: ru });
};

// Helper function to format time
const formatTimeForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return format(date, "HH:mm", { locale: ru });
};

// Helper function to get status text
const getStatusText = (status: string): string => {
  switch (status) {
    case "pending": return "Ожидание";
    case "confirmed": return "Подтвержден";
    case "cancelled": return "Отменен";
    case "completed": return "Завершен";
    default: return "Активный";
  }
};

// Helper function to get status color
const getStatusColor = (status: string): string => {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "confirmed": return "bg-green-100 text-green-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "completed": return "bg-blue-100 text-blue-800";
    default: return "bg-green-100 text-green-800";
  }
};

const EventRegistration: React.FC<EventRegistrationProps> = ({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  availableQuantity,
  soldQuantity,
  price,
  freeRegistration,
  onBookingClick,
  onLoginClick,
  onBookingSuccess,
  displayStatus,
}) => {
  const { userData, isAuth } = useAuth();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [userTicket, setUserTicket] = useState<UserTicket | null>(null);
  const [isCheckingTicket, setIsCheckingTicket] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const remainingQuantity = availableQuantity - soldQuantity;
  const maxVisibleSeats = 10;
  const seatsArray = Array.from(
    { length: Math.min(remainingQuantity, maxVisibleSeats) },
    (_, index) => index
  );

  const isRegistrationClosedOrCompleted =
    displayStatus === "Регистрация закрыта" || displayStatus === "Мероприятие завершено";

  // Функция для получения и отображения отладочной информации
  const showDebugInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setDebugInfo("Нет токена авторизации");
        return;
      }

      const response = await apiFetch<any>('/user_edits/my-tickets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        bypassLoadingStageCheck: true,
        params: {
          _nocache: Date.now()
        }
      });

      let tickets: UserTicket[] = [];
      
      if (Array.isArray(response)) {
        tickets = response;
      } else if (response) {
        if (response.data) {
          tickets = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response.items) {
          tickets = Array.isArray(response.items) ? response.items : [response.items];
        } else if (response.tickets) {
          tickets = Array.isArray(response.tickets) ? response.tickets : [response.tickets];
        }
      }

      // Фильтруем билеты для текущего мероприятия
      const currentEventId = parseInt(eventId.toString());
      const eventTickets = tickets.filter(ticket => ticket.event.id === currentEventId);
      
      // Формируем отладочную информацию
      if (eventTickets.length === 0) {
        setDebugInfo(`Билетов для мероприятия ${eventId} не найдено. Всего билетов: ${tickets.length}`);
      } else {
        const ticketInfo = eventTickets.map(t => 
          `ID: ${t.id}, Статус: ${t.status}, Дата: ${new Date(t.registration_date).toLocaleString()}`
        ).join('\n');
        setDebugInfo(`Билеты для мероприятия ${eventId}:\n${ticketInfo}`);
      }
    } catch (err) {
      setDebugInfo(`Ошибка получения билетов: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
    }
  }, [eventId]);

  // Effect to check for user's ticket when authenticated
  useEffect(() => {
    if (isAuth && userData) {
      // Define function to check if the user has a ticket for this event
      const checkUserTicket = async () => {
        try {
          setIsCheckingTicket(true);
          const token = localStorage.getItem('token');
          if (!token) {
            console.log('EventRegistration: No token found, user needs to login');
            return;
          }

          // First try the dedicated check-ticket endpoint
          let response = await apiFetch<any>(`/registration/check-ticket?event_id=${eventId}&user_id=${userData.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            bypassLoadingStageCheck: true,
            params: {
              _nocache: Date.now() // Prevent caching
            }
          }).catch(error => {
            console.log('EventRegistration: check-ticket endpoint failed, will try fallback:', error);
            return { error: 'Not Found', status: 404 };
          });

          // If the check-ticket endpoint fails, fallback to getting all tickets and filtering
          if (response && (response.error || response.status === 404)) {
            console.log('EventRegistration: Falling back to my-tickets endpoint');
            
            response = await apiFetch<any>('/user_edits/my-tickets', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              bypassLoadingStageCheck: true,
              params: {
                _nocache: Date.now() // Prevent caching
              }
            });
            
            // If we get all tickets, filter for the current event
            if (response) {
              console.log('EventRegistration: Got all tickets, filtering for current event', response);
              
              let allTickets: UserTicket[] = [];
          
              // Parse the response based on its structure
          if (Array.isArray(response)) {
                allTickets = response;
              } else if (response.data) {
                allTickets = Array.isArray(response.data) ? response.data : [response.data];
            } else if (response.items) {
                allTickets = Array.isArray(response.items) ? response.items : [response.items];
            } else if (response.tickets) {
                allTickets = Array.isArray(response.tickets) ? response.tickets : [response.tickets];
            }
          
              // Filter for tickets matching this event and not cancelled
          const currentEventId = parseInt(eventId.toString());
              const eventTickets = allTickets.filter(ticket => 
                ticket.event.id === currentEventId && ticket.status !== 'cancelled'
              );
              
              console.log(`EventRegistration: Found ${eventTickets.length} active tickets for event ${currentEventId}`);
              
              // Use the first valid ticket if found
              if (eventTickets.length > 0) {
                response = eventTickets[0];
              } else {
                console.log('EventRegistration: No active tickets found for this event');
                setUserTicket(null);
                setIsCheckingTicket(false);
                return;
              }
            }
          }

          console.log('EventRegistration: Ticket check response:', response);

          // Process the response based on its structure
          if (response && ((Array.isArray(response) && response.length > 0) || 
              response.data || response.ticket || response.result || response.id)) {
            
            // Handle different response formats
            let ticketData;
            if (Array.isArray(response)) {
              ticketData = response[0];
            } else if (response.data) {
              ticketData = Array.isArray(response.data) ? response.data[0] : response.data;
            } else if (response.ticket) {
              ticketData = response.ticket;
            } else {
              ticketData = response;
            }

            // Ensure we have the basic ticket data structure
            const processedTicket = {
              id: ticketData.id || 0,
              event: {
                id: parseInt(eventId.toString()),
                title: eventTitle,
                start_date: ticketData.event?.start_date || eventDate || new Date().toISOString(),
                end_date: ticketData.event?.end_date || undefined,
                location: ticketData.event?.location || eventLocation
              },
              ticket_type: ticketData.ticket_type || "standart",
              registration_date: ticketData.registration_date || ticketData.created_at || new Date().toISOString(),
              status: ticketData.status || "confirmed",
              ticket_number: ticketData.ticket_number || ticketData.id?.toString()
            };

            console.log('EventRegistration: Processed ticket data:', processedTicket);
          
            // Skip cancelled tickets - don't display them
            if (processedTicket.status === 'cancelled') {
              console.log('EventRegistration: Ticket is cancelled, not showing');
              setUserTicket(null);
              return;
            }
            
            // Set the user ticket for UI display
            setUserTicket(processedTicket);
          } else {
            // No ticket found or it's cancelled
            console.log('EventRegistration: No active ticket found for this event');
            setUserTicket(null);
          }
        } catch (err) {
          console.error('EventRegistration: Error checking user ticket:', err);
          setUserTicket(null);
        } finally {
          setIsCheckingTicket(false);
        }
      };

      // Check for ticket on component mount and userData change
      checkUserTicket();
      
      // Listen for ticket-update events to refresh ticket status
      const handleTicketUpdate = (event: Event) => {
        try {
          // Check if the event is a CustomEvent with detail data
        if (event instanceof CustomEvent && event.detail) {
            const { source, ticketId, eventId: receivedEventId, action, newTicket } = event.detail;
          const currentEventId = parseInt(eventId.toString());
          
          console.log(`EventRegistration: Received ticket-update event with details:`, {
            source,
            ticketId,
            receivedEventId,
            currentEventId,
            action,
              hasNewTicket: !!newTicket,
            matchesThisEvent: receivedEventId === currentEventId
          });
          
          // Check if this event update is for the current event we're displaying
          if (receivedEventId === currentEventId) {
            if (action === 'cancel') {
                // If ticket was cancelled, update our local state immediately
                console.log('EventRegistration: Ticket was cancelled, updating state');
              setUserTicket(null);
              } else if (action === 'register' && newTicket) {
                // If it's a registration with complete ticket data, use it directly
                console.log('EventRegistration: Direct ticket update with new data');
                setUserTicket(newTicket);
              } else {
                // For other actions or incomplete data, recheck ticket status from the server
                console.log('EventRegistration: Ticket was updated, rechecking status');
                setTimeout(() => checkUserTicket(), 100); // Small delay to allow other components to update
              }
            }
          } else {
            // If it's a simple event without details, recheck tickets if we're currently showing one
            // or if we're not but it's a fresh update
            console.log('EventRegistration: Received simple ticket update event, rechecking status');
            setTimeout(() => checkUserTicket(), 100);
          }
        } catch (error) {
          // Catch any errors to prevent event handler from breaking
          console.error('EventRegistration: Error handling ticket update event:', error);
          // Still try to check tickets as a fallback
          setTimeout(() => checkUserTicket(), 300);
        }
      };
      
      window.addEventListener('ticket-update', handleTicketUpdate);
      
      return () => {
        window.removeEventListener('ticket-update', handleTicketUpdate);
      };
    } else {
      // Если пользователь не авторизован, сбрасываем состояние билета
      setUserTicket(null);
    }
  }, [isAuth, userData, eventId, eventTitle, eventDate, eventLocation]);

  const handleConfirmBooking = async () => {
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

      // Use the correct endpoint format with standard fetch for better debugging
      const response = await fetch('/registration/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_id: parseInt(eventId.toString()),
          user_id: userData!.id
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        // Обработка конкретных типов ошибок для более дружелюбных сообщений
        try {
          let errorData;
          
          // Проверяем, является ли текст JSON-объектом
          if (errorText.startsWith('{') && errorText.endsWith('}')) {
            errorData = JSON.parse(errorText);
          } else {
            // Ищем внутри текста JSON-объект
            const jsonMatch = errorText.match(/{.*}/s);
            if (jsonMatch) {
              errorData = JSON.parse(jsonMatch[0]);
            }
          }
          
          if (errorData && errorData.detail) {
            // Обработка конкретных сообщений об ошибках
            if (errorData.detail.includes("Превышен лимит отмен регистраций")) {
              throw new Error("Вы уже отменяли регистрацию на это мероприятие 3 раза. Дальнейшая регистрация недоступна.");
            } else if (errorData.detail.includes("Вы уже зарегистрированы")) {
              throw new Error("Вы уже зарегистрированы на это мероприятие.");
            } else if (errorData.detail.includes("Билеты на это мероприятие распроданы")) {
              throw new Error("К сожалению, все билеты на это мероприятие уже распроданы.");
            } else if (errorData.detail.includes("Регистрация на это мероприятие недоступна")) {
              throw new Error("Регистрация на это мероприятие в данный момент недоступна.");
            } else {
              throw new Error(errorData.detail);
            }
          } else {
            // Если не удалось найти detail в JSON или это не JSON
            throw new Error(`Ошибка при бронировании: ${response.status === 400 ? 'Невозможно забронировать билет' : response.statusText}`);
          }
        } catch (parseError) {
          // Если это ошибка парсинга, значит текст ответа не валидный JSON
          console.error('Parse error:', parseError);
          
          // Пробуем найти понятное сообщение об ошибке в тексте
          if (errorText.includes("Превышен лимит отмен регистраций")) {
            throw new Error("Вы уже отменяли регистрацию на это мероприятие 3 раза. Дальнейшая регистрация недоступна.");
          } else if (errorText.includes("Вы уже зарегистрированы")) {
            throw new Error("Вы уже зарегистрированы на это мероприятие.");
          } else {
            throw new Error(`Ошибка при бронировании: ${response.status === 400 ? 'Невозможно забронировать билет' : response.statusText}`);
          }
        }
      }

      // Parse response data
      let data;
      try {
        data = await response.json();
      console.log('Success response:', data);
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        // Create a basic response if parsing fails
        data = { id: Date.now() }; // Use timestamp as fallback ID
      }

      setSuccess("Вы успешно забронировали билет!");
      
      // Always create a complete ticket object with all necessary data,
      // filling in missing fields with sensible defaults
        const newTicket = {
        id: data?.id || Date.now(), // Fallback to timestamp if no ID
          event: {
          id: parseInt(eventId.toString()),
          title: eventTitle || "Мероприятие",
          start_date: eventDate ? new Date(eventDate).toISOString() : new Date().toISOString(),
          end_date: eventDate ? new Date(eventDate).toISOString() : undefined,
          location: eventLocation || "Не указано"
          },
        ticket_type: data?.ticket_type || "standart",
          registration_date: new Date().toISOString(),
        status: "confirmed", // Always set as confirmed
        ticket_number: data?.ticket_number || String(data?.id || Date.now()),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
        };
        
      // Immediately update the local state to show the ticket
        setUserTicket(newTicket);
        
      // Dispatch both a full custom event and a simple event for backward compatibility
        if (typeof window !== 'undefined') {
        // Detailed event with full ticket data
        const ticketEvent = new CustomEvent('ticket-update', {
            detail: {
              source: 'event-registration',
              action: 'register',
            eventId: parseInt(eventId.toString()),
            ticketId: newTicket.id,
            newTicket: newTicket // Pass the complete ticket object
            }
          });
        window.dispatchEvent(ticketEvent);
        console.log('EventRegistration: Dispatched detailed ticket-update event with new ticket data', newTicket);
        
        // Also dispatch a simple event for legacy components
        setTimeout(() => {
          window.dispatchEvent(new Event('ticket-update'));
          console.log('EventRegistration: Also dispatched simple ticket-update event for compatibility');
        }, 50);
      }
      
      // Close the modal after a short delay for better UX
      setTimeout(() => {
        setIsModalOpen(false);
        if (onBookingSuccess) onBookingSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при бронировании.");
      console.error('Booking error:', err);
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
    router.push("/profile");
  };

  // Добавляем кнопку для отладки (только в режиме разработки)
  const renderDebugButton = () => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <div className="mt-4 w-full">
          <button 
            onClick={showDebugInfo}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-2 rounded"
          >
            Проверить билеты
          </button>
          {debugInfo && (
            <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto max-h-40 rounded whitespace-pre-wrap">
              {debugInfo}
            </pre>
          )}
        </div>
      );
    }
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
                  <p className="text-xl font-bold text-orange-600">
                    #{userTicket.ticket_number || userTicket.id}
                  </p>
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
                <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{price} ₽</span>
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