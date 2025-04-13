// // frontend/src/app/(public)/events/[slug]/page.tsx
// "use client";
// import { useState, useEffect, useCallback, useRef } from "react";
// import { useParams } from "next/navigation";
// import Header from "@/components/Header";
// import Footer from "@/components/Footer";
// import EventRegistration from "@/components/EventRegistration";
// import EventDetails from "@/components/EventDetails";
// import FormattedDescription from "@/components/FormattedDescription";
// import { notFound } from "next/navigation";
// import { useAuth } from "@/contexts/AuthContext";
// import { motion, AnimatePresence } from "framer-motion";
// import Image from "next/image";
// import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
// import { format } from "date-fns";
// import { ru } from "date-fns/locale";
// import Login from "@/components/Login";
// import Registration from "@/components/Registration";
// import AuthModal from "@/components/common/AuthModal";
// import { EventData } from "@/types/events";
// import { 
//   useLoadingStage, 
//   useLoadingFlags,
//   useLoadingError,
//   LoadingStage 
// } from '@/contexts/loading';
// import { createLogger } from "@/utils/logger";
// import { fetchEventBySlug } from "@/utils/eventService";

// // Создаем логгер для EventPage с контекстом
// const pageLogger = createLogger('EventPage');

// // Конфигурируем логгер с полезным контекстом
// if (process.env.NODE_ENV === 'development') {
//   pageLogger.withContext({
//     component: 'EventPage',
//     source: 'page.tsx'
//   });
// }

// // Стили для анимированного градиента
// const gradientStyles = `
//   .animated-gradient {
//     position: relative;
//     overflow: hidden;
//   }
  
//   .animated-gradient::before {
//     content: "";
//     position: absolute;
//     top: -50%;
//     left: -50%;
//     width: 200%;
//     height: 200%;
//     background: linear-gradient(-45deg, #ffe0c0, #ffcc99, #ffac63, #ff8c2d, #ff7700);
//     background-size: 400% 400%;
//     animation: moveGradient 18s linear infinite;
//     transform-origin: center center;
//     filter: blur(50px);
//   }
  
//   @keyframes moveGradient {
//     0% {
//       transform: rotate(0deg);
//     }
//     100% {
//       transform: rotate(360deg);
//     }
//   }
  
//   .event-title {
//     text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
//   }
// `;

// // Компонент анимированного градиента вместо изображения
// const AnimatedGradientBackground = ({ className = "", children }: { className?: string, children?: React.ReactNode }) => (
//   <div className={`w-full h-full animated-gradient relative ${className}`}>
//     <style jsx>{gradientStyles}</style>
//     <div className="absolute inset-0 bg-black/20 z-10"></div>
//     {children}
//   </div>
// );

// // Компонент скелетона для страницы мероприятия
// const EventDetailsSkeleton: React.FC = () => (
//   <div className="min-h-screen flex flex-col bg-gray-50">
//     <Header />
//     <main className="flex-grow">
//       {/* Скелетон для обложки мероприятия */}
//       <div className="relative h-[400px] w-full px-6 mt-16 mb-8">
//         <div className="relative h-full w-full rounded-xl overflow-hidden bg-gradient-to-r from-gray-100 to-orange-100">
//           <div className="absolute inset-0 flex items-center justify-center">
//             <div className="h-12 w-[70%] bg-white/30 backdrop-blur-sm rounded-lg animate-pulse"></div>
//           </div>
//         </div>
//       </div>

