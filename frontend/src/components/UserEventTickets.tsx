import { useEffect, useState, useRef, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimesCircle, FaFilter, FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

// Simple debug logger for development
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

// Define ref type for external access
export interface UserEventTicketsRef {
  refreshTickets: () => void;
}

// Define props type
type UserEventTicketsProps = Record<string, unknown>;

// User ticket interface
interface UserTicket {
  id: number;
  event: EventData;
  ticket_type: string;
  registration_date: string;
  status: "pending" | "cancelled" | "completed" | "approved";
  cancellation_count?: number;
  ticket_number?: string;
}

// Interface for filters
interface TicketFilters {
  status: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

// API response interface
interface APIResponse<T> {
  data?: T;
  items?: T;
  tickets?: T;
  error?: string;
  status?: number;
}

// Loading skeleton component for tickets
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
        {/* Vertical ticket number */}
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
        
        {/* Main content */}
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

// Filter panel component
const FilterPanel: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
  refreshTickets: () => void;
  filters: TicketFilters;
}> = ({ isOpen, onClose, setFilters, refreshTickets, filters }) => {
  // Local filter state
  const [localFilters, setLocalFilters] = useState<TicketFilters>({ 
    status: filters.status, 
    dateFrom: filters.dateFrom, 
    dateTo: filters.dateTo 
  });
  
  // Sync with global filters when opened
  useEffect(() => {
    if (isOpen) {
      debugLog('FilterPanel', 'Modal opened, syncing filters from global state', filters);
      setLocalFilters(filters);
    }
  }, [isOpen, filters]);

  // Handle filter changes
  const handleFilterChange = (type: 'status' | 'dateFrom' | 'dateTo', value: string | null) => {
    handleFilterChangeType(type, value, localFilters, setLocalFilters);
  };
  
  // Apply filters
  const applyFilters = () => {
    debugLog('Filters', 'Applying filters', localFilters);
    setFilters(localFilters);
    onClose();
    setTimeout(() => {
      refreshTickets();
    }, 0);
  };
  
  // Reset filters
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
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Статус билета</h4>
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
              <FilterOption 
                label="Ожидающие" 
                value="pending" 
                isSelected={localFilters.status.includes('pending')} 
              />
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Дата регистрации</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">С</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value || null)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">По</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value || null)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
            >
              Сбросить
            </button>
            <div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 mr-2 focus:outline-none"
              >
                Отмена
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
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

// Confirmation modal component
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
  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-xl p-5 shadow-xl w-full max-w-md"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            disabled={isLoading}
          >
            <FaTimesCircle size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600">{message}</p>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg">
              {success}
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 mr-2 focus:outline-none"
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
            disabled={isLoading || !!success}
          >
            {isLoading ? (
              <div className="flex items-center">
                <span className="animate-spin mr-2">⏳</span> Отмена...
              </div>
            ) : 'Подтвердить'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Constants
const TICKETS_CACHE_KEY = 'user_tickets';
const TICKETS_CACHE_TIMESTAMP_KEY = 'user_tickets_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// The main component
const UserEventTickets = forwardRef<UserEventTicketsRef, UserEventTicketsProps>((_, ref) => {
  const { userData, isLoading: authLoading, isAuthChecked } = useAuth();
  const router = useRouter();
  
  // Component state
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TicketFilters>({
    status: ['approved'], // Default filter to show approved tickets
    dateFrom: null,
    dateTo: null
  });
  
  // UI state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelRegistrationLoading, setCancelRegistrationLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  
  // Refs for tracking component lifecycle
  const isMounted = useRef(false);
  const isTicketBeingCancelled = useRef(false);
  
  // Apply filters to tickets
  const applyFilters = useCallback((ticketsToFilter: UserTicket[]) => {
    debugLog('applyFiltersToTickets', 'Applying filters', filters);
    
    return ticketsToFilter.filter(ticket => {
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(ticket.status)) {
        return false;
      }
      
      // Date range filters
      if (filters.dateFrom || filters.dateTo) {
        const ticketDate = new Date(ticket.registration_date);
        
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (ticketDate < fromDate) return false;
        }
        
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          // Set time to end of day
          toDate.setHours(23, 59, 59, 999);
          if (ticketDate > toDate) return false;
        }
      }
      
      return true;
    });
  }, [filters]);
  
  // Get tickets from cache
  const getCachedTickets = useCallback(() => {
    try {
      const cached = localStorage.getItem(TICKETS_CACHE_KEY);
      const timestamp = localStorage.getItem(TICKETS_CACHE_TIMESTAMP_KEY);
      const now = Date.now();
      
      if (!cached || !timestamp) {
        return null;
      }
      
      // Check if cache is still valid
      if (now - parseInt(timestamp) > CACHE_DURATION) {
        return null;
      }
      
      const parsedData = JSON.parse(cached) as UserTicket[];
      return parsedData;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }, []);
  
  // Fetch tickets from API
  const fetchTickets = useCallback(async () => {
    if (!userData || !userData.id) {
      setIsLoading(false);
      return;
    }
    
    if (isFetching) {
      return;
    }
    
    setIsFetching(true);
    setError(null);
    
    try {
      // Construct query parameters from filters
      const queryParams = new URLSearchParams();
      
      if (filters.status.length > 0) {
        queryParams.append('status', filters.status.join(','));
      }
      
      if (filters.dateFrom) {
        queryParams.append('dateFrom', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        queryParams.append('dateTo', filters.dateTo);
      }
      
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      
      // Use apiFetch for consistent error handling
      const response = await apiFetch<APIResponse<UserTicket[]> | UserTicket[]>(`/user/tickets${queryString}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      // Handle error in response
      if (response && typeof response === 'object' && !Array.isArray(response) && 'error' in response) {
        throw new Error(typeof response.error === 'string' ? response.error : 'Ошибка загрузки билетов');
      }
      
      // Extract data from response
      let ticketData: UserTicket[] = [];
      
      if (Array.isArray(response)) {
        ticketData = response;
      } else if (response && typeof response === 'object') {
        if ('data' in response && Array.isArray(response.data)) {
          ticketData = response.data;
        } else if ('items' in response && Array.isArray(response.items)) {
          ticketData = response.items;
        } else if ('tickets' in response && Array.isArray(response.tickets)) {
          ticketData = response.tickets;
        }
      }
      
      // Set tickets
      setTickets(ticketData);
      
      // Apply filters and update filtered tickets
      const filtered = applyFilters(ticketData);
      setFilteredTickets(filtered);
      
      // Cache tickets
      try {
        localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(ticketData));
        localStorage.setItem(TICKETS_CACHE_TIMESTAMP_KEY, Date.now().toString());
      } catch (error) {
        console.error('Error caching tickets:', error);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось загрузить билеты. Пожалуйста, попробуйте позже.');
      setTickets([]);
      setFilteredTickets([]);
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [userData, isFetching, filters, applyFilters]);
  
  // Expose refreshTickets to parent components via ref
  React.useImperativeHandle(ref, () => ({
    refreshTickets: () => {
      fetchTickets();
    }
  }));
  
  // Cancel ticket registration
  const handleCancelConfirm = useCallback(async () => {
    if (!selectedTicket) {
      setCancelError('Ошибка: билет не выбран');
      return;
    }
    
    setCancelRegistrationLoading(true);
    setCancelError('');
    setCancelSuccess('');
    isTicketBeingCancelled.current = true;
    
    try {
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
      
      if ('error' in response) {
        throw new Error(response.error ? response.error.toString() : 'Ошибка отмены регистрации');
      }
      
      setCancelSuccess('Регистрация успешно отменена');
      
      // Update the ticket in the list
      const updatedTicket = { 
        ...selectedTicket, 
        cancellation_count: (selectedTicket.cancellation_count || 0) + 1, 
        status: 'cancelled' as const 
      };
      
      // Update tickets list
      const updatedTickets = tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t);
      setTickets(updatedTickets);
      
      // Apply filters and update filtered tickets
      const filtered = applyFilters(updatedTickets);
      setFilteredTickets(filtered);
      
      // Dispatch event for other components
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
      }
      
      // Close modal after delay
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setCancelSuccess('');
        isTicketBeingCancelled.current = false;
      }, 2000);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Неизвестная ошибка при отмене регистрации');
      setTimeout(() => {
        setCancelError('');
        isTicketBeingCancelled.current = false;
      }, 3000);
    } finally {
      setCancelRegistrationLoading(false);
    }
  }, [selectedTicket, tickets, applyFilters]);
  
  // Handle ticket update events
  const handleTicketUpdate = useCallback((event: Event) => {
    if (!isMounted.current || isTicketBeingCancelled.current || isFetching) {
      return;
    }
    
    if (event instanceof CustomEvent && event.detail) {
      const { source, action, newTicket, ticketId } = event.detail;
      
      // Skip our own events
      if (source === 'UserEventTickets') {
        return;
      }
      
      // Handle external cancellation
      if (action === 'cancel' && ticketId) {
        const updatedTickets = tickets.filter(t => t.id !== ticketId);
        setTickets(updatedTickets);
        
        // Apply filters and update filtered tickets
        const filtered = applyFilters(updatedTickets);
        setFilteredTickets(filtered);
        return;
      }
      
      // Handle new ticket registration
      if (action === 'register' && newTicket) {
        // Check if ticket already exists
        if (!tickets.some(t => t.id === newTicket.id)) {
          const updatedTickets = [...tickets, newTicket];
          setTickets(updatedTickets);
          
          // Apply filters and update filtered tickets
          const filtered = applyFilters(updatedTickets);
          setFilteredTickets(filtered);
        }
        return;
      }
    }
    
    // If none of the specific events matched, refresh tickets
    fetchTickets();
  }, [tickets, isFetching, applyFilters, fetchTickets]);
  
  // Add event listener for ticket updates
  useEffect(() => {
    window.addEventListener('ticket-update', handleTicketUpdate);
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate);
    };
  }, [handleTicketUpdate]);
  
  // Initial data loading
  useEffect(() => {
    isMounted.current = true;
    
    // First check if we have cached data
    const cachedTickets = getCachedTickets();
    
    if (cachedTickets && cachedTickets.length > 0) {
      setTickets(cachedTickets);
      const filtered = applyFilters(cachedTickets);
      setFilteredTickets(filtered);
      setIsLoading(false);
    }
    
    // If authentication is complete, fetch fresh data
    if (isAuthChecked && !authLoading) {
      fetchTickets();
    } else {
      // If not yet authenticated, ensure we're not stuck in loading state
      setIsLoading(false);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [isAuthChecked, authLoading, fetchTickets, getCachedTickets, applyFilters]);
  
  // Render ticket status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Подтвержден
          </span>
        );
      case 'completed':
        return (
          <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Завершен
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Отменен
          </span>
        );
      case 'pending':
        return (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Ожидание
          </span>
        );
      default:
        return (
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {status}
          </span>
        );
    }
  };
  
  // Render ticket card
  const renderTicket = (ticket: UserTicket) => {
    const eventDate = new Date(ticket.event.start_date);
    const formattedDate = eventDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const registrationDate = new Date(ticket.registration_date);
    const formattedRegistrationDate = registrationDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    return (
      <div key={ticket.id} className="bg-white rounded-lg p-4 shadow-sm border border-orange-50 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium text-gray-800 truncate">{ticket.event.title}</h3>
          {renderStatusBadge(ticket.status)}
        </div>
        
        <div className="flex">
          <div className="flex-shrink-0 w-[90px] flex items-center justify-center">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-3 shadow-sm">
              <div className="text-orange-700 font-bold tracking-wider text-2xl text-center">
                {ticket.ticket_number || `#${ticket.id}`}
              </div>
            </div>
          </div>
          
          <div className="flex-1 ml-3">
            <div className="space-y-2">
              <div className="flex items-start">
                <FaCalendarAlt className="h-4 w-4 text-orange-500 mt-0.5 mr-2" />
                <span className="text-gray-700">{formattedDate}</span>
              </div>
              
              <div className="flex items-start">
                <FaClock className="h-4 w-4 text-orange-500 mt-0.5 mr-2" />
                <span className="text-gray-700">{formattedTime}</span>
              </div>
              
              <div className="flex items-start">
                <FaMapMarkerAlt className="h-4 w-4 text-orange-500 mt-0.5 mr-2" />
                <span className="text-gray-700">{ticket.event.location || 'Место не указано'}</span>
              </div>
              
              <div className="flex items-start">
                <FaTicketAlt className="h-4 w-4 text-orange-500 mt-0.5 mr-2" />
                <span className="text-gray-700">{ticket.ticket_type || 'Стандартный'}</span>
              </div>
              
              <div className="flex items-start">
                <FaRegCalendarCheck className="h-4 w-4 text-orange-500 mt-0.5 mr-2" />
                <span className="text-gray-700">Регистрация: {formattedRegistrationDate}</span>
              </div>
            </div>
            
            {ticket.status !== 'cancelled' && ticket.status !== 'completed' && (
              <div className="mt-4">
                <button 
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1 text-sm text-white bg-red-500 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
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
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Мои билеты</h2>
        <button
          onClick={() => setIsFilterPanelOpen(true)}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <FaFilter className="mr-2" />
          Фильтры
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(3)].map((_, index) => (
            <TicketSkeleton key={index} />
          ))}
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTickets.map(ticket => renderTicket(ticket))}
        </div>
      ) : (
        <div className="bg-gray-50 text-gray-600 p-8 rounded-lg text-center">
          <FaTicketAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-xl font-medium mb-2">Нет билетов</h3>
          <p>
            {tickets.length > 0
              ? 'По выбранным фильтрам не найдено билетов'
              : 'У вас еще нет ни одного билета'
            }
          </p>
        </div>
      )}
      
      {/* Filter panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        setFilters={setFilters}
        refreshTickets={fetchTickets}
        filters={filters}
      />
      
      {/* Cancel confirmation modal */}
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!cancelRegistrationLoading) {
            setIsModalOpen(false);
            setSelectedTicket(null);
          }
        }}
        onConfirm={handleCancelConfirm}
        title="Подтверждение отмены"
        message={`Вы уверены, что хотите отменить регистрацию на мероприятие "${selectedTicket?.event.title || ''}"?`}
        isLoading={cancelRegistrationLoading}
        error={cancelError}
        success={cancelSuccess}
      />
    </div>
  );
});

// Add display name for better debugging
UserEventTickets.displayName = 'UserEventTickets';

export default UserEventTickets;