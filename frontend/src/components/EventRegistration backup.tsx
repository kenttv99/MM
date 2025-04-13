// // frontend/src/components/EventRegistration.tsx
// "use client";

// import React, { useState, useEffect, useCallback, useRef } from "react";
// import { useAuth } from "@/contexts/AuthContext";
// import AuthModal, { ModalButton } from "./common/AuthModal";
// import { FaTicketAlt, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
// import { motion, AnimatePresence } from "framer-motion";
// import { EventRegistrationProps } from "@/types/index";
// import { useRouter } from "next/navigation";
// import { apiFetch } from "@/utils/api";
// import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';
// import { useLoadingFlags, useLoadingStage, LoadingStage } from '@/contexts/loading';
// import { createLogger } from "@/utils/logger";

// // Создаем логгер для компонента
// const regLogger = createLogger('EventRegistration');

// // Конфигурируем логгер с полезным контекстом в режиме разработки
// if (process.env.NODE_ENV === 'development') {
//   regLogger.withContext({
//     component: 'EventRegistration',
//     source: 'EventRegistration.tsx'
//   });
// }

// // Вспомогательный хук для управления состоянием загрузки
// const useEventRegistrationLoading = () => {
//   const { updateDynamicLoading } = useLoadingFlags();
//   const { currentStage } = useLoadingStage();
  
//   // Предыдущее состояние загрузки для предотвращения избыточных обновлений
//   const prevLoadingState = useRef(false);
  
//   // Дебаунс-таймер для предотвращения частых вызовов
//   const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

//   // Проверяет, находимся ли мы на стадии, когда можно показывать индикаторы загрузки
//   const isLoadingDisplayAllowed = currentStage === LoadingStage.DATA_LOADING || 
//                                  currentStage === LoadingStage.COMPLETED;

//   // Функция для безопасного изменения состояния загрузки с дополнительной защитой
//   const setLoading = useCallback((isLoading: boolean) => {
//     // Очищаем предыдущий таймер, если он существует
//     if (debounceTimerRef.current) {
//       clearTimeout(debounceTimerRef.current);
//       debounceTimerRef.current = null;
//     }
    
//     // Используем дебаунсинг для предотвращения частых вызовов
//     debounceTimerRef.current = setTimeout(() => {
//       // Проверяем, что состояние действительно изменилось
//       if (prevLoadingState.current !== isLoading && isLoadingDisplayAllowed) {
//         regLogger.debug(`${isLoading ? 'Показываю' : 'Скрываю'} индикатор загрузки`, { 
//           currentStage,
//           prevState: prevLoadingState.current,
//           newState: isLoading
//         });
        
//         // Обновляем предыдущее состояние перед вызовом
//         prevLoadingState.current = isLoading;
//         updateDynamicLoading(isLoading);
//       }
//     }, 50); // Короткая задержка для объединения запросов
//   }, [updateDynamicLoading, currentStage, isLoadingDisplayAllowed]);

//   // Очистка таймера при размонтировании
//   useEffect(() => {
//     return () => {
//       if (debounceTimerRef.current) {
//         clearTimeout(debounceTimerRef.current);
//       }
//     };
//   }, []);

//   return {
//     setLoading,
//     isLoadingDisplayAllowed,
//     currentStage
//   };
// };

// // Интерфейс для билета пользователя с учетом разных вариантов написания статусов
// interface UserTicket {
//   id: number;
//   event: {
//     id: number;
//     title: string;
//     start_date: string;
//     end_date?: string;
//     location?: string;
//   };
//   ticket_type: string;
//   registration_date: string;
//   status: "pending" | "confirmed" | "cancelled" | "canceled" | "completed";
//   ticket_number?: string;
//   created_at?: string;
//   updated_at?: string;
// }

// // Ticket response structure can vary, so we need this interface for the raw response
// interface TicketResponse {
//   data?: UserTicket[] | UserTicket;
//   items?: UserTicket[] | UserTicket;
//   tickets?: UserTicket[] | UserTicket;
//   [key: string]: unknown;
// }

// // Функции для работы с билетами
// const isTicketCancelled = (status: string): boolean => {
//   return status === 'cancelled' || status === 'canceled';
// };

// // Helper to parse ticket response into an array of UserTicket
// const parseTicketResponse = (response: TicketResponse | UserTicket[]): UserTicket[] => {
//   let allTickets: UserTicket[] = [];
  
//   if (Array.isArray(response)) {
//     allTickets = response;
//   } else if (response.data) {
//     allTickets = Array.isArray(response.data) ? response.data : [response.data];
//   } else if (response.items) {
//     allTickets = Array.isArray(response.items) ? response.items : [response.items];
//   } else if (response.tickets) {
//     allTickets = Array.isArray(response.tickets) ? response.tickets : [response.tickets];
//   }
  
//   return allTickets;
// };

