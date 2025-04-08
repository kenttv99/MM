import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
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

interface UserTicket {
  id: number;
  event: EventData;
  ticket_type: string;
  registration_date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
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

const UserEventTickets = () => {
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
  const ticketsPerPage = 3;
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>(undefined);

  // Add logging for component lifecycle
  useEffect(() => {
    console.log(`UserEventTickets: Component mounted, current stage: ${currentStage}`);
    return () => {
      console.log("UserEventTickets: Component unmounted");
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, [currentStage]);

  // Listen for navigation and force refresh when the pathname changes
  useEffect(() => {
    console.log(`UserEventTickets: Pathname changed to ${pathname}`);
    
    // Check if we're on a profile-related page
    if (pathname && (pathname.includes('/profile') || pathname.includes('/account'))) {
      console.log('UserEventTickets: Detected navigation to profile page');
      
      // Force a refresh when navigating to profile page
      refreshCounter.current += 1;
      console.log(`UserEventTickets: Forcing refresh #${refreshCounter.current} due to navigation`);
      
      // Reset all loading/pagination state
      setIsLoading(true);
      hasInitialData.current = false;
      isInitialLoad.current = true;
      fetchAttempted.current = false;
      setPage(1);
      setHasMore(true);
      setTickets([]);
    }
  }, [pathname]);

  // Create a separate effect to handle the actual fetching based on refreshCounter
  useEffect(() => {
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
      // If we're near the bottom (within 50px) and not already loading more
      if (scrollHeight - scrollTop - clientHeight < 50 && !isLoadingMore && hasMore) {
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

  // Initial fetch on mount
  useEffect(() => {
    console.log(`UserEventTickets: Setting up initial fetch timer`);
    const timer = setTimeout(() => {
      fetchTickets();
    }, initialLoadDelay);

    return () => {
      clearTimeout(timer);
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, []);

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
      
      const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        bypassLoadingStageCheck: true
      });
      
      // Handle direct array response
      if (Array.isArray(response)) {
        const startIndex = (nextPage - 1) * ticketsPerPage;
        const endIndex = startIndex + ticketsPerPage;
        const newTickets = response.slice(startIndex, endIndex);
        
        if (newTickets.length > 0) {
          setTickets(prev => [...prev, ...newTickets]);
          setPage(nextPage);
          setHasMore(endIndex < response.length);
        } else {
          setHasMore(false);
        }
      } else if (response && !("aborted" in response)) {
        if ("data" in response && Array.isArray(response.data)) {
          const startIndex = (nextPage - 1) * ticketsPerPage;
          const endIndex = startIndex + ticketsPerPage;
          const newTickets = response.data.slice(startIndex, endIndex);
          
          if (newTickets.length > 0) {
            setTickets(prev => [...prev, ...newTickets]);
            setPage(nextPage);
            setHasMore(endIndex < response.data.length);
          } else {
            setHasMore(false);
          }
        }
      }
    } catch (err) {
      console.error("UserEventTickets: Error loading more tickets", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const fetchTickets = async () => {
    // Don't allow fetching if we're already loading but not the initial load
    if (isLoading && !isInitialLoad.current) return;
    
    console.log(`UserEventTickets: Fetching tickets, current stage: ${currentStage}`);
    fetchAttempted.current = true;
    lastFetchTime.current = Date.now();
    setIsLoading(true); // Always set loading state when fetching
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: No token found in localStorage");
        setError("Необходима авторизация");
        setIsLoading(false);
        router.push('/');
        return;
      }
      
      console.log("UserEventTickets: Making API request to /user_edits/my-tickets");
      const response = await apiFetch<APIResponse<UserTicket[]>>("/user_edits/my-tickets", {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        bypassLoadingStageCheck: true
      });

      console.log("UserEventTickets: API response received", response);
      
      // Add more detailed logging for response structure
      console.log("UserEventTickets: Response type check", {
        hasData: "data" in response,
        hasError: "error" in response,
        hasAborted: "aborted" in response,
        isArray: Array.isArray(response),
        responseKeys: Object.keys(response)
      });
      
      // Ensure isLoading is set to false early in the success case
      setIsLoading(false);
      
      // Handle direct array response
      if (Array.isArray(response)) {
        console.log("UserEventTickets: Response is a direct array, setting tickets");
        // Cast the array to UserTicket[] to satisfy TypeScript
        const ticketsArray = response as unknown as UserTicket[];
        // Only take the first page of tickets
        const initialTickets = ticketsArray.slice(0, ticketsPerPage);
        setTickets(initialTickets);
        setHasMore(ticketsArray.length > ticketsPerPage);
        hasInitialData.current = true;
        setError(null);
        console.log(`UserEventTickets: Successfully loaded ${initialTickets.length} tickets out of ${ticketsArray.length} total`);
        return;
      }
      
      if (response && !("aborted" in response)) {
        if ("error" in response && response.status === 401) {
          console.log("UserEventTickets: Unauthorized response detected, redirecting to home");
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          router.push('/');
          return;
        }
        
        if ("data" in response && Array.isArray(response.data)) {
          console.log("UserEventTickets: Setting tickets from response.data", response.data);
          // Only take the first page of tickets
          const initialTickets = response.data.slice(0, ticketsPerPage);
          setTickets(initialTickets);
          setHasMore(response.data.length > ticketsPerPage);
          hasInitialData.current = true;
          setError(null);
          console.log(`UserEventTickets: Successfully loaded ${initialTickets.length} tickets out of ${response.data.length} total`);
        } else if ("data" in response && !Array.isArray(response.data)) {
          console.log("UserEventTickets: Response.data is not an array", response.data);
          // Try to convert to array if possible
          if (response.data) {
            const dataArray = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
            const initialTickets = dataArray.slice(0, ticketsPerPage);
            setTickets(initialTickets);
            setHasMore(dataArray.length > ticketsPerPage);
            hasInitialData.current = true;
            setError(null);
            console.log(`UserEventTickets: Converted and loaded ${initialTickets.length} tickets out of ${dataArray.length} total`);
          } else {
            console.log("UserEventTickets: Response.data is null or undefined");
            setTickets([]);
            setHasMore(false);
            setError(null);
          }
        }
      } else if ("aborted" in response && response.reason) {
        console.log(`UserEventTickets: Request aborted: ${response.reason}`);
        
        // If request was aborted due to loading stage, retry after a delay
        if (response.reason.includes('loading_stage')) {
          console.log('UserEventTickets: Request blocked due to loading stage, retrying after delay');
          retryTimeout.current = setTimeout(() => {
            fetchAttempted.current = false;
            fetchTickets();
          }, 500);
          return;
        }
        
        setError(`Запрос отменен: ${response.reason}`);
      }
    } catch (err) {
      console.error("UserEventTickets: Error fetching tickets", err);
      
      if (err instanceof Error && err.message.includes('401')) {
        console.log("UserEventTickets: 401 Unauthorized error detected, redirecting to home");
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        router.push('/');
        return;
      }
      
      setError(err instanceof Error ? err.message : "Ошибка загрузки билетов");
    } finally {
      setIsLoading(false);
      isInitialLoad.current = false;
    }
  };

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
        router.push('/');
        throw new Error('Необходима авторизация');
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
      
      if (response && !("aborted" in response)) {
        if ("error" in response && response.status === 401) {
          console.log("UserEventTickets: Unauthorized response detected during cancel, redirecting to home");
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          router.push('/');
          return;
        }
        
        setCancelSuccess('Регистрация успешно отменена');
        
        // Remove the cancelled ticket from local state
        setTickets(prevTickets => 
          prevTickets.filter(ticket => ticket.id !== selectedTicket.id)
        );
        
        console.log(`UserEventTickets: Removed cancelled ticket ID ${selectedTicket.id} from UI`);
        
        setTimeout(() => {
          setIsModalOpen(false);
          setCancelSuccess(undefined);
          setCancelLoading(false);
        }, 1500);
      } else if ("aborted" in response && response.reason) {
        setCancelError(`Запрос отменен: ${response.reason}`);
        setCancelLoading(false);
      }
    } catch (err) {
      console.error('Error cancelling registration:', err);
      
      if (err instanceof Error && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        console.log("UserEventTickets: 401 Unauthorized error detected during cancel, redirecting to home");
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        router.push('/');
        return;
      }
      
      setCancelError(err instanceof Error ? err.message : 'Ошибка при отмене регистрации');
      setCancelLoading(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-white rounded-lg p-4 shadow-sm">
          <div className="h-5 bg-orange-100 rounded w-3/4 mb-3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-orange-50 rounded w-1/2"></div>
            <div className="h-4 bg-orange-50 rounded w-2/3"></div>
            <div className="h-4 bg-orange-50 rounded w-1/3"></div>
            <div className="h-4 bg-orange-50 rounded w-2/5"></div>
            <div className="h-4 bg-orange-50 rounded w-1/4"></div>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="h-5 bg-orange-100 rounded w-1/6"></div>
          </div>
        </div>
      </div>
    );
  }

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

  if (tickets.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 mb-4">
          У вас пока нет зарегистрированных мероприятий
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/events")}
          className="btn btn-primary"
        >
          Найти мероприятия
        </motion.button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <span className="text-sm text-gray-500">Загружено: {tickets.length}</span>
      </div>
      
      <div 
        ref={ticketsContainerRef}
        className="max-h-[400px] overflow-y-auto pr-2"
      >
        <div className="space-y-3">
          {tickets.map((ticket, index) => (
            <div key={ticket.id}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Top section: Title and Status */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {ticket.event.title}
                  </h3>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                      ticket.status
                    )}`}
                  >
                    {getStatusText(ticket.status)}
                  </div>
                </div>
                
                <div className="flex">
                  {/* Left ticket number */}
                  <div className="flex-shrink-0 w-[90px] flex items-center justify-center">
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-2 shadow-sm flex flex-col items-center">
                      <div className="text-xs text-gray-500 uppercase font-medium text-center whitespace-nowrap">НОМЕР БИЛЕТА</div>
                      <div className="text-xl font-bold text-orange-600">#{ticket.id.toString().padStart(4, '0')}</div>
                    </div>
                  </div>
                  
                  {/* Right side with event info and cancel button */}
                  <div className="flex-1 ml-4">
                    <div className="grid grid-cols-1 gap-1">
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
                        <span className="break-words">{ticket.ticket_type}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <FaRegCalendarCheck className="text-orange-500 flex-shrink-0 mt-1" />
                        <span className="break-words">Забронировано: {formatDateForDisplay(ticket.registration_date)}</span>
                      </div>
                      
                      {/* Cancel button aligned with info items */}
                      {ticket.status !== "completed" && (
                        <div className="flex items-center justify-end">
                          <div
                            onClick={() => handleCancelClick(ticket)}
                            className="text-red-600 hover:text-red-800 transition-colors cursor-pointer text-sm"
                            role="button"
                            tabIndex={0}
                            aria-label="Отменить регистрацию"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                handleCancelClick(ticket);
                              }
                            }}
                          >
                            Отменить
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
              {index < tickets.length - 1 && (
                <div className="h-[2px] bg-gray-200 my-3 mx-auto w-[70%]"></div>
              )}
            </div>
          ))}
          
          {isLoadingMore && (
            <div className="py-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-orange-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Загрузка...</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Загрузка дополнительных билетов...</p>
            </div>
          )}
          
          {!isLoadingMore && hasMore && (
            <div className="py-4 text-center">
              <button 
                onClick={loadMoreTickets}
                className="text-orange-500 hover:text-orange-600 text-sm font-medium"
              >
                Загрузить еще
              </button>
            </div>
          )}
        </div>
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
  );
};

export default UserEventTickets;