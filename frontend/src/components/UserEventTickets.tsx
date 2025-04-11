import { useEffect, useState, useRef, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimesCircle, FaFilter, FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

// ========================================================================
// ОПТИМИЗИРОВАННОЕ ЛОГИРОВАНИЕ
// ========================================================================
// Принципы логирования:
// 1. Группировать логи по категориям: Lifecycle, Filters, API, Rendering
// 2. Минимизировать количество логов в рабочих версиях (только в dev-режиме)
// 3. Сокращать избыточную информацию, концентрироваться на ключевых данных
// 4. Избегать дублирования похожих логов на разных этапах
// 5. Обеспечить единый формат для удобного фильтрования в консоли
// ========================================================================
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

// Define interfaces for context and component props
interface FiltersContextType {
  filters: TicketFilters;
  setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
}

// Create context
const FiltersContext = React.createContext<FiltersContextType>({
  filters: { status: ['confirmed'], dateFrom: null, dateTo: null },
  setFilters: () => {}
});

// API response interface needed for requests
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

// Helper functions (moved outside components to be accessible everywhere)
// Unified handler for filter changes
const handleFilterChangeType = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null, localFilters: TicketFilters, setLocalFilters: React.Dispatch<React.SetStateAction<TicketFilters>>) => {
  if (type === 'status') {
    const newStatus = [...localFilters.status];
    const index = newStatus.indexOf(value as string);
    
    if (index === -1) {
      newStatus.push(value as string);
    } else if (newStatus.length > 1) { // Prevent unselecting the last status
      newStatus.splice(index, 1);
    }
    
    setLocalFilters({...localFilters, status: newStatus});
  } else if (type === 'dateFrom' || type === 'dateTo') {
    setLocalFilters({...localFilters, [type]: value});
  }
};

// Компонент панели фильтров (модернизированная версия)
const FilterPanel: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
  refreshTickets: () => void;
  filters: TicketFilters;
}> = ({ isOpen, onClose, setFilters, refreshTickets, filters }) => {
  // Local filters state - no longer using context
  const [localFilters, setLocalFilters] = useState<TicketFilters>({ 
    status: ['confirmed'], 
    dateFrom: null, 
    dateTo: null 
  });
  
  // При открытии модального окна синхронизируем локальные фильтры с глобальными
  useEffect(() => {
    if (isOpen) {
      // Синхронизируем локальные фильтры с глобальными вместо сброса на значения по умолчанию
      setLocalFilters(filters);
    }
  }, [isOpen, filters]);

  // Unified handler for filter changes
  const handleFilterChange = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null) => {
    handleFilterChangeType(type, value, localFilters, setLocalFilters);
  };
  
  // Применение фильтров
  const applyFilters = () => {
    debugLog('Filters', 'Applying filters', localFilters);
    setFilters(localFilters);
    onClose();
    // Use the refreshTickets function to ensure the API call uses the latest filters
    refreshTickets();
  };
  
  // Сброс фильтров
  const resetFilters = () => {
    const resetValues = { status: ['confirmed'], dateFrom: null, dateTo: null };
    setLocalFilters(resetValues);
    setFilters(resetValues); // Немедленно обновляем глобальные фильтры
    debugLog('FilterPanel', 'Filters reset', resetValues);
    // Закрываем модальное окно
    onClose();
    // Инициируем подгрузку билетов с обновленными фильтрами
    refreshTickets();
  };

  if (!isOpen) return null;

  const modalVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  // Create filter option component to avoid repetition
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
        value === 'confirmed' ? 'bg-green-200' :
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
                  value="confirmed" 
                  isSelected={localFilters.status.includes('confirmed')} 
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