// const EventRegistration: React.FC<EventRegistrationProps> = ({
//   eventId,
//   eventTitle,
//   eventDate,
//   eventTime,
//   eventLocation,
//   // ticketType неиспользуется, но сохраняем для совместимости
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   ticketType,
//   availableQuantity,
//   soldQuantity,
//   price,
//   freeRegistration,
//   onBookingClick,
//   onLoginClick,
//   // onBookingSuccess неиспользуется, но сохраняем для совместимости
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   onBookingSuccess,
//   onReady,
//   displayStatus,
// }) => {
//   const { userData, isAuth } = useAuth();
//   const router = useRouter();
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [error, setError] = useState<string | undefined>(undefined);
//   const [success, setSuccess] = useState<string | undefined>(undefined);
//   const [userTicket, setUserTicket] = useState<UserTicket | null>(null);
//   const [isCheckingTicket, setIsCheckingTicket] = useState(false);
//   // Add a flag to track active booking state
//   const isActiveBooking = useRef(false);
//   // Используем наш новый хук вместо прямого доступа к контексту загрузки
//   const { setLoading, isLoadingDisplayAllowed } = useEventRegistrationLoading();

//   const remainingQuantity = availableQuantity - soldQuantity;
//   const maxVisibleSeats = 10;
//   const seatsArray = Array.from(
//     { length: Math.min(remainingQuantity, maxVisibleSeats) },
//     (_, index) => index
//   );

//   const isRegistrationClosedOrCompleted =
//     displayStatus === "Регистрация закрыта" || displayStatus === "Мероприятие завершено";

//   // Main useEffect for ticket checking
//   useEffect(() => {
//     // Защита от перезапуска эффекта при частых перемонтированиях
//     const mountTimestamp = Date.now();
//     const minIntervalBetweenChecks = 500; // мс
    
//     // Log important information for debugging loading issues
//     regLogger.info('EventRegistration mount cycle', {
//       isAuth,
//       hasUserTicket: !!userTicket,
//       isActiveBooking: isActiveBooking.current,
//       isLoadingDisplayAllowed,
//       eventId,
//       remainingQuantity,
//       mountTimestamp
//     });
    
//     // Skip ticket check if user is not authenticated
//     if (!isAuth) {
//       regLogger.info('User not authenticated - skipping ticket check');
      
//       // Immediately notify parent that we're ready if onReady callback exists
//       if (onReady) {
//         regLogger.info('Notifying parent component that loading is complete (auth skip)');
//         onReady();
//       }
      
//       return;
//     }
    
//     let isMounted = true;
//     let hasCalledReady = false;
//     // Флаг для отслеживания, запущена ли проверка билетов
//     let checkStarted = false;

//     // Function to safely notify parent component that we're ready
//     const notifyReady = () => {
//       if (isMounted && onReady && !hasCalledReady) {
//         regLogger.info('Notifying parent component that loading is complete', { 
//           hasTicket: !!userTicket,
//           isLoadingDisplayAllowed,
//           eventId
//         });
//         hasCalledReady = true;
//         onReady();
//       }
//     };

//     // Function to check if user has a ticket for this event
//     const checkUserTicket = async () => {
//       // Проверка, не идет ли уже процесс проверки
//       if (checkStarted) {
//         regLogger.info('Ticket check already in progress, skipping duplicate check');
//         return;
//       }
      
//       checkStarted = true;
      
//       // Skip ticket checking if a booking is in progress
//       if (isActiveBooking.current) {
//         regLogger.info('Skipping ticket check during active booking');
//         // Несмотря на активное бронирование, мы должны сигнализировать о готовности компонента
//         notifyReady();
//         return;
//       }

//       try {
//         setIsCheckingTicket(true);
        
//         // Начинаем показывать индикатор загрузки только если действительно нужно
//         if (!userTicket) {
//           setLoading(true);
//         }
        
//         const token = localStorage.getItem('token');
//         if (!token) {
//           regLogger.info('No token found, user needs to login');
//           setUserTicket(null);
//           notifyReady();
          
//           // Сбрасываем индикатор загрузки
//           setLoading(false);
//           return;
//         }

//         // Use the user_edits/my-tickets endpoint with stronger cache-busting
//         regLogger.info('Using /user_edits/my-tickets endpoint to check tickets');
        
//         try {
//           // Generate a truly unique cache key with high entropy
//           const timestamp = Date.now();
//           const random = Math.random().toString(36).substring(2);
//           const uniqueId = `${timestamp}_${random}_${Math.floor(Math.random() * 1000000)}`;
          
//           // Используем apiFetch вместо fetch, чтобы соблюдать стадии загрузки
//           const response = await apiFetch<unknown>('/user_edits/my-tickets?no_cache=' + uniqueId, {
//             method: 'GET',
//             headers: {
//               'Content-Type': 'application/json',
//               'Authorization': `Bearer ${token}`,
//               'Cache-Control': 'no-cache, no-store, must-revalidate',
//               'Pragma': 'no-cache',
//               'Expires': '0'
//             },
//             // Если находимся в стадии загрузки данных или выше, не обходим проверку
//             bypassLoadingStageCheck: !isLoadingDisplayAllowed
//           });
          
//           if (!isMounted) {
//             regLogger.info('Component unmounted during ticket check, aborting');
//             return;
//           }
          
//           regLogger.info('Raw ticket response:', response);
          
//           // Обработка как ответа API
//           if (response && typeof response === 'object' && 'aborted' in response) {
//             regLogger.error('Request aborted', (response as ApiAbortedResponse).reason);
//             setUserTicket(null);
//             notifyReady();
//             return;
//           }
          
//           if (response && typeof response === 'object' && 'error' in response) {
//             const errorResp = response as ApiErrorResponse;
//             regLogger.info('Error response', errorResp.error);
//             setUserTicket(null);
//             notifyReady();
//             return;
//           }
          