//       <div className="container mx-auto px-6 py-12">
//         {/* Скелетон для блока деталей события */}
//         <div className="animate-pulse mb-12">
//           <div className="bg-white rounded-xl p-6 shadow-sm">
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//               <div className="flex flex-col items-center p-3">
//                 <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
//                 <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
//                 <div className="h-3 bg-gray-200 rounded w-16"></div>
//               </div>
//               <div className="flex flex-col items-center p-3">
//                 <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
//                 <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
//                 <div className="h-3 bg-gray-200 rounded w-16"></div>
//               </div>
//               <div className="flex flex-col items-center p-3">
//                 <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
//                 <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
//                 <div className="h-3 bg-gray-200 rounded w-24"></div>
//               </div>
//               <div className="flex flex-col items-center p-3">
//                 <div className="w-12 h-12 bg-orange-200 rounded-full mb-4"></div>
//                 <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
//                 <div className="h-3 bg-gray-200 rounded w-24"></div>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Скелетон для блока регистрации */}
//         <div className="animate-pulse mb-12">
//           <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
//             <div className="h-6 bg-orange-200 rounded w-48 mx-auto mb-6"></div>
//             <div className="space-y-4">
//               <div className="h-10 bg-gray-200 rounded"></div>
//               <div className="h-10 bg-gray-200 rounded"></div>
//               <div className="h-10 bg-orange-300 rounded"></div>
//             </div>
//           </div>
//         </div>

//         {/* Скелетон для описания */}
//         <div className="animate-pulse max-w-3xl mx-auto">
//           <div className="h-6 bg-orange-200 rounded w-32 mb-4"></div>
//           <div className="space-y-3">
//             <div className="h-4 bg-gray-200 rounded w-full"></div>
//             <div className="h-4 bg-gray-200 rounded w-[90%]"></div>
//             <div className="h-4 bg-gray-200 rounded w-[95%]"></div>
//             <div className="h-4 bg-gray-200 rounded w-[85%]"></div>
//             <div className="h-4 bg-gray-200 rounded w-[90%]"></div>
//           </div>
//         </div>
//       </div>
//     </main>
//     <Footer />
//   </div>
// );

// export default function EventPage() {
//   const { slug } = useParams<{ slug: string }>();
//   const [event, setEvent] = useState<EventData | null>(null);
//   const [hasServerError, setHasServerError] = useState(false);
//   const [fetchError, setFetchError] = useState<string | null>(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [isRegisterMode, setIsRegisterMode] = useState(false);
//   const { isAuth } = useAuth();
//   const [isLoading, setIsLoading] = useState(false);
//   const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
//   const { currentStage, setStage } = useLoadingStage();
//   const { updateDynamicLoading } = useLoadingFlags();
//   const { setError: setLoadingError } = useLoadingError();
//   const isMountedRef = useRef(false);
//   const [registrationUpdateKey, setRegistrationUpdateKey] = useState(0);
//   const [isEventRegistrationReady, setIsEventRegistrationReady] = useState(false);
//   const [, setComponentsReady] = useState({ registration: false });
  
//   // Function to get event data
//   const fetchEventData = useCallback(async (targetSlug: string): Promise<EventData | null> => {
//     // Log crucial loading state for debugging
//     pageLogger.info('fetchEventData called', {
//       slug: targetSlug,
//       stage: currentStage
//     });
    
//     if (!targetSlug) {
//       pageLogger.error("Missing targetSlug parameter");
//       return null;
//     }
    
//     // Переход к DATA_LOADING для запроса данных
//     setStage(LoadingStage.DATA_LOADING);
    
//     // Включаем индикатор динамической загрузки
//     updateDynamicLoading(true);
    
//     // Создаем контроллер для отмены запроса
//     const controller = new AbortController();
    
//     try {
//       setIsLoading(true);
      
//       // Используем fetchEventBySlug из eventService
//       const result = await fetchEventBySlug(targetSlug, controller.signal);
      
//       if (!isMountedRef.current) {
//         pageLogger.info("Component unmounted during fetch, aborting");
//         return null;
//       }
      
//       if (!result.success) {
//         // Обработка ошибки
//         pageLogger.error("Error in response", result.error);
//         setFetchError(result.error || "Ошибка загрузки");
//         setLoadingError(result.error || "Ошибка загрузки");
//         updateDynamicLoading(false);
//         return null;
//       }
      
//       // Проверяем что ответ содержит данные
//       if (result.data) {
//         const eventData = result.data;
        
//         setFetchError(null);
//         setHasServerError(false);
        
//         // Используем асинхронный таймер чтобы предотвратить конфликты состояний
//         setTimeout(() => {
//           if (isMountedRef.current) {
//             updateDynamicLoading(false);
//           }
//         }, 100);
        
