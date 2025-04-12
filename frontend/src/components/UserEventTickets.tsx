import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading } from "@/contexts/LoadingContext";
import { EventData } from "@/types/events";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Define the date formatting function directly
const formatDateForDisplay = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateString;
  }
};

// Add a function to format time
const formatTimeForDisplay = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

// Add a function to check if dates are the same day
const isSameDay = (date1: string, date2: string): boolean => {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getDate() === d2.getDate();
  } catch {
    return false;
  }
};

// Add a function to translate ticket types
const getTicketTypeInRussian = (ticketType: string): string => {
  const translations: Record<string, string> = {
    'free': 'Бесплатный',
    'standart': 'Стандартный',
    'vip': 'VIP',
    'org': 'Организатор'
  };
  return translations[ticketType.toLowerCase()] || ticketType;
};

// Helper functions for ticket status display
const getStatusColor = (status: "pending" | "approved" | "rejected" | "cancelled"): string => {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "rejected":
      return "bg-gray-100 text-gray-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-green-100 text-green-800";
  }
};

const getStatusText = (status: "pending" | "approved" | "rejected" | "cancelled"): string => {
  switch (status) {
    case "approved":
      return "Подтвержден";
    case "cancelled":
      return "Отменен";
    case "rejected":
      return "Отклонен";
    case "pending":
      return "Ожидает подтверждения";
    default:
      return "Подтвержден";
  }
};

interface UserTicket {
  id: number;
  event: EventData;
  ticket_type: string;
  registration_date: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  cancellation_count?: number;
  ticket_number?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading: boolean;
  error?: string;
  success?: string;
}