//           // If we get all tickets, filter for the current event
//           if (response) {
//             regLogger.info('Got all tickets, filtering for current event', response);
            
//             // Use parseTicketResponse to extract tickets from any response format
//             const allTickets = parseTicketResponse(response as TicketResponse);
        
//             // Filter for tickets matching this event and not cancelled - very strict filtering
//             const currentEventId = parseInt(eventId.toString());
//             const eventTickets = allTickets.filter((ticket: UserTicket) => 
//               ticket.event.id === currentEventId && 
//               !isTicketCancelled(ticket.status)
//             );
            
//             regLogger.info(`Found ${eventTickets.length} active tickets for event ${currentEventId}`);
            
//             // Status-based debug log
//             if (eventTickets.length === 0) {
//               regLogger.info('No active tickets for this event - showing booking UI');
//               setUserTicket(null);
//             } else {
//               // Use the first valid ticket if found
//               const ticketData = eventTickets[0];
              
//               // Log all ticket statuses for debugging
//               allTickets.forEach((t: UserTicket) => {
//                 if (t.event.id === currentEventId) {
//                   regLogger.info(`Ticket #${t.id} has status: ${t.status}`);
//                 }
//               });
              
//               // Ensure we have the basic ticket data structure
//               const processedTicket: UserTicket = {
//                 id: ticketData.id || 0,
//                 event: {
//                   id: parseInt(eventId.toString()),
//                   title: eventTitle,
//                   start_date: ticketData.event?.start_date || eventDate || new Date().toISOString(),
//                   end_date: ticketData.event?.end_date || undefined,
//                   location: ticketData.event?.location || eventLocation
//                 },
//                 ticket_type: ticketData.ticket_type || "standart",
//                 registration_date: ticketData.registration_date || ticketData.created_at || new Date().toISOString(),
//                 status: ticketData.status || "confirmed",
//                 ticket_number: ticketData.ticket_number || ticketData.id?.toString()
//               };

//               regLogger.info('Processed ticket data:', processedTicket);
            
//               // One more safety check - don't display cancelled tickets
//               if (isTicketCancelled(processedTicket.status)) {
//                 regLogger.info('Ticket is cancelled, not showing');
//                 setUserTicket(null);
//               } else {
//                 // Set the user ticket for UI display
//                 setUserTicket(processedTicket);
//               }
//             }
//           } else {
//             // No ticket data found or auth error
//             regLogger.info('No ticket data found or auth required:', response);
//             setUserTicket(null);
//           }
//         } catch (fetchErr) {
//           regLogger.error('Error fetching tickets:', fetchErr);
//           setUserTicket(null);
//         }
//       } catch (err) {
//         regLogger.error('Error checking user ticket:', err);
//         setUserTicket(null);
//       } finally {
//         if (isMounted) {
//           setIsCheckingTicket(false);
          
//           // Сбрасываем индикатор загрузки
//           setLoading(false);
          
//           notifyReady();
//         }
//       }
//     };

//     // Check for ticket on component mount and userData change with a delay protection
//     const lastCheckTime = window.__lastTicketCheckTime || 0;
//     const currentTime = Date.now();
    
//     if (currentTime - lastCheckTime < minIntervalBetweenChecks) {
//       // Если прошло мало времени с предыдущей проверки, увеличиваем задержку
//       regLogger.info(`Detected recent ticket check (${currentTime - lastCheckTime}ms ago), adding delay`);
//       const ticketCheckDelay = setTimeout(checkUserTicket, 300);
//       window.__lastTicketCheckTime = currentTime;
      
//       return () => {
//         isMounted = false;
//         clearTimeout(ticketCheckDelay);
//       };
//     } else {
//       // Обычная проверка с небольшой задержкой
//       const ticketCheckDelay = setTimeout(checkUserTicket, 150);
//       window.__lastTicketCheckTime = currentTime;
      
//       return () => {
//         isMounted = false;
//         clearTimeout(ticketCheckDelay);
//       };
//     }
//   }, [isAuth, userData, eventId, eventTitle, eventDate, eventLocation, onReady, setLoading, isLoadingDisplayAllowed]);

//   // Добавляем глобальное свойство для отслеживания времени проверки билетов
//   declare global {
//     interface Window {
//       __lastTicketCheckTime?: number;
//       __lastTicketUpdateTime?: Record<string, number>;
//       __ticketFetchInProgress?: Record<number | string, string>;
//     }
//   }

//   // Handle ticket update events
//   const handleTicketUpdate = useCallback(() => {
//     // Предотвращение частых вызовов с дебаунсингом
//     const debounceKey = `ticket_update_${eventId}`;
//     const lastUpdateTime = window.__lastTicketUpdateTime?.[debounceKey] || 0;
//     const currentTime = Date.now();
//     const minUpdateInterval = 300; // мс
    
//     if (currentTime - lastUpdateTime < minUpdateInterval) {
//       regLogger.info(`Debouncing ticket-update handler (${currentTime - lastUpdateTime}ms)`, {
//         eventId,
//         debounceKey
//       });
//       return;
//     }
    
//     // Обновляем время последнего обновления
//     if (!window.__lastTicketUpdateTime) {
//       window.__lastTicketUpdateTime = {};
//     }
//     window.__lastTicketUpdateTime[debounceKey] = currentTime;
    
//     // Skip event handling if the user is not authenticated
//     if (!isAuth) {
//       regLogger.info('Skipping ticket-update handling - user not authenticated');
//       return;
//     }
    