//         return eventData;
//       } else {
//         pageLogger.warn("No data in successful response");
//         setFetchError("Мероприятие не найдено");
//         updateDynamicLoading(false);
//         return null;
//       }
//     } catch (err) {
//       if (isMountedRef.current) {
//         pageLogger.error("Error fetching event", err);
//         const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки мероприятия";
//         setFetchError(errorMessage);
//         setLoadingError(errorMessage);
//         updateDynamicLoading(false);
//       }
//       return null;
//     } finally {
//       if (isMountedRef.current) {
//         setIsLoading(false);
//       }
//     }
//   }, [currentStage, updateDynamicLoading, setLoadingError, setStage]);
  
//   // Simplified page navigation effect
//   useEffect(() => {
//     // Function to handle page navigation events
//     const handleNavigation = () => {
//       pageLogger.info("Navigation detected - updating registration component");
//       setRegistrationUpdateKey(prev => prev + 1);
//     };
    
//     // Add event listeners for navigation and focus events
//     window.addEventListener('pageshow', handleNavigation);
//     window.addEventListener('popstate', handleNavigation);
    
//     return () => {
//       window.removeEventListener('pageshow', handleNavigation);
//       window.removeEventListener('popstate', handleNavigation);
//     };
//   }, []);
  
//   // Simplified event handlers
//   const handleBookingClick = useCallback(() => {
//     pageLogger.debug("Booking click triggered");
//   }, []);
  
//   const handleLoginClick = useCallback(() => {
//     setIsRegisterMode(false);
//     setIsModalOpen(true);
//   }, []);
  
//   // Simplified booking success handler
//   const handleBookingSuccess = useCallback(() => {
//     pageLogger.info("Booking successful");
//   }, []);

//   // Handle auth changes
//   useEffect(() => {
//     const handleAuthChange = () => {
//       pageLogger.info("Auth change detected");
//     };
//     window.addEventListener("auth-change", handleAuthChange);
//     return () => window.removeEventListener("auth-change", handleAuthChange);
//   }, []);

//   // Упрощенный эффект для управления загрузкой данных и переходами стадий
//   useEffect(() => {
//     // Четкая последовательность переходов стадий загрузки
//     switch (currentStage) {
//       case LoadingStage.STATIC_CONTENT:
//         // STATIC_CONTENT → DYNAMIC_CONTENT (автоматический переход)
//         const dynamicTimer = setTimeout(() => {
//           if (isMountedRef.current && currentStage === LoadingStage.STATIC_CONTENT) {
//             pageLogger.info("Transitioning STATIC_CONTENT → DYNAMIC_CONTENT");
//             setStage(LoadingStage.DYNAMIC_CONTENT);
//           }
//         }, 200);
        
//         return () => clearTimeout(dynamicTimer);
      
//       case LoadingStage.DYNAMIC_CONTENT:
//         // DYNAMIC_CONTENT → DATA_LOADING
//         pageLogger.info("Forcing transition DYNAMIC_CONTENT → DATA_LOADING");
        
//         const dataLoadingTimer = setTimeout(() => {
//           if (isMountedRef.current) {
//             setStage(LoadingStage.DATA_LOADING);
//           }
//         }, 200);
        
//         return () => clearTimeout(dataLoadingTimer);
      
//       case LoadingStage.DATA_LOADING:
//         // DATA_LOADING → Запуск загрузки данных
//         if (!event && !isLoading && slug) {
//           pageLogger.info("Starting data fetch in DATA_LOADING stage");
          
//           const fetchTimer = setTimeout(() => {
//             if (isMountedRef.current && currentStage === LoadingStage.DATA_LOADING) {
//               fetchEventData(slug.toString()).then(data => {
//                 if (data && isMountedRef.current) {
//                   pageLogger.info("Event data loaded successfully", { id: data.id });
//                   setEvent(data);
                  
