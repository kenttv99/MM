import { useEffect, useState, useRef, useCallback, forwardRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimesCircle, FaFilter, FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

// Add debugLog at the module level (after imports)
const debugLog = (category: string, message: string, data?: unknown) => {
  const isDevMode = process.env.NODE_ENV === 'development';
  if (!isDevMode) return;

  const prefix = `UserEventTickets [${category}]:`;
  
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
  const { isAuth: _isAuth, isLoading: authLoading, isAuthChecked, userData } = useAuth();
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
  // Comment out or remove unused previousPath
  // const previousPath = useRef<string>('');
  const lastHiddenAt = useRef<number>(0);
  
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
  // const cancelTicket = useCallback((ticketId: string) => {
  //   setCancelledTicketIds(prev => {
  //     const newSet = new Set(prev);
  //     newSet.add(ticketId);
  //     return newSet;
  //   });
  // }, []);

  // Comment out or remove unused sortByStatusAndDate
  // const sortByStatusAndDate = useCallback((ticketsToSort: UserTicket[]) => {
  //   return [...ticketsToSort].sort((a, b) => {
  //     // Сортировка по статусу: pending, approved, completed, cancelled
  //     const statusOrder = {
  //       pending: 0,
  //       approved: 1,
  //       completed: 2,
  //       cancelled: 3
  //     };
  //     const statusDiff = statusOrder[a.status] - statusOrder[b.status];
  //     if (statusDiff !== 0) return statusDiff;
  //     
  //     // Если статусы одинаковые, сортируем по дате регистрации (новые сверху)
  //     return new Date(b.registration_date).getTime() - new Date(a.registration_date).getTime();
  //   });
  // }, []);

  // Применение всех фильтров
  const applyAllFilters = useCallback(
    (ticketsToFilter: UserTicket[]) => {
      return applyFiltersToTickets(ticketsToFilter, filters);
    },
    [filters]
  );
  
  const TICKETS_CACHE_KEY = 'tickets_cache';
  const TICKETS_CACHE_TIMESTAMP_KEY = 'tickets_cache_timestamp';
  const CACHE_VALIDITY = 300000; // 5 minutes (was 30000 - 30 seconds)

  const getCachedTickets = useCallback((): UserTicket[] | null => {
    const cached = localStorage.getItem(TICKETS_CACHE_KEY);
    const timestamp = localStorage.getItem(TICKETS_CACHE_TIMESTAMP_KEY);
    const now = Date.now();
    
    if (cached && cached !== '[]' && timestamp) {
      const cacheAge = now - parseInt(timestamp);
      debugLog('Cache', `Cache age: ${cacheAge}ms, validity: ${CACHE_VALIDITY}ms`);
      
      if (cacheAge < CACHE_VALIDITY) {
        try {
          const parsedData = JSON.parse(cached);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            debugLog('Cache', `Using valid cached tickets (${parsedData.length} items)`);
            return parsedData;
          }
        } catch (error) {
          debugLog('Cache', 'Error parsing cached data', error);
        }
      } else {
        debugLog('Cache', 'Cache expired', { cacheAge, validity: CACHE_VALIDITY });
      }
    } else {
      debugLog('Cache', 'Cache missing or empty', { cached: !!cached, isEmpty: cached === '[]' });
    }
    
    return null;
  }, []);

  const fetchTickets = useCallback(async () => {
    debugLog('API', '=== Starting fetchTickets execution ===', { userId: userData?.id, isFetching });
    
    if (!userData || !userData.id) {
      debugLog('API', 'User data or ID not available, skipping fetch');
      return;
    }

    // Если уже идет загрузка, не начинаем новую
    if (isFetching) {
      debugLog('API', 'Already fetching, skipping duplicate fetch');
      return;
    }

    setIsFetching(true);
    debugLog('API', 'Setting isFetching to true for tickets request');

    try {
      debugLog('API', 'Fetching tickets from server', { userId: userData.id });
      const response = await fetch(`/api/user/tickets?userId=${userData.id}`);
      
      if (!response.ok) {
        debugLog('API', 'Error fetching tickets', { status: response.status, statusText: response.statusText });
        throw new Error(`Failed to fetch tickets: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      debugLog('API', 'Tickets received from server', { count: data.length });

      // Обработка данных через applyAllFilters, если есть данные
      if (data && Array.isArray(data)) {
        setTickets(data);
        debugLog('API', 'Tickets state updated from server', { count: data.length });
        
        // Сохраняем билеты в кэш
        try {
          localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(TICKETS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          debugLog('Cache', 'Updated tickets cache', { count: data.length });
        } catch (error) {
          console.error('Error caching tickets:', error);
        }
      } else {
        debugLog('API', 'Server returned invalid data structure', data);
      }
    } catch (error) {
      debugLog('API', 'Error in fetchTickets', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      fetchAttempted.current = true;
      setIsFetching(false); // Гарантируем сброс флага в любом случае
      debugLog('API', '=== Completed fetchTickets execution ===', { isFetching: false });
    }
  }, [userData, isFetching]);
  
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

  // Ensure efficient event handling with useCallback
  const handleTicketUpdate = useCallback((event: Event) => {
    if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
      debugLog('UserEventTickets', 'Ignoring our own ticket-update event');
      return;
    }

    if (isTicketBeingCancelled.current) {
      debugLog('UserEventTickets', 'Skipping ticket-update event during active cancellation');
      return;
    }

    if (!isMounted.current || isFetching) {
      debugLog('UserEventTickets', 'Component not mounted or fetch in progress, skipping event');
      return;
    }

    debugLog('UserEventTickets', 'External ticket-update event received');

    if (event instanceof CustomEvent && event.detail) {
      const { source, action, newTicket, ticketId, preventRefresh } = event.detail;

      debugLog('UserEventTickets', 'Event details', { source, action, preventRefresh });

      if (preventRefresh) {
        debugLog('UserEventTickets', 'Skipping refresh as requested by event');
        return;
      }

      if (source !== 'user-event-tickets' && action === 'cancel' && ticketId) {
        debugLog('UserEventTickets', `External cancel received for ticket ${ticketId} - removing from list`);

        setTickets(prevTickets => prevTickets.filter(t => t.id !== ticketId));
        setFilteredTickets(prevFiltered => prevFiltered.filter(t => t.id !== ticketId));
        return;
      }

      if ((source === 'event-registration' || source === 'event-page') && action === 'register') {
        debugLog('UserEventTickets', 'Received registration event, source:', source);

        sessionStorage.setItem('recent_registration', 'true');

        if (newTicket) {
          debugLog('UserEventTickets', 'Received new ticket data, adding to list', newTicket);

          setTickets(prev => {
            if (prev.some(t => t.id === newTicket.id)) {
              debugLog('UserEventTickets', 'Ticket already exists, not adding duplicate');
              return prev;
            }

            const updatedTickets = [...prev, newTicket];
            setTimeout(() => {
              if (isMounted.current) {
                setFilteredTickets(applyAllFilters(updatedTickets));
              }
            }, 0);

            return updatedTickets;
          });

          hasInitialData.current = true;
          isInitialFetchDone.current = true;
          return;
        }
      }
    }

    if (!isFetching && !fetchAttempted.current) {
      debugLog('UserEventTickets', 'External event requires refresh - will fetchTickets()');
      fetchTickets();
    } else {
      debugLog('UserEventTickets', 'Skipping refresh due to ongoing fetch or attempt');
    }
  }, [fetchTickets, applyAllFilters, isFetching]);

  // Add event listener for ticket updates
  useEffect(() => {
    window.addEventListener('ticket-update', handleTicketUpdate);
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate);
    };
  }, [handleTicketUpdate]);

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

  // Fix dependencies for component mounting useEffect
  useEffect(() => {
    if (!isMounted.current) return;
    debugLog('UserEventTickets', 'Component mounted', { authLoading, isAuthChecked, ticketsLoaded: tickets.length });
    isMounted.current = true;

    // Check for cached tickets immediately on mount
    const cachedTickets = getCachedTickets();
    debugLog('UserEventTickets', 'Checked for cached tickets', { cachedTickets: cachedTickets ? cachedTickets.length : null, rawData: localStorage.getItem(TICKETS_CACHE_KEY) });
    if (cachedTickets && cachedTickets.length > 0) {
      debugLog('UserEventTickets', 'Applying cached tickets on mount', { count: cachedTickets.length });
      setTickets(cachedTickets);
      setIsLoading(false); // Reset loading state if cached data is available
      debugLog('UserEventTickets', 'Loading state reset to false due to cached tickets');
    } else {
      debugLog('UserEventTickets', 'No valid cached tickets found in localStorage');
    }

    // Only initiate fetch if not already loading and auth is checked
    if (!authLoading && isAuthChecked && !isLoading) {
      debugLog('UserEventTickets', 'Initiating ticket fetch on mount', { authLoading, isAuthChecked });
      fetchTickets();
    }

    return () => {
      debugLog('UserEventTickets', 'Component unmounting', { ticketsLoaded: tickets.length });
      isMounted.current = false;
    };
  }, [authLoading, isAuthChecked, isLoading, fetchTickets, tickets, getCachedTickets]);

  // Add effect to detect route changes and refresh tickets
  useEffect(() => {
    const handleRouteChange = () => {
      debugLog('UserEventTickets', 'Route change detected, forcing ticket refresh');
      fetchTickets();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handleRouteChange);
      window.addEventListener('pushstate', handleRouteChange);
      window.addEventListener('replacestate', handleRouteChange);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', handleRouteChange);
        window.removeEventListener('pushstate', handleRouteChange);
        window.removeEventListener('replacestate', handleRouteChange);
      }
    };
  }, [fetchTickets]);

  // Fix useEffect dependencies for handleVisibilityChange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt.current = Date.now();
        debugLog('UserEventTickets', `Page hidden at ${new Date().toLocaleTimeString()}`);
      } else if (lastHiddenAt.current > 0) {
        const now = Date.now();
        const hiddenDuration = now - lastHiddenAt.current;
        debugLog('UserEventTickets', 'Page became visible', { hiddenDuration });
        if (hiddenDuration > 60000 && isAuthChecked && !authLoading && userData) {
          debugLog('UserEventTickets', 'Page was hidden for over a minute, refreshing tickets', { hiddenDuration });
          fetchTickets();
        }
        lastHiddenAt.current = 0;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isAuthChecked, authLoading, userData, fetchTickets]);

  // Make sure filteredTicketsMemo has proper dependencies
  const filteredTicketsMemo = useMemo(() => {
    return applyAllFilters(tickets);
  }, [applyAllFilters, tickets]);

  // Use filteredTicketsMemo to set filteredTickets
  useEffect(() => {
    setFilteredTickets(filteredTicketsMemo);
  }, [filteredTicketsMemo]);

  // Ensure localStorage access for cancelled tickets is minimized
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

  // Add handleCancelConfirm function to handle ticket cancellation
  const handleCancelConfirm = useCallback(async () => {
    if (!selectedTicket) {
      setCancelError('Ошибка: билет не выбран');
      return;
    }
    setCancelRegistrationLoading(true);
    setCancelError('');
    setCancelSuccess('');
    try {
      debugLog('Cancellation', 'Sending cancellation request', { ticketId: selectedTicket.id });
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }
      const response = await apiFetch<APIResponse<unknown>>(`/registration/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        data: { registration_id: selectedTicket.id },
      });
      debugLog('Cancellation', 'Cancellation response received', response);
      if ('error' in response) {
        throw new Error(response.error ? response.error.toString() : 'Ошибка отмены регистрации');
      }
      setCancelSuccess('Регистрация успешно отменена');
      // Обновляем счетчик отмен для текущего билета
      const updatedTicket = { ...selectedTicket, cancellation_count: (selectedTicket.cancellation_count || 0) + 1, status: 'cancelled' as const };
      // Обновляем список билетов
      const updatedTickets = tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t);
      setTickets(updatedTickets);
      setFilteredTickets(applyAllFilters(updatedTickets));
      // Добавляем ID билета в список отмененных
      setCancelledTicketIds(prev => new Set(prev).add(updatedTicket.id.toString()));
      // Обновляем localStorage для отмененных билетов
      const idsArray = Array.from(new Set([...cancelledTicketIds, updatedTicket.id.toString()]));
      localStorage.setItem('cancelled_ticket_ids', JSON.stringify(idsArray));
      debugLog('Cancellation', 'Updated cancelled ticket IDs', idsArray);
      // Отправляем событие об обновлении билета
      if (typeof window !== 'undefined') {
      const event = new CustomEvent('ticket-update', {
        detail: {
            source: 'UserEventTickets',
          action: 'cancel',
            ticketId: updatedTicket.id,
            eventId: updatedTicket.event.id
        }
      });
      window.dispatchEvent(event);
        debugLog('Cancellation', 'Dispatched ticket-update event', { ticketId: updatedTicket.id });
      }
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setCancelSuccess('');
        isTicketBeingCancelled.current = false;
      }, 2000);
    } catch (error) {
      debugLog('Cancellation', 'Error during cancellation', error);
      setCancelError(error instanceof Error ? error.message : 'Неизвестная ошибка при отмене регистрации');
      setTimeout(() => {
        setCancelError('');
        isTicketBeingCancelled.current = false;
      }, 3000);
    } finally {
      setCancelRegistrationLoading(false);
    }
  }, [selectedTicket, applyAllFilters, cancelledTicketIds, tickets]);

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