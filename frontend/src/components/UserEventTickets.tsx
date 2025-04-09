import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { EventData } from "@/types/events";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MdCalendarToday, MdLocationOn, MdConfirmationNumber } from "react-icons/md";

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

interface UserTicket {
  id: number;
  event: EventData;
  ticket_type: string;
  registration_date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
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

interface TicketItemProps {
  ticket: UserTicket;
  userData: any;
  onCancelClick: (ticket: UserTicket) => void;
}

// Helper functions (moved outside components to be accessible everywhere)
const getStatusColor = (status: UserTicket["status"]) => {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-green-100 text-green-800";
  }
};

const getStatusText = (status: UserTicket["status"]) => {
  switch (status) {
    case "confirmed":
      return "Подтвержден";
    case "cancelled":
      return "Отменен";
    case "completed":
      return "Завершен";
    case "pending":
      return "Ожидает подтверждения";
    default:
      return "Подтвержден";
  }
};

const TicketItem: React.FC<TicketItemProps> = ({ ticket, userData, onCancelClick }) => {
  const startDate = formatDateForDisplay(ticket.event.start_date);
  const startTime = formatTimeForDisplay(ticket.event.start_date);
  const endTime = ticket.event.end_date ? formatTimeForDisplay(ticket.event.end_date) : '';
  const showCancelButton = ticket.status !== "cancelled" && ticket.status !== "completed";
  const ticketTypeDisplay = getTicketTypeInRussian(ticket.ticket_type);
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg relative">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-gray-800 truncate">{ticket.event.title}</h3>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(ticket.status)}`}>
          {getStatusText(ticket.status)}
        </span>
      </div>
      
      <div className="flex">
        {/* Ticket number section */}
        {ticket.ticket_number && (
          <div className="flex-shrink-0 w-[90px] flex items-center justify-center mr-3">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-2 shadow-sm h-full flex">
              <div className="flex-1 flex items-center justify-center pr-1 border-r border-orange-200">
                <div className="vertical-text text-orange-700 font-mono text-sm tracking-wider transform -rotate-90 whitespace-nowrap">
                  {ticket.ticket_number.slice(0, ticket.ticket_number.length / 2)}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center pl-1">
                <div className="vertical-text text-orange-500 font-mono text-sm tracking-wider transform -rotate-90 whitespace-nowrap">
                  {ticket.ticket_number.slice(ticket.ticket_number.length / 2)}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Main ticket info */}
        <div className="flex-1">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <FaTicketAlt className="text-orange-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700">Тип билета: <span className="font-medium">{ticketTypeDisplay}</span></span>
            </div>
            <div className="flex items-start gap-2">
              <FaCalendarAlt className="text-orange-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700">{startDate}</span>
            </div>
            <div className="flex items-start gap-2">
              <FaClock className="text-orange-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700">{startTime}{endTime ? ` - ${endTime}` : ''}</span>
            </div>
            {ticket.event.location && (
              <div className="flex items-start gap-2">
                <FaMapMarkerAlt className="text-orange-500 mt-1 flex-shrink-0" />
                <span className="text-sm text-gray-700 break-words">{ticket.event.location}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <FaRegCalendarCheck className="text-orange-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-500">
                Зарегистрирован: {formatDateForDisplay(ticket.registration_date)}
              </span>
            </div>
          </div>
          
          {showCancelButton && (
            <div className="mt-4">
              <button
                onClick={() => onCancelClick(ticket)}
                className="text-sm text-red-600 hover:text-red-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded px-2 py-1"
              >
                Отменить регистрацию
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const UserEventTickets: React.FC = () => {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentStage } = useLoading();
  const { userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasInitialData = useRef(false);
  const isInitialLoad = useRef(true);
  const minFetchInterval = 200; // ms
  const skeletonTimeout = 2000; // ms
  const initialLoadDelay = 200; // ms
  const fetchAttempted = useRef(false);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTime = useRef<number>(0);
  // Add a manual refresh counter for forcing updates
  const refreshCounter = useRef<number>(0);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ticketsContainerRef = useRef<HTMLDivElement>(null);
  const ticketsPerPage = 5; // Увеличиваем число билетов на страницу до 5
  
  // Для предотвращения дублирования запросов в режиме разработки
  const isMounted = useRef(false);
  const isInitialFetchDone = useRef(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>(undefined);

  // Add logging for component lifecycle
  useEffect(() => {
    console.log(`UserEventTickets: Component mounted, current stage: ${currentStage}`);
    isMounted.current = true;
    
    return () => {
      console.log("UserEventTickets: Component unmounted");
      isMounted.current = false;
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, [currentStage]);

  // Listen for navigation and force refresh when the pathname changes
  useEffect(() => {
    if (!isMounted.current) return;
    
    console.log(`UserEventTickets: Pathname changed to ${pathname}`);
    
    // Check if we're on a profile-related page
    if (pathname && (pathname.includes('/profile') || pathname.includes('/account'))) {
      console.log('UserEventTickets: Detected navigation to profile page');
      
      // Сбрасываем состояние загрузки
      setIsLoading(true);
      hasInitialData.current = false;
      isInitialLoad.current = true;
      fetchAttempted.current = false;
      setPage(1);
      setHasMore(true);
      setTickets([]);
      isInitialFetchDone.current = false;
    }
  }, [pathname]);

  // Create a separate effect to handle the actual fetching based on refreshCounter
  useEffect(() => {
    if (!isMounted.current) return;
    
    // Skip initial run to prevent double fetches
    if (refreshCounter.current > 0) {
      console.log(`UserEventTickets: Handling refresh #${refreshCounter.current}`);
      fetchTickets();
    }
  }, [refreshCounter.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log("UserEventTickets: No token found on mount, redirecting to home");
      router.push('/');
    }
  }, [router]);

  // Log stage changes
  useEffect(() => {
    console.log(`UserEventTickets: Stage changed to ${currentStage}`);
  }, [currentStage]);

  // Add scroll event listener for infinite scrolling
  useEffect(() => {
    const container = ticketsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Проверяем, находимся ли мы ближе к концу контейнера (в пределах 100px)
      if (scrollHeight - scrollTop - clientHeight < 100 && !isLoadingMore && hasMore) {
        console.log('UserEventTickets: Scrolled near bottom, loading more tickets');
        loadMoreTickets();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isLoadingMore, hasMore]);

  // Force refresh method
  const forceRefresh = useCallback(() => {
    refreshCounter.current += 1;
    console.log(`UserEventTickets: Manual refresh triggered #${refreshCounter.current}`);
    
    // Reset state but wait a bit before fetching
    setIsLoading(true);
    hasInitialData.current = false;
    fetchAttempted.current = false;
    setPage(1);
    setHasMore(true);
    
    // Wait a very short time before fetching to ensure state updates have time to propagate
    setTimeout(() => {
      fetchTickets();
    }, 50);
  }, []);

  // Effect to fetch tickets when the component mounts or when userData changes
  useEffect(() => {
    // Предотвращаем запросы, если компонент не смонтирован
    if (!isMounted.current) return;
    
    // Проверяем, есть ли данные userData
    if (!userData) {
      console.log('UserEventTickets: No user data yet, waiting...');
      // Если userData еще не загружен, выходим и ждем следующего рендера
      return;
    }
    
    // Предотвращаем повторные запросы при каждом ре-рендере
    if (isInitialFetchDone.current && !isInitialLoad.current) {
      console.log('UserEventTickets: Initial fetch already completed, skipping');
      return;
    }
    
    // Если начальная загрузка уже запланирована, не создаем дублирующие таймеры
    if (fetchAttempted.current) {
      console.log('UserEventTickets: Fetch already scheduled or in progress');
      return;
    }
    
    console.log('UserEventTickets: userData is available, triggering fetch');
    
    // Принудительно обновляем счетчик при изменении userData только если требуется начальная загрузка
    if (!isInitialFetchDone.current) {
      refreshCounter.current += 1;
      fetchAttempted.current = true;
      
      // Небольшая задержка для стабильности
      const timer = setTimeout(() => {
        console.log(`UserEventTickets: Initial data load with userData, refresh #${refreshCounter.current}`);
        fetchTickets();
      }, initialLoadDelay);
      
      return () => {
        clearTimeout(timer);
        fetchAttempted.current = false;
      };
    }
  }, [userData]);

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
      
      // Сохраняем текущие ID билетов перед запросом
      const currentTicketIds = new Set(tickets.map(ticket => ticket.id));
      console.log(`UserEventTickets: Текущее количество билетов: ${currentTicketIds.size}`);
      
      const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        bypassLoadingStageCheck: true,
        params: {
          _nocache: Date.now(), // Добавляем параметры для предотвращения кэширования
          _refresh: refreshCounter.current,
          page: nextPage,
          per_page: ticketsPerPage
        }
      });
      
      console.log('UserEventTickets: Loaded more tickets response:', response);
      
      // Получаем данные в зависимости от формата ответа
      let ticketsData: UserTicket[] = [];
      
      if (Array.isArray(response)) {
        // Если ответ - это прямой массив
        console.log("UserEventTickets: Ответ в формате прямого массива");
        ticketsData = response;
      } else if (response && !("aborted" in response)) {
        if ("data" in response && response.data) {
          // Если ответ в формате {data: [...]}
          console.log("UserEventTickets: Ответ в формате {data: [...]}");
          ticketsData = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
        } else if ("items" in response && response.items) {
          // Если ответ в формате {items: [...]}
          console.log("UserEventTickets: Ответ в формате {items: [...]}");
          ticketsData = Array.isArray(response.items) ? response.items : [response.items as UserTicket];
        } else if ("tickets" in response && response.tickets) {
          // Если ответ в формате {tickets: [...]}
          console.log("UserEventTickets: Ответ в формате {tickets: [...]}");
          ticketsData = Array.isArray(response.tickets) ? response.tickets : [response.tickets as UserTicket];
        }
      }
      
      // Обрабатываем билеты, используя новую функцию processTickets
      const processedTickets = processTickets(ticketsData);
      
      // Фильтруем только новые билеты, которых еще нет в списке
      const newTickets = processedTickets.filter(ticket => !currentTicketIds.has(ticket.id));
      console.log(`UserEventTickets: Новых билетов для добавления: ${newTickets.length}`);
      
      if (newTickets.length > 0) {
        // Добавляем только новые билеты в список
        setTickets(prev => [...prev, ...newTickets]);
        setPage(nextPage);
        
        // Если получили меньше билетов, чем запрашивали, значит больше нет
        setHasMore(newTickets.length >= ticketsPerPage);
      } else {
        console.log('UserEventTickets: Больше новых билетов не найдено');
        setHasMore(false);
      }
    } catch (err) {
      console.error("UserEventTickets: Error loading more tickets", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const fetchTickets = async () => {
    // Предотвращаем запрос, если компонент не смонтирован
    if (!isMounted.current) {
      console.log("UserEventTickets: Компонент не смонтирован, запрос отменен");
      return;
    }
    
    // Предотвращаем дублирование начального запроса в режиме разработки
    if (isInitialFetchDone.current && isInitialLoad.current) {
      console.log("UserEventTickets: Предотвращение дублирования начального запроса");
      isInitialLoad.current = false;
      return;
    }
    
    // Проверяем, прошло ли достаточно времени с последнего запроса
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < minFetchInterval && !isInitialLoad.current) {
      console.log(`UserEventTickets: Слишком частые запросы, последний запрос был ${timeSinceLastFetch}ms назад`);
      return;
    }
    
    // Если запрос уже идет, не запускаем новый
    if (isLoading && fetchAttempted.current) {
      console.log("UserEventTickets: Запрос уже выполняется, дублирование предотвращено");
      return;
    }
    
    // Помечаем попытку запроса
    fetchAttempted.current = true;
    lastFetchTime.current = now;
    console.log(`UserEventTickets: Начало запроса билетов, refreshCounter=${refreshCounter.current}`);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: Токен не найден");
        setError("Необходима авторизация");
        setIsLoading(false);
        router.push('/');
        return;
      }
      
      console.log('UserEventTickets: Выполняется запрос билетов');
      
      // Добавляем уникальный идентификатор для кэширования
      const cacheKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const response = await apiFetch<APIResponse<UserTicket[]>>('/user_edits/my-tickets', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        bypassLoadingStageCheck: true,
        params: {
          _nocache: cacheKey, // Гарантированно уникальный ключ для избежания кэширования
          page: 1,
          per_page: ticketsPerPage
        }
      });
      
      if (response && "aborted" in response) {
        if (response.reason === "loading-stage-mismatch") {
          // Если запрос был отменен из-за несоответствия стадии загрузки, планируем повторную попытку
          console.log("UserEventTickets: Запрос отменен из-за несоответствия стадии загрузки");
          
          if (retryTimeout.current) {
            clearTimeout(retryTimeout.current);
          }
          
          retryTimeout.current = setTimeout(() => {
            console.log("UserEventTickets: Повторная попытка запроса");
            refreshCounter.current += 1;
            fetchTickets();
          }, 1000);
          
          return;
        }
        
        console.log(`UserEventTickets: Запрос отменен, причина: ${response.reason}`);
        setError(`Запрос был прерван: ${response.reason}`);
        setIsLoading(false);
        isInitialLoad.current = false;
        return;
      }
      
      console.log('UserEventTickets: Билеты получены', response);
      
      // Получаем данные в зависимости от формата ответа
      let ticketsData: UserTicket[] = [];
      
      if (Array.isArray(response)) {
        console.log("UserEventTickets: Ответ в формате прямого массива");
        ticketsData = response;
      } else if (response && !("aborted" in response)) {
        if ("data" in response && response.data) {
          console.log("UserEventTickets: Ответ в формате {data: [...]}");
          ticketsData = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
        } else if ("items" in response && response.items) {
          console.log("UserEventTickets: Ответ в формате {items: [...]}");
          ticketsData = Array.isArray(response.items) ? response.items : [response.items as UserTicket];
        } else if ("tickets" in response && response.tickets) {
          console.log("UserEventTickets: Ответ в формате {tickets: [...]}");
          ticketsData = Array.isArray(response.tickets) ? response.tickets : [response.tickets as UserTicket];
        }
      }
      
      if (!ticketsData || ticketsData.length === 0) {
        console.log('UserEventTickets: Билеты не найдены или пустой ответ');
        setTickets([]);
        setError(null);
        hasInitialData.current = true;
        isInitialFetchDone.current = true;
        setIsLoading(false);
        isInitialLoad.current = false;
        return;
      }
      
      console.log(`UserEventTickets: Получено ${ticketsData.length} билетов`);
      
      // Фильтруем активные билеты через одну функцию, которая:
      // 1. Удаляет дубликаты
      // 2. Применяет фильтрацию по статусу
      // 3. Сортирует по статусу и дате
      const processedTickets = processTickets(ticketsData);
      
      console.log(`UserEventTickets: После обработки осталось ${processedTickets.length} уникальных активных билетов`);
      
      // Устанавливаем билеты только один раз
      setTickets(processedTickets);
      setError(null);
      
      // Обновляем флаги для предотвращения повторных запросов
      hasInitialData.current = true;
      isInitialFetchDone.current = true;
      setIsLoading(false);
      isInitialLoad.current = false;
      
      console.log('UserEventTickets: Загрузка билетов завершена успешно');
    } catch (err) {
      console.error('UserEventTickets: Ошибка при загрузке билетов', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных');
      setIsLoading(false);
      isInitialLoad.current = false;
    } finally {
      fetchAttempted.current = false;
    }
  };

  // Add a function to explicitly refresh tickets
  const refreshTickets = useCallback(() => {
    console.log('UserEventTickets: Manual refresh requested');
    refreshCounter.current += 1;
    setIsLoading(true);
    fetchTickets();
  }, [userData]);

  const handleCancelClick = (ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setIsModalOpen(true);
    console.log("UserEventTickets: Opening cancel confirmation for ticket ID:", ticket.id);
  };
  
  const handleCancelConfirm = async () => {
    if (!selectedTicket || !userData) return;
    
    setCancelLoading(true);
    setCancelError(undefined);
    setCancelSuccess(undefined);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCancelError('Необходима авторизация');
        setCancelLoading(false);
        setTimeout(() => {
          setIsModalOpen(false);
          router.push('/');
        }, 1500);
        return;
      }
      
      console.log('Sending cancel request with data:', {
        event_id: selectedTicket.event.id,
        user_id: userData.id
      });
      
      const response = await apiFetch<APIResponse<void>>('/registration/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          event_id: selectedTicket.event.id,
          user_id: userData.id
        }
      });
      
      if (response && "error" in response) {
        // Обработка ошибок
        let errorMessage = response.error || 'Ошибка при отмене регистрации';
        
        // Специальная обработка 401 ошибки
        if (response.status === 401) {
          errorMessage = 'Сессия истекла. Требуется повторная авторизация.';
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          
          setCancelError(errorMessage);
          setCancelLoading(false);
          
          setTimeout(() => {
            setIsModalOpen(false);
            router.push('/');
          }, 1500);
          return;
        }
        
        // Обработка специфических ошибок
        if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
          try {
            const errorObj = JSON.parse(errorMessage);
            if (errorObj.detail) {
              errorMessage = errorObj.detail;
            }
          } catch {
            // Если не удалось распарсить, оставляем исходное сообщение
          }
        }
        
        setCancelError(errorMessage);
        setCancelLoading(false);
        return;
      }
      
      // Успешная отмена
      setCancelSuccess('Регистрация успешно отменена');
      
      // Обновляем состояние билетов
      setTickets(prev => {
        // Если отмена действительно удаляет билет с сервера, удаляем из списка
        if (selectedTicket.status === "pending") {
          return prev.filter(ticket => ticket.id !== selectedTicket.id);
        }
        
        // Иначе обновляем статус этого билета
        return prev.map(ticket => 
          ticket.id === selectedTicket.id 
            ? { ...ticket, status: "cancelled" as UserTicket["status"] } 
            : ticket
        );
      });
      
      // Закрываем модальное окно после небольшой задержки
      setTimeout(() => {
        setIsModalOpen(false);
        setCancelSuccess(undefined);
        setCancelLoading(false);
      }, 1500);
    } catch (err) {
      console.error('Error cancelling registration:', err);
      
      // Обработка ошибок в формате строки
      let errorMessage = err instanceof Error ? err.message : 'Ошибка при отмене регистрации';
      
      // Проверяем ошибку авторизации
      if (err instanceof Error && (
          errorMessage.includes('401') || 
          errorMessage.includes('Unauthorized') || 
          errorMessage.toLowerCase().includes('авториз')
      )) {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        
        setCancelError('Требуется повторная авторизация');
        setCancelLoading(false);
        
        setTimeout(() => {
          setIsModalOpen(false);
          router.push('/');
        }, 1500);
        return;
      }
      
      // Пытаемся извлечь сообщение в формате JSON
      if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
        try {
          const match = errorMessage.match(/{.*}/);
          if (match) {
            const errorData = JSON.parse(match[0]);
            if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          }
        } catch {
          // Если не удалось распарсить, оставляем исходное сообщение
        }
      }
      
      setCancelError(errorMessage);
      setCancelLoading(false);
    }
  };

  // Комплексная функция для обработки билетов:
  // 1. Удаление дубликатов
  // 2. Фильтрация по статусу
  // 3. Сортировка
  const processTickets = (tickets: UserTicket[]): UserTicket[] => {
    // Создаем Map для гарантированной уникальности по ID
    const uniqueTicketsMap = new Map<number, UserTicket>();
    
    // Добавляем только билеты с приоритетным статусом
    tickets.forEach(ticket => {
      const existingTicket = uniqueTicketsMap.get(ticket.id);
      
      // Если такого билета еще нет или текущий имеет более приоритетный статус
      if (!existingTicket || shouldReplaceTicket(existingTicket, ticket)) {
        uniqueTicketsMap.set(ticket.id, ticket);
      }
    });
    
    // Извлекаем уникальные билеты
    const uniqueTickets = Array.from(uniqueTicketsMap.values());
    
    // Фильтруем - удаляем билеты со статусом cancelled
    const activeTickets = uniqueTickets.filter(ticket => ticket.status !== "cancelled");
    
    // Сортируем билеты по статусу и дате
    return sortByStatusAndDate(activeTickets);
  };
  
  // Вспомогательная функция для определения, нужно ли заменить существующий билет новым
  const shouldReplaceTicket = (existing: UserTicket, newTicket: UserTicket): boolean => {
    // Приоритет статусов (от высшего к низшему)
    const statusPriority: Record<string, number> = {
      "confirmed": 0,
      "pending": 1,
      "cancelled": 2,
      "completed": 3
    };
    
    // Сравниваем приоритеты статусов
    return statusPriority[newTicket.status] < statusPriority[existing.status];
  };
  
  // Функция для сортировки билетов по статусу и дате
  const sortByStatusAndDate = (tickets: UserTicket[]): UserTicket[] => {
    // Приоритет статусов (от высшего к низшему)
    const statusPriority: Record<string, number> = {
      "confirmed": 0,
      "pending": 1,
      "cancelled": 2,
      "completed": 3
    };
    
    return [...tickets].sort((a, b) => {
      // Сначала сортируем по статусу
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // Если статусы одинаковые, сортируем по дате начала события (сначала ближайшие)
      const dateA = new Date(a.event.start_date);
      const dateB = new Date(b.event.start_date);
      return dateA.getTime() - dateB.getTime();
    });
  };

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => {
            setIsLoading(true);
            fetchTickets();
          }}
          className="mt-2 text-orange-500 hover:text-orange-600"
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
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <div className="text-xl font-semibold mb-2">У вас пока нет билетов</div>
          <p className="text-gray-500">После покупки, билеты на мероприятия будут отображаться здесь</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end mb-4 w-full overflow-hidden pr-2">
            <span className="text-sm text-gray-500 truncate bg-white px-2 py-1 rounded shadow-sm">
              Загружено: {tickets.length}
            </span>
          </div>
          
          <div className="space-y-4">
            {(() => {
              // Создаем Map для однократной дедупликации билетов
              const uniqueTicketsMap = new Map();
              
              // Добавляем билеты в Map, используя ID как ключ
              tickets.forEach(ticket => {
                uniqueTicketsMap.set(ticket.id, ticket);
              });
              
              // Преобразуем Map обратно в массив
              const uniqueTickets = Array.from(uniqueTicketsMap.values());
              
              // Фильтруем - удаляем билеты со статусом cancelled
              const activeTickets = uniqueTickets.filter(ticket => ticket.status !== "cancelled");
              
              // Сортируем по статусу и дате
              const sortedTickets = sortByStatusAndDate(activeTickets);
              
              // Рендерим только уникальные билеты
              return sortedTickets.map((ticket, index) => {
                // Определяем максимальное количество отмен (по умолчанию 3)
                const maxCancellations = 3;
                // Вычисляем оставшиеся отмены
                const cancellationCount = ticket.cancellation_count || 0;
                const remainingCancellations = maxCancellations - cancellationCount;
                
                // Отладочная информация с однократным выводом
                console.log(`Билет #${ticket.id}: cancellation_count=${ticket.cancellation_count}, remainingCancellations=${remainingCancellations}`);

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
                          {ticket.status !== "completed" && (
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
                                #{ticket.ticket_number || ticket.id.toString()}
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
                    {index < sortedTickets.length - 1 && (
                      <div className="h-[2px] bg-gray-200 my-3 mx-auto w-[70%]"></div>
                    )}
                  </div>
                );
              });
            })()}
            
            {isLoadingMore && (
              <div className="py-4 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-orange-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                  <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Загрузка...</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">Загрузка дополнительных билетов...</p>
              </div>
            )}
          </div>
          
          {/* Confirmation Modal */}
          <ConfirmModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
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
};

export default UserEventTickets;