//                   // Автоматический переход в COMPLETED после загрузки данных
//                   setTimeout(() => {
//                     if (isMountedRef.current && !showInitialSkeleton) {
//                       pageLogger.info("Transitioning DATA_LOADING → COMPLETED after data fetch");
//                       setStage(LoadingStage.COMPLETED);
//                     }
//                   }, 100);
//                 }
//               });
//             }
//           }, 100);
          
//           return () => clearTimeout(fetchTimer);
//         }
        
//         // DATA_LOADING → COMPLETED если данные уже загружены
//         if (event && !isLoading && !showInitialSkeleton) {
//           const completeTimer = setTimeout(() => {
//             if (isMountedRef.current && currentStage === LoadingStage.DATA_LOADING) {
//               pageLogger.info("Transitioning DATA_LOADING → COMPLETED (data already available)");
//               setStage(LoadingStage.COMPLETED);
//             }
//           }, 200);
          
//           return () => clearTimeout(completeTimer);
//         }
//         break;
      
//       case LoadingStage.COMPLETED:
//         // Убираем скелетон, когда достигнута стадия COMPLETED
//         if (showInitialSkeleton) {
//           pageLogger.info("Hiding skeleton on COMPLETED stage");
//           setShowInitialSkeleton(false);
//         }
//         break;
//     }
//   }, [currentStage, event, slug, fetchEventData, isLoading, showInitialSkeleton, setStage]);
  
//   // Функция для маркировки готовности EventRegistration
//   const markEventRegistrationReady = useCallback(() => {
//     if (!isEventRegistrationReady) {
//       Promise.resolve().then(() => {
//         if (isMountedRef.current) {
//           pageLogger.info("EventRegistration component ready signal received");
//           setIsEventRegistrationReady(true);
          
//           // Обновляем состояние готовности компонентов и переходим к COMPLETED, если все готово
//           setComponentsReady(prev => {
//             const newState = { ...prev, registration: true };
            
//             // Если у нас уже есть данные и стадия не COMPLETED, делаем переход
//             if (event && currentStage !== LoadingStage.COMPLETED) {
//               pageLogger.info("All critical components ready, transitioning to COMPLETED");
//               setTimeout(() => {
//                 if (isMountedRef.current) {
//                   setStage(LoadingStage.COMPLETED);
//                   setShowInitialSkeleton(false);
//                 }
//               }, 100);
//             }
            
//             return newState;
//           });
//         }
//       });
//     }
//   }, [event, currentStage, isEventRegistrationReady, setStage]);
  
//   // Effect to handle errors
//   useEffect(() => {
//     // Обработка ошибок и переход в состояние ERROR
//     if (fetchError) {
//       pageLogger.error("Fetch error detected, transitioning to ERROR stage", { error: fetchError });
//       updateDynamicLoading(false);
//       setLoadingError(fetchError);
      
//       // Автоматический переход в ERROR только если у нас есть ошибка
//       if (currentStage !== LoadingStage.ERROR) {
//         setTimeout(() => {
//           if (isMountedRef.current) {
//             pageLogger.warn("Moving to ERROR stage due to fetch error");
//             setStage(LoadingStage.ERROR);
//           }
//         }, 100);
//       }
//     }
//   }, [fetchError, currentStage, updateDynamicLoading, setLoadingError, setStage]);
  
//   // Add as early as possible in the component
//   useEffect(() => {
//     isMountedRef.current = true;
    
//     // Стабилизационный таймер только для первого монтирования
//     const stabilityTimer = setTimeout(() => {
//       if (isMountedRef.current) {
//         // Корректный переход стадий для первого монтирования
//         if (currentStage === LoadingStage.STATIC_CONTENT) {
//           pageLogger.info("Moving to DYNAMIC_CONTENT stage after stability timeout");
//           setStage(LoadingStage.DYNAMIC_CONTENT);
//         }
//       }
//     }, 250);
    
//     return () => {
//       clearTimeout(stabilityTimer);
//       isMountedRef.current = false;
//       pageLogger.info(`Component unmounted`);
      
//       // Сбрасываем индикатор загрузки при размонтировании
//       updateDynamicLoading(false);
//     };
//   }, [currentStage, setStage, updateDynamicLoading]);
  
