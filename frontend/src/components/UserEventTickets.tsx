import { useEffect, useState, useRef, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimesCircle, FaFilter, FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading } from "@/contexts/LoadingContext";
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

// Helper functions (moved outside components to be accessible everywhere)
// Unified handler for filter changes
const handleFilterChangeType = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null, localFilters: TicketFilters, setLocalFilters: React.Dispatch<React.SetStateAction<TicketFilters>>) => {
  if (type === 'status') {
    const newStatus = [...localFilters.status];
    const index = newStatus.indexOf(value as string);
    
    if (index === -1) {
      newStatus.push(value as string);
    } else {
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
  onFilterChange?: (filters: TicketFilters) => void 
}> = ({ isOpen, onClose, onFilterChange }) => {
  // Local filters state - no longer using context
  const [localFilters, setLocalFilters] = useState<TicketFilters>({ 
    status: ['confirmed'], 
    dateFrom: null, 
    dateTo: null 
  });
  
  // При открытии модального окна загружаем текущие фильтры
  useEffect(() => {
    if (isOpen) {
      // Use default filters when opening
      setLocalFilters({ status: ['confirmed'], dateFrom: null, dateTo: null });
    }
  }, [isOpen]);

  // Unified handler for filter changes
  const handleFilterChange = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null) => {
    handleFilterChangeType(type, value, localFilters, setLocalFilters);
  };
  
  // Применение фильтров
  const applyFilters = () => {
    debugLog('FilterPanel', 'Applying filters', localFilters);
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

// Convert to forwardRef with imperative handle
const UserEventTickets = forwardRef<UserEventTicketsRef, UserEventTicketsProps>(
  (_, ref) => {
    const [tickets, setTickets] = useState<UserTicket[]>([]);
    const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelError, setCancelError] = useState<string | undefined>();
    const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    // Настройки фильтров - по умолчанию показываем подтвержденные билеты
    const [filters, setFilters] = useState<TicketFilters>({
      status: ['confirmed'],
      dateFrom: null,
      dateTo: null
    });

    const { userData, } = useAuth();
    const router = useRouter();
    const { /* currentStage */ } = useLoading();
    const ticketsPerPage = 10;
    
    const isMounted = useRef(true);
    const fetchAttempted = useRef(false);
    const refreshCounter = useRef(0);
    const isInitialFetchDone = useRef(false);
    const hasInitialData = useRef(false);
    const retryTimeout = useRef<NodeJS.Timeout | null>(null);
    const isTicketBeingCancelled = useRef(false);
    const ticketsContainerRef = useRef<HTMLDivElement>(null);
    
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
    }, [shouldReplaceTicket]);

    // Integrated filter function using both utilities
    const applyAllFilters = useCallback((ticketsToFilter: UserTicket[]) => {
      if (!ticketsToFilter.length) return [];
      
      debugLog('Filters', 'Applying all filters', { count: ticketsToFilter.length, filters });
      
      // Apply status and date filtering
      const filtered = applyFiltersToTickets(ticketsToFilter, filters);
      
      // Then sort the filtered tickets
      return sortByStatusAndDate(filtered);
    }, [filters, sortByStatusAndDate]);
    
    // Define fetchTickets with useCallback before it's used
    const fetchTickets = useCallback(async () => {
      // Prevent request if component not mounted
      if (!isMounted.current) {
        debugLog('Lifecycle', 'Component not mounted, request cancelled');
        return;
      }
      
      // If request already in progress, don't start a new one
      if (fetchAttempted.current) {
        debugLog('Lifecycle', 'Request already in progress, duplicate prevented');
        return;
      }
      
      // Mark request attempt
      fetchAttempted.current = true;
      setIsLoading(true);
      debugLog('API', 'Starting ticket fetch, refreshCounter=', refreshCounter.current);
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          debugLog('Auth', 'Token not found');
          setError("Необходима авторизация");
          setIsLoading(false);
          fetchAttempted.current = false;
          router.push('/');
          return;
        }
        
        // Get parameters for API request
        const params = createApiParams(1, refreshCounter.current);
        
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
            // If request cancelled due to loading stage mismatch, schedule retry
            debugLog('API', 'Request cancelled due to loading stage mismatch');
            
            if (retryTimeout.current) {
              clearTimeout(retryTimeout.current);
            }
            
            retryTimeout.current = setTimeout(() => {
              debugLog('API', 'Retrying request');
              fetchAttempted.current = false;
              refreshCounter.current += 1;
            }, 1000);
            
            return;
          }
        
          debugLog('API', 'Request cancelled', `Reason: ${response.reason}`);
          setError(`Запрос был прерван: ${response.reason}`);
          setIsLoading(false);
          fetchAttempted.current = false;
          // Важно: отмечаем загрузку как завершенную, чтобы UI не оставался в состоянии загрузки
          isInitialFetchDone.current = true;
          return;
        }
          
        debugLog('API', 'Tickets response received');
        
        // Extract ticket data from response using our utility
        const ticketsData = extractTicketsFromResponse(response);
        
        if (!ticketsData || ticketsData.length === 0) {
          debugLog('API', 'Tickets not found or empty response');
          setTickets([]);
          setFilteredTickets([]);
          setError(null);
          hasInitialData.current = true;
          isInitialFetchDone.current = true;
          setIsLoading(false);
          return;
        }
          
        debugLog('API', `${ticketsData.length} tickets received`);
        
        // Process tickets with our utility
        const processedTickets = processTickets(ticketsData);
        
        debugLog('API', `${processedTickets.length} unique tickets after processing`);
        
        // Set tickets
        setTickets(processedTickets);
        
        // Apply filters immediately (moved to the useEffect that watches tickets)
        
        setError(null);
        
        // Update flags to prevent repeat requests
        hasInitialData.current = true;
        isInitialFetchDone.current = true;
        
        // Note: We don't set isLoading(false) here because that happens in the useEffect
        // that processes tickets, to ensure we don't flash between loading states
        
        debugLog('API', 'Tickets load completed successfully');
      } catch (err) {
        debugLog('Error', 'Error loading tickets', err);
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных');
        setIsLoading(false);
        // Важно: отмечаем загрузку как завершенную, чтобы UI не оставался в состоянии загрузки
        isInitialFetchDone.current = true;
      } finally {
        // Reset request marker in any case
        fetchAttempted.current = false;
      }
    }, [router, createApiParams, extractTicketsFromResponse, processTickets]);
    
    // Define loadMoreTickets with useCallback before it's used
    const loadMoreTickets = useCallback(async () => {
      if (isLoadingMore || !hasMore) return;
      
      setIsLoadingMore(true);
      const nextPage = page + 1;
      debugLog('Pagination', `Loading more tickets, page ${nextPage}`);
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError("Необходима авторизация");
          setIsLoadingMore(false);
          router.push('/');
          return;
        }
        
        // Save current ticket IDs before request
        const currentTicketIds = new Set(tickets.map(ticket => ticket.id));
        
        const params = createApiParams(nextPage, refreshCounter.current);
        
        const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
          method: "GET",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          bypassLoadingStageCheck: true,
          params
        });
        
        debugLog('Pagination', 'Load more response received');
        
        const ticketsData = extractTicketsFromResponse(response);
        
        if (!ticketsData || ticketsData.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }
        
        // Process tickets
        const processedTickets = processTickets(ticketsData);
        
        // Filter only new tickets not already in the list
        const newTickets = processedTickets.filter(ticket => !currentTicketIds.has(ticket.id));
            
        if (newTickets.length > 0) {
          // Update tickets without triggering another processing cycle
          const updatedTickets = [...tickets, ...newTickets];
          setTickets(updatedTickets);
          
          // Apply filters to combined array
          const filteredResults = applyAllFilters(updatedTickets);
          setFilteredTickets(filteredResults);
          
          setPage(nextPage);
          
          // If we got fewer tickets than requested, there are no more
          setHasMore(newTickets.length >= ticketsPerPage);
        } else {
          setHasMore(false);
        }
        
        // Small delay before allowing next load
        setTimeout(() => {
          setIsLoadingMore(false);
        }, 300);
      } catch (err) {
        debugLog('Error', 'Error loading more tickets', err);
        setIsLoadingMore(false);
      }
    }, [isLoadingMore, hasMore, page, tickets, router, ticketsPerPage, createApiParams, extractTicketsFromResponse, processTickets, applyAllFilters]);
    
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
          const { source, action, newTicket, ticketId, needsRefresh } = event.detail;
          
          debugLog('UserEventTickets', 'Event details', { source, action, needsRefresh });
          
          // Explicitly check the needsRefresh flag and log for debugging
          if (needsRefresh === false) {
            debugLog('UserEventTickets', 'needsRefresh is explicitly false, skipping refresh');
            return;
          }
          
          // If the refresh flag is modified elsewhere and this is an external cancel event,
          // we should still avoid refreshing since we've already handled it locally
          if (source !== 'user-event-tickets' && action === 'cancel' && ticketId) {
            debugLog('UserEventTickets', `External cancel received for ticket ${ticketId} - no refresh needed`);
            return;
          }
          
          // Handle registration events with complete ticket data
          if (source === 'event-registration' && action === 'register' && newTicket) {
            debugLog('UserEventTickets', 'Received new ticket registration data', newTicket);
            
            // Add the new ticket directly to the state without a full reload
            setTickets(prev => {
              // Check if we already have this ticket
              if (prev.some(t => t.id === newTicket.id)) {
                debugLog('UserEventTickets', 'Ticket already exists, not adding duplicate');
                return prev;
              }
              
              // Add the new ticket and process it
              debugLog('UserEventTickets', 'Adding new ticket to state');
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
          debugLog('UserEventTickets', 'External event requires refresh - will fetchTickets()');
          refreshCounter.current += 1;
          fetchTickets();
        }
      };
      
      window.addEventListener('ticket-update', handleTicketUpdate);
      
      return () => {
        window.removeEventListener('ticket-update', handleTicketUpdate);
      };
    }, [fetchTickets]);

    // Add scroll event listener for infinite scrolling
    useEffect(() => {
      const container = ticketsContainerRef.current;
      if (!container) return;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        // Начинаем подгрузку когда пользователь прокрутил до 80% высоты контента
        // Это обеспечит более плавную подгрузку до того, как пользователь достигнет конца списка
        if (scrollHeight - scrollTop - clientHeight < scrollHeight * 0.2 && !isLoadingMore && hasMore) {
          debugLog('UserEventTickets', 'Scrolled near bottom, loading more tickets');
          loadMoreTickets();
        }
      };

      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }, [isLoadingMore, hasMore, loadMoreTickets]);

    // Modified cancel ticket confirmation with proper logging and flag consistency
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
        
        // Update local ticket state (for optimistic update)
        setTickets(currentTickets => 
          currentTickets.filter(ticket => ticket.id !== selectedTicket.id)
        );
        
        // IMPORTANT: Create a deep copy of the ticket to prevent React state references from being passed along
        // This ensures other components don't have direct references to our state
        const ticketDetails = {
          ticketId: selectedTicket.id,
          eventId: selectedTicket.event.id
        };
        
        // Dispatch custom event to notify other components but with needsRefresh:false
        const ticketUpdateEvent = new CustomEvent('ticket-update', {
          detail: {
            source: 'user-event-tickets',
            action: 'cancel',
            ticketId: ticketDetails.ticketId,
            eventId: ticketDetails.eventId,
            needsRefresh: false
          }
        });
        debugLog('UserEventTickets', 'Dispatching ticket-update event with needsRefresh:false');
        window.dispatchEvent(ticketUpdateEvent);
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedTicket(null);
          setCancelLoading(false);
          // Clear the flag after modal is closed
          isTicketBeingCancelled.current = false;
        }, 1500);
        
      } catch (err: unknown) {
        console.error('CANCEL REQUEST - ERROR:');
        console.error('Error object:', err);
        
        // Try to extract more details from the error
        if (err && typeof err === 'object' && 'response' in err) {
          const apiError = err as any; // Type assertion for logging purposes
          console.error('Error status:', apiError.response?.status);
          console.error('Error data:', apiError.response?.data);
        }
        
        // Log error message if available
        if (err instanceof Error) {
          console.error('Error message:', err.message);
        }
        
        // Reset states and set error
        const errorMsg = err instanceof Error 
          ? err.message 
          : 'Не удалось отменить билет. Пожалуйста, попробуйте снова.';
        
        setCancelError(errorMsg);
        setCancelLoading(false);
        
        // Clear the flag on error
        isTicketBeingCancelled.current = false;
      }
    };

    // Process tickets when they are fetched - modified to avoid recursion
    useEffect(() => {
      if (tickets.length > 0) {
        debugLog('UserEventTickets', 'Processing tickets data', { count: tickets.length });
        
        // Group tickets by event_id to remove duplicates
        const ticketsByEvent: Record<string, UserTicket> = {};
        
        // First pass: group by event ID
        tickets.forEach(ticket => {
          if (!ticket || !ticket.event) return;
          
          const eventId = ticket.event.id;
          const ticketKey = String(eventId);
          
          // Skip tickets without event id
          if (!eventId) return;
          
          // Check for newer status based on registration_date
          if (!ticketsByEvent[ticketKey] || 
              new Date(ticket.registration_date) > new Date(ticketsByEvent[ticketKey].registration_date)) {
            ticketsByEvent[ticketKey] = ticket;
          }
        });
        
        debugLog('UserEventTickets', 'Grouped tickets by event', { count: Object.keys(ticketsByEvent).length });
        
        // Convert to array
        const uniqueTickets = Object.values(ticketsByEvent);
        debugLog('UserEventTickets', 'Unique tickets before filtering', { count: uniqueTickets.length });
        
        // Больше не фильтруем здесь отмененные билеты, оставляем это для applyAllFilters
        const sortedTickets = sortByStatusAndDate(uniqueTickets);
        
        // Применяем фильтры
        const filtered = applyAllFilters(sortedTickets);
        setFilteredTickets(filtered);
        
        // Завершаем загрузку
        setIsLoading(false);
      } else if (isInitialFetchDone.current) {
        // Если билетов нет, но загрузка завершена, тоже убираем индикатор загрузки
        setIsLoading(false);
      }
    }, [tickets, sortByStatusAndDate, applyAllFilters]);

    // Обработчик обновления счетчика refreshCounter
    useEffect(() => {
      if (!isMounted.current || refreshCounter.current === 0) return;
      
      debugLog('UserEventTickets', `Handling refresh #${refreshCounter.current}`);
      
      // Выполняем запрос
      fetchTickets();
    }, [refreshCounter.current]); // eslint-disable-line react-hooks/exhaustive-deps

    // Effect to fetch tickets when the component mounts
    useEffect(() => {
      // Предотвращаем запросы, если компонент не смонтирован
      if (!isMounted.current) return;
      
      // Предотвращаем повторные запросы при каждом ре-рендере
      if (isInitialFetchDone.current) {
        debugLog('UserEventTickets', 'Initial fetch already completed, skipping');
        return;
      }
      
      debugLog('UserEventTickets', 'Component mounted, triggering initial fetch');
      
      // Инициируем начальную загрузку
      fetchTickets();
      
      // Устанавливаем таймер для автоматического сброса состояния загрузки
      // на случай, если что-то пойдет не так
      const timer = setTimeout(() => {
        if (isLoading) {
          debugLog('UserEventTickets', 'Loading timeout triggered, resetting loading state');
          setIsLoading(false);
          isInitialFetchDone.current = true;
        }
      }, 5000); // 5 секунд таймаута
      
      return () => clearTimeout(timer);
    }, [fetchTickets, isLoading]);

    // Add refreshTickets for use with the ref
    const refreshTickets = useCallback(() => {
      debugLog('UserEventTickets', 'Manual refresh requested via ref');
      
      // Reset state
      setIsLoading(true);
      hasInitialData.current = false;
      fetchAttempted.current = false;
      setPage(1);
      setHasMore(true);
      
      // Increment counter to trigger refresh
      refreshCounter.current += 1;
      
      // Важно: вызовите fetchTickets напрямую для немедленной загрузки
      fetchTickets();
    }, [fetchTickets]);
    
    // Expose methods to parent components via ref
    React.useImperativeHandle(ref, () => ({
      refreshTickets
    }), [refreshTickets]);

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
                onFilterChange={(newFilters) => {
                  setFilters(newFilters);
                  // Apply filters to tickets
                  if (tickets.length > 0) {
                    const filtered = applyFiltersToTickets(tickets, newFilters);
                    // Sort the filtered tickets
                    const sortedFiltered = sortByStatusAndDate(filtered);
                    setFilteredTickets(sortedFiltered);
                  }
                }}
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
                                    setCancelError(undefined);
                                    setCancelSuccess(undefined);
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
                    onClick={() => setFilters({ status: ['confirmed'], dateFrom: null, dateTo: null })}
                    className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium"
                  >
                    Сбросить фильтры
                  </button>
                </div>
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
          
          {/* Loading indicator */}
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