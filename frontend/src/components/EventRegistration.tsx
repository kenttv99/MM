// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  ticketType,
  availableQuantity,
  soldQuantity,
  price,
  freeRegistration,
  onBookingClick,
  onLoginClick,
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
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
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

  // Main useEffect for ticket checking
  useEffect(() => {
    // Skip ticket check if user is not authenticated
    if (!isAuth) {
      console.log('EventRegistration: User not authenticated - skipping ticket check');
      
      // Immediately notify parent that we're ready if onReady callback exists
      if (onReady) {
        console.log('EventRegistration: Notifying parent component that loading is complete');
        onReady();
      }
      
      return;
    }
    
    let isMounted = true;
    let hasCalledReady = false;

    // Function to safely notify parent component that we're ready
    const notifyReady = () => {
      if (isMounted && onReady && !hasCalledReady) {
        console.log('EventRegistration: Notifying parent component that loading is complete');
        hasCalledReady = true;
        onReady();
      }
    };

    // Function to check if user has a ticket for this event
    const checkUserTicket = async () => {
      // Skip ticket checking if a booking is in progress
      if (isActiveBooking.current) {
        console.log('EventRegistration: Skipping ticket check during active booking');
        return;
      }

      try {
        setIsCheckingTicket(true);
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('EventRegistration: No token found, user needs to login');
          setUserTicket(null);
          notifyReady();
          return;
        }

        // Use the user_edits/my-tickets endpoint with stronger cache-busting
        console.log('EventRegistration: Using /user_edits/my-tickets endpoint to check tickets');
        
        try {
          // Generate a truly unique cache key with high entropy
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2);
          const uniqueId = `${timestamp}_${random}_${Math.floor(Math.random() * 1000000)}`;
          
          // Force browser to skip cache with cache control headers and unique URL parameters
          const response = await fetch('/user_edits/my-tickets?no_cache=' + uniqueId, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }).then(res => {
            // Handle 401 gracefully
            if (res.status === 401) {
              console.log('EventRegistration: Authorization error (401), user needs to login');
              setUserTicket(null);
              return { detail: 'Authentication required' };
            }
            return res.json();
          });
          
          console.log('EventRegistration: Raw ticket response:', response);
          
          // If we get all tickets, filter for the current event
          if (response && !response.detail) {
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
        
            // Filter for tickets matching this event and not cancelled - very strict filtering
            const currentEventId = parseInt(eventId.toString());
            const eventTickets = allTickets.filter(ticket => 
              ticket.event.id === currentEventId && 
              ticket.status !== 'cancelled' && 
              ticket.status !== 'canceled' // Account for spelling variations
            );
            
            console.log(`EventRegistration: Found ${eventTickets.length} active tickets for event ${currentEventId}`);
            
            // Status-based debug log
            if (eventTickets.length === 0) {
              console.log('EventRegistration: No active tickets for this event - showing booking UI');
              setUserTicket(null);
            } else {
              // Use the first valid ticket if found
              const ticketData = eventTickets[0];
              
              // Log all ticket statuses for debugging
              allTickets.forEach(t => {
                if (t.event.id === currentEventId) {
                  console.log(`EventRegistration: Ticket #${t.id} has status: ${t.status}`);
                }
              });
              
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
            
              // One more safety check - don't display cancelled tickets
              if (processedTicket.status === 'cancelled' || processedTicket.status === 'canceled') {
                console.log('EventRegistration: Ticket is cancelled, not showing');
                setUserTicket(null);
              } else {
                // Set the user ticket for UI display
                setUserTicket(processedTicket);
              }
            }
          } else {
            // No ticket data found or auth error
            console.log('EventRegistration: No ticket data found or auth required:', response);
            setUserTicket(null);
          }
        } catch (fetchErr) {
          console.error('EventRegistration: Error fetching tickets:', fetchErr);
          setUserTicket(null);
        }
      } catch (err) {
        console.error('EventRegistration: Error checking user ticket:', err);
        setUserTicket(null);
      } finally {
        setIsCheckingTicket(false);
        notifyReady();
      }
    };

    // Check for ticket on component mount and userData change - with a small delay to ensure we get fresh data
    setTimeout(checkUserTicket, 100);
    
    return () => {
      isMounted = false;
    };
  }, [isAuth, userData, eventId, eventTitle, eventDate, eventLocation, onReady]);

  // Handle ticket update events - moved outside the main useEffect
  const handleTicketUpdate = useCallback(() => {
    // Skip event handling if the user is not authenticated
    if (!isAuth) {
      console.log('EventRegistration: Skipping ticket-update handling - user not authenticated');
      return;
    }
    
    // Skip event handling during an active booking to prevent race conditions
    if (isActiveBooking.current) {
      console.log('EventRegistration: Skipping ticket-update handling during active booking');
      return;
    }
    
    // Add a small delay to allow other state changes to settle
    console.log('EventRegistration: Received ticket-update event, scheduling ticket check');
    setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('EventRegistration: Re-checking ticket status after ticket-update event');
        // Define checkUserTicket here or use a ref to access it
        console.log('EventRegistration: Executing ticket refresh after update event');
        // We need to re-fetch tickets here
        const fetchTickets = async () => {
          try {
            setIsCheckingTicket(true);
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2);
            const uniqueId = `${timestamp}_${random}_${Math.floor(Math.random() * 1000000)}`;
            
            const response = await fetch('/user_edits/my-tickets?no_cache=' + uniqueId, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            }).then(res => {
              if (res.status === 401) return { detail: 'Authentication required' };
              return res.json();
            });
            
            if (response && !response.detail) {
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
              
              const currentEventId = parseInt(eventId.toString());
              const eventTickets = allTickets.filter(ticket => 
                ticket.event.id === currentEventId && 
                ticket.status !== 'cancelled' && 
                ticket.status !== 'canceled'
              );
              
              if (eventTickets.length === 0) {
                setUserTicket(null);
              } else {
                const ticketData = eventTickets[0];
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
                
                if (processedTicket.status === 'cancelled' || processedTicket.status === 'canceled') {
                  setUserTicket(null);
                } else {
                  setUserTicket(processedTicket);
                }
              }
            } else {
              setUserTicket(null);
            }
          } catch (err) {
            console.error('EventRegistration: Error refreshing tickets:', err);
            setUserTicket(null);
          } finally {
            setIsCheckingTicket(false);
          }
        };
        
        fetchTickets();
      }
    }, 150);
  }, [isAuth, eventId, eventTitle, eventDate, eventLocation]);
  
  // Setup the event listener for ticket updates
  useEffect(() => {
    // Only add event listener if the user is authenticated
    if (isAuth) {
      console.log('EventRegistration: Adding ticket-update event listener');
      window.addEventListener('ticket-update', handleTicketUpdate);
      
      return () => {
        console.log('EventRegistration: Removing ticket-update event listener');
        window.removeEventListener('ticket-update', handleTicketUpdate);
      };
    }
  }, [handleTicketUpdate, isAuth]);

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
      
      // Create a temporary ticket object for immediate UI update
      const tempTicket = {
        id: data?.id || Math.floor(Math.random() * 10000), 
        event: {
          id: parseInt(eventId.toString()),
          title: eventTitle || "Мероприятие",
          start_date: eventDate ? (() => {
            try {
              // Don't try to convert to ISO string - just return undefined if there's an error
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
              // Don't try to convert to ISO string - just return undefined if there's an error
              // This prevents the RangeError: Invalid time value
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
        ticket_number: data?.ticket_number || `Загрузка...`, // Show loading indicator instead of random number
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
            
            const actualTicketData = await apiFetch<any>('/user_edits/my-tickets', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              bypassLoadingStageCheck: true,
              params: { _nocache: Date.now() }
            });
            
            if (actualTicketData) {
              // Find ticket for this event
              let allTickets = Array.isArray(actualTicketData) ? actualTicketData : 
                actualTicketData.data ? actualTicketData.data : 
                actualTicketData.tickets ? actualTicketData.tickets : [];
              
              if (!Array.isArray(allTickets)) {
                console.warn('EventRegistration: Unexpected ticket data format', actualTicketData);
                allTickets = [];
              }
              
              const currentEventId = parseInt(eventId.toString());
              const actualTicket = allTickets.find(t => 
                t.event.id === currentEventId && t.status !== 'cancelled'
              );
              
              if (actualTicket) {
                console.log('EventRegistration: Found actual ticket data', actualTicket);
                // Update the ticket with actual data from server
                setUserTicket(actualTicket);
                
                // Dispatch another update with the real ticket data
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
            // Reset the active booking flag no matter what
            console.log('EventRegistration: Resetting active booking flag');
            isActiveBooking.current = false;
            // Cancel safety timeout since we're done
            clearTimeout(safetyTimeout);
          }
        }, 500); // Wait a bit after modal closes
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при бронировании.");
      console.error('Booking error:', err);
      // Clear the active booking flag on error
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
    router.push("/profile");
  };

  // Добавляем кнопку для отладки (только в режиме разработки)
  const renderDebugButton = () => {
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