//   // Debug render states
//   useEffect(() => {
//     if (isMountedRef.current) {
//       pageLogger.debug(`Render state`, { 
//         isLoading, 
//         hasEvent: !!event, 
//         fetchError,
//         showingSkeleton: showInitialSkeleton,
//         loadingStage: currentStage
//       });
//     }
//   }, [isLoading, event, fetchError, showInitialSkeleton, currentStage]);

//   // This effect will run whenever the page is navigated to - with initialization check
//   useEffect(() => {
//     if (process.env.NODE_ENV === 'development') {
//       pageLogger.info("Skipping initial registration update in dev mode");
//       return;
//     }
    
//     pageLogger.info("Page mounted or navigated to - forcing EventRegistration update");
//     // Increment the key to force the component to re-mount
//     setRegistrationUpdateKey(prev => prev + 1);
//   }, []);
  
//   // Эффект для отслеживания таймаута загрузки (расположен до всех условий рендеринга)
//   useEffect(() => {
//     if (showInitialSkeleton && !event) {
//       // Устанавливаем таймаут для принудительного скрытия скелетона, если загрузка затянулась
//       const timeoutId = setTimeout(() => {
//         if (isMountedRef.current && showInitialSkeleton && !event) {
//           pageLogger.warn("Loading timeout - forcing error state");
//           setFetchError("Timeout loading event data");
//           setLoadingError("Timeout loading event data");
//           setStage(LoadingStage.ERROR);
//           setShowInitialSkeleton(false);
//         }
//       }, 35000); // 35 секунд - максимальное время ожидания
      
//       return () => clearTimeout(timeoutId);
//     }
//   }, [showInitialSkeleton, event, setLoadingError, setStage]);

//   // Render error states
//   if (currentStage === LoadingStage.ERROR || fetchError) {
//     pageLogger.warn("Rendering error state", { error: fetchError });
    
//     if (hasServerError) {
//       return <ErrorPlaceholder />;
//     }
    
//     return notFound();
//   }
  
//   // Render loading state with improved skeleton
//   if (!event || isLoading || showInitialSkeleton) {
//     pageLogger.info("Rendering loading state with improved skeleton");
//     return <EventDetailsSkeleton />;
//   }

//   // Render event content
//   return (
//     <div className="min-h-screen flex flex-col">
//       <Header />
//       <main className="flex-grow">
//         <motion.section
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="relative h-[400px] w-full px-6 mt-16 mb-8"
//         >
//           <div className="relative h-full w-full rounded-xl overflow-hidden">
//             {event.image_url ? (
//               <Image src={event.image_url} alt={event.title} fill className="object-cover" priority unoptimized />
//             ) : (
//               <AnimatedGradientBackground>
//               </AnimatedGradientBackground>
//             )}
//             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
//               <motion.h1
//                 initial={{ opacity: 0, scale: 0.95 }}
//                 animate={{ opacity: 1, scale: 1 }}
//                 className="text-4xl font-bold text-white text-center px-4 max-w-[90vw] event-title"
//                 style={{ fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }}
//               >
//                 {event.title}
//               </motion.h1>
//             </div>
//           </div>
//         </motion.section>

//         <div className="container mx-auto px-6 py-12">
//           {event.ticket_type && (
//             <motion.section 
//               initial={{ opacity: 0, y: 20 }} 
//               animate={{ opacity: 1, y: 0 }} 
//               className="mb-12"
//             >
//               <EventDetails 
//                 date={format(new Date(event.start_date), "d MMMM yyyy", { locale: ru })}
//                 time={format(new Date(event.start_date), "HH:mm", { locale: ru })}
//                 location={event.location || "Не указано"}
//                 price={event.price}
//                 freeRegistration={event.ticket_type.free_registration}
//               />
//             </motion.section>
//           )}