//     // Skip event handling during an active booking to prevent race conditions
//     if (isActiveBooking.current) {
//       regLogger.info('Skipping ticket-update handling during active booking');
//       return;
//     }
    
//     // Add a small delay to allow other state changes to settle
//     regLogger.info('Received ticket-update event, scheduling ticket check');
//     setTimeout(() => {
//       const token = localStorage.getItem('token');
//       if (token) {
//         regLogger.info('Re-checking ticket status after ticket-update event');
//         // We need to re-fetch tickets here
//         const fetchTickets = async () => {
//           // Проверка на повторные вызовы
//           const internalKey = `fetch_${eventId}_${Date.now()}`;
//           if (window.__ticketFetchInProgress?.[eventId]) {
//             regLogger.info('Ticket fetch already in progress, skipping duplicate call');
//             return;
//           }
          
//           if (!window.__ticketFetchInProgress) {
//             window.__ticketFetchInProgress = {};
//           }
//           window.__ticketFetchInProgress[eventId] = internalKey;
          
//           try {
//             setIsCheckingTicket(true);
//             setLoading(true);
//             const timestamp = Date.now();
//             const random = Math.random().toString(36).substring(2);
//             const uniqueId = `${timestamp}_${random}_${Math.floor(Math.random() * 1000000)}`;
            
//             // Используем apiFetch вместо прямого fetch
//             const response = await apiFetch<unknown>('/user_edits/my-tickets?no_cache=' + uniqueId, {
//               method: 'GET',
//               headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//                 'Cache-Control': 'no-cache, no-store, must-revalidate',
//                 'Pragma': 'no-cache',
//                 'Expires': '0'
//               },
//               // Не обходим проверку стадии загрузки, если находимся на соответствующих стадиях
//               bypassLoadingStageCheck: !isLoadingDisplayAllowed
//             });
            
//             if (response && typeof response === 'object') {
//               // Обработка ошибок
//               if ('aborted' in response || 'error' in response) {
//                 regLogger.error('Error refreshing tickets:', response);
//                 setUserTicket(null);
//                 return;
//               }
              
//               // Обработка успешного ответа
//               // Use our helper function to parse tickets
//               const allTickets = parseTicketResponse(response as TicketResponse);
              
//               const currentEventId = parseInt(eventId.toString());
//               const eventTickets = allTickets.filter((ticket: UserTicket) => 
//                 ticket.event.id === currentEventId && 
//                 !isTicketCancelled(ticket.status)
//               );
              
//               if (eventTickets.length === 0) {
//                 setUserTicket(null);
//               } else {
//                 const ticketData = eventTickets[0];
//                 const processedTicket: UserTicket = {
//                   id: ticketData.id || 0,
//                   event: {
//                     id: parseInt(eventId.toString()),
//                     title: eventTitle,
//                     start_date: ticketData.event?.start_date || eventDate || new Date().toISOString(),
//                     end_date: ticketData.event?.end_date || undefined,
//                     location: ticketData.event?.location || eventLocation
//                   },
//                   ticket_type: ticketData.ticket_type || "standart",
//                   registration_date: ticketData.registration_date || ticketData.created_at || new Date().toISOString(),
//                   status: ticketData.status || "confirmed",
//                   ticket_number: ticketData.ticket_number || ticketData.id?.toString()
//                 };
                
//                 if (isTicketCancelled(processedTicket.status)) {
//                   setUserTicket(null);
//                 } else {
//                   setUserTicket(processedTicket);
//                 }
//               }
//             } else {
//               setUserTicket(null);
//             }
//           } catch (err) {
//             regLogger.error('Error refreshing tickets:', err);
//             setUserTicket(null);
//           } finally {
//             setIsCheckingTicket(false);
//             setLoading(false);
//             // Очищаем флаг выполнения запроса
//             if (window.__ticketFetchInProgress?.[eventId] === internalKey) {
//               delete window.__ticketFetchInProgress[eventId];
//             }
//           }
//         };
        
//         fetchTickets();
//       }
//     }, 150);
//   }, [isAuth, eventId, eventTitle, eventDate, eventLocation, setLoading, isLoadingDisplayAllowed]);
  
//   // Setup the event listener for ticket updates - улучшенная версия
//   useEffect(() => {
//     // Только добавляем слушатель, если пользователь аутентифицирован
//     // и текущая стадия загрузки позволяет отображать уведомления
//     if (!isAuth || !isLoadingDisplayAllowed) {
//       regLogger.info('Skipping ticket-update listener setup', {
//         isAuth,
//         isLoadingDisplayAllowed,
//         currentStage
//       });
//       return;
//     }
    
//     regLogger.info('Adding ticket-update event listener', {
//       eventId,
//       userData: userData?.id ? `user_${userData.id}` : 'no_user_data'
//     });
    
//     // Используем именованную функцию для слушателя событий
//     // Это поможет избежать проблем с анонимными функциями
//     const ticketUpdateListener = (event: Event) => {
//       handleTicketUpdate();
//     };
    
//     window.addEventListener('ticket-update', ticketUpdateListener);
    
