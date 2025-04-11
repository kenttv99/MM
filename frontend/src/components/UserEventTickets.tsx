import { useEffect, useState, useRef, useCallback, forwardRef, ForwardedRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck, FaFilter, FaSearch } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { EventData } from "@/types/events";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MdCalendarToday, MdLocationOn, MdConfirmationNumber, MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import React from "react";

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
  status: "pending" | "confirmed" | "cancelled" | "completed" | "approved";
  cancellation_count?: number;
  ticket_number?: string;
}

// Интерфейс для фильтров
interface TicketFilters {
  status: string[];
  dateFrom: string | null;
  dateTo: string | null;
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
    case "approved":
      return "bg-green-100 text-green-800"; // Используем тот же стиль, что и для confirmed
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

const getStatusText = (status: UserTicket["status"], eventStatus?: string) => {
  // Проверяем, завершено ли мероприятие
  if (eventStatus === "completed" && status !== "cancelled") {
    return "Завершенный";
  }
  
  switch (status) {
    case "confirmed":
      return "Подтвержденный";
    case "approved":
      return "Подтвержденный"; // "Approved" и "Confirmed" переводим как "Подтвержденный"
    case "cancelled":
      return "Отмененный";
    case "completed":
      return "Завершенный";
    case "pending":
      return "В ожидании";
    default:
      return status;
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
          {getStatusText(ticket.status, ticket.event.status)}
        </span>
      </div>
      
      <div className="flex">
        {/* Ticket number section */}
        <div className="flex-shrink-0 flex items-center justify-center mr-3">
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
                #{ticket.ticket_number || ticket.id}
              </p>
            </div>
          </div>
        </div>
        
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

// Add interface for component props
interface UserEventTicketsProps {
  needsRefresh?: React.MutableRefObject<boolean>;
  forceUpdateTrigger?: number;
}

// Define the ref methods interface
export interface UserEventTicketsRef {
  refreshTickets: () => void;
}

// Контекст для фильтров
interface FiltersContextType {
  filters: TicketFilters;
  setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
}

const FiltersContext = React.createContext<FiltersContextType | undefined>(undefined);

// Хук для использования контекста фильтров
const useFilters = () => {
  const context = React.useContext(FiltersContext);
  if (!context) {
    throw new Error('useFilters must be used within a FiltersProvider');
  }
  return context;
};

// Компонент панели фильтров (модернизированная версия)
const FilterPanel: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  onFilterChange?: (filters: TicketFilters) => void 
}> = ({ isOpen, onClose, onFilterChange }) => {
  const { filters, setFilters } = useFilters();
  const [localFilters, setLocalFilters] = useState<TicketFilters>({...filters});
  
  // При открытии модального окна загружаем текущие фильтры
  useEffect(() => {
    if (isOpen) {
      setLocalFilters({...filters});
    }
  }, [isOpen, filters]);

  // Обработчики изменения фильтров
  const handleStatusChange = (status: string) => {
    const newStatus = [...localFilters.status];
    const index = newStatus.indexOf(status);
    
    if (index === -1) {
      newStatus.push(status);
    } else {
      newStatus.splice(index, 1);
    }
    
    setLocalFilters({...localFilters, status: newStatus});
  };

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setLocalFilters({...localFilters, [field]: value || null});
  };
  
  // Применение фильтров
  const applyFilters = () => {
    console.log('FilterPanel: Применяем фильтры:', localFilters);
    console.log('FilterPanel: Активны фильтры по статусам:', localFilters.status);
    setFilters(localFilters);
    
    // Принудительное обновление отфильтрованных билетов
    if (onFilterChange) onFilterChange(localFilters);
    
    // Закрываем модальное окно
    onClose();
  };
  
  // Сброс фильтров
  const resetFilters = () => {
    const resetValues = { status: ['confirmed'], dateFrom: null, dateTo: null };
    setLocalFilters(resetValues);
  };

  if (!isOpen) return null;

  const modalVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-30 pt-20 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-xl p-5 shadow-xl w-full max-w-md"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">Фильтры билетов</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <FaTimesCircle size={20} />
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Фильтр по статусу */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-gray-700 border-b pb-2">Статус билета</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg p-3 cursor-pointer transition-all ${
                  localFilters.status.includes('confirmed') 
                    ? 'bg-orange-100 border-2 border-orange-300' 
                    : 'bg-gray-50 border-2 border-gray-100 hover:bg-gray-100'
                }`} onClick={() => handleStatusChange('confirmed')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Подтвержденные</span>
                    {localFilters.status.includes('confirmed') && (
                      <span className="text-orange-500">✓</span>
                    )}
                  </div>
                  <div className="h-2 w-full bg-green-200 rounded-full"></div>
                </div>
                
                <div className={`rounded-lg p-3 cursor-pointer transition-all ${
                  localFilters.status.includes('completed') 
                    ? 'bg-orange-100 border-2 border-orange-300' 
                    : 'bg-gray-50 border-2 border-gray-100 hover:bg-gray-100'
                }`} onClick={() => handleStatusChange('completed')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Завершенные</span>
                    {localFilters.status.includes('completed') && (
                      <span className="text-orange-500">✓</span>
                    )}
                  </div>
                  <div className="h-2 w-full bg-gray-300 rounded-full"></div>
                </div>
                
                <div className={`rounded-lg p-3 cursor-pointer transition-all ${
                  localFilters.status.includes('cancelled') 
                    ? 'bg-orange-100 border-2 border-orange-300' 
                    : 'bg-gray-50 border-2 border-gray-100 hover:bg-gray-100'
                }`} onClick={() => handleStatusChange('cancelled')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Отмененные</span>
                    {localFilters.status.includes('cancelled') && (
                      <span className="text-orange-500">✓</span>
                    )}
                  </div>
                  <div className="h-2 w-full bg-red-200 rounded-full"></div>
                </div>
              </div>
            </div>
            
            {/* Фильтр по дате */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-gray-700 border-b pb-2">Дата бронирования</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-24 flex-shrink-0">
                    <label className="block text-xs text-gray-500">С даты</label>
                  </div>
                  <div className="flex-grow">
                    <input
                      type="date"
                      value={localFilters.dateFrom || ''}
                      onChange={(e) => handleDateChange('dateFrom', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-24 flex-shrink-0">
                    <label className="block text-xs text-gray-500">По дату</label>
                  </div>
                  <div className="flex-grow">
                    <input
                      type="date"
                      value={localFilters.dateTo || ''}
                      onChange={(e) => handleDateChange('dateTo', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Кнопки действий */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
            <button 
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
            >
              Сбросить
            </button>
            <div className="space-x-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={applyFilters}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-colors"
              >
                Применить
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Convert to forwardRef with imperative handle
const UserEventTickets = forwardRef<UserEventTicketsRef, UserEventTicketsProps>(
  ({ needsRefresh, forceUpdateTrigger }, ref) => {
    const [tickets, setTickets] = useState<UserTicket[]>([]);
    const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelError, setCancelError] = useState<string | undefined>();
    const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
    const [ticketsCount, setTicketsCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    // Настройки фильтров - по умолчанию показываем подтвержденные билеты
    const [filters, setFilters] = useState<TicketFilters>({
      status: ['confirmed'],
      dateFrom: null,
      dateTo: null
    });

    const { isAuth, userData } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { setDynamicLoading, currentStage } = useLoading();
    const ticketsPerPage = 10;
    const minFetchInterval = 200;
    const initialLoadDelay = 200;
    const lastFetchTime = useRef<number>(0);
    
    const isMounted = useRef(true);
    const fetchAttempted = useRef(false);
    const refreshCounter = useRef(0);
    const isInitialFetchDone = useRef(false);
    const hasInitialData = useRef(false);
    const isInitialLoad = useRef(true);
    const retryTimeout = useRef<NodeJS.Timeout | null>(null);
    const isTicketBeingCancelled = useRef(false);
    const ticketsContainerRef = useRef<HTMLDivElement>(null);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
    
    // Создаем значение контекста
    const filtersContextValue = { filters, setFilters };

    // Функция для последовательного применения всех фильтров к списку билетов
    const applyAllFilters = useCallback((ticketsToFilter: UserTicket[]) => {
      if (!ticketsToFilter.length) return [];
      
      console.log(`UserEventTickets: Применяем фильтры к ${ticketsToFilter.length} билетам`);
      let result = [...ticketsToFilter];
      
      // Отладочная информация перед фильтрацией
      console.log('UserEventTickets: Билеты перед фильтрацией:', result.map(t => ({
        id: t.id,
        status: t.status,
        event_status: t.event?.status,
        title: t.event?.title
      })));
      console.log('UserEventTickets: Текущий фильтр статусов:', filters.status);
      
      // Применяем фильтр по статусу
      if (filters.status.length > 0) {
        result = result.filter(ticket => {
          // Проверяем наличие данных
          if (!ticket || !ticket.event) {
            console.log('UserEventTickets: Пропускаем билет без данных');
            return false;
          }
          
          // Определяем эффективный статус билета (с учетом статуса мероприятия)
          let effectiveStatus = ticket.status;
          
          // Если мероприятие завершено и билет не отменен, считаем его завершенным
          if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
            effectiveStatus = "completed";
          }
          
          // Проверяем соответствие эффективного статуса выбранным фильтрам
          let matches = filters.status.includes(effectiveStatus);
          
          // Специальная обработка для статуса "approved"
          if (effectiveStatus === "approved" && filters.status.includes("confirmed")) {
            console.log(`UserEventTickets: Билет ${ticket.id} со статусом approved соответствует фильтру confirmed`);
            matches = true;
          }
          
          console.log(`UserEventTickets: Билет ${ticket.id} для ${ticket.event.title} статус ${ticket.status} (эффективный: ${effectiveStatus}) соответствует фильтру: ${matches}`);
          return matches;
        });
      }
      
      // Отладочная информация после фильтрации
      console.log(`UserEventTickets: После фильтрации по статусу осталось ${result.length} билетов`);
      console.log('UserEventTickets: Билеты после фильтрации:', result.map(t => ({
        id: t.id,
        status: t.status,
        event_status: t.event?.status,
        title: t.event?.title
      })));

      // Применяем фильтр по дате бронирования
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        result = result.filter(ticket => {
          if (!ticket || !ticket.registration_date) return false;
          const regDate = new Date(ticket.registration_date);
          return regDate >= fromDate;
        });
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        // Устанавливаем время конца дня
        toDate.setHours(23, 59, 59, 999);
        result = result.filter(ticket => {
          if (!ticket || !ticket.registration_date) return false;
          const regDate = new Date(ticket.registration_date);
          return regDate <= toDate;
        });
      }
      
      // Сортируем отфильтрованные билеты
      return sortByStatusAndDate(result);
    }, [filters]);

    // Modified ticket update event listener to better handle external events
    useEffect(() => {
      const handleTicketUpdate = (event: Event) => {
        // Skip if this event was triggered by this component
        if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
          console.log('UserEventTickets: Ignoring our own ticket-update event');
          return;
        }
        
        // Do not process events while a ticket is being cancelled
        if (isTicketBeingCancelled.current) {
          console.log('UserEventTickets: Skipping ticket-update event during active cancellation');
          return;
        }
        
        console.log('UserEventTickets: External ticket-update event received');
        
        // Handle event with detailed ticket data
        if (event instanceof CustomEvent && event.detail) {
          const { source, action, newTicket, eventId, ticketId, needsRefresh } = event.detail;
          
          console.log(`UserEventTickets: Event details - source: ${source}, action: ${action}, needsRefresh: ${needsRefresh}`);
          
          // Explicitly check the needsRefresh flag and log for debugging
          if (needsRefresh === false) {
            console.log('UserEventTickets: needsRefresh is explicitly false, skipping refresh');
            return;
          }
          
          // If the refresh flag is modified elsewhere and this is an external cancel event,
          // we should still avoid refreshing since we've already handled it locally
          if (source !== 'user-event-tickets' && action === 'cancel' && ticketId) {
            console.log(`UserEventTickets: External cancel received for ticket ${ticketId} - no refresh needed`);
            return;
          }
          
          // Handle registration events with complete ticket data
          if (source === 'event-registration' && action === 'register' && newTicket) {
            console.log('UserEventTickets: Received new ticket registration data:', newTicket);
            
            // Add the new ticket directly to the state without a full reload
            setTickets(prev => {
              // Check if we already have this ticket
              if (prev.some(t => t.id === newTicket.id)) {
                console.log('UserEventTickets: Ticket already exists, not adding duplicate');
                return prev;
              }
              
              // Add the new ticket and process it
              console.log('UserEventTickets: Adding new ticket to state');
              return [...prev, newTicket];
            });
            
            // Mark data as loaded
            hasInitialData.current = true;
            isInitialFetchDone.current = true;
            return;
          }
        }
        
        // For other events, we'll do a full refresh only if not in the process of cancelling
        if (!isTicketBeingCancelled.current) {
          console.log('UserEventTickets: External event requires refresh - will fetchTickets()');
          refreshCounter.current += 1;
          fetchTickets();
        }
      };
      
      window.addEventListener('ticket-update', handleTicketUpdate);
      
      return () => {
        window.removeEventListener('ticket-update', handleTicketUpdate);
      };
    }, []);

    // Process tickets when they are fetched - modified to avoid recursion
    useEffect(() => {
      if (tickets.length > 0) {
        console.log('UserEventTickets: Processing tickets data', { count: tickets.length });
        
        // Group tickets by event_id to remove duplicates
        const ticketsByEvent = {};
        
        // First pass: group by event ID
        tickets.forEach(ticket => {
          const eventId = ticket.event.id;
          
          // Не фильтруем отмененные билеты здесь, оставляем это для applyAllFilters
          if (!ticketsByEvent[eventId] || new Date(ticket.created_at) > new Date(ticketsByEvent[eventId].created_at)) {
            ticketsByEvent[eventId] = ticket;
          }
        });
        
        console.log('UserEventTickets: Grouped tickets by event', { count: Object.keys(ticketsByEvent).length });
        
        // Convert to array
        let uniqueTickets = Object.values(ticketsByEvent);
        console.log('UserEventTickets: Unique tickets before filtering', { count: uniqueTickets.length });
        
        // Больше не фильтруем здесь отмененные билеты, оставляем это для applyAllFilters
        const sortedTickets = sortByStatusAndDate(uniqueTickets);
        
        // IMPORTANT: Skip updating state if processed tickets are the same length as current tickets
        // This prevents unnecessary re-renders and potential infinite loops
        if (sortedTickets.length !== tickets.length) {
          // Update tickets count separately to avoid triggering this effect again
          setTicketsCount(sortedTickets.length);
          // Update tickets state with processed tickets
          setTickets(sortedTickets);
        }
      }
    }, []); // Empty dependencies to run only once after initial tickets are set

    // Применяем фильтры при изменении билетов или фильтров
    useEffect(() => {
      if (tickets.length > 0) {
        console.log('UserEventTickets: Изменились фильтры или список билетов, обновляем фильтрацию');
        const filtered = applyAllFilters(tickets);
        console.log(`UserEventTickets: После фильтрации получены билеты: `, 
          filtered.map(t => ({id: t.id, status: t.status, title: t.event?.title})));
        setFilteredTickets(filtered);
      } else {
        setFilteredTickets([]);
      }
    }, [tickets, filters, applyAllFilters]);

    // Add a useEffect specifically for updating the tickets count display
    useEffect(() => {
      // Set timeout to ensure this runs after state updates
      const timer = setTimeout(() => {
        const countDisplay = document.querySelector(".tickets-count");
        if (countDisplay) {
          countDisplay.textContent = `Загружено: ${filteredTickets.length || 0}`;
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }, [filteredTickets.length]); // Зависимость от длины отфильтрованных билетов вместо общего счетчика

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

    // Modify the useEffect for pathname changes to avoid unnecessary state resets
    useEffect(() => {
      if (!isMounted.current) return;
      
      console.log(`UserEventTickets: Pathname changed to ${pathname}`);
      
      // Check if we're on a profile-related page
      if (pathname && (pathname.includes('/profile') || pathname.includes('/account'))) {
        console.log('UserEventTickets: Detected navigation to profile page');
        
        // Only reset state if we haven't fetched data before
        if (!hasInitialData.current && !isInitialFetchDone.current) {
          console.log('UserEventTickets: First time on profile page - initializing');
          setIsLoading(true);
          hasInitialData.current = false;
          isInitialLoad.current = true;
          fetchAttempted.current = false;
          setPage(1);
          setHasMore(true);
          setTickets([]);
          isInitialFetchDone.current = false;
        } else {
          console.log('UserEventTickets: Already initialized - avoiding full reset');
        }
      }
    }, [pathname]);

    // Check authentication on mount
    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: No token found on mount, redirecting to home");
        router.push('/');
      }
    }, [router]);

    // Обработчик обновления счетчика refreshCounter
    useEffect(() => {
      if (!isMounted.current || refreshCounter.current === 0) return;
      
      console.log(`UserEventTickets: Handling refresh #${refreshCounter.current}`);
      