interface APIResponse<T> {
  data?: T;
  items?: T;
  tickets?: T;
  error?: string;
  status?: number;
  aborted?: boolean;
  reason?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading,
  error,
  success
}) => {
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl relative"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Закрыть"
            >
              <FaTimesCircle size={20} />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">{title}</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md">
                <p className="text-sm font-medium">{success}</p>
              </div>
            )}
            
            <p className="mb-6 text-gray-600">{message}</p>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-medium transition-colors duration-300 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading || !!success}
                className="px-4 py-2 rounded-lg font-medium transition-colors duration-300 bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                    <span>Отмена...</span>
                  </>
                ) : (
                  "Подтвердить"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Компонент для отображения скелетона загрузки билета
const TicketSkeleton = () => (
  <>
    <style jsx global>{`
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .animate-shimmer {
        animation: shimmer 1.5s infinite;
      }
    `}</style>
    <div className="bg-white rounded-lg p-4 shadow-sm border border-orange-50">
      {/* Top section: Title and Status */}
      <div className="flex justify-between items-center mb-2">
        <div className="h-5 bg-gradient-to-r from-orange-200 via-orange-50 to-orange-100 rounded w-1/3 animate-shimmer bg-[length:200%_100%]"></div>
        <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded-full w-1/6 animate-shimmer bg-[length:200%_100%]"></div>
      </div>
      
      <div className="flex h-full">
        {/* Вертикальный номер билета */}
        <div className="flex-shrink-0 w-[90px] flex items-center justify-center">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-2 shadow-sm h-full flex">
            <div className="flex-1 flex items-center justify-center pr-1 border-r border-orange-200">
              <div className="h-20 w-3 bg-gradient-to-b from-orange-100 via-orange-50 to-orange-100 rounded animate-shimmer bg-[length:200%_100%]"></div>
            </div>
            <div className="flex-1 flex items-center justify-center pl-1">
              <div className="h-20 w-3 bg-gradient-to-b from-orange-200 via-orange-100 to-orange-200 rounded animate-shimmer bg-[length:200%_100%]"></div>
            </div>
          </div>
        </div>
        
        {/* Основное содержимое */}
        <div className="flex-1 ml-3">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 bg-gradient-to-r from-orange-300 via-orange-200 to-orange-300 rounded-full mt-1 animate-shimmer bg-[length:200%_100%]"></div>
              <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-3/4 animate-shimmer bg-[length:200%_100%]"></div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 bg-gradient-to-r from-orange-300 via-orange-200 to-orange-300 rounded-full mt-1 animate-shimmer bg-[length:200%_100%]"></div>
              <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-1/2 animate-shimmer bg-[length:200%_100%]"></div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 bg-gradient-to-r from-orange-300 via-orange-200 to-orange-300 rounded-full mt-1 animate-shimmer bg-[length:200%_100%]"></div>
              <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-2/3 animate-shimmer bg-[length:200%_100%]"></div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 bg-gradient-to-r from-orange-300 via-orange-200 to-orange-300 rounded-full mt-1 animate-shimmer bg-[length:200%_100%]"></div>
              <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-3/5 animate-shimmer bg-[length:200%_100%]"></div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 bg-gradient-to-r from-orange-300 via-orange-200 to-orange-300 rounded-full mt-1 animate-shimmer bg-[length:200%_100%]"></div>
              <div className="h-4 bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 rounded w-4/5 animate-shimmer bg-[length:200%_100%]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

// Определение для ref компонента
export interface UserEventTicketsRef {
  refreshTickets: () => void;
}

interface UserEventTicketsProps {
  needsRefresh?: React.MutableRefObject<boolean>;
  forceUpdateTrigger?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const UserEventTickets = React.forwardRef<UserEventTicketsRef, UserEventTicketsProps>(
  ({ needsRefresh, forceUpdateTrigger = 0, containerRef }, ref) => {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketsCount, setTicketsCount] = useState(0);
  const { currentStage, setDynamicLoading } = useLoading();
  const { userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasInitialData = useRef(false);
  const isInitialLoad = useRef(true);
  const fetchAttempted = useRef(false);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  // Add a manual refresh counter for forcing updates
  const refreshCounter = useRef<number>(0);
  const debounceFetch = useRef<NodeJS.Timeout | null>(null);
  const loadingSafetyTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const ticketsContainerRef = containerRef || internalContainerRef;
  const ticketsPerPage = 5;
  
  // For preventing duplicate requests in development mode
  const isMounted = useRef(false);
  const isInitialFetchDone = useRef(false);
  
  // Modal state - keep just one set of modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>(undefined);
  
  // Prevent modal reopening
  const isTicketBeingCancelled = useRef(false);

  // Добавляем состояние для отслеживания длительной загрузки
  const [showLoadingHint, setShowLoadingHint] = useState(false);

  // Добавляем флаг для предотвращения перерисовок после успешной загрузки
  const isStable = useRef(false);
  const mountCountRef = useRef(0);
  
  // Используем useRef для хранения последней версии функций
  const fetchTicketsRef = useRef<(bypassStageCheck?: boolean) => Promise<void>>();
  
  // Функция для сброса состояния загрузки и попытки повторного запроса
  const handleRetryFetch = useCallback(() => {
    setError(null);
    setIsLoading(true);
    refreshCounter.current += 1;
    
    if (debounceFetch.current) {
      clearTimeout(debounceFetch.current);
    }
    
    debounceFetch.current = setTimeout(() => {
      if (fetchTicketsRef.current) {
        fetchTicketsRef.current();
      }
    }, 100);
  }, [setError, setIsLoading]);
  
  const shouldReplaceTicket = (existing: UserTicket, newTicket: UserTicket): boolean => {
    const statusPriority: Record<string, number> = {
      "approved": 0,
      "pending": 1,
      "cancelled": 2,
      "rejected": 3
    };
    return statusPriority[newTicket.status] < statusPriority[existing.status];
  };
  
  const sortByStatusAndDate = (tickets: UserTicket[]): UserTicket[] => {
    const statusPriority: Record<string, number> = {
      "approved": 0,
      "pending": 1,
      "cancelled": 2,
      "rejected": 3
    };
    return [...tickets].sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      const dateA = new Date(a.event.start_date);
      const dateB = new Date(b.event.start_date);
      return dateA.getTime() - dateB.getTime();
    });
  };
  
  // Function to process tickets
  const processTickets = useCallback((tickets: UserTicket[]): UserTicket[] => {
    const nonCancelledTickets = tickets.filter(ticket => ticket.status !== "cancelled");
    console.log(`UserEventTickets: Filtered out cancelled tickets: ${tickets.length - nonCancelledTickets.length} cancelled, ${nonCancelledTickets.length} remaining`);
    
    const uniqueTicketsMap = new Map<number, UserTicket>();
    nonCancelledTickets.forEach(ticket => {
      const existingTicket = uniqueTicketsMap.get(ticket.id);
      if (!existingTicket || shouldReplaceTicket(existingTicket, ticket)) {
        uniqueTicketsMap.set(ticket.id, ticket);
      }
    });
    
    const uniqueTickets = Array.from(uniqueTicketsMap.values());
    const activeTickets = uniqueTickets.filter(ticket => ticket.status !== "cancelled");
    return sortByStatusAndDate(activeTickets);
  }, [shouldReplaceTicket, sortByStatusAndDate]);

  // Function to fetch tickets with better error handling and loading state management
  const fetchTickets = useCallback(async (bypassLoadingStageCheck: boolean = false) => {
    if (!isMounted.current) {
      console.log("UserEventTickets: Component not mounted, request cancelled");
      return;
    }
    
    if (fetchAttempted.current) {
      console.log("UserEventTickets: Request already in progress");
      return;
    }
    
    fetchAttempted.current = true;
    setIsLoading(true);
    setDynamicLoading(true);
    
    console.log(`UserEventTickets: Starting ticket request, stage: ${currentStage}, refreshCounter=${refreshCounter.current}`);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: Token not found");
        setError("Необходима авторизация");
        setIsLoading(false);
        setDynamicLoading(false);
        router.push('/');
        return;
      }
      
      console.log('UserEventTickets: Executing ticket request');
      const cacheKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const response = await apiFetch<APIResponse<UserTicket[]>>('/user_edits/my-tickets', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        bypassLoadingStageCheck: bypassLoadingStageCheck,
        params: {
          _nocache: cacheKey,
          page: 1,
          per_page: ticketsPerPage
        }
      });
      
      // Handle aborted requests
      if (response && "aborted" in response) {
        if (response.reason === "loading-stage-mismatch") {
          console.log("UserEventTickets: Request aborted due to loading stage mismatch");
          if (retryTimeout.current) {
            clearTimeout(retryTimeout.current);
          }
          
          // Retry after a delay using self-reference to ensure we use the latest version
          const self = fetchTickets;
          retryTimeout.current = setTimeout(() => {
            console.log("UserEventTickets: Retrying request after stage mismatch");
            fetchAttempted.current = false;
            refreshCounter.current += 1;
            self(true);
          }, 1000);
          return;
        }
        
        console.log(`UserEventTickets: Request aborted, reason: ${response.reason}`);
        setError(`Запрос был прерван: ${response.reason}`);
        setIsLoading(false);
        setDynamicLoading(false);
        isInitialLoad.current = false;
        return;
      }
      
      console.log('UserEventTickets: Tickets received', response);
      let ticketsData: UserTicket[] = [];
      
      // Process different response formats
      if (Array.isArray(response)) {
        console.log("UserEventTickets: Response in direct array format");
        ticketsData = response;
      } else if (response && !("aborted" in response)) {
        if ("data" in response && response.data) {
          console.log("UserEventTickets: Response in {data: [...]} format");
          ticketsData = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
        } else if ("items" in response && response.items) {
          console.log("UserEventTickets: Response in {items: [...]} format");
          ticketsData = Array.isArray(response.items) ? response.items : [response.items as UserTicket];
        } else if ("tickets" in response && response.tickets) {
          console.log("UserEventTickets: Response in {tickets: [...]} format");
          ticketsData = Array.isArray(response.tickets) ? response.tickets : [response.tickets as UserTicket];
        }
      }
      
      if (!ticketsData || ticketsData.length === 0) {
        console.log('UserEventTickets: No tickets found or empty response');
        setTickets([]);
        setError(null);
        hasInitialData.current = true;
        isInitialFetchDone.current = true;
        setIsLoading(false);
        setDynamicLoading(false);
        isInitialLoad.current = false;
        return;
      }
      
      console.log(`UserEventTickets: Received ${ticketsData.length} tickets`);
      const processedTickets = processTickets(ticketsData);
      console.log(`UserEventTickets: After processing, ${processedTickets.length} unique active tickets remain`);
      
      setTickets(processedTickets);
      setTicketsCount(processedTickets.length);
      setError(null);
      hasInitialData.current = true;
      isInitialFetchDone.current = true;
      setIsLoading(false);
      setDynamicLoading(false);
      isInitialLoad.current = false;
      console.log('UserEventTickets: Ticket loading completed successfully');
      
      // Помечаем компонент как стабильный после успешной загрузки билетов
      if (processedTickets.length > 0 && !isStable.current) {
        console.log('UserEventTickets: Component reached stable state');
        isStable.current = true;
      }
    } catch (err) {
      console.error('UserEventTickets: Error loading tickets', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных');
      setIsLoading(false);
      setDynamicLoading(false);
      isInitialLoad.current = false;
    } finally {
      fetchAttempted.current = false;
    }
  }, [currentStage, setDynamicLoading, router, processTickets]);
  
  // Сохраняем последнюю версию функции в ref
  useEffect(() => {
    fetchTicketsRef.current = fetchTickets;
  }, [fetchTickets]);
  
  // Обработчик прерывания запросов при изменении сети
  useEffect(() => {
    const handleOnline = () => {
      if (isLoading && !tickets.length) {
        console.log('UserEventTickets: Network reconnected, retrying fetch');
        handleRetryFetch();
      }
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isLoading, tickets.length, handleRetryFetch]);
  
  // Consolidated effect for component lifecycle and initial setup
  useEffect(() => {
    mountCountRef.current += 1;
    
    console.log(`UserEventTickets: Component mounted, current stage: ${currentStage}, mount #${mountCountRef.current}`);
    
    // Обязательно отмечаем, что компонент смонтирован
    isMounted.current = true;
    
    // Сначала проверяем, достигли ли мы стабильного состояния
    if (isStable.current) {
      console.log('UserEventTickets: Component in stable state, preserving render');
      return () => {
        console.log('UserEventTickets: Component unmounting (stable state)');
        isMounted.current = false;
      };
    }
    
    // Единый блок инициализации для предотвращения дублирования логики
    const initializeTickets = () => {
      // Clear any existing timeouts
      if (debounceFetch.current) {
        clearTimeout(debounceFetch.current);
        debounceFetch.current = null;
      }
      
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
        retryTimeout.current = null;
      }
      
      if (loadingSafetyTimeout.current) {
        clearTimeout(loadingSafetyTimeout.current);
        loadingSafetyTimeout.current = null;
      }
      
      // Check authentication
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: No token found on mount, redirecting to home");
        router.push('/');
        return;
      }
      
      // Инициализация только при первом монтировании
      if (!hasInitialData.current && !isInitialFetchDone.current && !fetchAttempted.current) {
        console.log('UserEventTickets: First time on profile page - initializing');
        
        // Устанавливаем флаги загрузки
        setIsLoading(true);
        hasInitialData.current = false;
        isInitialLoad.current = true;
        fetchAttempted.current = false;
        setPage(1);
        setHasMore(true);
        setTickets([]);
        isInitialFetchDone.current = false;
        
        // Инкрементируем счетчик для обеспечения свежего запроса
        refreshCounter.current += 1;
        
        console.log(`UserEventTickets: Forcing ticket fetch regardless of loading stage (${currentStage})`);
        if (fetchTicketsRef.current) {
          fetchTicketsRef.current(true);
        }
      }
    };
    
    // Инициализируем сразу, не используя setTimeout для дополнительных задержек
    initializeTickets();
    
    // Отслеживаем изменение стадии загрузки для более умной инициализации
    const stageChangeHandler = () => {
      // Если компонент еще не инициализирован полностью, пропускаем
      if (!isMounted.current || hasInitialData.current || fetchAttempted.current) {
        return;
      }
      
      // Отслеживаем переходы между стадиями только для запуска первоначальной загрузки
      // при переходе от authentication к другим стадиям
      const prevStageWasAuth = currentStage !== 'authentication' && 
                             !isInitialFetchDone.current && 
                             !hasInitialData.current;
      
      if (prevStageWasAuth) {
        console.log(`UserEventTickets: Stage changed to ${currentStage}, triggering fetch`);
        
        // Избегаем повторных запросов
        if (!fetchAttempted.current && !isInitialFetchDone.current && fetchTicketsRef.current) {
          console.log('UserEventTickets: Post-authentication fetch triggered');
          fetchTicketsRef.current(true);
        }
      }
    };
    
    // Вызываем обработчик изменения стадии при необходимости
    stageChangeHandler();
    
    // Настраиваем таймер безопасности для сброса состояния загрузки
    loadingSafetyTimeout.current = setTimeout(() => {
      if (isMounted.current && isLoading) {
        console.log('UserEventTickets: Safety timeout triggered - resetting loading state');
        setIsLoading(false);
        setDynamicLoading(false);
        
        if (!tickets.length && !error) {
          console.log('UserEventTickets: No tickets loaded after timeout, showing empty state');
          setTickets([]);
        }
      }
    }, 5000);
    
    // Интеллектуальное управление состоянием загрузки
    const loadingCheckInterval = setInterval(() => {
      if (!isMounted.current) return;
      
      // Если данные загружены, но флаг всё ещё активен - сбрасываем его
      if (hasInitialData.current && isLoading) {
        console.log('UserEventTickets: Fixing inconsistent loading state');
        setIsLoading(false);
        setDynamicLoading(false);
      }
      
      // Проверяем наличие "зависшего" состояния загрузки
      if (isLoading && !fetchAttempted.current) {
        console.log('UserEventTickets: Detected potentially stale loading state');
        if (!tickets.length && mountCountRef.current > 2) {
          console.log('UserEventTickets: Stale loading with no tickets, retrying fetch');
          handleRetryFetch();
        }
      }
    }, 2000);
    
    return () => {
      console.log(`UserEventTickets: Component unmounting, mount #${mountCountRef.current}`);
      isMounted.current = false;
      
      // Очистка всех таймеров
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
        retryTimeout.current = null;
      }
      
      if (debounceFetch.current) {
        clearTimeout(debounceFetch.current);
        debounceFetch.current = null;
      }
      
      if (loadingSafetyTimeout.current) {
        clearTimeout(loadingSafetyTimeout.current);
        loadingSafetyTimeout.current = null;
      }
      
      clearInterval(loadingCheckInterval);
      
      // Сбрасываем глобальное состояние загрузки
      if (isLoading) {
        console.log('UserEventTickets: Clearing loading state during unmount');
        setDynamicLoading(false);
      }
    };
  }, [currentStage, fetchTickets, handleRetryFetch, isLoading, tickets, error, router, pathname, setDynamicLoading]);

  // Добавляем состояние для отслеживания длительной загрузки
  useEffect(() => {
    let loadingHintTimeout: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      // Если загрузка длится более 3 секунд, показываем подсказку пользователю
      loadingHintTimeout = setTimeout(() => {
        setShowLoadingHint(true);
      }, 3000);
    } else {
      setShowLoadingHint(false);
    }
    
    return () => {
      if (loadingHintTimeout) {
        clearTimeout(loadingHintTimeout);
      }
    };
  }, [isLoading]);

  // Add method for ProfilePage to directly trigger refresh
  React.useImperativeHandle(ref, () => ({
    refreshTickets: () => {
      if (fetchAttempted.current) {
        console.log('UserEventTickets: Not refreshing - fetch already in progress');
        return;
      }
      console.log('UserEventTickets: Manual refresh triggered via ref');
      refreshCounter.current += 1;
      if (debounceFetch.current) clearTimeout(debounceFetch.current);
      
      debounceFetch.current = setTimeout(() => {
        if (fetchTicketsRef.current) {
          fetchTicketsRef.current();
        }
      }, 100);
    }
  }), []);

    // Effect for ticket update event listener
  useEffect(() => {
    const handleTicketUpdate = (event: Event) => {
      if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
        console.log('UserEventTickets: Ignoring our own ticket-update event');
        return;
      }
      
      if (isTicketBeingCancelled.current) {
        console.log('UserEventTickets: Skipping ticket-update event during active cancellation');
        return;
      }
      
      console.log('UserEventTickets: External ticket-update event received');
      
      if (event instanceof CustomEvent && event.detail) {
          const { source, action, newTicket, ticketId, needsRefresh } = event.detail;
        
        console.log(`UserEventTickets: Event details - source: ${source}, action: ${action}, needsRefresh: ${needsRefresh}`);
        
        if (needsRefresh === false) {
          console.log('UserEventTickets: needsRefresh is explicitly false, skipping refresh');
          return;
        }
        
        if (source !== 'user-event-tickets' && action === 'cancel' && ticketId) {
          console.log(`UserEventTickets: External cancel received for ticket ${ticketId} - no refresh needed`);
          return;
        }
        
        if (source === 'event-registration' && action === 'register' && newTicket) {
          console.log('UserEventTickets: Received new ticket registration data:', newTicket);
          
          setTickets(prev => {
            if (prev.some(t => t.id === newTicket.id)) {
              console.log('UserEventTickets: Ticket already exists, not adding duplicate');
              return prev;
            }
            console.log('UserEventTickets: Adding new ticket to state');
            return [...prev, newTicket];
          });
          
          hasInitialData.current = true;
          isInitialFetchDone.current = true;
          return;
        }
      }
      
      if (!isTicketBeingCancelled.current) {
        console.log('UserEventTickets: External event requires refresh - will fetchTickets()');
        refreshCounter.current += 1;
        fetchTickets();
      }
    };
    
    window.addEventListener('ticket-update', handleTicketUpdate);
    return () => window.removeEventListener('ticket-update', handleTicketUpdate);
  }, [fetchTickets]);

    // Effect for scroll event listener for infinite scrolling
  useEffect(() => {
    const container = ticketsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < scrollHeight * 0.2 && !isLoadingMore && hasMore) {
        console.log('UserEventTickets: Scrolled near bottom, loading more tickets');
        loadMoreTickets();
      }
    };

    container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore]);

    // Effect for forceUpdateTrigger and needsRefresh
  useEffect(() => {
    if (!isMounted.current) return;
    
      if (forceUpdateTrigger > 0) {
        console.log(`UserEventTickets: Force update triggered #${forceUpdateTrigger}`);
        if (isTicketBeingCancelled.current) {
          console.log('UserEventTickets: Skipping forced update during active cancellation');
      return;
    }
        refreshCounter.current += 1;
        fetchTickets();
      }
      
      if (needsRefresh && needsRefresh.current) {
        console.log('UserEventTickets: needsRefresh ref is true, refreshing');
        needsRefresh.current = false;
        refreshCounter.current += 1;
        fetchTickets();
      }
    }, [forceUpdateTrigger, needsRefresh]);

    // Effect for updating tickets count display
    useEffect(() => {
    const timer = setTimeout(() => {
        const countDisplay = document.querySelector(".tickets-count");
        if (countDisplay) {
          countDisplay.textContent = `Загружено: ${ticketsCount}`;
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [ticketsCount]);

    const loadMoreTickets = async () => {
      if (isLoadingMore || !hasMore) return;
      
      setIsLoadingMore(true);
      const nextPage = page + 1;
      console.log(`UserEventTickets: Loading more tickets, page ${nextPage}`);
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.log("UserEventTickets: No token found in localStorage");
          setError("Необходима авторизация");
          setIsLoadingMore(false);
          router.push('/');
          return;
        }
        
        const currentTicketIds = new Set(tickets.map(ticket => ticket.id));
        console.log(`UserEventTickets: Current ticket count: ${currentTicketIds.size}`);
        
        const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
          method: "GET",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          bypassLoadingStageCheck: true,
          params: {
            _nocache: Date.now(),
            _refresh: refreshCounter.current,
            page: nextPage,
            per_page: ticketsPerPage
          }
        });
        
        console.log('UserEventTickets: Loaded more tickets response:', response);
        let ticketsData: UserTicket[] = [];
        if (Array.isArray(response)) {
          console.log("UserEventTickets: Response in direct array format");
          ticketsData = response;
        } else if (response && !("aborted" in response)) {
          if ("data" in response && response.data) {
            console.log("UserEventTickets: Response in {data: [...]} format");
            ticketsData = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
          } else if ("items" in response && response.items) {
            console.log("UserEventTickets: Response in {items: [...]} format");
            ticketsData = Array.isArray(response.items) ? response.items : [response.items as UserTicket];
          } else if ("tickets" in response && response.tickets) {
            console.log("UserEventTickets: Response in {tickets: [...]} format");
            ticketsData = Array.isArray(response.tickets) ? response.tickets : [response.tickets as UserTicket];
          }
        }
        
        const processedTickets = processTickets(ticketsData);
        const newTickets = processedTickets.filter(ticket => !currentTicketIds.has(ticket.id));
        console.log(`UserEventTickets: New tickets to add: ${newTickets.length}`);
        
        if (newTickets.length > 0) {
          const updatedTickets = [...tickets, ...newTickets];
          setTickets(updatedTickets);
          setTicketsCount(updatedTickets.length);
          setPage(nextPage);
          setHasMore(newTickets.length >= ticketsPerPage);
        } else {
          console.log('UserEventTickets: No more new tickets found');
          setHasMore(false);
        }
        
        setTimeout(() => {
          setIsLoadingMore(false);
        }, 300);
      } catch (err) {
        console.error("UserEventTickets: Error loading more tickets", err);
        setIsLoadingMore(false);
      }
    };

  // Обработка отмены билета с улучшенной обработкой ошибок и состояний
  const handleCancelClick = useCallback((ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setIsModalOpen(true);
    console.log("UserEventTickets: Opening cancel confirmation for ticket ID:", ticket.id);
  }, [setSelectedTicket, setCancelError, setCancelSuccess, setIsModalOpen]);
  
  const handleCancelConfirm = async () => {
    if (!selectedTicket) {
      console.error('UserEventTickets: Attempt to cancel without selected ticket');
      setCancelError('Не удалось найти выбранный билет');
      return;
    }
    
    isTicketBeingCancelled.current = true;
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setCancelLoading(true);
    
    try {
      if (!selectedTicket || !userData) {
        throw new Error('No ticket selected or user not authorized');
      }
      
      console.log('UserEventTickets: Cancelling ticket:', selectedTicket.id);
      const response = await apiFetch(`/registration/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        bypassLoadingStageCheck: true,
        // Добавляем явно необходимые данные для бэкенда
        data: {
          event_id: selectedTicket.event.id,
          ticket_id: selectedTicket.id
        }
      });
      
      // Проверяем ответ на наличие ошибок
      const responseObj = response as Record<string, unknown>;
      if (responseObj && responseObj.error) {
        throw new Error(responseObj.error as string || 'Ошибка при отмене билета');
      }
      
      console.log('UserEventTickets: Ticket cancelled successfully:', response);
      setCancelSuccess('Билет успешно отменен!');
      
      // Обновляем локальное состояние немедленно
      setTickets(currentTickets => 
        currentTickets.filter(ticket => ticket.id !== selectedTicket.id)
      );
      setTicketsCount(prev => Math.max(0, prev - 1));
      
      const ticketDetails = {
        ticketId: selectedTicket.id,
        eventId: selectedTicket.event.id
      };
      
      // Оповещаем приложение об отмене билета
      const ticketUpdateEvent = new CustomEvent('ticket-update', {
        detail: {
          source: 'user-event-tickets',
          action: 'cancel',
          ticketId: ticketDetails.ticketId,
          eventId: ticketDetails.eventId,
          needsRefresh: false // Указываем, что обновление не требуется, т.к. мы уже обновили локальное состояние
        }
      });
      console.log('UserEventTickets: Dispatching ticket-update event with needsRefresh:false');
      window.dispatchEvent(ticketUpdateEvent);
      
      // Закрываем модальное окно с небольшой задержкой для показа сообщения об успехе
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setCancelLoading(false);
        isTicketBeingCancelled.current = false;
      }, 1500);
    } catch (err: unknown) {
      console.error('UserEventTickets: Error cancelling ticket:', err);
      const errorMessage = err instanceof Error ? err.message : 'Не удалось отменить билет. Пожалуйста, попробуйте снова.';
      setCancelError(errorMessage);
      setCancelLoading(false);
      isTicketBeingCancelled.current = false;
    }
  };

    // Добавляем функцию для автоматической попытки восстановления после длительной загрузки
    useEffect(() => {
      // Если загрузка длится больше 7 секунд и нет данных, пробуем запросить еще раз
      const autoRetryTimeout = setTimeout(() => {
        if (isLoading && tickets.length === 0 && !error) {
          console.log('UserEventTickets: Auto-retry fetch after long loading');
          // Сбрасываем состояние загрузки и делаем повторный запрос
          fetchAttempted.current = false;
          setIsLoading(true);
          fetchTickets();
        }
      }, 7000);
      
      return () => {
        clearTimeout(autoRetryTimeout);
      };
    }, [isLoading, tickets.length, error, fetchTickets]);

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={handleRetryFetch}
          className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

    return (
      <div className="h-full overflow-auto" ref={ticketsContainerRef}>
      {isLoading && tickets.length === 0 ? (
        <div className="p-2">
          <TicketSkeleton />
          {showLoadingHint && (
            <div className="text-center mt-4 text-gray-500 text-sm animate-pulse">
              Загрузка билетов может занять некоторое время...
            </div>
          )}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <div className="text-xl font-semibold mb-2">У вас пока нет билетов</div>
          <p className="text-gray-500">После бронирования, билеты на мероприятия будут отображаться здесь</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end mb-4 w-full overflow-hidden pr-2">
            <span className="text-sm text-gray-500 truncate bg-white px-2 py-1 rounded shadow-sm tickets-count">
              Загружено: {tickets.length}
            </span>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
      
          <div className="space-y-4">
            {tickets.map((ticket, index) => {
              const showCancelButton = ticket.status !== "rejected";

              return (
                <div key={`ticket-${ticket.id}`}>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Top section: Title and Status */}
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {ticket.event.title}
                      </h3>
                      <div className="flex items-center gap-3">
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                            ticket.status
                          )}`}
                        >
                          {getStatusText(ticket.status)}
                        </div>
                        {showCancelButton && (
                          <button 
                            onClick={() => handleCancelClick(ticket)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium py-1 px-2 rounded transition-colors whitespace-nowrap"
                          >
                            Отменить
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex h-full">
                      {/* Вертикальный номер билета */}
                      <div className="flex-shrink-0 w-[90px] flex items-center justify-center">
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-2 shadow-sm h-full flex">
                          {/* Левая колонка - заголовок */}
                          <div className="flex-1 flex items-center justify-center pr-1 border-r border-orange-200">
                            <p className="[writing-mode:vertical-rl] rotate-180 text-xs text-gray-500 uppercase font-medium">
                              НОМЕР БИЛЕТА
                            </p>
                          </div>
                          
                          {/* Правая колонка - номер */}
                          <div className="flex-1 flex items-center justify-center pl-1">
                            <p className="[writing-mode:vertical-rl] rotate-180 text-xl font-bold text-orange-600">
                              #{ticket.ticket_number || ticket.id}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Основное содержимое */}
                      <div className="flex-1 ml-3">
                        {/* Информация о событии */}
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <FaCalendarAlt className="text-orange-500 flex-shrink-0 mt-1" />
                            <span className="break-words">
                              {formatDateForDisplay(ticket.event.start_date)}
                              {ticket.event.end_date && !isSameDay(ticket.event.start_date, ticket.event.end_date) &&
                                ` - ${formatDateForDisplay(ticket.event.end_date)}`}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <FaClock className="text-orange-500 flex-shrink-0 mt-1" />
                            <span className="break-words">
                              {formatTimeForDisplay(ticket.event.start_date)}
                              {ticket.event.end_date && 
                                ` - ${formatTimeForDisplay(ticket.event.end_date)}`}
                            </span>
                          </div>
                          {ticket.event.location && (
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <FaMapMarkerAlt className="text-orange-500 flex-shrink-0 mt-1" />
                              <span className="break-words">{ticket.event.location}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <FaTicketAlt className="text-orange-500 flex-shrink-0 mt-1" />
                            <span className="break-words">{getTicketTypeInRussian(ticket.ticket_type)}</span>
                          </div>
                          
                          {/* Последний элемент информации */}
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <FaRegCalendarCheck className="text-orange-500 flex-shrink-0 mt-1" />
                            <span className="break-words">Забронировано: {formatDateForDisplay(ticket.registration_date)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  {index < tickets.length - 1 && (
                    <div className="h-[2px] bg-gray-200 my-3 mx-auto w-[70%]"></div>
                  )}
                </div>
              );
            })}
          </div>
          
          {isLoadingMore && (
            <div className="py-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-orange-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Загрузка...</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Загрузка дополнительных билетов...</p>
            </div>
          )}
          
          <ConfirmModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false); 
              setSelectedTicket(null);
              isTicketBeingCancelled.current = false;
            }}
            onConfirm={handleCancelConfirm}
            title="Отмена регистрации"
            message={selectedTicket ? `Вы уверены, что хотите отменить регистрацию на мероприятие "${selectedTicket.event.title}"?` : ''}
            isLoading={cancelLoading}
            error={cancelError}
            success={cancelSuccess}
          />
        </>
      )}
    </div>
  );
  }
);

// Добавляем displayName для улучшения отладки
UserEventTickets.displayName = 'UserEventTickets';

// Создаем мемоизированную версию компонента с пользовательской функцией сравнения
const MemoizedUserEventTickets = React.memo(UserEventTickets, (prevProps, nextProps) => {
  // Базовая проверка наличия пропсов
  if (!prevProps || !nextProps) return false;
  
  // Проверяем только те свойства, которые действительно используются для рендеринга
  const arePropsEqual = prevProps.forceUpdateTrigger === nextProps.forceUpdateTrigger;
  
  // Если пропсы не изменились, не перерисовываем компонент
  return arePropsEqual;
});

// Экспортируем мемоизированную версию по умолчанию
export default MemoizedUserEventTickets;