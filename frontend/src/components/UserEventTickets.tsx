import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck, FaFilter } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { LoadingStage } from '@/contexts/loading/types';
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Определение интерфейса для данных события
interface EventData {
  id: number;
  title: string;
  start_date: string;
  end_date?: string;
  location?: string;
  status: string; // Статус события
}

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

// Типы фильтров для билетов
type TicketFilter = "approved" | "cancelled" | "completed";

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

// Добавляем глобальный кэш для хранения данных между монтированиями
const globalTicketsCache = {
  data: [] as UserTicket[],
  count: 0,
  status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
  lastFetched: 0,
  hasMore: true,
  currentPage: 1,
  
  // Добавляем метод для логирования изменений в кэше
  logCacheUpdate(source: string): void {
    console.log(`TicketsCache: Updated from ${source} - Stats: ${this.data.length} tickets, page ${this.currentPage}, status: ${this.status}, last fetched: ${new Date(this.lastFetched).toLocaleTimeString()}`);
  }
};

// Замена компонента TicketFilters на модальное окно
interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: TicketFilter;
  setActiveFilter: (filter: TicketFilter) => void;
  dateRange: { startDate: string; endDate: string };
  setDateRange: (range: { startDate: string; endDate: string }) => void;
  setUseDateFilter: (use: boolean) => void;
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  activeFilter,
  setActiveFilter,
  dateRange,
  setDateRange,
  setUseDateFilter
}) => {
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  // Локальное состояние для временных значений
  const [tempDateRange, setTempDateRange] = useState(dateRange);
  const [tempFilter, setTempFilter] = useState(activeFilter);
  
  // Блокировка скролла при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      // Сохраняем текущую позицию прокрутки
      const scrollY = window.scrollY;
      // Блокируем прокрутку
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      setTempDateRange(dateRange);
      setTempFilter(activeFilter);
      
      return () => {
        // Восстанавливаем прокрутку при закрытии
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen, dateRange, activeFilter]);

  const filters: { id: TicketFilter; label: string; description: string }[] = [
    { id: "approved", label: "Подтвержденные", description: "Только подтвержденные билеты" },
    { id: "cancelled", label: "Отмененные", description: "Только отмененные билеты" },
    { id: "completed", label: "Завершенные", description: "Билеты мероприятий в статусе завершено" }
  ];

  const handleFilterChange = (filter: TicketFilter) => {
    setTempFilter(filter);
  };
  
  const handleApplyFilters = () => {
    setActiveFilter(tempFilter);
    setDateRange(tempDateRange);
    setUseDateFilter(true); // Всегда устанавливаем в true
    onClose();
  };
  
  const handleResetFilters = () => {
    setTempFilter("approved");
    setTempDateRange({ startDate: '', endDate: '' });
    onClose();
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
            className="bg-white rounded-lg p-5 w-full max-w-lg shadow-xl relative my-8"
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
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Фильтр билетов</h2>
            
            <div className="space-y-5">
              <div>
                <p className="text-sm text-gray-600 mb-3">Выберите статус билетов:</p>
                <div className="grid grid-cols-2 gap-3">
                  {filters.map((filter) => (
                    <div
                      key={filter.id}
                      onClick={() => handleFilterChange(filter.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        tempFilter === filter.id
                          ? "bg-orange-100 border-2 border-orange-500"
                          : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full mr-2 ${
                          tempFilter === filter.id ? "bg-orange-500" : "bg-gray-300"
                        }`} />
                        <div>
                          <h3 className="font-medium text-gray-800">{filter.label}</h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Удаляем переключатель для фильтра по датам */}
              
              {/* Секция выбора диапазона дат - всегда видима */}
              <div className="p-4 rounded-lg border-2 border-orange-500 bg-orange-50">
                <p className="text-sm text-gray-600 mb-3">Фильтр по датам мероприятий:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">С даты:</label>
                    <input 
                      type="date" 
                      value={tempDateRange.startDate}
                      onChange={(e) => setTempDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">По дату:</label>
                    <input 
                      type="date" 
                      value={tempDateRange.endDate}
                      onChange={(e) => setTempDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Сбросить
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 rounded-lg font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                Применить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
  ({ needsRefresh: externalNeedsRefresh, containerRef: externalContainerRef }, ref) => {
  console.log("UserEventTickets: Component function start"); // Лог 5: Начало функции компонента
  const { isAuth, userData } = useAuth();
  const { currentStage, setStage } = useLoadingStage();
  const { error: loadingError, setError: setLoadingError } = useLoadingError();
  const router = useRouter();
  
  // Инициализация состояний с учетом кэша
  const [tickets, setTickets] = useState<UserTicket[]>(() => {
     const cacheIsFresh = Date.now() - globalTicketsCache.lastFetched <= 180000; // 3 минуты
     if (globalTicketsCache.data.length > 0 && cacheIsFresh) {
        console.log("UserEventTickets: Initializing tickets state from fresh cache");
        return globalTicketsCache.data;
     }
     console.log("UserEventTickets: Initializing tickets state as empty (no fresh cache)");
     return [];
  });
  const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>(tickets); // Инициализируем отфильтрованные сразу
  const [page, setPage] = useState(() => globalTicketsCache.currentPage);
  const [hasMore, setHasMore] = useState(() => globalTicketsCache.hasMore);
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
     const cacheIsFresh = Date.now() - globalTicketsCache.lastFetched <= 180000;
     const shouldUseCache = globalTicketsCache.data.length > 0 && cacheIsFresh;
     console.log(`UserEventTickets: Initializing isInitialLoading: ${!shouldUseCache} (shouldUseCache: ${shouldUseCache})`);
     return !shouldUseCache; // Загрузка нужна, только если не используем свежий кэш
  });

  const [isFetching, setIsFetching] = useState(false); // Флаг активного запроса
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const ticketsContainerRef = externalContainerRef || internalContainerRef;
  const ticketsPerPage = 5;
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>(undefined);
  const isTicketBeingCancelled = useRef(false);
  const [showLoadingHint, setShowLoadingHint] = useState(false);

  const [activeFilter, setActiveFilter] = useState<TicketFilter>("approved");
  const [dateRange, setDateRange] = useState({ 
    startDate: '', 
    endDate: ''
  });

  const filters: { id: TicketFilter; label: string; description: string }[] = [
    { id: "approved", label: "Подтвержденные", description: "Только подтвержденные билеты" },
    { id: "cancelled", label: "Отмененные", description: "Только отмененные билеты" },
    { id: "completed", label: "Завершенные", description: "Билеты мероприятий в статусе завершено" }
  ];

  const applyFilter = useCallback((tickets: UserTicket[], filter: TicketFilter) => {
    const filteredByStatus = tickets.filter(ticket => {
      const isEventCompleted = ticket.event.status === "completed";
      
      switch (filter) {
        case "approved":
          return ticket.status === "approved";
        case "cancelled":
          return ticket.status === "cancelled";
        case "completed":
          return ticket.status === "approved" && isEventCompleted;
        default:
          return true;
      }
    });
    
    if (dateRange.startDate && dateRange.endDate) {
      const startFilterDate = new Date(dateRange.startDate);
      startFilterDate.setHours(0, 0, 0, 0);
      
      const endFilterDate = new Date(dateRange.endDate);
      endFilterDate.setHours(23, 59, 59, 999);
      
      return filteredByStatus.filter(ticket => {
        const eventDate = new Date(ticket.event.start_date);
        return eventDate >= startFilterDate && eventDate <= endFilterDate;
      });
    }
    
    return filteredByStatus;
  }, [dateRange]);
  
  useEffect(() => {
    setFilteredTickets(applyFilter(tickets, activeFilter));
  }, [tickets, activeFilter, applyFilter]);

  const shouldReplaceTicket = useCallback((existing: UserTicket, newTicket: UserTicket): boolean => {
    const statusPriority = { "approved": 0, "pending": 1, "cancelled": 2, "rejected": 3 };
    return statusPriority[newTicket.status] < statusPriority[existing.status];
  }, []);
  
  const sortByStatusAndDate = useCallback((tickets: UserTicket[]): UserTicket[] => {
    const statusPriority = { "approved": 0, "pending": 1, "cancelled": 2, "rejected": 3 };
    return [...tickets].sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(a.event.start_date).getTime() - new Date(b.event.start_date).getTime();
    });
  }, []);
  
  const processTickets = useCallback((tickets: UserTicket[]): UserTicket[] => {
    const nonCancelledTickets = tickets.filter(ticket => ticket.status !== "cancelled");
    console.log(`UserEventTickets: Filtered tickets: ${tickets.length - nonCancelledTickets.length} cancelled, ${nonCancelledTickets.length} remaining`);
    
    const uniqueTicketsMap = new Map<number, UserTicket>();
    nonCancelledTickets.forEach(ticket => {
      const existingTicket = uniqueTicketsMap.get(ticket.id);
      if (!existingTicket || shouldReplaceTicket(existingTicket, ticket)) {
        uniqueTicketsMap.set(ticket.id, ticket);
      }
    });
    
    return sortByStatusAndDate(Array.from(uniqueTicketsMap.values()).filter(t => t.status !== "cancelled"));
  }, [shouldReplaceTicket, sortByStatusAndDate]);

  const fetchTickets = useCallback(async (pageToFetch = 1, abortController?: AbortController) => {
    if (!isAuth || !userData || !userData.id) {
      console.log("UserEventTickets: Пользователь не авторизован или нет userData.id, прерывание загрузки билетов.");
      return;
    }
    setStage(LoadingStage.DYNAMIC_CONTENT);
    setLoadingError(null);
    setLocalError(null);
    console.log(`UserEventTickets: Загрузка билетов, страница ${pageToFetch}, userId: ${userData.id}`);

    const token = localStorage.getItem('token');
    if (!token) {
      console.error("UserEventTickets: Токен не найден.");
      setLocalError("Ошибка аутентификации.");
      setStage(LoadingStage.ERROR);
      setLoadingError("Ошибка аутентификации.");
      return;
    }

    try {
      const params: Record<string, string | number> = {
        _nocache: Date.now(),
        page: pageToFetch,
        per_page: ticketsPerPage
      };

      if (activeFilter === "approved") {
        params.status = "approved";
      } else if (activeFilter === "completed") {
        params.status = "cancelled,rejected";
      } else {
        params.status = "approved,pending,cancelled,rejected";
      }
      
      console.log(`UserEventTickets: Fetching tickets with filter "${activeFilter}"`);
      const response = await apiFetch<APIResponse<UserTicket[]>>('/user_edits/my-tickets', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        bypassLoadingStageCheck: true,
        params,
        signal: abortController?.signal
      });
      
      if (!response || response.aborted) {
        console.log("UserEventTickets: Запрос на загрузку билетов прерван.");
        return;
      }
      
      let ticketsData: UserTicket[] = [];
      if (Array.isArray(response)) {
        ticketsData = response;
      } else if (response && !("aborted" in response)) {
        if ("data" in response && response.data) {
          ticketsData = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
        } else if ("items" in response && response.items) {
          ticketsData = Array.isArray(response.items) ? response.items : [response.items as UserTicket];
        } else if ("tickets" in response && response.tickets) {
          ticketsData = Array.isArray(response.tickets) ? response.tickets : [response.tickets as UserTicket];
        }
      }
      
      console.log(`UserEventTickets: Received ${ticketsData.length} tickets`);
      
      const processedTickets = processTickets(ticketsData);
      
      setTickets(processedTickets);
      setPage(pageToFetch);
      setHasMore(processedTickets.length >= ticketsPerPage);
      setIsLoadingMore(false);
      setIsFetching(false);
      setIsInitialLoading(false);
      setLocalError(null);
      
      globalTicketsCache.data = processedTickets;
      globalTicketsCache.count = processedTickets.length;
      globalTicketsCache.status = 'success';
      globalTicketsCache.lastFetched = Date.now();
      globalTicketsCache.hasMore = processedTickets.length >= ticketsPerPage;
      globalTicketsCache.currentPage = pageToFetch;
      globalTicketsCache.logCacheUpdate('fetchTickets');
      
      console.log('UserEventTickets: Ticket loading complete');
      setStage(LoadingStage.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("UserEventTickets: Запрос на загрузку билетов прерван.");
      } else {
        const errorMsg = err instanceof Error ? err.message : "Не удалось загрузить билеты";
        console.error("UserEventTickets: Исключение при загрузке билетов:", err);
        setLocalError(`Критическая ошибка: ${errorMsg}`);
        setLoadingError(errorMsg);
        setStage(LoadingStage.ERROR);
      }
    } finally {
      console.log("UserEventTickets: Завершение fetchTickets finally.");
      if (currentStage !== LoadingStage.ERROR) {
         setStage(LoadingStage.COMPLETED);
      }
      setIsFetching(false);
      setIsInitialLoading(false);
    }
  }, [setStage, processTickets, ticketsPerPage, activeFilter, dateRange, isAuth, userData, setLoadingError, setLocalError, setTickets, setPage, setHasMore, setIsLoadingMore, setIsFetching, setIsInitialLoading, globalTicketsCache]);

  // --- Новый useEffect для инициализации и проверки кэша ---
  useEffect(() => {
    console.log("UserEventTickets: Init useEffect start"); // Лог 6: Начало useEffect инициализации
    if (!isAuth || !userData) {
      console.log("UserEventTickets: Init useEffect - waiting for auth");
      return; // Ждем авторизации
    }

    const cacheIsStale = Date.now() - globalTicketsCache.lastFetched > 180000; // 3 минуты
    const cacheIsEmpty = globalTicketsCache.data.length === 0;

    if (cacheIsEmpty || cacheIsStale) {
       // Только если isInitialLoading все еще true (т.е. мы не загрузились из кэша в useState)
       if (isInitialLoading) {
            if (cacheIsEmpty) {
                console.log('UserEventTickets: Init useEffect - Cache empty, fetching tickets...');
            } else {
                console.log('UserEventTickets: Init useEffect - Cache stale, fetching tickets...');
            }
            fetchTickets(1); // Запускаем начальную загрузку
       } else {
           console.log('UserEventTickets: Init useEffect - Cache stale/empty, but initial load already handled (likely from cache).');
       }
    } else {
      console.log('UserEventTickets: Init useEffect - Using recent cached data.');
      // Если мы дошли сюда, значит кэш свежий и не пустой.
      // Убедимся, что isInitialLoading точно false, если вдруг useState не справился
      if (isInitialLoading) {
          console.warn("UserEventTickets: Init useEffect - Forcing isInitialLoading to false as cache is fresh.");
          setIsInitialLoading(false);
      }
      // Обновим tickets из кэша на случай, если он изменился с момента инициализации useState
      // (маловероятно, но для надежности)
      if (JSON.stringify(tickets) !== JSON.stringify(globalTicketsCache.data)) {
          console.log("UserEventTickets: Init useEffect - Updating tickets state from fresh cache again.");
          setTickets(globalTicketsCache.data);
      }
    }

    // Страховочный таймер
    const safetyTimeout = setTimeout(() => {
      // Проверяем isInitialLoading снова, т.к. fetchTickets мог завершиться
      if (isInitialLoading) {
        console.warn("UserEventTickets: Initial load safety timeout reached while still loading.");
        setIsInitialLoading(false); // Принудительно выключаем лоадер
        if(currentStage === LoadingStage.DYNAMIC_CONTENT) {
           setStage(LoadingStage.COMPLETED); // Считаем условно завершенным
        }
      }
    }, 15000);

    return () => {
      console.log("UserEventTickets: Init useEffect cleanup"); // Лог 7: Очистка useEffect инициализации
      clearTimeout(safetyTimeout)
    };

  }, [isAuth, userData, fetchTickets, isInitialLoading]); // Добавляем isInitialLoading в зависимости, чтобы реагировать на его ИЗМЕНЕНИЕ

  const loadMoreTickets = useCallback(async () => {
    if (isLoadingMore || !hasMore || isFetching) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    
    try {
      await fetchTickets(nextPage);
    } catch (err) {
      console.error("UserEventTickets: Error loading more tickets", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, fetchTickets, isFetching]);

  useEffect(() => {
    const container = ticketsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < scrollHeight * 0.2 && !isLoadingMore && hasMore) {
        loadMoreTickets();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, loadMoreTickets, ticketsContainerRef]);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    
    if (isFetching) {
      timeout = setTimeout(() => {
        setShowLoadingHint(true);
      }, 3000);
    } else {
      setShowLoadingHint(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isFetching]);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isFetching && tickets.length === 0 && !localError && isAuth && userData && isInitialLoading) {
        console.log('UserEventTickets: Auto-retry after long loading');
        fetchTickets(1);
      }
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [isFetching, tickets.length, localError, isAuth, userData, isInitialLoading, fetchTickets]);

  React.useImperativeHandle(ref, () => ({
    refreshTickets: () => {
      if (!isFetching && isAuth && userData && isInitialLoading) {
        console.log('UserEventTickets: Manual refresh via ref');
        fetchTickets(1);
      }
    }
  }), [isFetching, isAuth, userData, isInitialLoading, fetchTickets]);

  useEffect(() => {
    const handleTicketUpdate = (event: Event) => {
      if (!isAuth || isTicketBeingCancelled.current) return;
      
      if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
        return;
      }
      
      if (event instanceof CustomEvent && event.detail) {
        const { source, action, newTicket, needsRefresh } = event.detail;
        
        if (needsRefresh === false) return;
        
        if (source === 'event-registration' && action === 'register' && newTicket) {
          const updatedTickets = [...tickets];
          if (!updatedTickets.some(t => t.id === newTicket.id)) {
            updatedTickets.push(newTicket);
            setTickets(updatedTickets);
            
            globalTicketsCache.data = updatedTickets;
            globalTicketsCache.count = updatedTickets.length;
            globalTicketsCache.logCacheUpdate('ticket-update-event');
          }
          return;
        }
        
        if (!isFetching) {
          fetchTickets();
        }
      }
    };
    
    window.addEventListener('ticket-update', handleTicketUpdate);
    return () => window.removeEventListener('ticket-update', handleTicketUpdate);
  }, [isAuth, isTicketBeingCancelled, tickets, fetchTickets, isFetching]);

  const handleCancelClick = useCallback((ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setIsFilterModalOpen(true);
  }, []);
  
  const handleCancelConfirm = async () => {
    if (!selectedTicket) {
      setCancelError('Не удалось найти выбранный билет');
      return;
    }
    
    isTicketBeingCancelled.current = true;
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setCancelLoading(true);
    setStage(LoadingStage.DYNAMIC_CONTENT);

    const token = localStorage.getItem('token');
    if (!token) {
      setCancelError("Ошибка аутентификации.");
      setCancelLoading(false);
      setStage(LoadingStage.ERROR);
      setLoadingError("Ошибка аутентификации.");
      return;
    }

    try {
      console.log(`UserEventTickets: Попытка отмены билета ID: ${selectedTicket.id}`);
      const response = await apiFetch<APIResponse<any>>(`/tickets/${selectedTicket.id}/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        bypassLoadingStageCheck: true,
        data: {
          event_id: selectedTicket.event.id,
          user_id: userData.id
        }
      });
      
      interface ApiResponse {
        error?: string;
        [key: string]: unknown;
      }
      
      if ((response as ApiResponse)?.error) {
        throw new Error((response as ApiResponse).error || 'Ошибка при отмене билета');
      }
      
      setCancelSuccess('Билет успешно отменен!');
      
      const updatedTickets = tickets.filter(ticket => ticket.id !== selectedTicket.id);
      setTickets(updatedTickets);
      
      globalTicketsCache.data = updatedTickets;
      globalTicketsCache.count = updatedTickets.length;
      globalTicketsCache.logCacheUpdate('handleCancelConfirm');
      
      window.dispatchEvent(new CustomEvent('ticket-update', {
        detail: {
          source: 'user-event-tickets',
          action: 'cancel',
          ticketId: selectedTicket.id,
          eventId: selectedTicket.event.id,
          needsRefresh: false
        }
      }));
      
      setTimeout(() => {
        setIsFilterModalOpen(false);
        setSelectedTicket(null);
        setCancelLoading(false);
        isTicketBeingCancelled.current = false;
      }, 1500);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Не удалось отменить билет';
      console.error(`UserEventTickets: Исключение при отмене билета ${selectedTicket?.id}:`, err);
      setCancelError(errorMsg);
      setLoadingError(errorMsg);
      setStage(LoadingStage.ERROR);
    } finally {
      console.log(`UserEventTickets: Завершение отмены билета ${selectedTicket?.id} finally.`);
      setCancelLoading(false);
      if (currentStage !== LoadingStage.ERROR && !cancelError) {
          setStage(LoadingStage.COMPLETED);
      }
      if (cancelSuccess || cancelError) {
          setTimeout(() => {
              if (cancelSuccess) {
                  handleCancelClick(selectedTicket);
              }
          }, cancelSuccess ? 1500 : 3000);
      } else {
         handleCancelClick(selectedTicket);
      }
    }
  };

  // Отображение скелетонов во время начальной загрузки или загрузки дополнительных страниц
  if (isInitialLoading) { // Показываем скелетон строго во время isInitialLoading
    console.log("UserEventTickets: Rendering skeleton"); // Лог 8: Рендеринг скелетона
    return (
      <div className="space-y-4">
        <TicketSkeleton />
        {showLoadingHint && (
          <div className="text-center mt-4 text-gray-500 text-sm animate-pulse">
            Загрузка билетов может занять некоторое время...
          </div>
        )}
      </div>
    );
  }

  // Отображение ошибки загрузки, если она есть
  if (loadingError) {
    console.log("UserEventTickets: Rendering loading error"); // Лог 9: Рендеринг ошибки
    return (
      <div className="text-center py-4">
        <p className="text-red-500">{loadingError}</p>
        <button
          onClick={fetchTickets}
          className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  console.log(`UserEventTickets: Rendering main content (tickets: ${filteredTickets.length})`); // Лог 10: Рендеринг основного контента
  return (
    <div className="h-full overflow-auto" ref={ticketsContainerRef}>
      {isFetching && tickets.length === 0 ? (
        <div className="p-2">
          <>{console.log("UserEventTickets: Rendering skeleton (isFetching && no tickets)")}</> {/* Лог 11 */}
          <TicketSkeleton />
          {showLoadingHint && (
            <div className="text-center mt-4 text-gray-500 text-sm animate-pulse">
              Загрузка билетов может занять некоторое время...
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FaFilter className="text-orange-500" />
              <span>
                {filters.find((f: {id: TicketFilter}) => f.id === activeFilter)?.label || "Фильтровать"}
                {dateRange.startDate && dateRange.endDate && 
                  ` (${dateRange.startDate.split('-').reverse().join('.')} - ${dateRange.endDate.split('-').reverse().join('.')})`}
              </span>
            </button>
            
            <span className="text-sm text-gray-500 truncate bg-white px-2 py-1 rounded shadow-sm tickets-count">
              Загружено: {filteredTickets.length}
            </span>
          </div>
          
          {localError && tickets.length === 0 && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <p className="text-sm font-medium">{localError}</p>
            </div>
          )}
      
          <div className="space-y-4">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket, index) => {
                const showCancelButton = ticket.status !== "rejected";

                return (
                  <div key={`ticket-${ticket.id}`}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
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
                        <div className="flex-shrink-0 w-[90px] flex items-center justify-center">
                          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-2 shadow-sm h-full flex">
                            <div className="flex-1 flex items-center justify-center pr-1 border-r border-orange-200">
                              <p className="[writing-mode:vertical-rl] rotate-180 text-xs text-gray-500 uppercase font-medium">
                                НОМЕР БИЛЕТА
                              </p>
                            </div>
                            
                            <div className="flex-1 flex items-center justify-center pl-1">
                              <p className="[writing-mode:vertical-rl] rotate-180 text-xl font-bold text-orange-600">
                                #{ticket.ticket_number || ticket.id}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-1 ml-3">
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
                            
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <FaRegCalendarCheck className="text-orange-500 flex-shrink-0 mt-1" />
                              <span className="break-words">Забронировано: {formatDateForDisplay(ticket.registration_date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    {index < filteredTickets.length - 1 && (
                      <div className="h-[2px] bg-gray-200 my-3 mx-auto w-[70%]"></div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <div className="bg-orange-50 rounded-full p-4 mb-4">
                  <FaTicketAlt className="text-orange-500 text-3xl" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Билеты не найдены</h3>
                <p className="text-gray-500 text-center max-w-md">
                  По выбранным параметрам фильтра не найдено билетов. Попробуйте изменить настройки фильтра или проверьте наличие билетов позже.
                </p>
              </div>
            )}
          </div>
          
          {isLoadingMore && (
            <div className="py-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-orange-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Загрузка...</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Загрузка дополнительных билетов...</p>
            </div>
          )}
          
          <FilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            setUseDateFilter={() => {}}
          />
        </>
      )}
    </div>
  );
  }
);

UserEventTickets.displayName = 'UserEventTickets';

export default UserEventTickets;