      // Предотвращаем дублирование запросов, проверяя время с последнего вызова
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime.current;
      
      if (timeSinceLastFetch < minFetchInterval && !isInitialLoad.current) {
        console.log(`UserEventTickets: Слишком частые запросы, последний запрос был ${timeSinceLastFetch}ms назад. Пропускаем запрос #${refreshCounter.current}`);
        return;
      }
      
      // Если запрос уже идет, не запускаем новый
      if (fetchAttempted.current) {
        console.log(`UserEventTickets: Запрос уже выполняется, пропускаем запрос #${refreshCounter.current}`);
        return;
      }
      
      // Устанавливаем маркер последнего запроса
      lastFetchTime.current = now;
      
      // Выполняем запрос
      fetchTickets();
    }, [refreshCounter.current]); // eslint-disable-line react-hooks/exhaustive-deps

    // Log stage changes
    useEffect(() => {
      console.log(`UserEventTickets: Stage changed to ${currentStage}`);
    }, [currentStage]);

    // Инициализация загрузки при получении userData
    useEffect(() => {
      // Предотвращаем запросы, если компонент не смонтирован
      if (!isMounted.current) return;
      
      // Проверяем, есть ли данные userData
      if (!userData) {
        console.log('UserEventTickets: No user data yet, waiting...');
        return;
      }
      
      // Предотвращаем повторные запросы при каждом ре-рендере
      if (isInitialFetchDone.current) {
        console.log('UserEventTickets: Initial fetch already completed, skipping');
        return;
      }
      
      // Если начальная загрузка уже запланирована, не создаем дублирующие таймеры
      if (fetchAttempted.current) {
        console.log('UserEventTickets: Fetch already scheduled or in progress');
        return;
      }
      
      console.log('UserEventTickets: userData is available, triggering initial fetch');
      
      // Инициируем начальную загрузку только один раз при первом получении userData
      refreshCounter.current += 1;
      fetchAttempted.current = true;
      
      // Небольшая задержка для стабильности
      const timer = setTimeout(() => {
        console.log(`UserEventTickets: Initial data load with userData, refresh #${refreshCounter.current}`);
        // Не используем fetchTickets() напрямую, т.к. был увеличен refreshCounter
        // Это запустит другой useEffect, который вызовет fetchTickets()
      }, initialLoadDelay);

      return () => {
        clearTimeout(timer);
        fetchAttempted.current = false;
      };
    }, [userData]);

    // Add scroll event listener for infinite scrolling
    useEffect(() => {
      const container = ticketsContainerRef.current;
      if (!container) return;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        // Начинаем подгрузку когда пользователь прокрутил до 80% высоты контента
        // Это обеспечит более плавную подгрузку до того, как пользователь достигнет конца списка
        if (scrollHeight - scrollTop - clientHeight < scrollHeight * 0.2 && !isLoadingMore && hasMore) {
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
      console.log(`UserEventTickets: Manual refresh triggered`);
      
      // Reset state
      setIsLoading(true);
      hasInitialData.current = false;
      fetchAttempted.current = false;
      setPage(1);
      setHasMore(true);
      
      // Increment counter to trigger refresh
      refreshCounter.current += 1;
      
      // Не вызываем fetchTickets() напрямую, т.к. это приведет к дублированию логики
      // Для запуска запроса используем хук useEffect с зависимостью от refreshCounter
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
      if (isInitialFetchDone.current) {
        console.log('UserEventTickets: Initial fetch already completed, skipping');
        return;
      }
      
      // Если начальная загрузка уже запланирована, не создаем дублирующие таймеры
      if (fetchAttempted.current) {
        console.log('UserEventTickets: Fetch already scheduled or in progress');
        return;
      }
      
      console.log('UserEventTickets: userData is available, triggering initial fetch');
      
      // Инициируем начальную загрузку только один раз при первом получении userData
      refreshCounter.current += 1;
      fetchAttempted.current = true;
      
      // Небольшая задержка для стабильности
      const timer = setTimeout(() => {
        console.log(`UserEventTickets: Initial data load with userData, refresh #${refreshCounter.current}`);
        // Не используем fetchTickets() напрямую, а увеличиваем счетчик
        // Это запустит другой useEffect, который вызовет fetchTickets()
        // с полной проверкой на дубликаты
      }, initialLoadDelay);

      return () => {
        clearTimeout(timer);
        fetchAttempted.current = false;
      };
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
        
        // Создаем параметры для запроса с фильтрами
        const params: Record<string, any> = {
          _nocache: Date.now(), // Добавляем параметры для предотвращения кэширования
          _refresh: refreshCounter.current,
          page: nextPage,
          per_page: ticketsPerPage
        };
        
        // Добавляем параметры фильтрации, если они установлены
        if (filters.dateFrom) {
          params.date_from = filters.dateFrom;
        }
        if (filters.dateTo) {
          params.date_to = filters.dateTo;
        }
        if (filters.status.length > 0) {
          params.status = filters.status.join(',');
        }
        
        const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
          method: "GET",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          bypassLoadingStageCheck: true,
          params
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
        
        if (!ticketsData || ticketsData.length === 0) {
          console.log('UserEventTickets: Больше билетов не найдено');
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }
        
        // Обрабатываем билеты, учитывая фильтры
        const processedTickets = processTickets(ticketsData);
        
        // Фильтруем только новые билеты, которых еще нет в списке
        const newTickets = processedTickets.filter(ticket => !currentTicketIds.has(ticket.id));
        console.log(`UserEventTickets: Новых билетов для добавления: ${newTickets.length}`);
            
        if (newTickets.length > 0) {
          // Update tickets directly without triggering another processing cycle
          const updatedTickets = [...tickets, ...newTickets];
          setTickets(updatedTickets);
          setTicketsCount(updatedTickets.length);
          
          // Применяем общую функцию фильтрации к объединенному массиву билетов
          const filteredResults = applyAllFilters(updatedTickets);
          setFilteredTickets(filteredResults);
          
          setPage(nextPage);
          
          // Если получили меньше билетов, чем запрашивали, значит больше нет
          setHasMore(newTickets.length >= ticketsPerPage);
        } else {
          console.log('UserEventTickets: Больше новых билетов не найдено');
          setHasMore(false);
        }
        
        // Добавляем небольшую задержку перед тем, как разрешить следующую загрузку
        // Это предотвращает слишком частые запросы при быстрой прокрутке
        setTimeout(() => {
          setIsLoadingMore(false);
        }, 300);
      } catch (err) {
        console.error("UserEventTickets: Error loading more tickets", err);
        setIsLoadingMore(false);
      }
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
        // Проверяем наличие данных перед сортировкой
        if (!a || !b || !a.event || !b.event) {
          return 0;
        }
        
        // Сначала сортируем по статусу
        const aStatus = a.status || 'pending';
        const bStatus = b.status || 'pending';
        const statusDiff = (statusPriority[aStatus] || 0) - (statusPriority[bStatus] || 0);
        if (statusDiff !== 0) return statusDiff;
        
        // Если статусы одинаковые, сортируем по дате начала события (сначала ближайшие)
        try {
          const dateA = new Date(a.event.start_date || Date.now());
          const dateB = new Date(b.event.start_date || Date.now());
          return dateA.getTime() - dateB.getTime();
        } catch (err) {
          console.error('Error sorting tickets by date:', err);
          return 0;
        }
      });
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

    // Комплексная функция для обработки билетов:
    // 1. Удаление дубликатов
    // 2. Обновление статусов
    // 3. Сортировка
    const processTickets = (tickets: UserTicket[]): UserTicket[] => {
      if (!tickets || tickets.length === 0) {
        return [];
      }
      
      // Отладочная информация о входных данных
      console.log('UserEventTickets: Входные данные для processTickets:', tickets.map(t => ({
        id: t.id,
        status: t.status,
        event_status: t.event?.status,
        title: t.event?.title
      })));
      
      // Не фильтруем билеты по статусу, а обрабатываем их все
      // Это позволит корректно работать с фильтрами
      
      // Создаем Map для гарантированной уникальности по ID
      const uniqueTicketsMap = new Map<number, UserTicket>();
      
      // Добавляем только билеты с приоритетным статусом
      tickets.forEach(ticket => {
        // Глубокое копирование для предотвращения мутации исходных данных
        const ticketCopy = { ...ticket, event: { ...ticket.event } };
        
        const existingTicket = uniqueTicketsMap.get(ticketCopy.id);
        
        // Обновляем статус билета в соответствии со статусом мероприятия
        // Но не меняем отмененные билеты
        if (ticketCopy.event && ticketCopy.event.status === "completed" && ticketCopy.status !== "cancelled") {
          console.log(`UserEventTickets: Устанавливаем статус билета ${ticketCopy.id} для события ${ticketCopy.event.title} как 'completed' (было '${ticketCopy.status}')`);
          ticketCopy.status = "completed";
        }
        
        // Если такого билета еще нет или текущий имеет более приоритетный статус
        if (!existingTicket || shouldReplaceTicket(existingTicket, ticketCopy)) {
          uniqueTicketsMap.set(ticketCopy.id, ticketCopy);
        }
      });
      
      // Извлекаем уникальные билеты
      const uniqueTickets = Array.from(uniqueTicketsMap.values());
      
      // Отладочная информация о билетах после обработки
      console.log('UserEventTickets: Билеты после processTickets:', uniqueTickets.map(t => ({
        id: t.id,
        status: t.status,
        event_status: t.event?.status,
        title: t.event?.title
      })));
      
      // Не фильтруем билеты здесь, оставляем это для applyAllFilters
      
      // Сортируем билеты по статусу и дате
      return sortByStatusAndDate(uniqueTickets);
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
      
      // Если запрос уже идет, не запускаем новый
      if (fetchAttempted.current) {
        console.log("UserEventTickets: Запрос уже выполняется, дублирование предотвращено");
        return;
      }
      
      // Помечаем попытку запроса
      fetchAttempted.current = true;
      setIsLoading(true);
      console.log(`UserEventTickets: Начало запроса билетов, refreshCounter=${refreshCounter.current}`);
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.log("UserEventTickets: Токен не найден");
          setError("Необходима авторизация");
          setIsLoading(false);
          fetchAttempted.current = false; // Важно сбросить маркер при выходе
          router.push('/');
          return;
        }
        
        console.log('UserEventTickets: Выполняется запрос билетов');
        
        // Добавляем уникальный идентификатор для кэширования
        const cacheKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Создаем параметры для запроса с фильтрами
        const params: Record<string, any> = {
          _nocache: cacheKey,
          page: 1,
          per_page: ticketsPerPage
        };
        
        // Добавляем параметры фильтрации, если они установлены
        if (filters.dateFrom) {
          params.date_from = filters.dateFrom;
        }
        if (filters.dateTo) {
          params.date_to = filters.dateTo;
        }
        if (filters.status.length > 0) {
          params.status = filters.status.join(',');
        }
        
        const response = await apiFetch<APIResponse<UserTicket[]>>('/user_edits/my-tickets', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          bypassLoadingStageCheck: true,
          params
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
              fetchAttempted.current = false; // Важно сбросить маркер перед новой попыткой
              refreshCounter.current += 1;
            }, 1000);
            
            return;
          }
        
          console.log(`UserEventTickets: Запрос отменен, причина: ${response.reason}`);
          setError(`Запрос был прерван: ${response.reason}`);
          setIsLoading(false);
          isInitialLoad.current = false;
          fetchAttempted.current = false; // Сбрасываем маркер запроса
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
          setFilteredTickets([]);
          setError(null);
          hasInitialData.current = true;
          isInitialFetchDone.current = true;
          setIsLoading(false);
          isInitialLoad.current = false;
          fetchAttempted.current = false; // Важно сбросить маркер при выходе
          return;
        }
          
        console.log(`UserEventTickets: Получено ${ticketsData.length} билетов`);
        
        // Обработка данных с учетом фильтров
        const processedTickets = processTickets(ticketsData);
        
        console.log(`UserEventTickets: После обработки осталось ${processedTickets.length} уникальных билетов`);
        
        // Set tickets (filtered tickets будут обновлены через useEffect)
        setTickets(processedTickets);
        setTicketsCount(processedTickets.length);
        
        // Применяем фильтры сразу после загрузки билетов
        const filteredResults = applyAllFilters(processedTickets);
        setFilteredTickets(filteredResults);
        
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
        // Сбрасываем маркер запроса в любом случае
        fetchAttempted.current = false;
      }
    };

    // Add a function to explicitly refresh tickets
    const refreshTickets = useCallback(() => {
      console.log('UserEventTickets: Manual refresh requested via ref');
      
      // Reset pagination state
      setPage(1);
      setHasMore(true);
      setIsLoading(true);
      
      // Сбрасываем маркеры запросов для гарантированного выполнения
      fetchAttempted.current = false;
      
      // Increment counter to trigger refresh
      refreshCounter.current += 1;
      
      // Не вызываем fetchTickets() напрямую, т.к. это приведет к дублированию логики
      // Для запуска запроса используем хук useEffect с зависимостью от refreshCounter
    }, []);
    
    // Expose methods to parent components via ref
    useImperativeHandle(ref, () => ({
      refreshTickets
    }), [refreshTickets]);

    const handleCancelClick = (ticket: UserTicket) => {
      // Reset modal states
      setSelectedTicket(ticket);
      setCancelError(undefined);
      setCancelSuccess(undefined);
      setIsModalOpen(true);
      console.log("UserEventTickets: Opening cancel confirmation for ticket ID:", ticket.id);
    };
    
    // Modified cancel ticket confirmation with proper logging and flag consistency
    const handleCancelConfirm = async () => {
      // Set the flag to prevent event handling during cancellation
      isTicketBeingCancelled.current = true;
      
      // Reset states and set loading
      setCancelError(undefined);
      setCancelSuccess(undefined);
      setCancelLoading(true);
      
      try {
        if (!selectedTicket || !userData) {
          throw new Error('No ticket selected or user not authorized');
        }
        
        console.log('Cancelling ticket:', selectedTicket.id);
        
        // Make the API call to cancel the ticket
        const response = await apiFetch(`/registration/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            event_id: selectedTicket.event.id,
            user_id: userData.id
          }),
          bypassLoadingStageCheck: true
        });
        
        // Handle successful cancellation
        console.log('Ticket cancelled successfully:', response);
        setCancelSuccess('Билет успешно отменен!');
        
        // Update local ticket state (for optimistic update)
        setTickets(currentTickets => 
          currentTickets.filter(ticket => ticket.id !== selectedTicket.id)
        );
        setTicketsCount(prev => Math.max(0, prev - 1));
        
        // IMPORTANT: Create a deep copy of the ticket to prevent React state references from being passed along
        // This ensures other components don't have direct references to our state
        const ticketDetails = {
          ticketId: selectedTicket.id,
          eventId: selectedTicket.event.id
        };
        
        // Dispatch custom event to notify other components but with needsRefresh:false
        // Important: We are explicitly telling other components NOT to refresh, but they might override this
        const ticketUpdateEvent = new CustomEvent('ticket-update', {
          detail: {
            source: 'user-event-tickets',
            action: 'cancel',
            ticketId: ticketDetails.ticketId,
            eventId: ticketDetails.eventId,
            needsRefresh: false // Important! We don't want a refresh since we already updated our local state
          }
        });
        console.log('Dispatching ticket-update event with needsRefresh:false');
        window.dispatchEvent(ticketUpdateEvent);
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedTicket(null);
          setCancelLoading(false);
          // Clear the flag after modal is closed
          isTicketBeingCancelled.current = false;
        }, 1500);
        
      } catch (err) {
        console.error('Error cancelling ticket:', err);
        setCancelError(err.message || 'Не удалось отменить билет. Пожалуйста, попробуйте снова.');
        setCancelLoading(false);
        // Clear the flag on error
        isTicketBeingCancelled.current = false;
      }
    };

    // Инициализация настроек фильтра при первом монтировании компонента
    useEffect(() => {
      console.log('UserEventTickets: Инициализация начальных фильтров');
      // Устанавливаем фильтр подтвержденных билетов по умолчанию
      if (filters.status.length === 0) {
        setFilters(prev => ({ ...prev, status: ['confirmed'] }));
      }
    }, []);

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
      <FiltersContext.Provider value={filtersContextValue}>
        <div className="h-full overflow-auto" ref={ref || ticketsContainerRef}>
          {isLoading && tickets.length === 0 ? (
            <div className="p-2">
              <TicketSkeleton />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <div className="text-xl font-semibold mb-2">У вас пока нет билетов</div>
              <p className="text-gray-500">После бронирования, билеты на мероприятия будут отображаться здесь</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 w-full pr-2">
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm"
                >
                  <FaFilter /> Фильтры
                  {filters.status.length > 0 || filters.dateFrom || filters.dateTo ? (
                    <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {filters.status.length + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0)}
                    </span>
                  ) : null}
                </button>
                <span className="text-sm text-gray-500 truncate bg-white px-2 py-1 rounded shadow-sm tickets-count">
                  Загружено: {filteredTickets.length || 0}
                </span>
              </div>
              
              <FilterPanel 
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onFilterChange={(newFilters) => {
                  console.log('Применены новые фильтры:', newFilters);
                  
                  // Принудительно применяем фильтры к текущим билетам
                  if (tickets.length > 0) {
                    console.log('Принудительно применяем фильтры к', tickets.length, 'билетам');
                    const filtered = tickets.filter(ticket => {
                      if (!ticket || !ticket.event) return false;
                      
                      // Определяем эффективный статус билета (с учетом статуса мероприятия)
                      let effectiveStatus = ticket.status;
                      
                      // Если мероприятие завершено и билет не отменен, считаем его завершенным
                      if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
                        effectiveStatus = "completed";
                      }
                      
                      // Специальная обработка для статуса "approved"
                      if (effectiveStatus === "approved" && newFilters.status.includes("confirmed")) {
                        console.log(`UserEventTickets: Билет ${ticket.id} со статусом approved соответствует фильтру confirmed`);
                        return true;
                      }
                      
                      // Проверяем соответствие эффективного статуса выбранным фильтрам
                      if (newFilters.status.length > 0) {
                        const matches = newFilters.status.includes(effectiveStatus);
                        console.log(`UserEventTickets: Билет ${ticket.id} для ${ticket.event.title} статус ${ticket.status} (эффективный: ${effectiveStatus}) соответствует фильтру: ${matches}`);
                        return matches;
                      }
                      
                      return true;
                    });
                    
                    console.log('После применения фильтров осталось', filtered.length, 'билетов');
                    
                    // Применяем фильтр по дате бронирования
                    let dateFiltered = [...filtered];
                    
                    if (newFilters.dateFrom) {
                      const fromDate = new Date(newFilters.dateFrom);
                      dateFiltered = dateFiltered.filter(ticket => {
                        if (!ticket || !ticket.registration_date) return false;
                        const regDate = new Date(ticket.registration_date);
                        return regDate >= fromDate;
                      });
                    }

                    if (newFilters.dateTo) {
                      const toDate = new Date(newFilters.dateTo);
                      // Устанавливаем время конца дня
                      toDate.setHours(23, 59, 59, 999);
                      dateFiltered = dateFiltered.filter(ticket => {
                        if (!ticket || !ticket.registration_date) return false;
                        const regDate = new Date(ticket.registration_date);
                        return regDate <= toDate;
                      });
                    }
                    
                    setFilteredTickets(sortByStatusAndDate(dateFiltered));
                    console.log('UserEventTickets: После всех фильтраций и сортировки получено билетов:', dateFiltered.length);
                  }
                }}
              />
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
              
              {Array.isArray(filteredTickets) && filteredTickets.length > 0 ? (
                <div className="space-y-4" key={`tickets-list-${filteredTickets.length}-${filters.status.join('-')}`}>
                  {console.log('UserEventTickets: Рендеринг билетов:', 
                    filteredTickets.map(t => ({id: t.id, status: t.status, title: t.event?.title})))}
                  {filteredTickets.map((ticket, index) => {
                    console.log(`UserEventTickets: Рендеринг билета ${ticket?.id || 'unknown'}, статус ${ticket?.status || 'unknown'}`);
                    // Проверяем наличие необходимых данных
                    if (!ticket || !ticket.event) {
                      console.log('UserEventTickets: Пропускаем билет без данных при рендеринге');
                      return null;
                    }
                    
                    // Определяем эффективный статус билета (с учетом статуса мероприятия)
                    let effectiveStatus = ticket.status;
                    
                    // Если мероприятие завершено и билет не отменен, считаем его завершенным
                    if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
                      effectiveStatus = "completed";
                    }
                    
                    // Доп.проверка на соответствие фильтрам (на всякий случай)
                    if (filters.status.length > 0) {
                      // Проверяем соответствие эффективного статуса выбранным фильтрам
                      let matchesStatus = filters.status.includes(effectiveStatus);
                      
                      // Специальная обработка для статуса "approved" - считается совпадающим с confirmed
                      if (effectiveStatus === "approved" && filters.status.includes("confirmed")) {
                        console.log(`UserEventTickets: Билет ${ticket.id} со статусом approved соответствует фильтру confirmed при рендеринге`);
                        matchesStatus = true;
                      }
                      
                      if (!matchesStatus) {
                        console.log(`UserEventTickets: Билет ${ticket.id} не соответствует фильтрам при рендеринге`);
                        console.log(`   - Статус билета: ${ticket.status}`);
                        console.log(`   - Эффективный статус: ${effectiveStatus}`);
                        console.log(`   - Статус события: ${ticket.event.status}`);
                        console.log(`   - Фильтры: ${filters.status.join(', ')}`);
                        return null;
                      }
                    }
                    
                    // Определяем максимальное количество отмен (по умолчанию 3)
                    const maxCancellations = 3;
                    // Вычисляем оставшиеся отмены
                    const cancellationCount = ticket.cancellation_count || 0;
                    
                    // Проверяем, завершено ли мероприятие
                    const isEventCompleted = ticket.event.status === "completed";
                    
                    // Не показываем кнопку отмены для завершенных билетов или мероприятий
                    const showCancelButton = ticket.status !== "completed" && 
                                            ticket.status !== "cancelled" && 
                                            !isEventCompleted;

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
                                  effectiveStatus
                                )}`}
                              >
                                {getStatusText(effectiveStatus, ticket.event.status)}
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
                                
                                {/* Отображаем дату бронирования */}
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <FaRegCalendarCheck className="text-orange-500 flex-shrink-0 mt-1" />
                                  <span className="break-words">
                                    Забронировано: {formatDateForDisplay(ticket.registration_date)} 
                                    {ticket.registration_date && ` в ${formatTimeForDisplay(ticket.registration_date)}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                filteredTickets.length === 0 && tickets.length > 0 && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg mt-4">
                    <p className="text-gray-600">Нет билетов, соответствующих выбранным фильтрам</p>
                    <button 
                      onClick={() => setFilters({ status: ['confirmed'], dateFrom: null, dateTo: null })}
                      className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium"
                    >
                      Сбросить фильтры
                    </button>
                  </div>
                )
              )}
            </>
          )}
          
          {/* Confirmation Modal - only when we actually want to show it */}
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
          
          {/* Индикатор загрузки при подгрузке дополнительных билетов */}
          {isLoadingMore && (
            <div className="p-4 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-400 border-r-transparent align-[-0.125em]" />
            </div>
          )}
        </div>
      </FiltersContext.Provider>
    );
  }
);

// Add display name for debugging
UserEventTickets.displayName = 'UserEventTickets';

export default UserEventTickets;