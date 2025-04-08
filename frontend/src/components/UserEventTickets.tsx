import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading } from "@/contexts/LoadingContext";
import { EventData } from "@/types/events";
import { useRouter } from "next/navigation";

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

const UserEventTickets = () => {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentStage } = useLoading();
  const router = useRouter();
  const hasInitialData = useRef(false);
  const isInitialLoad = useRef(true);
  const minFetchInterval = 200; // ms
  const skeletonTimeout = 2000; // ms
  const initialLoadDelay = 200; // ms

  // Add logging for component lifecycle
  useEffect(() => {
    console.log(`UserEventTickets: Component mounted, current stage: ${currentStage}`);
    return () => {
      console.log("UserEventTickets: Component unmounted");
    };
  }, []);

  // Log stage changes
  useEffect(() => {
    console.log(`UserEventTickets: Stage changed to ${currentStage}`);
  }, [currentStage]);

  const fetchTickets = async () => {
    if (isLoading && !isInitialLoad.current) return;
    
    // Check if we're in a stage that allows fetching tickets
    // According to the loading system, we need at least STATIC_CONTENT stage
    if (currentStage < "STATIC_CONTENT") {
      console.log(`UserEventTickets: Skipping fetch, current stage (${currentStage}) is too early`);
      return;
    }

    console.log(`UserEventTickets: Fetching tickets, current stage: ${currentStage}`);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("UserEventTickets: No token found in localStorage");
        setError("Необходима авторизация");
        setIsLoading(false);
        return;
      }
      
      console.log("UserEventTickets: Making API request to /user_edits/my-tickets");
      const response = await apiFetch<UserTicket[]>("/user_edits/my-tickets", {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        bypassLoadingStageCheck: true // Allow this request even during early stages
      });

      console.log("UserEventTickets: API response received", response);
      
      if (response && !("aborted" in response)) {
        setTickets(response);
        hasInitialData.current = true;
        setError(null);
        console.log(`UserEventTickets: Successfully loaded ${response.length} tickets`);
      } else if ("aborted" in response) {
        console.log(`UserEventTickets: Request aborted: ${response.reason}`);
        setError(`Запрос отменен: ${response.reason}`);
      }
    } catch (err) {
      console.error("UserEventTickets: Error fetching tickets", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки билетов");
    } finally {
      setIsLoading(false);
      isInitialLoad.current = false;
    }
  };

  useEffect(() => {
    if (currentStage >= "STATIC_CONTENT") {
      console.log(`UserEventTickets: Setting up fetch timer for stage ${currentStage}`);
      const timer = setTimeout(() => {
        fetchTickets();
      }, initialLoadDelay);

      return () => clearTimeout(timer);
    }
  }, [currentStage]);

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
        return "bg-gray-100 text-gray-800";
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
        return "Неизвестно";
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
    <div className="max-h-[400px] overflow-y-auto pr-2">
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
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
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  ticket.status
                )}`}
              >
                {getStatusText(ticket.status)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default UserEventTickets; 