import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck, FaFilter } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading } from "@/contexts/LoadingContextLegacy";
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
  ({ needsRefresh, forceUpdateTrigger = 0, containerRef }, ref) => {
  // Упрощенное состояние с использованием кэша
  const [tickets, setTickets] = useState<UserTicket[]>(globalTicketsCache.data);
  const [isLoading, setIsLoading] = useState(globalTicketsCache.data.length === 0);
  const [error, setError] = useState<string | null>(null);
  const { setDynamicLoading } = useLoading();
  const { userData } = useAuth();
  const router = useRouter();
  
  // Состояние фильтра - по умолчанию "approved"
  const [activeFilter, setActiveFilter] = useState<TicketFilter>("approved");
  const [dateRange, setDateRange] = useState({ 
    startDate: '', 
    endDate: ''
  });
  const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>(tickets);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Определение фильтров - нужно для отображения названия текущего фильтра в кнопке
  const filters: { id: TicketFilter; label: string; description: string }[] = [
    { id: "approved", label: "Подтвержденные", description: "Только подтвержденные билеты" },
    { id: "cancelled", label: "Отмененные", description: "Только отмененные билеты" },
    { id: "completed", label: "Завершенные", description: "Билеты мероприятий в статусе завершено" }
  ];
  
  // Базовые флаги
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  const mountCount = useRef(0);
  
  // Пагинация
  const [page, setPage] = useState(globalTicketsCache.currentPage);
  const [hasMore, setHasMore] = useState(globalTicketsCache.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const ticketsContainerRef = containerRef || internalContainerRef;
  const ticketsPerPage = 5;
  
  // Модальное окно
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>(undefined);
  const isTicketBeingCancelled = useRef(false);
  
  // Отображение подсказки о длительной загрузке
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  
  // Функция для применения фильтров к билетам
  const applyFilter = useCallback((tickets: UserTicket[], filter: TicketFilter) => {
    // Сначала применяем фильтрацию по статусу
    const filteredByStatus = tickets.filter(ticket => {
      // Проверяем статус события для фильтра "completed"
      const isEventCompleted = ticket.event.status === "completed";
      
      switch (filter) {
        case "approved":
          // Подтвержденные билеты
          return ticket.status === "approved";
        case "cancelled":
          // Отмененные билеты
          return ticket.status === "cancelled";
        case "completed":
          // Завершенные билеты (мероприятия имеют статус completed)
          return ticket.status === "approved" && isEventCompleted;
        default:
          return true;
      }
    });
    
    // Затем, если задан диапазон дат, фильтруем по датам
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
  
  // Обновляем отфильтрованные билеты при изменении фильтра или списка билетов
  useEffect(() => {
    setFilteredTickets(applyFilter(tickets, activeFilter));
  }, [tickets, activeFilter, applyFilter]);

  // Отслеживаем монтирование/размонтирование компонента
  useEffect(() => {
    mountCount.current += 1;
    console.log(`UserEventTickets: Component mounted, mount #${mountCount.current}`);
    isMounted.current = true;
    
    return () => {
      console.log(`UserEventTickets: Component unmounting, mount #${mountCount.current}`);
      isMounted.current = false;
      
      // Сбрасываем состояние загрузки при размонтировании
      if (isLoading) {
        setDynamicLoading(false);
      }
    };
  }, [isLoading, setDynamicLoading]);

  // Функции обработки билетов
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

  // Функция загрузки билетов
  const fetchTickets = useCallback(async () => {
    if (fetchInProgress.current || !isMounted.current) {
      console.log("UserEventTickets: Skip fetch - already in progress or unmounted");
      return;
    }
    
    fetchInProgress.current = true;
    setIsLoading(true);
    setDynamicLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: No token found");
        setError("Необходима авторизация");
        setIsLoading(false);
        setDynamicLoading(false);
        router.push('/');
        return;
      }
      
      // Если фильтр не "all", передаем статус в параметры запроса
      const params: Record<string, string | number> = {
        _nocache: Date.now(),
        page: 1,
        per_page: ticketsPerPage
      };

      // Добавляем фильтр по статусу в зависимости от выбранного фильтра
      if (activeFilter === "approved") {
        params.status = "approved";
      } else if (activeFilter === "completed") {
        params.status = "cancelled,rejected";
      } else {
        // Для всех остальных случаев получаем все билеты
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
        params
      });
      
      if (!isMounted.current) return;
      
      console.log('UserEventTickets: Tickets received', response);
      
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
      
      // Обновляем локальное состояние
      setTickets(processedTickets);
      setPage(1);
      setHasMore(processedTickets.length >= ticketsPerPage);
      setIsLoading(false);
      setDynamicLoading(false);
      setError(null);
      
      // Обновляем глобальный кэш
      globalTicketsCache.data = processedTickets;
      globalTicketsCache.count = processedTickets.length;
      globalTicketsCache.status = 'success';
      globalTicketsCache.lastFetched = Date.now();
      globalTicketsCache.hasMore = processedTickets.length >= ticketsPerPage;
      globalTicketsCache.currentPage = 1;
      globalTicketsCache.logCacheUpdate('fetchTickets');
      
      console.log('UserEventTickets: Ticket loading complete');
    } catch (err) {
      console.error('UserEventTickets: Error loading tickets', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных');
        setIsLoading(false);
        setDynamicLoading(false);
        
        globalTicketsCache.status = 'error';
        globalTicketsCache.logCacheUpdate('fetchTickets-error');
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, [setDynamicLoading, router, processTickets, ticketsPerPage, activeFilter]);
  
  // Загрузка дополнительных билетов при прокрутке
  const loadMoreTickets = useCallback(async () => {
    if (isLoadingMore || !hasMore || fetchInProgress.current) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("Необходима авторизация");
        setIsLoadingMore(false);
        return;
      }
      
      const currentTicketIds = new Set(tickets.map(ticket => ticket.id));
      
      // Применяем те же параметры фильтрации, что и в основном запросе
      const params: Record<string, string | number> = {
        _nocache: Date.now(),
        page: nextPage,
        per_page: ticketsPerPage
      };

      // Добавляем фильтр по статусу в зависимости от выбранного фильтра
      if (activeFilter === "approved") {
        params.status = "approved";
      } else if (activeFilter === "completed") {
        params.status = "cancelled,rejected";
      } else {
        // Для всех остальных случаев получаем все билеты
        params.status = "approved,pending,cancelled,rejected";
      }
      
      const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
        bypassLoadingStageCheck: true,
        params
      });
      
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
      
      const processedTickets = processTickets(ticketsData);
      const newTickets = processedTickets.filter(ticket => !currentTicketIds.has(ticket.id));
      
      if (newTickets.length > 0) {
        const updatedTickets = [...tickets, ...newTickets];
        setTickets(updatedTickets);
        setPage(nextPage);
        setHasMore(newTickets.length >= ticketsPerPage);
        
        globalTicketsCache.data = updatedTickets;
        globalTicketsCache.count = updatedTickets.length;
        globalTicketsCache.hasMore = newTickets.length >= ticketsPerPage;
        globalTicketsCache.currentPage = nextPage;
        globalTicketsCache.logCacheUpdate('loadMoreTickets');
      } else {
        setHasMore(false);
        globalTicketsCache.hasMore = false;
        globalTicketsCache.logCacheUpdate('loadMoreTickets-no-more');
      }
    } catch (err) {
      console.error("UserEventTickets: Error loading more tickets", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, tickets, processTickets, setError, setTickets, setPage, setHasMore, ticketsPerPage, activeFilter]);

  // Слушатель прокрутки для бесконечной загрузки
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
  
  // Отображение подсказки при длительной загрузке
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      timeout = setTimeout(() => {
        setShowLoadingHint(true);
      }, 3000);
    } else {
      setShowLoadingHint(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading]);
  
  // Автоматическая попытка восстановления после длительной загрузки
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && tickets.length === 0 && !error && isMounted.current) {
        console.log('UserEventTickets: Auto-retry after long loading');
        fetchInProgress.current = false;
        fetchTickets();
      }
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [isLoading, tickets.length, error, fetchTickets]);

  // Метод для обновления билетов из родительского компонента
  React.useImperativeHandle(ref, () => ({
    refreshTickets: () => {
      if (!fetchInProgress.current && isMounted.current) {
        console.log('UserEventTickets: Manual refresh via ref');
        fetchTickets();
      }
    }
  }), [fetchTickets]);

  // Слушатель событий обновления билетов
  useEffect(() => {
    const handleTicketUpdate = (event: Event) => {
      if (!isMounted.current || isTicketBeingCancelled.current) return;
      
      if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
        return; // Игнорируем собственные события
      }
      
      if (event instanceof CustomEvent && event.detail) {
        const { source, action, newTicket, needsRefresh } = event.detail;
        
        if (needsRefresh === false) return;
        
        if (source === 'event-registration' && action === 'register' && newTicket) {
          // Добавляем новый билет
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
        
        // Для всех остальных событий делаем полное обновление
        if (!fetchInProgress.current) {
          fetchTickets();
        }
      }
    };
    
    window.addEventListener('ticket-update', handleTicketUpdate);
    return () => window.removeEventListener('ticket-update', handleTicketUpdate);
  }, [fetchTickets, tickets]);

  // Основной эффект инициализации
  useEffect(() => {
    // У нас уже есть кэшированные данные?
    if (globalTicketsCache.data.length > 0) {
      // Проверяем, нужно ли обновить (старше 3 минут)
      const needsRefresh = Date.now() - globalTicketsCache.lastFetched > 180000;
      
      if (needsRefresh && !fetchInProgress.current) {
        console.log('UserEventTickets: Cached data is stale, refreshing');
        fetchTickets();
      } else {
        console.log('UserEventTickets: Using recent cached data');
        setIsLoading(false);
      }
    } else {
      // Нет данных - загружаем
      console.log('UserEventTickets: No cached data, fetching tickets');
      fetchTickets();
    }
    
    // Безопасный таймаут для сброса состояния загрузки
    const safetyTimeout = setTimeout(() => {
      if (isMounted.current && isLoading) {
        setIsLoading(false);
        setDynamicLoading(false);
      }
    }, 15000);
    
    return () => clearTimeout(safetyTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Обработка forceUpdateTrigger и needsRefresh
  useEffect(() => {
    if (!isMounted.current) return;
    
    if (forceUpdateTrigger > 0 && !fetchInProgress.current && !isTicketBeingCancelled.current) {
      console.log(`UserEventTickets: Force update #${forceUpdateTrigger}`);
      fetchTickets();
    }
    
    if (needsRefresh?.current && !fetchInProgress.current && !isTicketBeingCancelled.current) {
      console.log('UserEventTickets: needsRefresh is true');
      needsRefresh.current = false;
      fetchTickets();
    }
  }, [forceUpdateTrigger, needsRefresh, fetchTickets]);
  
  // Обработка отмены билета
  const handleCancelClick = useCallback((ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setIsModalOpen(true);
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
    
    try {
      if (!userData) throw new Error('Пользователь не авторизован');
      
      const response = await apiFetch(`/registration/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        bypassLoadingStageCheck: true,
        data: {
          event_id: selectedTicket.event.id,
          user_id: userData.id  // Добавляем user_id в запрос, так как его ожидает бэкенд
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
      
      // Обновляем локальное состояние
      const updatedTickets = tickets.filter(ticket => ticket.id !== selectedTicket.id);
      setTickets(updatedTickets);
      
      // Обновляем глобальный кэш
      globalTicketsCache.data = updatedTickets;
      globalTicketsCache.count = updatedTickets.length;
      globalTicketsCache.logCacheUpdate('handleCancelConfirm');
      
      // Оповещаем приложение
      window.dispatchEvent(new CustomEvent('ticket-update', {
        detail: {
          source: 'user-event-tickets',
          action: 'cancel',
          ticketId: selectedTicket.id,
          eventId: selectedTicket.event.id,
          needsRefresh: false
        }
      }));
      
      // Закрываем модальное окно
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setCancelLoading(false);
        isTicketBeingCancelled.current = false;
      }, 1500);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Не удалось отменить билет');
      setCancelLoading(false);
      isTicketBeingCancelled.current = false;
    }
  };

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchTickets}
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
      ) : (
        <>
          {/* Кнопка для открытия модального окна фильтрации */}
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
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <p className="text-sm font-medium">{error}</p>
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
          
          {/* Модальное окно для подтверждения отмены билета */}
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
          
          {/* Модальное окно фильтрации */}
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

// Добавляем displayName для улучшения отладки
UserEventTickets.displayName = 'UserEventTickets';

// Экспортируем оригинальный компонент
export default UserEventTickets;