//     // Проверяем, находимся ли на правильной стадии загрузки для обработки билетов
//     if (isLoadingDisplayAllowed && userData?.id && parseInt(eventId.toString()) > 0) {
//       // Принудительно запускаем проверку билетов, если находимся на правильной стадии
//       // Но с задержкой, чтобы предотвратить конфликты с другими процессами загрузки
//       const forceCheckTimeout = setTimeout(() => {
//         if (userData?.id && !isActiveBooking.current && !userTicket) {
//           regLogger.info('Forcing ticket check due to correct loading stage');
//           handleTicketUpdate();
//         }
//       }, 300);
      
//       return () => {
//         regLogger.info('Removing ticket-update event listener');
//         window.removeEventListener('ticket-update', ticketUpdateListener);
//         clearTimeout(forceCheckTimeout);
//       };
//     }
    
//     return () => {
//       regLogger.info('Removing ticket-update event listener');
//       window.removeEventListener('ticket-update', ticketUpdateListener);
//     };
//   }, [handleTicketUpdate, isAuth, isLoadingDisplayAllowed, userData, eventId, userTicket, currentStage]);

//   const handleConfirmBooking = async () => {
//     // Защита от повторных нажатий
//     if (isActiveBooking.current) {
//       regLogger.info('Booking operation already in progress, ignoring duplicate click');
//       return;
//     }
    
//     // Set the flag to prevent event handling during booking
//     isActiveBooking.current = true;
    
//     setError(undefined);
//     setSuccess(undefined);
    
//     // Показываем индикатор загрузки
//     setLoading(true);

//     try {
//       // Check if registration is closed or completed
//       if (isRegistrationClosedOrCompleted) {
//         throw new Error("Регистрация на это мероприятие закрыта");
//       }

//       // Check if there are available tickets
//       if (remainingQuantity <= 0) {
//         throw new Error("К сожалению, все билеты уже распроданы");
//       }

//       const token = localStorage.getItem('token');
//       if (!token) {
//         throw new Error('Необходима авторизация');
//       }

//       regLogger.info('Sending registration request with data:', {
//         event_id: parseInt(eventId.toString()),
//         user_id: userData!.id
//       });

//       // Создаем уникальный ключ для отслеживания этого запроса
//       const requestId = `booking_${eventId}_${Date.now()}`;
      
//       // Use apiFetch for consistent API handling
//       const response = await apiFetch<UserTicket>('/registration/register', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         data: JSON.stringify({
//           event_id: parseInt(eventId.toString()),
//           user_id: userData!.id,
//           request_id: requestId // Добавляем идентификатор запроса для отладки и дедупликации на сервере
//         }),
//         // Не используем обход проверки стадии - запрос должен выполняться в соответствии с текущей стадией
//         bypassLoadingStageCheck: false
//       });

//       regLogger.info('Response received:', response);
      
//       if ('aborted' in response) {
//         const abortedResponse = response as unknown as ApiAbortedResponse;
//         regLogger.error("Request aborted", abortedResponse.reason);
//         throw new Error(abortedResponse.reason || "Запрос был прерван");
//       }
      
//       if ('error' in response) {
//         // Обработка конкретных типов ошибок для более дружелюбных сообщений
//         const errorResponse = response as unknown as ApiErrorResponse;
//         const errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при бронировании";
        
//         // Пробуем найти понятное сообщение об ошибке в тексте
//         if (errorMessage.includes("Превышен лимит отмен регистраций")) {
//           throw new Error("Вы уже отменяли регистрацию на это мероприятие 3 раза. Дальнейшая регистрация недоступна.");
//         } else if (errorMessage.includes("Вы уже зарегистрированы")) {
//           throw new Error("Вы уже зарегистрированы на это мероприятие.");
//         } else if (errorMessage.includes("Билеты на это мероприятие распроданы")) {
//           throw new Error("К сожалению, все билеты на это мероприятие уже распроданы.");
//         } else if (errorMessage.includes("Регистрация на это мероприятие недоступна")) {
//           throw new Error("Регистрация на это мероприятие в данный момент недоступна.");
//         } else {
//           throw new Error(errorMessage);
//         }
//       }

//       // Use the response directly
//       const data = response;
//       regLogger.info('Success response:', data);

//       setSuccess("Вы успешно забронировали билет!");
      
//       // Create a temporary ticket object for immediate UI update
//       const tempTicket: UserTicket = {
//         id: data?.id || Math.floor(Math.random() * 10000), 
//         event: {
//           id: parseInt(eventId.toString()),
//           title: eventTitle || "Мероприятие",
//           start_date: eventDate ? (() => {
//             try {
//               // Don't try to convert to ISO string - just return undefined if there's an error
//               const date = new Date(eventDate);
//               if (isNaN(date.getTime())) {
//                 regLogger.warn('Invalid event date for start_date, using current date instead');
//                 return new Date().toISOString();
//               }
//               return date.toISOString();
//             } catch (e) {
//               regLogger.warn('Invalid event date format, using current date instead:', e);
//               return new Date().toISOString();
//             }
//           })() : new Date().toISOString(),
//           end_date: eventDate ? (() => {
//             try {
//               // Don't try to convert to ISO string - just return undefined if there's an error
//               // This prevents the RangeError: Invalid time value
//               const date = new Date(eventDate);
//               if (isNaN(date.getTime())) {
//                 regLogger.warn('Invalid event date for end_date, using undefined');
//                 return undefined;
//               }
//               return date.toISOString();
//             } catch (e) {
//               regLogger.warn('Invalid event date format for end_date, using undefined:', e);
//               return undefined;
//             }
//           })() : undefined,
//           location: eventLocation || "Не указано"
//         },
//         ticket_type: data?.ticket_type || "standart",
//         registration_date: new Date().toISOString(),
//         status: "confirmed", 
//         ticket_number: data?.ticket_number || `Загрузка...`, // Show loading indicator instead of random number
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString()
//       };
        