//           <motion.section 
//             initial={{ opacity: 0, y: 20 }} 
//             animate={{ opacity: 1, y: 0 }} 
//             className="mb-12"
//           >
//             <div className={`bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto ${
//               event.status !== "registration_open" || 
//               (event.ticket_type?.available_quantity || 0) - (event.ticket_type?.sold_quantity || 0) <= 0 
//                 ? "opacity-50 pointer-events-none" 
//                 : ""
//             }`}>
//               <h2 className="text-2xl font-semibold mb-4 text-center">
//                 {event.status === "registration_open" && 
//                  (event.ticket_type?.available_quantity || 0) - (event.ticket_type?.sold_quantity || 0) <= 0 
//                   ? "Регистрация закрыта (мест нет)"
//                   : event.status === "registration_open" 
//                     ? "Регистрация открыта"
//                     : event.status === "registration_closed" 
//                       ? "Регистрация закрыта"
//                       : event.status === "completed" 
//                         ? "Мероприятие завершено" 
//                         : "Черновик"}
//               </h2>

//               <EventRegistration
//                 key={`event-registration-${registrationUpdateKey}`}
//                 eventId={event.id ?? 0}
//                 eventTitle={event.title}
//                 eventDate={format(new Date(event.start_date), "d MMMM yyyy", { locale: ru })}
//                 eventTime={format(new Date(event.start_date), "HH:mm", { locale: ru })}
//                 eventLocation={event.location || "Не указано"}
//                 ticketType={event.ticket_type?.name || "Стандартный"}
//                 availableQuantity={event.ticket_type?.available_quantity || 0}
//                 soldQuantity={event.ticket_type?.sold_quantity || 0}
//                 price={event.price}
//                 freeRegistration={event.ticket_type?.free_registration || false}
//                 onBookingClick={handleBookingClick}
//                 onLoginClick={handleLoginClick}
//                 onBookingSuccess={handleBookingSuccess}
//                 onReady={markEventRegistrationReady}
//                 displayStatus={event.status === "registration_open" && 
//                              (event.ticket_type?.available_quantity || 0) - (event.ticket_type?.sold_quantity || 0) <= 0 
//                               ? "Регистрация закрыта (мест нет)"
//                               : event.status === "registration_open" 
//                                 ? "Регистрация открыта"
//                                 : event.status === "registration_closed" 
//                                   ? "Регистрация закрыта"
//                                   : event.status === "completed" 
//                                     ? "Мероприятие завершено" 
//                                     : "Черновик"}
//               />

//               {!isAuth && (
//                 <motion.p 
//                   initial={{ opacity: 0 }} 
//                   animate={{ opacity: 1 }} 
//                   className="text-center mt-6 text-gray-700 bg-orange-50 py-3 px-6 rounded-full"
//                 >
//                   Для бронирования билета{" "}
//                   <button 
//                     onClick={handleLoginClick} 
//                     className="text-orange-600 font-semibold hover:underline"
//                   >
//                     войдите в аккаунт
//                   </button>
//                 </motion.p>
//               )}
//             </div>
//           </motion.section>

//           {event.description && (
//             <motion.section 
//               initial={{ opacity: 0, y: 20 }} 
//               animate={{ opacity: 1, y: 0 }} 
//               className="max-w-3xl mx-auto"
//             >
//               <h2 className="text-2xl font-semibold mb-4">Описание</h2>
//               <FormattedDescription 
//                 content={event.description} 
//                 className="text-gray-600 max-w-full overflow-wrap-break-word" 
//                 disableFontSize={false} 
//               />
//             </motion.section>
//           )}
//         </div>
//       </main>
//       <Footer />

//       <AnimatePresence>
//         {isModalOpen && (
//           <AuthModal 
//             isOpen={isModalOpen} 
//             onClose={() => setIsModalOpen(false)} 
//             title={isRegisterMode ? "Регистрация" : "Вход"}
//           >
//             {isRegisterMode ? (
//               <Registration 
//                 isOpen={isModalOpen} 
//                 onClose={() => setIsModalOpen(false)} 
//                 toggleMode={() => setIsRegisterMode(false)} 
//               />
//             ) : (
//               <Login 
//                 isOpen={isModalOpen} 
//                 onClose={() => setIsModalOpen(false)} 
//                 toggleMode={() => setIsRegisterMode(true)} 
//               />
//             )}
//           </AuthModal>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }