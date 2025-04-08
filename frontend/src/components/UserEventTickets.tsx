import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle } from "react-icons/fa";
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
            className="bg-white rounded-lg p-5 w-full max-w-md relative"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <FaTimesCircle size={18} />
            </button>
            <h2 className="text-xl font-semibold mb-3">{title}</h2>
            
            {error && (
              <div className="mb-4 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-sm">
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-2 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md text-sm">
                <p>{success}</p>
              </div>
            )}
            
            <p className="mb-4 text-gray-600">{message}</p>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-medium transition-colors duration-300 bg-gray-200 text-gray-700 hover:bg-gray-300 w-full sm:w-auto"
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading || !!success}
                className="px-4 py-2 rounded-lg font-medium transition-colors duration-300 bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
              >
                {isLoading ? "Отмена..." : "Отменить регистрацию"}
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

  // Add effect to detect navigation changes
  useEffect(() => {
    console.log(`UserEventTickets: Pathname changed to ${pathname}`);
    
    // Check if we're on a profile-related page
    if (pathname && (pathname.includes('/profile') || pathname.includes('/account'))) {
      console.log('UserEventTickets: Detected navigation to profile page');
      
      // Check if enough time has passed since the last fetch
      const now = Date.now();
      if (now - lastFetchTime.current > minFetchInterval) {
        console.log('UserEventTickets: Triggering ticket fetch due to navigation');
        fetchAttempted.current = false;
        fetchTickets();
      } else {
        console.log('UserEventTickets: Skipping fetch due to rate limiting');
      }
    }
  }, [pathname]);

  const fetchTickets = async () => {
    if (isLoading && !isInitialLoad.current) return;
    if (fetchAttempted.current) return;
    
    console.log(`UserEventTickets: Fetching tickets, current stage: ${currentStage}`);
    fetchAttempted.current = true;
    lastFetchTime.current = Date.now();
    
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
      
      // Handle direct array response
      if (Array.isArray(response)) {
        console.log("UserEventTickets: Response is a direct array, setting tickets");
        // Cast the array to UserTicket[] to satisfy TypeScript
        const ticketsArray = response as unknown as UserTicket[];
        setTickets(ticketsArray);
        hasInitialData.current = true;
        setError(null);
        console.log(`UserEventTickets: Successfully loaded ${ticketsArray.length} tickets`);
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
          setTickets(response.data);
          hasInitialData.current = true;
          setError(null);
          console.log(`UserEventTickets: Successfully loaded ${response.data.length} tickets`);
        } else if ("data" in response && !Array.isArray(response.data)) {
          console.log("UserEventTickets: Response.data is not an array", response.data);
          // Try to convert to array if possible
          if (response.data) {
            const dataArray = Array.isArray(response.data) ? response.data : [response.data as UserTicket];
            setTickets(dataArray);
            hasInitialData.current = true;
            setError(null);
            console.log(`UserEventTickets: Converted and loaded ${dataArray.length} tickets`);
          } else {
            console.log("UserEventTickets: Response.data is null or undefined");
            setTickets([]);
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

  // Initial fetch on mount
  useEffect(() => {
    console.log(`UserEventTickets: Setting up fetch timer`);
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

  const handleCancelClick = (ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
    setCancelError(undefined);
    setCancelSuccess(undefined);
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
        
        setTimeout(() => {
          setIsModalOpen(false);
          fetchTickets();
        }, 1500);
      } else if ("aborted" in response && response.reason) {
        setCancelError(`Запрос отменен: ${response.reason}`);
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
    } finally {
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
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-white rounded-lg p-4 shadow-sm"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
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
      <div className="max-h-[400px] overflow-y-auto pr-2">
        <div className="space-y-3">
          {tickets.map((ticket, index) => (
            <div key={ticket.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors relative"
              >
                <div className="flex items-start justify-between relative h-full">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {ticket.event.title}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-orange-500" />
                        <span>
                          {formatDateForDisplay(ticket.event.start_date)}
                          {ticket.event.end_date &&
                            ` - ${formatDateForDisplay(ticket.event.end_date)}`}
                        </span>
                      </div>
                      {ticket.event.location && (
                        <div className="flex items-center gap-2">
                          <FaMapMarkerAlt className="text-orange-500" />
                          <span>{ticket.event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <FaTicketAlt className="text-orange-500" />
                        <span>{ticket.ticket_type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 h-full flex flex-col items-center justify-between">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        ticket.status
                      )}`}
                    >
                      {getStatusText(ticket.status)}
                    </div>
                    
                    {/* Show cancel button for all tickets except completed ones */}
                    {ticket.status !== "completed" && (
                      <div
                        onClick={() => handleCancelClick(ticket)}
                        className={`px-3 py-1 rounded-full text-xs font-medium text-red-600 hover:text-red-800 transition-colors cursor-pointer`}
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
                    )}
                  </div>
                </div>
              </motion.div>
              {index < tickets.length - 1 && (
                <div className="h-px bg-gray-100 my-3 mx-auto w-[70%]"></div>
              )}
            </div>
          ))}
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