//       // Immediately update the local state to show the ticket
//       setUserTicket(tempTicket);
        
//       // Dispatch ticket update event with the temporary ticket data
//       if (typeof window !== 'undefined') {
//         const ticketEvent = new CustomEvent('ticket-update', {
//           detail: {
//             source: 'event-registration',
//             action: 'register',
//             eventId: parseInt(eventId.toString()),
//             ticketId: tempTicket.id,
//             newTicket: tempTicket,
//             isInternalUpdate: true,
//             requestId // Добавляем идентификатор запроса для отслеживания
//           }
//         });
//         window.dispatchEvent(ticketEvent);
//         regLogger.info('Dispatched ticket update event with temporary ticket data');
        
//         // Store the registration in sessionStorage to help detect navigation to profile page
//         sessionStorage.setItem('recent_registration', JSON.stringify({
//           event_id: parseInt(eventId.toString()),
//           ticket_id: tempTicket.id,
//           timestamp: Date.now(),
//           requestId // Добавляем идентификатор запроса для отслеживания
//         }));
//       }
      
//       // Сбрасываем индикатор загрузки после успешного бронирования
//       // Управление индикатором загрузки - оставляем его активным во время задержки (не сбрасываем)
      
//       // Close modal after showing success message
//       setTimeout(() => {
//         setIsModalOpen(false);
        
//         // Create a safety timeout to reset booking flag in case the fetch fails
//         const safetyTimeout = setTimeout(() => {
//           if (isActiveBooking.current) {
//             regLogger.info('Safety timeout triggered - resetting active booking flag');
//             isActiveBooking.current = false;
//             // Гарантируем, что индикатор загрузки сброшен
//             setLoading(false);
//           }
//         }, 10000); // 10 second safety timeout
        
//         // After modal closes, fetch the actual ticket data from server
//         setTimeout(async () => {
//           try {
//             regLogger.info('Fetching actual ticket data after registration');
//             const token = localStorage.getItem('token');
//             if (!token) {
//               regLogger.info('No token available for fetching actual ticket');
//               isActiveBooking.current = false;
//               clearTimeout(safetyTimeout);
//               setLoading(false);
//               return;
//             }
            
//             // Показываем индикатор загрузки во время получения актуальных данных билета
//             // (Индикатор уже должен быть активен, не вызываем setLoading)
            
//             const actualTicketResponse = await apiFetch<unknown>('/user_edits/my-tickets', {
//               method: 'GET',
//               headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//                 'Cache-Control': 'no-cache, no-store, must-revalidate',
//                 'Pragma': 'no-cache',
//                 'Expires': '0'
//               },
//               // Не используем обход проверки стадии
//               bypassLoadingStageCheck: !isLoadingDisplayAllowed
//             });
            
//             if (actualTicketResponse && typeof actualTicketResponse === 'object') {
//               if ('aborted' in actualTicketResponse) {
//                 const abortedResponse = actualTicketResponse as unknown as ApiAbortedResponse;
//                 throw new Error(abortedResponse.reason || "Запрос был прерван");
//               }
              
//               if ('error' in actualTicketResponse) {
//                 const errorResponse = actualTicketResponse as unknown as ApiErrorResponse;
//                 throw new Error(typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при получении билетов");
//               }
              
//               // Типизированный кастинг для безопасной обработки
//               const actualTicketData = actualTicketResponse as TicketResponse;
              
//               if (actualTicketData) {
//                 // Use our helper function to parse the response
//                 const allTickets = parseTicketResponse(actualTicketData);
                
//                 const currentEventId = parseInt(eventId.toString());
//                 const actualTicket = allTickets.find((t: UserTicket) => 
//                   t.event.id === currentEventId && !isTicketCancelled(t.status)
//                 );
                
//                 if (actualTicket) {
//                   regLogger.info('Found actual ticket data', actualTicket);
//                   // Update the ticket with actual data from server
//                   setUserTicket(actualTicket);
                  
//                   // Dispatch another update with the real ticket data
//                   const updatedEvent = new CustomEvent('ticket-update', {
//                     detail: {
//                       source: 'event-registration',
//                       action: 'update',
//                       eventId: currentEventId,
//                       ticketId: actualTicket.id,
//                       newTicket: actualTicket,
//                       isInternalUpdate: false,
//                       isServerData: true,
//                       requestId // Добавляем идентификатор запроса для отслеживания
//                     }
//                   });
//                   window.dispatchEvent(updatedEvent);
//                   regLogger.info('Dispatched update with actual ticket data');
//                 } else {
//                   regLogger.info('No actual ticket found for event', currentEventId);
//                 }
//               }
//             }
//           } catch (err) {
//             regLogger.error('Error fetching actual ticket data', err);
//           } finally {
//             // Reset the active booking flag no matter what
//             regLogger.info('Resetting active booking flag');
//             isActiveBooking.current = false;
//             // Cancel safety timeout since we're done
//             clearTimeout(safetyTimeout);
//             // Сбрасываем индикатор загрузки в любом случае
//             setLoading(false);
//           }
//         }, 500); // Wait a bit after modal closes
//       }, 1500);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Ошибка при бронировании.");
//       regLogger.error('Booking error:', err);
//       // Clear the active booking flag on error
//       isActiveBooking.current = false;
//       // Сбрасываем индикатор загрузки при ошибке
//       setLoading(false);
//       regLogger.info('Reset active booking flag to false (error path)');
//     }
//   };

