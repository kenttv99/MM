import { useEffect, useState, useRef, useCallback, forwardRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimesCircle, FaFilter, FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

// Простой логгер
const debugLog = (category: string, message: string, data?: unknown) => {
  const isDevMode = process.env.NODE_ENV === 'development';
  if (!isDevMode) return;
  
  const prefix = `UserEventTickets [${category}]:`;
  
  // Ограничиваем повторяющиеся логи, особенно при загрузке страницы
  if (message.includes('Recomputing filtered tickets') || message.includes('Applying all filters') || message.includes('Applying filters')) {
    // Пропускаем эти логи, чтобы не засорять консоль
    return;
  }
  
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

// Define ref type
export interface UserEventTicketsRef {
  refreshTickets: () => void;
}

// Define props type using Record<string, unknown> to accept any props
type UserEventTicketsProps = Record<string, unknown>;

interface UserTicket {
  id: number;
  event: EventData;
  ticket_type: string;
  registration_date: string;
  status: "pending" | "cancelled" | "completed" | "approved";
  cancellation_count?: number;
  ticket_number?: string;
}

// Интерфейс для фильтров
interface TicketFilters {
  status: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

// API response interface needed for requests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface APIResponse<T> {
  data?: T;
  items?: T;
  tickets?: T;
  error?: string;
  status?: number;
  aborted?: boolean;
  reason?: string;
}

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

// Helper function for filter changes
const handleFilterChangeType = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null, localFilters: TicketFilters, setLocalFilters: React.Dispatch<React.SetStateAction<TicketFilters>>) => {
  if (type === 'status') {
    setLocalFilters({...localFilters, status: [value as string]});
  } else if (type === 'dateFrom' || type === 'dateTo') {
    setLocalFilters({...localFilters, [type]: value});
  }
};

// Define interfaces for context and component props
interface FiltersContextType {
  filters: TicketFilters;
  setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
}

// Create context
const FiltersContext = React.createContext<FiltersContextType>({
  filters: { status: ['approved'], dateFrom: null, dateTo: null },
  setFilters: () => {}
});

// Компонент панели фильтров
const FilterPanel: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
  refreshTickets: () => void;
  filters: TicketFilters;
}> = ({ isOpen, onClose, setFilters, refreshTickets, filters }) => {
  // Локальное состояние фильтров
  const [localFilters, setLocalFilters] = useState<TicketFilters>({ 
    status: filters.status, 
    dateFrom: filters.dateFrom, 
    dateTo: filters.dateTo 
  });
  
  // Синхронизация с глобальными фильтрами при открытии
  useEffect(() => {
    if (isOpen) {
      debugLog('FilterPanel', 'Modal opened, syncing filters from global state', filters);
      setLocalFilters(filters);
    }
  }, [isOpen, filters]);

  // Обработка изменения фильтров
  const handleFilterChange = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null) => {
    handleFilterChangeType(type, value, localFilters, setLocalFilters);
  };
  
  // Применение фильтров
  const applyFilters = () => {
    debugLog('Filters', 'Applying filters', localFilters);
    setFilters(localFilters);
    onClose();
    setTimeout(() => {
    refreshTickets();
    }, 0);
  };
  
  // Сброс фильтров
  const resetFilters = () => {
    const resetFilterValues = { status: ['approved'], dateFrom: null, dateTo: null };
    setLocalFilters(resetFilterValues);
    setFilters(resetFilterValues);
    debugLog('FilterPanel', 'Filters reset', resetFilterValues);
    onClose();
    setTimeout(() => {
    refreshTickets();
    }, 0);
  };

  if (!isOpen) return null;

  const modalVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  // Filter option component
  const FilterOption = ({ label, value, isSelected }: { label: string, value: string, isSelected: boolean }) => (
    <div 
      className={`rounded-lg p-3 cursor-pointer transition-all ${
        isSelected 
          ? 'bg-orange-100 border-2 border-orange-300' 
          : 'bg-gray-50 border-2 border-gray-100 hover:bg-gray-100'
      }`} 
      onClick={() => handleFilterChange('status', value)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{label}</span>
        {isSelected && <span className="text-orange-500">✓</span>}
      </div>
      <div className={`h-2 w-full ${
        value === 'approved' ? 'bg-green-200' :
        value === 'completed' ? 'bg-gray-300' :
        value === 'cancelled' ? 'bg-red-200' : 'bg-yellow-200'
      } rounded-full`}></div>
    </div>
  );

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
                <FilterOption 
                  label="Подтвержденные" 
                  value="approved" 
                  isSelected={localFilters.status.includes('approved')} 
                />
                <FilterOption 
                  label="Завершенные" 
                  value="completed" 
                  isSelected={localFilters.status.includes('completed')} 
                />
                <FilterOption 
                  label="Отмененные" 
                  value="cancelled" 
                  isSelected={localFilters.status.includes('cancelled')} 
                />
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
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
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
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
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

// Функция фильтрации билетов по статусу и дате
const applyFiltersToTickets = (tickets: UserTicket[], filters: TicketFilters): UserTicket[] => {
  debugLog('applyFiltersToTickets', 'Applying filters', filters);
  
  // Если нет фильтров или они не заданы, возвращаем исходный массив
  if (!filters || (!filters.status.length && !filters.dateFrom && !filters.dateTo)) {
    return tickets;
  }
  
  return tickets.filter(ticket => {
    // Проверяем статус билета
    if (filters.status.length > 0 && !filters.status.includes(ticket.status)) {
      return false;
    }
    
    // Проверяем даты бронирования
    const registrationDate = new Date(ticket.registration_date);
    if (filters.dateFrom) {
      const dateFrom = new Date(filters.dateFrom);
      dateFrom.setHours(0, 0, 0, 0);
      if (registrationDate < dateFrom) {
        return false;
      }
    }
    
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      if (registrationDate > dateTo) {
        return false;
      }
    }
    
    return true;
  });
};