// Unified ticket filtering utility
const applyFiltersToTickets = (ticketsToFilter: UserTicket[], filterSettings: TicketFilters) => {
  if (!ticketsToFilter.length) return [];
  
  debugLog('applyFiltersToTickets', 'Applying filters', filterSettings);
  
  // First filter by status
  let result = ticketsToFilter.filter(ticket => {
    if (!ticket || !ticket.event) return false;
    
    // Determine effective status considering event status
    let effectiveStatus = ticket.status;
    
    // If event is completed and ticket not cancelled, mark as completed
    if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
      effectiveStatus = "completed";
    }
    
    // Check status filter match
    if (filterSettings.status.length === 0) return true;
    
    let matches = filterSettings.status.includes(effectiveStatus);
    
    // Special handling for "approved" status (treat as "confirmed")
    if (effectiveStatus === "approved" && filterSettings.status.includes("confirmed")) {
      matches = true;
    }
    
    return matches;
  });
  
  // Then filter by date range if needed
  if (filterSettings.dateFrom) {
    const fromDate = new Date(filterSettings.dateFrom);
    result = result.filter(ticket => {
      if (!ticket || !ticket.registration_date) return false;
      const regDate = new Date(ticket.registration_date);
      return regDate >= fromDate;
    });
  }

  if (filterSettings.dateTo) {
    const toDate = new Date(filterSettings.dateTo);
    // Set time to end of day
    toDate.setHours(23, 59, 59, 999);
    result = result.filter(ticket => {
      if (!ticket || !ticket.registration_date) return false;
      const regDate = new Date(ticket.registration_date);
      return regDate <= toDate;
    });
  }
  
  return result;
};