//   const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
//     e.stopPropagation();
//     if (isAuth && userData) {
//       setIsModalOpen(true);
//     } else {
//       onLoginClick();
//     }
//     onBookingClick();
//   };

//   // Перенаправление в профиль пользователя при нажатии на кнопку "Активная бронь"
//   const handleGoToProfile = () => {
//     // Store a flag in sessionStorage to indicate we're coming from an event page with a ticket
//     if (userTicket) {
//       sessionStorage.setItem('recent_registration', JSON.stringify({
//         event_id: userTicket.event.id,
//         ticket_id: userTicket.id,
//         timestamp: Date.now(),
//         from_event_page: true
//       }));
//     }
//     router.push("/profile");
//   };

//   // Добавляем кнопку для отладки (только в режиме разработки)
//   const renderDebugButton = (): JSX.Element | null => {
//     // Always return null to hide the debug button in all environments
//     return null;
//   };

//   // Effect to signal parent component that this component is ready
//   useEffect(() => {
//     // Предотвращаем частые вызовы при быстрых перемонтированиях
//     const readyKey = `component_ready_${eventId}`;
//     const lastReadySignal = window.__lastReadySignalTime?.[readyKey] || 0;
//     const currentTime = Date.now();
//     const minSignalInterval = 800; // Увеличенный интервал для предотвращения частых перемонтирований
    
//     // Запоминаем время, когда был вызван этот эффект
//     const mountTime = currentTime;
    
//     // Инициализируем объект для хранения времени последнего сигнала
//     if (!window.__lastReadySignalTime) {
//       window.__lastReadySignalTime = {};
//     }
    
//     // Если прошло недостаточно времени с последнего сигнала, устанавливаем более длинную задержку
//     let readinessTimeout = null;
    
//     if (currentTime - lastReadySignal < minSignalInterval) {
//       regLogger.info(`Recent ready signal detected (${currentTime - lastReadySignal}ms ago), delaying signal`, {
//         eventId,
//         lastSignal: lastReadySignal,
//         currentTime
//       });
      
//       // Увеличиваем задержку, чтобы избежать циклов перерисовки
//       readinessTimeout = setTimeout(() => {
//         if (onReady) {
//           // Проверяем, не было ли других сигналов с момента установки таймаута
//           if (window.__lastReadySignalTime[readyKey] === lastReadySignal) {
//             regLogger.info('Signaling delayed readiness after timeout', {
//               mountTime,
//               elapsedTime: Date.now() - mountTime,
//               currentStage,
//               hasTicket: !!userTicket,
//               isCheckingTicket
//             });
//             window.__lastReadySignalTime[readyKey] = Date.now();
//             onReady();
//           }
//         }
//       }, 800); // Увеличенная задержка
//     } else {
//       // Обычная задержка для первого монтирования
//       readinessTimeout = setTimeout(() => {
//         if (onReady) {
//           regLogger.info('Auto-signaling readiness after standard timeout', {
//             mountTime,
//             elapsedTime: Date.now() - mountTime,
//             currentStage,
//             hasTicket: !!userTicket,
//             isCheckingTicket
//           });
//           window.__lastReadySignalTime[readyKey] = Date.now();
//           onReady();
//         }
//       }, 500); // Стандартная задержка
//     }
    
//     return () => {
//       if (readinessTimeout) {
//         clearTimeout(readinessTimeout);
//       }
//     };
//   }, [onReady, eventId, currentStage, userTicket, isCheckingTicket]);
  
//   // Расширяем глобальное определение для сигналов готовности
//   declare global {
//     interface Window {
//       __lastTicketCheckTime?: number;
//       __lastTicketUpdateTime?: Record<string, number>;
//       __ticketFetchInProgress?: Record<number | string, string>;
//       __lastReadySignalTime?: Record<string, number>;
//     }
//   }

//   // Рендер компонента, если у пользователя уже есть билет
//   if (userTicket) {
//     return (
//       <div className="flex flex-col items-center space-y-4">
//         <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
//           <div className="flex items-center mb-2 sm:mb-0">
//             <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
//             <h3 className="text-lg sm:text-xl font-semibold text-gray-800 text-center sm:text-left">
//               Доступные места: {remainingQuantity}
//             </h3>
//           </div>
//           <motion.button
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             onClick={handleGoToProfile}
//             className="px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md min-w-[120px] min-h-[44px] text-sm sm:text-base bg-orange-200 text-orange-700 hover:bg-orange-300"
//           >
//             Активная бронь
//           </motion.button>
//         </div>
        
//         {!isRegistrationClosedOrCompleted && (
//           <div className="flex flex-wrap gap-2 justify-center">
//             {/* Горизонтальный номер билета */}
//             <div className="flex-shrink-0 flex items-center justify-center">
//               <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-3 px-5 shadow-sm flex flex-row items-center">
//                 {/* Левая часть - заголовок */}
//                 <div className="flex items-center justify-center pr-3 border-r border-orange-200">
//                   <p className="text-xs text-gray-500 uppercase font-medium">
//                     НОМЕР БИЛЕТА
//                   </p>
//                 </div>
                