// Re-add the ConfirmModal component
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

// Convert to forwardRef with imperative handle
const UserEventTickets = forwardRef<UserEventTicketsRef, UserEventTicketsProps>(() => {
  const { isAuth: _isAuth, isLoading: authLoading, isAuthChecked } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isAuthUnused = _isAuth; // Suppress unused warning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter(); // Suppress unused warning
  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelRegistrationLoading, setCancelRegistrationLoading] = useState(false);
  const [cancelledTicketIds, setCancelledTicketIds] = useState<Set<string>>(new Set());
  const [cancelError, setCancelError] = useState<string | undefined>();
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false); // Используем состояние вместо ref для управления загрузкой
  
  // Фильтры билетов
  const [filters, setFilters] = useState<TicketFilters>({
    status: ['approved'], // По умолчанию показываем только подтвержденные билеты
    dateFrom: null,
    dateTo: null
  });

  // Число билетов на страницу
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ticketsPerPage = 50;
  
  // Refs для отслеживания состояния компонента
  const isMounted = useRef(true);
  const hasInitialData = useRef(false);
  const isInitialFetchDone = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const lastCheckTime = useRef(0);
  const fetchAttempted = useRef(false);
  const ticketsContainerRef = useRef<HTMLDivElement>(null);
  const isTicketBeingCancelled = useRef(false);
  const previousPath = useRef<string>('');
  const activeAbortController = useRef<AbortController | null>(null); // Для отслеживания активного запроса
  const lastFetchTime = useRef<number>(0); // Для предотвращения частых запросов
  const lastUnmountTime = useRef<number>(0); // Для отслеживания времени последнего размонтирования
  const pendingFetchResult = useRef<UserTicket[] | null>(null); // Для хранения результатов запроса, если компонент размонтирован
  
  // Создаем значение контекста
  const filtersContextValue = { filters, setFilters };
  
  // Загрузка отмененных билетов из localStorage
  useEffect(() => {
    try {
      const storedTickets = localStorage.getItem('cancelledTickets');
      if (storedTickets) {
        const ticketsArray = JSON.parse(storedTickets) as string[];
        setCancelledTicketIds(new Set(ticketsArray));
        debugLog('UserEventTickets', 'Loaded cancelled tickets from localStorage', { count: ticketsArray.length });
      }
    } catch (error) {
      console.error('Error loading cancelled tickets from localStorage:', error);
    }
  }, []);
  
  // Функция отмены билета
  const cancelTicket = useCallback((ticketId: string) => {
    setCancelledTicketIds(prev => {
      const newSet = new Set(prev);
      newSet.add(ticketId);
      return newSet;
    });
  }, []);

  // Функция для сортировки билетов по статусу и дате
  const sortByStatusAndDate = useCallback((tickets: UserTicket[]): UserTicket[] => {
    if (!tickets || !tickets.length) return [];
    
    // Status priority (highest to lowest)
    const statusPriority: Record<string, number> = {
      "approved": 0, // Highest priority
      "pending": 1,
      "cancelled": 2,
      "completed": 3
    };
    
    return [...tickets].sort((a, b) => {
      // Проверка данных перед сортировкой
      if (!a || !b || !a.event || !b.event) return 0;
      
      // Сначала сортируем по приоритету статуса
      const aStatus = a.status || 'pending';
      const bStatus = b.status || 'pending';
      const statusDiff = (statusPriority[aStatus] ?? 999) - (statusPriority[bStatus] ?? 999);
      
      if (statusDiff !== 0) return statusDiff;
      
      // Затем сортируем по дате начала события (ближайшие сначала)
      try {
        const dateA = new Date(a.event.start_date || Date.now());
        const dateB = new Date(b.event.start_date || Date.now());
        return dateA.getTime() - dateB.getTime();
      } catch (err) {
        debugLog('Error', 'Error sorting tickets by date', err);
        return 0;
      }
    });
  }, []);

  // Обработка и удаление дубликатов билетов
  const processTickets = useCallback((ticketsData: UserTicket[]): UserTicket[] => {
    if (!ticketsData || ticketsData.length === 0) return [];
    
    debugLog('Processing', 'Processing tickets', { count: ticketsData.length });
    
    // Создаем Map для гарантии уникальности по ID
    const uniqueTicketsMap = new Map<number, UserTicket>();
    
    // Добавляем только билеты с приоритетным статусом
    ticketsData.forEach(ticket => {
      if (!ticket || !ticket.event) return;
      
      // Пропускаем билеты, которые пользователь отменил
      if (cancelledTicketIds.has(ticket.id.toString())) {
        debugLog('Processing', `Skipping cancelled ticket ID: ${ticket.id}`);
        return;
      }
      
      // Глубокое копирование для предотвращения мутаций
      const ticketCopy = { ...ticket, event: { ...ticket.event } };
      
      // Обновляем статус билета на основе статуса события
      // Но не меняем отмененные билеты
      if (ticketCopy.event.status === "completed" && ticketCopy.status !== "cancelled") {
        ticketCopy.status = "completed";
      }
      
        uniqueTicketsMap.set(ticketCopy.id, ticketCopy);
    });
    
    // Извлекаем уникальные билеты
    return Array.from(uniqueTicketsMap.values());
  }, [cancelledTicketIds]);

  // Применение всех фильтров
  const applyAllFilters = useCallback((ticketsToFilter: UserTicket[]) => {
    if (!ticketsToFilter.length) return [];
    
    debugLog('Filters', 'Applying all filters', { count: ticketsToFilter.length, filters });
    
    // Применяем фильтрацию по статусу и дате
    const filtered = applyFiltersToTickets(ticketsToFilter, filters);
    
    // Затем сортируем отфильтрованные билеты
    return sortByStatusAndDate(filtered);
  }, [filters, sortByStatusAndDate]);
  
  // Define fetchTickets with useCallback before it's used
  const fetchTickets = useCallback(async () => {
    debugLog('API', 'fetchTickets started');
    console.log('🔍 DIRECT CONSOLE: fetchTickets is executing now');

    // Проверка на наличие сетевого соединения
    if (!navigator.onLine) {
      debugLog('API', 'No internet connection detected');
      if (isMounted.current) {
        setError('Нет соединения с интернетом. Проверьте подключение и попробуйте снова.');
        setIsLoading(false);
      }
      setIsFetching(false);
      fetchAttempted.current = false;
      return;
    }

    // Предотвращаем повторный запрос если процесс уже идет
    if (isFetching) {
      debugLog('Lifecycle', 'Request already in progress, duplicate prevented');
      return;
    }

    // Добавляем защиту от частых запросов (дебounce 3 секунды, увеличено для учета размонтирования)
    const currentTime = Date.now();
    const timeSinceLastFetch = currentTime - lastFetchTime.current;
    const timeSinceLastUnmount = currentTime - lastUnmountTime.current;
    if (timeSinceLastFetch < 3000 || (timeSinceLastUnmount < 1000 && timeSinceLastFetch < 5000)) {
      debugLog('Lifecycle', 'Fetch request throttled due to recent activity', { timeSinceLastFetch, timeSinceLastUnmount });
      // Если компонент смонтирован, можно показать сообщение о задержке
      if (isMounted.current && timeSinceLastUnmount < 1000) {
        setIsLoading(true); // Показываем загрузку, чтобы пользователь знал, что процесс идет
      }
      return;
    }
    lastFetchTime.current = currentTime;
    
    try {
      // Mark request attempt
      setIsFetching(true);
      fetchAttempted.current = true;
      if (isMounted.current) {
        setIsLoading(true);
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        debugLog('Auth', 'Token not found');
        if (isMounted.current) {
          setError("Необходима авторизация");
          setIsLoading(false);
        }
        setIsFetching(false);
        fetchAttempted.current = false;
        return;
      }
      
      // Создаем контроллер для возможности отмены запроса
      const controller = new AbortController();
      activeAbortController.current = controller; // Сохраняем для возможности отмены при размонтировании
      
      // Задаем таймаут для запроса - 20 секунд
      const timeoutId = setTimeout(() => {
        controller.abort('Timeout after 20 seconds');
        debugLog('API', 'Request aborted due to timeout');
        
        // После отмены запроса, сразу сбрасываем состояние загрузки
        if (isMounted.current) {
          setIsLoading(false);
          setError("Не удалось загрузить билеты. Пожалуйста, проверьте соединение с интернетом.");
        }
        setIsFetching(false);
        fetchAttempted.current = false; // Сбрасываем для повторной попытки
        hasInitialData.current = true;
        isInitialFetchDone.current = true;
        // Инициируем повторную попытку загрузки через эффект, а не прямой вызов
        debugLog('API', 'Initiating retry after timeout abort');
        if (isMounted.current) {
          setRetryCount(prev => prev + 1); // Увеличиваем счетчик для инициирования повторной попытки через эффект
        }
      }, 20000); // Таймаут 20 секунд
      
      // Получаем параметры для запроса
      const cacheKey = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Формируем URL с параметрами как строку запроса
      let url = `${process.env.NEXT_PUBLIC_API_URL || ''}/user_edits/my-tickets?_nocache=${cacheKey}`;
      
      // Добавляем фильтры
      if (filters.status.length > 0) {
        url += `&status=${filters.status[0]}`;
      }
      
      if (filters.dateFrom) {
        url += `&date_from=${filters.dateFrom}`;
      }
      
      if (filters.dateTo) {
        url += `&date_to=${filters.dateTo}`;
      }
      
      // Выполняем запрос
      debugLog('API', 'Sending network request', { url });
      console.log('🔍 DIRECT CONSOLE: Sending request to', url);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });
        
        // Очищаем таймаут сразу после получения ответа
        clearTimeout(timeoutId);
        activeAbortController.current = null; // Сбрасываем после завершения запроса
        
        if (!response.ok) {
          // Обработка ошибок HTTP
          debugLog('API', `HTTP error: ${response.status} ${response.statusText}`);
          
          // Особая обработка для 401 - unauthorized
          if (response.status === 401) {
            debugLog('API', 'Unauthorized access, redirecting to login');
            if (isMounted.current) {
              setError("Требуется авторизация");
            }
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            return;
          }
          
          // Для других ошибок просто показываем сообщение
          throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        }
        
        const jsonData = await response.json();
        debugLog('API', 'Network request completed', { ticketCount: Array.isArray(jsonData) ? jsonData.length : (jsonData.data?.length || jsonData.tickets?.length || jsonData.items?.length || 0) });
        
        // Нормализуем данные
        let ticketsData: UserTicket[] = [];
        if (Array.isArray(jsonData)) {
          ticketsData = jsonData;
        } else if (jsonData.data && Array.isArray(jsonData.data)) {
          ticketsData = jsonData.data;
        } else if (jsonData.tickets && Array.isArray(jsonData.tickets)) {
          ticketsData = jsonData.tickets;
        } else if (jsonData.items && Array.isArray(jsonData.items)) {
          ticketsData = jsonData.items;
        } else {
          // Неизвестный формат данных
          debugLog('API', 'Unknown data format', jsonData);
          throw new Error('Неизвестный формат данных от сервера');
        }
        
        debugLog('API', `Received ${ticketsData.length} tickets`);
        
        // Обработка билетов
        const processedTickets = processTickets(ticketsData);
        const filteredResults = applyAllFilters(processedTickets);
        
        // Сохраняем результат запроса, даже если компонент размонтирован
        pendingFetchResult.current = processedTickets;
        
        // Обновляем состояние только если компонент все еще смонтирован
        if (isMounted.current) {
          setTickets(processedTickets);
          setFilteredTickets(filteredResults);
          setError(null);
          setIsLoading(false);
          pendingFetchResult.current = null; // Очищаем после применения
        }
        
        // Обновляем флаги
        hasInitialData.current = true;
        isInitialFetchDone.current = true;
        
        debugLog('API', 'Tickets fetch completed successfully');
      } catch (fetchError) {
        // Ошибка запроса
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          debugLog('API', 'Request was aborted');
          if (isMounted.current) {
            setError("Запрос был отменен. Попробуйте снова.");
          }
        } else {
          console.error('Error fetching tickets:', fetchError);
          debugLog('API', 'Error fetching tickets', fetchError);
          if (isMounted.current) {
            setError("Ошибка при загрузке билетов: " + (fetchError instanceof Error ? fetchError.message : 'Неизвестная ошибка'));
          }
        }
        
        // Сбрасываем состояние только если компонент смонтирован
        if (isMounted.current) {
          setIsLoading(false);
        }
        setIsFetching(false);
        activeAbortController.current = null; // Сбрасываем после ошибки
      }
    } catch (err) {
      // Любая другая ошибка
      console.error('🔍 DIRECT CONSOLE: Error in fetchTickets', err);
      debugLog('API', 'Error in fetchTickets', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке билетов');
      }
      
      // В случае ошибки устанавливаем пустые билеты только если компонент смонтирован
      if (isMounted.current) {
        setTickets([]);
        setFilteredTickets([]);
      }
      
      // Обновляем флаги и состояние
      hasInitialData.current = true;
      isInitialFetchDone.current = true;
      if (isMounted.current) {
        setIsLoading(false);
      }
      activeAbortController.current = null; // Сбрасываем после ошибки
    } finally {
      debugLog('API', 'fetchTickets completed');
      setIsFetching(false); // Гарантируем сброс флага в любом случае
    }
  }, [filters, processTickets, applyAllFilters, tickets.length, retryCount, isFetching]);
  
  // Add refreshTickets for use with the ref - moved after fetchTickets definition
  const refreshTickets = useCallback(() => {
    debugLog('UserEventTickets', 'Manual refresh requested via ref');
    
    // Защита от множественных вызовов
    if (isFetching) {
      debugLog('UserEventTickets', 'Refresh already in progress, skipping');
      return;
    }
    
    // Don't set loading state again if already loading
    if (!isLoading) {
      setIsLoading(true);
    }
    
    // Reset states for a clean fetch
    hasInitialData.current = false;
    fetchAttempted.current = false; 
    // setPage(1); // Commented out as setPage is not defined
    // setHasMore(true); // Commented out as setHasMore is not defined
    
    // Directly call fetchTickets to ensure data refresh
    debugLog('UserEventTickets', 'Initiating direct fetch for refresh');
    fetchTickets();
  }, [isLoading, isFetching, fetchTickets]);
  
  // Modified ticket update event listener to better handle external events
  useEffect(() => {
    const handleTicketUpdate = (event: Event) => {
      // Пропускаем наши собственные события
      if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
        debugLog('UserEventTickets', 'Ignoring our own ticket-update event');
        return;
      }
      
      // Не обрабатываем события во время отмены билета
      if (isTicketBeingCancelled.current) {
        debugLog('UserEventTickets', 'Skipping ticket-update event during active cancellation');
        return;
      }
      
      // Проверяем, инициализирован ли компонент
      if (!isMounted.current || isFetching) {
        debugLog('UserEventTickets', 'Component not mounted or fetch in progress, skipping event');
        return;
      }
      
      debugLog('UserEventTickets', 'External ticket-update event received');
      
      // Обработка события с детальной информацией
      if (event instanceof CustomEvent && event.detail) {
        const { source, action, newTicket, ticketId, preventRefresh } = event.detail;
        
        debugLog('UserEventTickets', 'Event details', { source, action, preventRefresh });
        
        // Пропускаем обновление, если явно указано
        if (preventRefresh) {
          debugLog('UserEventTickets', 'Skipping refresh as requested by event');
          return;
        }
        
        // Для событий отмены билета удаляем билет из списка без полного обновления
        if (source !== 'user-event-tickets' && action === 'cancel' && ticketId) {
          debugLog('UserEventTickets', `External cancel received for ticket ${ticketId} - removing from list`);
          
          // Удаляем отмененный билет без полного обновления
          setTickets(prevTickets => prevTickets.filter(t => t.id !== ticketId));
          setFilteredTickets(prevFiltered => prevFiltered.filter(t => t.id !== ticketId));
          return;
        }
        
        // Обработка события регистрации с полными данными билета
        if ((source === 'event-registration' || source === 'event-page') && action === 'register') {
          debugLog('UserEventTickets', 'Received registration event, source:', source);
          
          // Сохраняем флаг в sessionStorage для обнаружения навигации после регистрации
          sessionStorage.setItem('recent_registration', 'true');
          
          // Если у нас есть полные данные билета, добавляем его напрямую
          if (newTicket) {
            debugLog('UserEventTickets', 'Received new ticket data, adding to list', newTicket);
            
            // Добавляем новый билет напрямую в состояние без полной перезагрузки
            setTickets(prev => {
              // Проверяем, есть ли уже такой билет
              if (prev.some(t => t.id === newTicket.id)) {
                debugLog('UserEventTickets', 'Ticket already exists, not adding duplicate');
                return prev;
              }
              
              // Добавляем новый билет и применяем фильтры
              const updatedTickets = [...prev, newTicket];
              
              // Обновляем отфильтрованные билеты
              setTimeout(() => {
                if (isMounted.current) {
                  setFilteredTickets(applyAllFilters(updatedTickets));
                }
              }, 0);
              
              return updatedTickets;
            });
            
            // Отмечаем, что данные загружены
            hasInitialData.current = true;
            isInitialFetchDone.current = true;
            return;
          }
        }
      }
      
      // Для других событий выполняем полное обновление только если нет текущих запросов
      if (!isFetching && !fetchAttempted.current) {
        debugLog('UserEventTickets', 'External event requires refresh - will fetchTickets()');
        fetchTickets();
      } else {
        debugLog('UserEventTickets', 'Skipping refresh due to ongoing fetch or attempt');
      }
    };
    
    window.addEventListener('ticket-update', handleTicketUpdate);
    
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate);
    };
  }, [fetchTickets, applyAllFilters, isFetching]); // Remove isLoading from dependencies to prevent overfetching

  // Add scroll event listener for infinite scrolling
  useEffect(() => {
    const container = ticketsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Correct the usage of variables
      if (scrollHeight - scrollTop - clientHeight < scrollHeight * 0.2) {
        debugLog('UserEventTickets', 'Scrolled near bottom, loading more tickets');
        console.log('Scrolled near bottom, loading more tickets functionality to be implemented');
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []); // Remove dependencies causing errors

  // Effect to fetch tickets when the component mounts or remounts
  useEffect(() => {
    // Устанавливаем флаг монтирования
    isMounted.current = true;
    debugLog('UserEventTickets', 'Component mounted', { authLoading, isAuthChecked, ticketsLoaded: tickets.length });
    
    // Проверяем, есть ли сохраненные данные из предыдущего запроса
    if (pendingFetchResult.current && pendingFetchResult.current.length > 0 && isMounted.current) {
      debugLog('UserEventTickets', 'Applying pending fetch results on mount', { ticketCount: pendingFetchResult.current.length });
      setTickets(pendingFetchResult.current);
      setFilteredTickets(applyAllFilters(pendingFetchResult.current));
      setError(null);
      setIsLoading(false);
      hasInitialData.current = true;
      isInitialFetchDone.current = true;
      pendingFetchResult.current = null; // Очищаем после применения
    } else if (tickets.length === 0 && isAuthChecked && !isFetching && !authLoading) {
      // Простая логика: если данные не загружены, загружаем их, но только если нет текущего запроса и authLoading завершено
      debugLog('UserEventTickets', 'Initiating ticket fetch on mount', { authLoading, isAuthChecked });
      setIsLoading(true);
      setIsFetching(true);
      fetchTickets();
    } else if (tickets.length > 0) {
      debugLog('UserEventTickets', 'Data already loaded, skipping fetch', { ticketsLoaded: tickets.length });
      setIsLoading(false);
    } else if (authLoading) {
      debugLog('UserEventTickets', 'Auth still loading, delaying fetch until stable', { authLoading, isAuthChecked });
      setIsLoading(true); // Показываем загрузку, пока ждем стабильности
    } else {
      debugLog('UserEventTickets', 'Fetch already in progress or not needed', { isFetching: isFetching });
    }

    return () => {
      debugLog('UserEventTickets', 'Component unmounting', { ticketsLoaded: tickets.length });
      isMounted.current = false; // Устанавливаем флаг, что компонент размонтирован
      lastUnmountTime.current = Date.now(); // Запоминаем время размонтирования
      // Не отменяем активный запрос, чтобы он мог завершиться и сохранить данные
      // if (activeAbortController.current) {
      //   debugLog('Lifecycle', 'Aborting active fetch request on unmount');
      //   activeAbortController.current.abort('Component unmounted');
      //   activeAbortController.current = null;
      // }
      // Не сбрасываем isFetching, чтобы сохранить состояние для возможного повторного монтирования
    };
  }, [fetchTickets, isAuthChecked, tickets.length, authLoading, isFetching, applyAllFilters]); // Добавляем applyAllFilters для обработки сохраненных данных
  
  // Add effect to detect route changes and refresh tickets
  useEffect(() => {
    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      
      // Skip if we're already on the same path
      if (currentPath === previousPath.current) {
        return;
      }
      
      // Check if this is a navigation to a page with our component
      if (currentPath.includes('/profile') || currentPath.includes('/cabinet')) {
        debugLog('UserEventTickets', 'Navigation detected to profile page, current path:', currentPath);
        
        // Check for sessionStorage data that might indicate recent registration
        try {
          const regData = sessionStorage.getItem('recent_registration');
          if (regData) {
            debugLog('UserEventTickets', 'Found recent registration in sessionStorage', regData);
            sessionStorage.removeItem('recent_registration');
            
            // Force a refresh since we might have new registration data only if no ongoing fetch
            if (!isFetching && !fetchAttempted.current) {
              debugLog('UserEventTickets', 'Initiating fetch after recent registration');
              fetchTickets();
            } else {
              debugLog('UserEventTickets', 'Skipping refresh due to ongoing fetch or attempt');
            }
          } else {
            // Only refresh if component is still mounted and no ongoing fetch
            if (isMounted.current && !isFetching && !fetchAttempted.current) {
              debugLog('UserEventTickets', 'Initiating fetch on navigation to profile page');
              fetchTickets();
            } else {
              debugLog('UserEventTickets', 'Skipping refresh due to ongoing fetch or attempt');
            }
          }
        } catch (error) {
          // Default to regular refresh if sessionStorage access fails
          debugLog('Error', 'Error accessing sessionStorage:', error);
          if (isMounted.current && !isFetching && !fetchAttempted.current) {
            debugLog('UserEventTickets', 'Initiating fetch despite sessionStorage error');
            fetchTickets();
          } else {
            debugLog('UserEventTickets', 'Skipping refresh due to ongoing fetch or attempt');
          }
        }
      }
      // Update the previous path
      previousPath.current = currentPath;
    };

    // Record initial path
    if (!previousPath.current) {
      previousPath.current = window.location.pathname;
      
      // Initial check - if we're on the profile page
      if (previousPath.current.includes('/profile') || previousPath.current.includes('/cabinet')) {
        // Check for sessionStorage data
        const regData = sessionStorage.getItem('recent_registration');
        if (regData) {
          debugLog('UserEventTickets', 'Found sessionStorage data on initial load', regData);
          // Only clear if we're going to use it
          sessionStorage.removeItem('recent_registration'); 
          
          // Force refresh right away on initial mount only if no ongoing fetch
          if (!isFetching && !fetchAttempted.current) {
            debugLog('UserEventTickets', 'Initiating fetch on initial load with recent registration');
            fetchTickets();
          } else {
            debugLog('UserEventTickets', 'Skipping initial refresh due to ongoing fetch or attempt');
          }
        }
      }
    }

    // For Next.js App Router, add event listeners
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [fetchTickets, isFetching]); // Remove isLoading from dependencies to prevent overfetching

  // Обработка изменений в localStorage и visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const lastHiddenTime = Date.now(); // Moved outside useRef to avoid hook inside callback issue
      if (document.visibilityState === 'visible' && !isLoading) {
        // Check if we were hidden for a meaningful amount of time (e.g., 5+ seconds)
        const now = Date.now();
        const lastHiddenAt = lastHiddenTime;
        
        if (lastHiddenAt && (now - lastHiddenAt > 5000)) {
          debugLog('UserEventTickets', `Page became visible after being hidden for ${(now - lastHiddenAt)/1000} seconds`);
          
          // Check if there's a user session before fetching
          if (isAuthChecked && !authLoading && !isFetching) {
            debugLog('UserEventTickets', 'Initiating fetch on page visibility after long hidden period');
            fetchTickets();
          } else {
            debugLog('UserEventTickets', 'Skipping fetch on visibility due to auth check or ongoing fetch', { isAuthChecked, authLoading, isFetching });
          }
        }
      } else if (document.visibilityState === 'hidden') {
        // Record when the page was hidden
        debugLog('UserEventTickets', 'Page hidden at', new Date(lastHiddenTime).toLocaleTimeString());
      }
    };

    // Handle localStorage changes that might affect our tickets
    const handleStorageChange = (e: StorageEvent) => {
      // Only react to changes relevant to us
      if (e.key === 'cancelled_ticket_ids' && e.newValue !== null) {
        try {
          // Use a try-catch since JSON parsing can fail
          const parsedIds = JSON.parse(e.newValue);
          debugLog('UserEventTickets', 'Detected localStorage update for cancelled_ticket_ids', parsedIds);
          
          // If we have tickets loaded, update our local state
          if (tickets.length > 0 && !isLoading) {
            // Convert to a Set for efficient lookups
            const cancelledIds = new Set(parsedIds);
            
            // Update both tickets arrays by filtering out cancelled tickets
            const updatedTickets = tickets.filter(ticket => !cancelledIds.has(ticket.id.toString()));
            const updatedFilteredTickets = filteredTickets.filter(ticket => !cancelledIds.has(ticket.id.toString()));
            
            // Only update if there's an actual change
            if (updatedTickets.length !== tickets.length) {
              debugLog('UserEventTickets', 'Updating local tickets based on localStorage change');
              setTickets(updatedTickets);
              setFilteredTickets(updatedFilteredTickets);
              
              // Update our local cancelled IDs set
              setCancelledTicketIds(new Set(parsedIds));
            }
          }
        } catch (error) {
          console.error('Error parsing cancelled_ticket_ids from localStorage:', error);
        }
      }
    };

    // Register event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    // Clean up function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      
      // Save cancelled IDs to localStorage when component unmounts
      if (cancelledTicketIds.size > 0) {
        const idsArray = Array.from(cancelledTicketIds);
        try {
          localStorage.setItem('cancelled_ticket_ids', JSON.stringify(idsArray));
          debugLog('UserEventTickets', 'Updated localStorage with cancelled ticket IDs', idsArray);
        } catch (error) {
          console.error('Error updating localStorage with cancelled ticket IDs:', error);
        }
      }
    };
  }, [tickets, filteredTickets, cancelledTicketIds, isLoading, isAuthChecked, authLoading, fetchTickets]);

  // Мемоизированная фильтрация билетов
  const filteredTicketsData = useMemo(() => {
    if (!tickets || tickets.length === 0) {
      return [];
    }

    debugLog('UserEventTickets', 'Recomputing filtered tickets', { 
      ticketsCount: tickets.length 
    });

    // Применяем фильтры к билетам
    const result = applyAllFilters(tickets);
    return result;
  }, [tickets, filters, sortByStatusAndDate]); // Более точные зависимости для минимизации пересчетов

  // Обновляем отфильтрованные билеты при изменении результатов мемоизации
  useEffect(() => {
    setFilteredTickets(filteredTicketsData);
  }, [filteredTicketsData]);

  // Сохранение отмененных билетов при изменении
  useEffect(() => {
    if (cancelledTicketIds.size > 0) {
      const idsArray = Array.from(cancelledTicketIds);
      try {
        localStorage.setItem('cancelledTickets', JSON.stringify(idsArray));
        debugLog('UserEventTickets', 'Updated localStorage with cancelled ticket IDs', idsArray);
      } catch (error) {
        console.error('Error updating localStorage with cancelled ticket IDs:', error);
      }
    }
  }, [cancelledTicketIds]);

  // Инициализация отмененных билетов при загрузке компонента
  useEffect(() => {
    try {
      const storedTickets = localStorage.getItem('cancelledTickets');
      if (storedTickets) {
        const ticketsArray = JSON.parse(storedTickets) as string[];
        setCancelledTicketIds(new Set(ticketsArray));
        debugLog('UserEventTickets', 'Loaded cancelled tickets from localStorage', { count: ticketsArray.length });
      }
    } catch (error) {
      console.error('Error loading cancelled tickets from localStorage:', error);
    }
  }, []);

  // Add handleCancelConfirm function to handle ticket cancellation
  const handleCancelConfirm = useCallback(async () => {
    if (!selectedTicket) return;
    
    // Mark that we're in the process of cancelling
    isTicketBeingCancelled.current = true;
    setCancelRegistrationLoading(true);
    setCancelError(undefined);
    setCancelSuccess(undefined);
    
    try {
      // Get the auth token
      const token = localStorage.getItem('token');
      if (!token) {
        setCancelError('Необходима авторизация');
        return;
      }
      
      // Make API call to cancel ticket
      const response = await apiFetch<{error?: string}>(`/user_edits/tickets/${selectedTicket.id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if ('error' in response) {
        setCancelError(response.error || 'Ошибка при отмене регистрации');
        return;
      }
      
      // Success - add to cancelled IDs and update UI
      cancelTicket(selectedTicket.id.toString());
      
      // Display success message
      setCancelSuccess('Регистрация успешно отменена');
      
      // Update tickets list by removing the cancelled ticket
      setTickets(prev => prev.filter(t => t.id !== selectedTicket.id));
      setFilteredTickets(prev => prev.filter(t => t.id !== selectedTicket.id));
      
      // Dispatch event for other components
      const event = new CustomEvent('ticket-update', {
        detail: {
          source: 'user-event-tickets',
          action: 'cancel',
          ticketId: selectedTicket.id
        }
      });
      window.dispatchEvent(event);
      
      // Close modal after delay
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        isTicketBeingCancelled.current = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error cancelling ticket:', error);
      setCancelError('Произошла ошибка при отмене регистрации');
    } finally {
      setCancelRegistrationLoading(false);
    }
  }, [selectedTicket, cancelTicket]);

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
      <div className="h-full overflow-auto" ref={ticketsContainerRef}>
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
                  <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                    {(filters.status.length > 0 ? 1 : 0) + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0)}
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
              setFilters={setFilters}
              refreshTickets={refreshTickets}
              filters={filters}
            />
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            
            {filteredTickets.length > 0 && (
              <div className="space-y-4">
                {filteredTickets.map(ticket => {
                  if (!ticket || !ticket.event) return null;
                  
                  // Logic for rendering individual tickets
                  let effectiveStatus = ticket.status;
                  
                  // If event is completed and ticket not cancelled, mark as completed
                  if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
                    effectiveStatus = "completed";
                  }
                  
                  // Check if event is completed
                  const isEventCompleted = ticket.event.status === "completed";
                  
                  // Don't show cancel button for completed tickets or events
                  const showCancelButton = effectiveStatus !== "completed" && 
                                           effectiveStatus !== "cancelled" && 
                                           !isEventCompleted;
                                          
                  // Get status text and color
                  const statusText = (() => {
                    if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
                      return "Завершенный";
                    }
                    
                    switch (ticket.status) {
                      case "approved": return "Подтвержденный";
                      case "cancelled": return "Отмененный";
                      case "completed": return "Завершенный";
                      case "pending": return "В ожидании";
                      default: return ticket.status;
                    }
                  })();
                  
                  const statusColor = (() => {
                    switch (effectiveStatus as "pending" | "cancelled" | "completed" | "approved") {
                      case "approved": return "bg-green-100 text-green-800";
                      case "cancelled": return "bg-red-100 text-red-800";
                      case "completed": return "bg-gray-100 text-gray-800";
                      case "pending": return "bg-yellow-100 text-yellow-800";
                      default: return "bg-green-100 text-green-800";
                    }
                  })();
                  
                  // Format the dates
                  const formatDate = (dateString: string): string => {
                    try {
                      return new Date(dateString).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
                    } catch {
                      return dateString;
                    }
                  };
                  
                  const formatTime = (dateString: string): string => {
                    try {
                      return new Date(dateString).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                    } catch {
                      return "";
                    }
                  };
                  
                  // Check if dates are the same day
                  const checkSameDay = (date1: string, date2: string): boolean => {
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
                  
                  // Translate ticket type
                  const translateTicketType = (ticketType: string): string => {
                    const translations: Record<string, string> = {
                      'free': 'Бесплатный',
                      'standart': 'Стандартный',
                      'vip': 'VIP',
                      'org': 'Организатор'
                    };
                    return translations[ticketType.toLowerCase()] || ticketType;
                  };
                  
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
                              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor}`}
                            >
                              {statusText}
                            </div>
                            {showCancelButton && (
                              <button 
                                onClick={() => {
                                  setSelectedTicket(ticket);
                                  setIsModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-800 text-sm font-medium py-1 px-2 rounded transition-colors whitespace-nowrap"
                              >
                                Отменить
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex h-full">
                          {/* Ticket number section */}
                          <div className="flex-shrink-0 w-[90px] flex items-center justify-center">
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-2 shadow-sm h-full flex">
                              {/* Left column - title */}
                              <div className="flex-1 flex items-center justify-center pr-1 border-r border-orange-200">
                                <p className="[writing-mode:vertical-rl] rotate-180 text-xs text-gray-500 uppercase font-medium">
                                  НОМЕР БИЛЕТА
                                </p>
                              </div>
                              
                              {/* Right column - number */}
                              <div className="flex-1 flex items-center justify-center pl-1">
                                <p className="[writing-mode:vertical-rl] rotate-180 text-xl font-bold text-orange-600">
                                  #{ticket.ticket_number || ticket.id}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Main content */}
                          <div className="flex-1 ml-3">
                            {/* Event information */}
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="text-orange-500 flex-shrink-0 mt-1"><FaCalendarAlt /></span>
                                <span className="break-words">
                                  {formatDate(ticket.event.start_date)}
                                  {ticket.event.end_date && !checkSameDay(ticket.event.start_date, ticket.event.end_date) &&
                                    ` - ${formatDate(ticket.event.end_date)}`}
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="text-orange-500 flex-shrink-0 mt-1"><FaClock /></span>
                                <span className="break-words">
                                  {formatTime(ticket.event.start_date)}
                                  {ticket.event.end_date && 
                                    ` - ${formatTime(ticket.event.end_date)}`}
                                </span>
                              </div>
                              {ticket.event.location && (
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <span className="text-orange-500 flex-shrink-0 mt-1"><FaMapMarkerAlt /></span>
                                  <span className="break-words">{ticket.event.location}</span>
                                </div>
                              )}
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="text-orange-500 flex-shrink-0 mt-1"><FaTicketAlt /></span>
                                <span className="break-words">{translateTicketType(ticket.ticket_type)}</span>
                              </div>
                              
                              {/* Registration date display */}
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="text-orange-500 flex-shrink-0 mt-1"><FaRegCalendarCheck /></span>
                                <span className="break-words">
                                  Забронировано: {formatDate(ticket.registration_date)} 
                                  {ticket.registration_date && ` в ${formatTime(ticket.registration_date)}`}
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
            )}
            
            {filteredTickets.length === 0 && tickets.length > 0 && (
              <div className="text-center p-4 bg-gray-50 rounded-lg mt-4">
                <p className="text-gray-600">Нет билетов, соответствующих выбранным фильтрам</p>
                <button 
                  onClick={() => {
                    const resetButtonValues = { status: ['approved'], dateFrom: null, dateTo: null };
                    setFilters(resetButtonValues);
                    debugLog('UserEventTickets', 'Filters reset from no-results button', resetButtonValues);
                    // Инициируем подгрузку билетов с обновленными фильтрами
                    refreshTickets();
                  }}
                  className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium"
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
          </>
        )}
        
        {/* Add back the ConfirmModal */}
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
          isLoading={cancelRegistrationLoading}
          error={cancelError}
          success={cancelSuccess}
        />
      </div>
    </FiltersContext.Provider>
  );
});

// Add display name for debugging
UserEventTickets.displayName = 'UserEventTickets';

export default UserEventTickets;