// Restore required interfaces
interface APIResponse<T> {
  data?: T;
  items?: T;
  tickets?: T;
  error?: string;
  status?: number;
  aborted?: boolean;
  reason?: string;
}

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
  const { isLoading: authLoading, isAuthChecked } = useAuth();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>();
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [cancelledTicketIds, setCancelledTicketIds] = useState<Set<number>>(() => {
    const stored = localStorage.getItem('cancelledTicketIds');
    debugLog('Initialization', 'Loading cancelledTicketIds from localStorage', stored);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Настройки фильтров - по умолчанию показываем подтвержденные билеты
  const [filters, setFilters] = useState<TicketFilters>({
    status: ['confirmed'],
    dateFrom: null,
    dateTo: null
  });

  const { userData } = useAuth();
  const router = useRouter();
  const ticketsPerPage = 10;
  
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);
  const refreshCounter = useRef(0);
  const isInitialFetchDone = useRef(false);
  const hasInitialData = useRef(false);
  const isTicketBeingCancelled = useRef(false);
  const ticketsContainerRef = useRef<HTMLDivElement>(null);
  const previousPath = useRef<string | null>(null);
  const isFetching = useRef(false); // Track ongoing fetch

  // Создаем значение контекста
  const filtersContextValue = { filters, setFilters };

  // Функция для сортировки билетов по статусу и дате
  const sortByStatusAndDate = useCallback((tickets: UserTicket[]): UserTicket[] => {
    if (!tickets || !tickets.length) return [];
    
    // Приоритет статусов (от высшего к низшему)
    const statusPriority: Record<string, number> = {
      "confirmed": 0,
      "approved": 0, // Same priority as confirmed
      "pending": 1,
      "cancelled": 2,
      "completed": 3
    };
    
    return [...tickets].sort((a, b) => {
      // Validate data before sorting
      if (!a || !b || !a.event || !b.event) return 0;
      
      // First sort by status priority
      const aStatus = a.status || 'pending';
      const bStatus = b.status || 'pending';
      const statusDiff = (statusPriority[aStatus] ?? 999) - (statusPriority[bStatus] ?? 999);
      
      if (statusDiff !== 0) return statusDiff;
      
      // Then sort by event start date (closest first)
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

  // Common function to extract ticket data from API response
  const extractTicketsFromResponse = useCallback((response: APIResponse<UserTicket[]> | UserTicket[]): UserTicket[] => {
    let ticketsData: UserTicket[] = [];
    
    if (Array.isArray(response)) {
      debugLog('API', 'Response in direct array format');
      ticketsData = response;
    } else if (response && !("aborted" in response)) {
      if ("data" in response && response.data) {
        debugLog('API', 'Response in {data: [...]} format');
        ticketsData = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
      } else if ("items" in response && response.items) {
        debugLog('API', 'Response in {items: [...]} format');
        ticketsData = Array.isArray(response.items) ? response.items : [response.items as UserTicket];
      } else if ("tickets" in response && response.tickets) {
        debugLog('API', 'Response in {tickets: [...]} format');
        ticketsData = Array.isArray(response.tickets) ? response.tickets : [response.tickets as UserTicket];
      }
    }
    
    return ticketsData;
  }, []);
  
  // Create params for API requests
  const createApiParams = useCallback((page: number = 1, refresh: number = 0): Record<string, string | number> => {
    const cacheKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const params: Record<string, string | number> = {
      _nocache: cacheKey,
      page,
      per_page: ticketsPerPage
    };
    
    if (refresh) {
      params._refresh = refresh;
    }
    
    // Add filter parameters if set
    if (filters.dateFrom) {
      params.date_from = filters.dateFrom;
    }
    if (filters.dateTo) {
      params.date_to = filters.dateTo;
    }
    if (filters.status.length > 0) {
      params.status = filters.status.join(',');
    }
    
    return params;
  }, [filters, ticketsPerPage]);
  
  // Helper function to determine if a new ticket should replace existing one
  const shouldReplaceTicket = useCallback((existing: UserTicket, newTicket: UserTicket): boolean => {
    // Status priority (higher to lower)
    const statusPriority: Record<string, number> = {
      "confirmed": 0,
      "approved": 0, // Same priority as confirmed
      "pending": 1,
      "cancelled": 2,
      "completed": 3
    };
    
    // Compare status priorities
    return (statusPriority[newTicket.status] ?? 999) < (statusPriority[existing.status] ?? 999);
  }, []);
  
  // Process and deduplicate tickets
  const processTickets = useCallback((ticketsData: UserTicket[]): UserTicket[] => {
    if (!ticketsData || ticketsData.length === 0) return [];
    
    debugLog('Processing', 'Processing tickets', { count: ticketsData.length });
    
    // Create Map to guarantee uniqueness by ID
    const uniqueTicketsMap = new Map<number, UserTicket>();
    
    // Add only tickets with priority status
    ticketsData.forEach(ticket => {
      if (!ticket || !ticket.event) return;
      
      // Skip tickets that have been cancelled by the user
      if (cancelledTicketIds.has(ticket.id)) {
        debugLog('Processing', `Skipping cancelled ticket ID: ${ticket.id}`);
        return;
      }
      
      // Deep copy to prevent mutation
      const ticketCopy = { ...ticket, event: { ...ticket.event } };
      
      // Update ticket status based on event status
      // But don't change cancelled tickets
      if (ticketCopy.event.status === "completed" && ticketCopy.status !== "cancelled") {
        ticketCopy.status = "completed";
      }
      
      const existingTicket = uniqueTicketsMap.get(ticketCopy.id);
      
      // If ticket doesn't exist or has higher priority status
      if (!existingTicket || shouldReplaceTicket(existingTicket, ticketCopy)) {
        uniqueTicketsMap.set(ticketCopy.id, ticketCopy);
      }
    });
    
    // Extract unique tickets
    return Array.from(uniqueTicketsMap.values());
  }, [shouldReplaceTicket, cancelledTicketIds]);

  // Integrated filter function using both utilities
  const applyAllFilters = useCallback((ticketsToFilter: UserTicket[]) => {
    if (!ticketsToFilter.length) return [];
    
    debugLog('Filters', 'Applying all filters', { count: ticketsToFilter.length, filters });
    
    // Apply status and date filtering
    const filtered = applyFiltersToTickets(ticketsToFilter, filters);
    
    // Then sort the filtered tickets
    return sortByStatusAndDate(filtered);
  }, [filters, sortByStatusAndDate]);
  
  // Add refreshTickets for use with the ref
  const refreshTickets = useCallback(() => {
    debugLog('UserEventTickets', 'Manual refresh requested via ref');
    
    // Don't set loading state again if already loading
    if (!isLoading) {
      setIsLoading(true);
    }
    
    // Reset states for a clean fetch
    hasInitialData.current = false;
    fetchAttempted.current = false; 
    // setPage(1); // Commented out as setPage is not defined
    // setHasMore(true); // Commented out as setHasMore is not defined
    
    // Increment counter to trigger refresh
    refreshCounter.current += 1;
    
    // Directly call fetchTickets to ensure data refresh
    // Will be handled after fetchTickets is defined
    console.log('Refresh requested, will be handled after fetchTickets is defined');
  }, [isLoading]);
  
  // Define fetchTickets with useCallback before it's used
  const fetchTickets = useCallback(async () => {
    debugLog('API', 'fetchTickets function called - starting fetch process');
    // Prevent request if component not mounted
    if (!isMounted.current) {
      debugLog('Lifecycle', 'Component not mounted, but proceeding with fetch to ensure data refresh');
      // Proceed with fetch even if not mounted to ensure data refresh on remount
    }
    
    // If request already in progress, don't start a new one
    if (isFetching.current) {
      debugLog('Lifecycle', 'Request already in progress, duplicate prevented');
      return;
    }
    
    // Mark request attempt
    isFetching.current = true;
    fetchAttempted.current = true;
    setIsLoading(true);
    debugLog('API', 'Starting ticket fetch, refreshCounter=', refreshCounter.current);
    
    try {
      debugLog('API', 'Preparing to make API call for tickets');
      const token = localStorage.getItem('token');
      if (!token) {
        debugLog('Auth', 'Token not found');
        setError("Необходима авторизация");
        setIsLoading(false);
        isFetching.current = false;
        fetchAttempted.current = false;
        router.push('/');
        return;
      }
      
      // Get parameters for API request with stronger cache-busting
      const paramBase = createApiParams(1, refreshCounter.current);
      const params = {
        ...paramBase,
        _nocache: Date.now() + '_' + Math.random().toString(36).substring(2)
      };
      
      debugLog('API', 'Making API call to fetch tickets', params);
      debugLog('API', 'Before API call to /user_edits/my-tickets');
      // Add timeout to apiFetch to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timed out after 10 seconds')), 10000);
      });
      const responsePromise = apiFetch<APIResponse<UserTicket[]>>('/user_edits/my-tickets', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        bypassLoadingStageCheck: true,
        params
      });
      const response = await Promise.race([responsePromise, timeoutPromise]);
      
      debugLog('API', 'After API call to /user_edits/my-tickets, response received', response);
      // Correct the type issue with response
      const typedResponse = response as APIResponse<UserTicket[]> & { aborted?: boolean; reason?: unknown };
      if ('aborted' in typedResponse && typedResponse.aborted) {
        console.log('[fetchTickets] Fetch was aborted');
        if (typedResponse.reason) {
          console.log('[fetchTickets] Abort reason:', typedResponse.reason);
        }
        isFetching.current = false;
        return;
      }
        
      debugLog('API', 'Tickets response received');
      
      // Extract ticket data from response using our utility
      const ticketsData = extractTicketsFromResponse(response as APIResponse<UserTicket[]> | UserTicket[]);
      
      if (!ticketsData || ticketsData.length === 0) {
        debugLog('API', 'Tickets not found or empty response');
        setTickets([]);
        setFilteredTickets([]);
        setError(null);
        hasInitialData.current = true;
        isInitialFetchDone.current = true;
        setIsLoading(false);
        isFetching.current = false;
        fetchAttempted.current = false;
        return;
      }
        
      debugLog('API', `${ticketsData.length} tickets received`);
      
      // Process tickets with our utility
      const processedTickets = processTickets(ticketsData);
      
      debugLog('API', `${processedTickets.length} unique tickets after processing`);
      
      // Apply filters immediately
      const filteredResults = applyAllFilters(processedTickets);
      
      // Set both states in one batch
      setTickets(processedTickets);
      setFilteredTickets(filteredResults);
      setError(null);
      
      // Update flags to prevent repeat requests
      hasInitialData.current = true;
      isInitialFetchDone.current = true;
      
      // Clear loading state immediately
      setIsLoading(false);
      
      debugLog('API', 'Tickets load completed successfully');
    } catch (err) {
      debugLog('Error', 'Error loading tickets', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных');
      setIsLoading(false);
      isInitialFetchDone.current = true;
    } finally {
      // Reset request marker in any case
      debugLog('API', 'Fetch operation interrupted or aborted, resetting fetch state');
      isFetching.current = false;
      fetchAttempted.current = false;
    }
  }, [router, createApiParams, extractTicketsFromResponse, processTickets, applyAllFilters]);
  
  // Modified refreshCounter hook to avoid using .current in dependencies
  useEffect(() => {
    if (!isMounted.current) return;
    
    // Create a local copy of the counter to prevent re-triggers
    const currentRefreshCount = refreshCounter.current;
    
    // Only fetch if refreshCounter has been explicitly incremented
    if (currentRefreshCount > 0) {
      debugLog('UserEventTickets', `Handling refresh #${currentRefreshCount}`);
      
      // Ensure not already fetching
      if (!fetchAttempted.current) {
        // Выполняем запрос
        fetchTickets();
      } else {
        debugLog('UserEventTickets', 'Fetch already in progress, will retry in 500ms');
        setTimeout(() => {
          if (isMounted.current && !fetchAttempted.current) {
            fetchTickets();
          }
        }, 500);
      }
    }
  }, [fetchTickets]); // Remove refreshCounter.current from dependencies

  // Modified ticket update event listener to better handle external events
  useEffect(() => {
    const handleTicketUpdate = (event: Event) => {
      // Skip if this event was triggered by this component
      if (event instanceof CustomEvent && event.detail && event.detail.source === 'user-event-tickets') {
        debugLog('UserEventTickets', 'Ignoring our own ticket-update event');
        return;
      }
      
      // Do not process events while a ticket is being cancelled
      if (isTicketBeingCancelled.current) {
        debugLog('UserEventTickets', 'Skipping ticket-update event during active cancellation');
        return;
      }
      
      debugLog('UserEventTickets', 'External ticket-update event received');
      
      // Handle event with detailed ticket data
      if (event instanceof CustomEvent && event.detail) {
        const { source, action, newTicket, ticketId, preventRefresh } = event.detail;
        
        debugLog('UserEventTickets', 'Event details', { source, action, preventRefresh });
        
        // Skip refresh if explicitly prevented
        if (preventRefresh) {
          debugLog('UserEventTickets', 'Skipping refresh as requested by event');
          return;
        }
        
        // If the refresh flag is modified elsewhere and this is an external cancel event,
        // we should still refresh
        if (source !== 'user-event-tickets' && action === 'cancel' && ticketId) {
          debugLog('UserEventTickets', `External cancel received for ticket ${ticketId} - removing from list`);
          
          // Just remove the cancelled ticket without full refresh
          setTickets(prevTickets => prevTickets.filter(t => t.id !== ticketId));
          setFilteredTickets(prevFiltered => prevFiltered.filter(t => t.id !== ticketId));
          return;
        }
        
        // Handle registration events with complete ticket data
        if ((source === 'event-registration' || source === 'event-page') && action === 'register') {
          debugLog('UserEventTickets', 'Received registration event, source:', source);
          
          // Store a flag in sessionStorage to detect navigation from registration
          sessionStorage.setItem('recent_registration', 'true');
          
          // If we have the complete ticket data, add it directly
          if (newTicket) {
            debugLog('UserEventTickets', 'Received new ticket data, adding to list', newTicket);
            
            // Add the new ticket directly to the state without a full reload
            setTickets(prev => {
              // Check if we already have this ticket
              if (prev.some(t => t.id === newTicket.id)) {
                debugLog('UserEventTickets', 'Ticket already exists, not adding duplicate');
                return prev;
              }
              
              // Add the new ticket and process it
              debugLog('UserEventTickets', 'Adding new ticket to state');
              const updatedTickets = [...prev, newTicket];
              
              // Also update filtered tickets based on current filters
              setFilteredTickets(() => {
                // Apply filters to the new combined array
                return applyAllFilters(updatedTickets);
              });
              
              return updatedTickets;
            });
            
            // Mark data as loaded
            hasInitialData.current = true;
            isInitialFetchDone.current = true;
            return;
          }
        }
      }
      
      // For other events, do a full refresh
      debugLog('UserEventTickets', 'External event requires refresh - will fetchTickets()');
      refreshCounter.current += 1;
      fetchTickets();
    };
    
    window.addEventListener('ticket-update', handleTicketUpdate);
    
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate);
    };
  }, [fetchTickets, applyAllFilters]);

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
    if (!isMounted.current) {
      isMounted.current = true; // Reset mounted flag on remount
      debugLog('UserEventTickets', 'Component remounted, resetting isMounted to true');
    }
    
    debugLog('UserEventTickets', 'Component mounted or remounted, checking fetch necessity');
    
    // Fetch only if we don't have data yet and auth is checked
    if (tickets.length === 0 && isAuthChecked) {
      debugLog('UserEventTickets', 'No data loaded, triggering fetch on mount', { authLoading, isAuthChecked });
      setIsLoading(true);
      isFetching.current = false; // Force reset to allow fetch
      debugLog('UserEventTickets', 'Fetch operation started - setting isFetching to true');
      fetchTickets();
      
      // Add a safety timeout to reset isFetching if it gets stuck
      setTimeout(() => {
        if (isMounted.current && isFetching.current && tickets.length === 0) {
          debugLog('UserEventTickets', 'Fetch operation timed out after 5 seconds, resetting isFetching to allow retry');
          isFetching.current = false;
          setIsLoading(true); // Keep loading state to show skeleton
          fetchTickets(); // Retry fetch
        }
      }, 5000);
    } else if (tickets.length > 0) {
      debugLog('UserEventTickets', 'Data already loaded, skipping fetch');
      setIsLoading(false);
    } else {
      debugLog('UserEventTickets', 'Fetch in progress, auth not checked, or data pending, skipping duplicate fetch', { isFetching: isFetching.current, ticketsLength: tickets.length, isAuthChecked, authLoading });
    }

    // Устанавливаем таймер для автоматического сброса состояния загрузки
    const timer = setTimeout(() => {
      if (isMounted.current) {
        debugLog('UserEventTickets', 'Loading timeout triggered, resetting loading state');
        setIsLoading(false);
        if (!tickets.length && !isFetching.current) {
          debugLog('UserEventTickets', 'No data after timeout, resetting fetch state to allow retry');
          isFetching.current = false;
          isInitialFetchDone.current = false;
        }
      } else {
        debugLog('UserEventTickets', 'Loading timeout triggered, but component unmounted, resetting fetch state');
        isFetching.current = false;
      }
    }, 3000); // Таймаут 3 секунды для быстрого сброса
    
    return () => {
      clearTimeout(timer);
      debugLog('UserEventTickets', 'Component unmounting, marking as unmounted');
      isMounted.current = false;
      isFetching.current = false; // Reset fetching flag on unmount to allow retry on remount
      debugLog('UserEventTickets', 'Fetch flag reset on unmount - isFetching set to false');
    };
  }, [fetchTickets, tickets.length, isAuthChecked, authLoading]); // Depend on tickets.length, isAuthChecked, and authLoading

  // Separate effect to monitor auth changes for fetching
  useEffect(() => {
    if (isAuthChecked && !authLoading && tickets.length === 0 && !isFetching.current && isMounted.current) {
      debugLog('UserEventTickets', 'Auth conditions met, triggering fetch', { authLoading, isAuthChecked });
      setIsLoading(true);
      isFetching.current = true;
      fetchTickets();
    }
  }, [isAuthChecked, authLoading, tickets.length, fetchTickets]);

  // Additional effect to detect stuck fetches and retry
  useEffect(() => {
    if (isFetching.current && isMounted.current && tickets.length === 0) {
      const stuckFetchTimer = setTimeout(() => {
        if (isMounted.current && isFetching.current && tickets.length === 0) {
          debugLog('UserEventTickets', 'Fetch appears stuck after 5 seconds, resetting to retry');
          isFetching.current = false;
          setIsLoading(true); // Keep loading state to show skeleton
          fetchTickets();
        }
      }, 5000); // Retry after 5 seconds if fetch is stuck
      return () => clearTimeout(stuckFetchTimer);
    }
  }, [fetchTickets, tickets.length]);

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
            
            // Force a refresh since we might have new registration data
            refreshCounter.current += 1;
            
            // Use small delay to avoid concurrent requests
            setTimeout(() => {
              if (isMounted.current && !fetchAttempted.current) {
                fetchTickets();
              }
            }, 100);
          } else {
            // Still refresh, but with lower priority if no recent registration
            refreshCounter.current += 1;
            fetchTickets();
          }
        } catch (error) {
          // Default to regular refresh if sessionStorage access fails
          debugLog('Error', 'Error accessing sessionStorage:', error);
          refreshCounter.current += 1;
          fetchTickets();
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
          
          // Force refresh right away on initial mount
          refreshCounter.current += 1;
          fetchTickets();
        }
      }
    }

    // For Next.js App Router, add event listeners
    // Change from focus event to only popstate to prevent refreshes on clicks
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [fetchTickets, isLoading]); // Add isLoading as a dependency

  // New effect to handle focus/visibility changes (when user returns to the tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasInitialData.current) {
        debugLog('UserEventTickets', 'Tab became visible, but not refreshing tickets');
        // Do not refresh automatically on tab visibility
        // refreshCounter.current += 1;
        // fetchTickets();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchTickets]);

  // Update localStorage whenever cancelledTicketIds changes
  useEffect(() => {
    const arrayToStore = Array.from(cancelledTicketIds);
    debugLog('UserEventTickets', 'Saving cancelledTicketIds to localStorage', arrayToStore);
    localStorage.setItem('cancelledTicketIds', JSON.stringify(arrayToStore));
  }, [cancelledTicketIds]);

  // Add back the cancel functionality
  const handleCancelConfirm = async () => {
    // Set the flag to prevent event handling during cancellation
    isTicketBeingCancelled.current = true;
    
    // Reset states and set loading
    setCancelError(undefined);
    setCancelSuccess(undefined);
    setCancelLoading(true);
    
    try {
      if (!selectedTicket) {
        throw new Error('No ticket selected or user not authorized');
      }
      
      debugLog('UserEventTickets', 'Cancelling ticket:', selectedTicket.id);
      
      // Проверяем наличие userData и id пользователя
      if (!userData?.id) {
        throw new Error('Не удалось определить ID пользователя. Пожалуйста, обновите страницу или войдите заново.');
      }

      // Подготавливаем данные для запроса
      const requestData = {
        event_id: Number(selectedTicket.event.id),
        user_id: Number(userData.id)
      };

      // Проверяем, что оба значения корректны
      if (isNaN(requestData.event_id) || isNaN(requestData.user_id)) {
        throw new Error(`Неверный формат ID: event_id=${selectedTicket.event.id}, user_id=${userData.id}`);
      }

      const response = await apiFetch(`/registration/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        bypassLoadingStageCheck: true,
        data: requestData
      });
      
      // Handle successful cancellation
      debugLog('UserEventTickets', 'Ticket cancelled successfully:', response);
      setCancelSuccess('Билет успешно отменен!');
      
      // Save ticket info before we lose the reference
      const ticketId = selectedTicket.id;
      const eventId = selectedTicket.event.id;
      
      // Add the ticket ID to cancelledTicketIds to prevent it from being re-added
      setCancelledTicketIds(prev => {
        const newSet = new Set(prev).add(ticketId);
        debugLog('UserEventTickets', 'Added ticket to cancelledTicketIds', ticketId);
        return newSet;
      });
      
      // Local updates to UI - optimistic update
      // We remove the ticket from both states immediately
      const updatedTickets = tickets.filter(t => t.id !== ticketId);
      const updatedFilteredTickets = filteredTickets.filter(t => t.id !== ticketId);
      
      setTickets(updatedTickets);
      setFilteredTickets(updatedFilteredTickets);
      
      // Dispatch custom event to notify other components
      const ticketUpdateEvent = new CustomEvent('ticket-update', {
        detail: {
          source: 'user-event-tickets',
          action: 'cancel',
          ticketId: ticketId,
          eventId: eventId,
          preventRefresh: true // Add flag to prevent child components from triggering a refresh
        }
      });
      debugLog('UserEventTickets', 'Dispatching ticket-update event with preventRefresh flag');
      window.dispatchEvent(ticketUpdateEvent);
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setCancelLoading(false);
        // Clear the flag after modal is closed
        isTicketBeingCancelled.current = false;
      }, 1500);
      
    } catch (error: unknown) {
      console.error('CANCEL REQUEST - ERROR:');
      console.error('Error object:', error);
      
      // Try to extract more details from the error
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { status?: number, data?: unknown } };
        console.error('Error status:', apiError.response?.status);
        console.error('Error data:', apiError.response?.data);
      }
      
      // Log error message if available
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      
      // Reset states and set error
      const errorMsg = error instanceof Error 
        ? error.message 
        : 'Не удалось отменить билет. Пожалуйста, попробуйте снова.';
      
      setCancelError(errorMsg);
      setCancelLoading(false);
      
      // Clear the flag on error
      isTicketBeingCancelled.current = false;
    }
  };

  useEffect(() => {
    debugLog('Rendering', 'Rendering UserEventTickets UI, including filter panel');
  }, []); // Log once on mount

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
                  const showCancelButton = ticket.status !== "completed" && 
                                           ticket.status !== "cancelled" && 
                                           !isEventCompleted;
                                          
                  // Get status text and color
                  const statusText = (() => {
                    if (ticket.event.status === "completed" && ticket.status !== "cancelled") {
                      return "Завершенный";
                    }
                    
                    switch (ticket.status) {
                      case "confirmed": return "Подтвержденный";
                      case "approved": return "Подтвержденный";
                      case "cancelled": return "Отмененный";
                      case "completed": return "Завершенный";
                      case "pending": return "В ожидании";
                      default: return ticket.status;
                    }
                  })();
                  
                  const statusColor = (() => {
                    switch (effectiveStatus) {
                      case "confirmed": return "bg-green-100 text-green-800";
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
                    const resetValues = { status: ['confirmed'], dateFrom: null, dateTo: null };
                    setFilters(resetValues);
                    debugLog('UserEventTickets', 'Filters reset from no-results button', resetValues);
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
          isLoading={cancelLoading}
          error={cancelError}
          success={cancelSuccess}
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="p-4 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-400 border-r-transparent align-[-0.125em]" />
          </div>
        )}
      </div>
    </FiltersContext.Provider>
  );
});

// Add display name for debugging
UserEventTickets.displayName = 'UserEventTickets';

export default UserEventTickets;