//                 {/* Правая часть - номер */}
//                 <div className="flex items-center justify-center pl-3">
//                   {userTicket.ticket_number === 'Загрузка...' ? (
//                     <div className="flex items-center justify-center">
//                       <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-orange-500 border-r-transparent"></div>
//                       <span className="ml-2 text-sm text-orange-600">Загрузка номера...</span>
//                     </div>
//                   ) : (
//                     <p className="text-xl font-bold text-orange-600">
//                       #{userTicket.ticket_number || userTicket.id}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}
        
//         {renderDebugButton()}
//       </div>
//     );
//   }

//   // Рендер стандартного компонента бронирования
//   return (
//     <>
//       <div className="flex flex-col items-center space-y-4">
//         {isCheckingTicket ? (
//           <div className="flex items-center justify-center h-[120px]">
//             <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
//           </div>
//         ) : (
//           <>
//             <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
//               <div className="flex items-center mb-2 sm:mb-0">
//                 <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
//                 <h3 className="text-lg sm:text-xl font-semibold text-gray-800 text-center sm:text-left">
//                   {isRegistrationClosedOrCompleted
//                     ? "Места распределены"
//                     : `Доступные места: ${remainingQuantity}`}
//                 </h3>
//               </div>
//               <motion.button
//                 whileHover={{ scale: 1.05 }}
//                 whileTap={{ scale: 0.95 }}
//                 onClick={handleButtonClick}
//                 disabled={remainingQuantity === 0}
//                 className={`
//                   px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md
//                   min-w-[120px] min-h-[44px] text-sm sm:text-base
//                   ${remainingQuantity === 0
//                     ? "bg-gray-200 text-gray-500 cursor-not-allowed"
//                     : "bg-orange-500 text-white hover:bg-orange-600"}
//                 `}
//               >
//                 Забронировать
//               </motion.button>
//             </div>
            
//             {renderDebugButton()}

//             {!isRegistrationClosedOrCompleted && remainingQuantity > 0 ? (
//               <div className="flex flex-wrap gap-2 justify-center">
//                 <AnimatePresence>
//                   {seatsArray.map((seat) => (
//                     <motion.button
//                       key={seat}
//                       initial={{ opacity: 0, scale: 0.8 }}
//                       animate={{ opacity: 1, scale: 1 }}
//                       exit={{ opacity: 0, scale: 0.8 }}
//                       transition={{ duration: 0.3, delay: seat * 0.05 }}
//                       onClick={handleButtonClick}
//                       className="w-10 h-10 rounded-md transition-all duration-200 text-base bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center font-medium min-w-[40px] min-h-[40px]"
//                       title={`Место ${seat + 1}`}
//                     >
//                       {seat + 1}
//                     </motion.button>
//                   ))}
//                 </AnimatePresence>
//                 {remainingQuantity > maxVisibleSeats && (
//                   <span className="text-gray-500 text-sm mt-2">+{remainingQuantity - maxVisibleSeats} мест</span>
//                 )}
//               </div>
//             ) : (
//               <p className="text-gray-500 text-center text-sm sm:text-base">
//                 {isRegistrationClosedOrCompleted ? "Места распределены" : "Места закончились"}
//               </p>
//             )}
//           </>
//         )}
//       </div>

//       <AuthModal
//         isOpen={isModalOpen}
//         onClose={() => setIsModalOpen(false)}
//         title="Бронирование билета"
//         error={error}
//         success={success}
//         className="max-w-[90vw] min-w-[300px] w-full sm:max-w-md"
//       >
//         <div className="space-y-6">
//           <motion.h3
//             initial={{ opacity: 0, y: 10 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.3 }}
//             className="text-lg sm:text-xl font-semibold text-gray-800 text-center"
//           >
//             {eventTitle}
//           </motion.h3>
//           <div className="space-y-3 text-gray-600">
//             <motion.div
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.3, delay: 0.1 }}
//               className="flex items-center"
//             >
//               <FaCalendarAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
//               <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventDate}</span>
//             </motion.div>
//             <motion.div
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.3, delay: 0.2 }}
//               className="flex items-center"
//             >
//               <FaClock className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
//               <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventTime}</span>
//             </motion.div>
//             <motion.div
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.3, delay: 0.3 }}
//               className="flex items-center"
//             >
//               <FaMapMarkerAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
//               <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventLocation}</span>
//             </motion.div>
//             {!freeRegistration && (
//               <motion.div
//                 initial={{ opacity: 0, y: 10 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.3, delay: 0.4 }}
//                 className="flex items-center"
//               >
//                 <FaRubleSign className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
//                 <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
//                   {price === 0 ? <span className="text-green-600">Свободный взнос</span> : `${price} ₽`}
//                 </span>
//               </motion.div>
//             )}
//           </div>
          
//           <div className="flex flex-row gap-2 pt-4">
//             <ModalButton onClick={() => setIsModalOpen(false)} className="w-1/2 bg-gray-100 text-gray-700 hover:bg-gray-200">
//               Отмена
//             </ModalButton>
//             <ModalButton 
//               onClick={handleConfirmBooking} 
//               className="w-1/2 bg-orange-500 text-white hover:bg-orange-600"
//             >
//               Подтвердить
//             </ModalButton>
//           </div>
//         </div>
//       </AuthModal>
//     </>
//   );
// };

// export default EventRegistration;