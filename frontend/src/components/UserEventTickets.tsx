import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCalendarAlt, FaMapMarkerAlt, FaTimesCircle, FaClock, FaRegCalendarCheck, FaFilter, FaHandPointLeft } from "react-icons/fa";
import { apiFetch, clearCache } from "@/utils/api";
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { LoadingStage } from '@/contexts/loading/types';
import { useAuth } from "@/contexts/AuthContext";

// Определение интерфейса для данных события
interface EventData {
  id: number;
  title: string;
  start_date: string;
  end_date?: string;
  location?: string;
  status: string; // Статус события
  published: boolean;
  url_slug?: string;
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

// Восстанавливаем определение APIResponse
interface APIResponse<T> {
  tickets: T[]; // Изменено: ожидаем массив в поле tickets
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
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
    <div className="bg-white rounded-lg p-4 shadow-sm border border-orange-50 min-h-[150px]">
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
    setUseDateFilter(true); 
    onClose();
  };
  
  const handleResetFilters = () => {
    // Устанавливаем основные состояния, а не временные
    setActiveFilter("approved"); 
    setDateRange({ startDate: '', endDate: '' });
    setUseDateFilter(false); // Сбрасываем использование фильтра по дате
    onClose(); // Закрываем модальное окно
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-2 sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg p-3 sm:p-5 w-full max-w-lg shadow-xl relative my-4 sm:my-8"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              onClick={onClose}
              className="absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Закрыть"
            >
              <FaTimesCircle size={16} className="sm:text-xl" />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800">Фильтр билетов</h2>
            
            <div className="space-y-3 sm:space-y-5">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Выберите статус билетов:</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {filters.map((filter) => (
                    <div
                      key={filter.id}
                      onClick={() => handleFilterChange(filter.id)}
                      className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-colors ${
                        tempFilter === filter.id
                          ? "bg-orange-100 border-2 border-orange-500"
                          : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full mr-1 sm:mr-2 ${
                          tempFilter === filter.id ? "bg-orange-500" : "bg-gray-300"
                        }`} />
                        <div>
                          <h3 className="font-medium text-gray-800 text-xs sm:text-base">{filter.label}</h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Секция выбора диапазона дат - всегда видима */}
              <div className="p-3 sm:p-4 rounded-lg border-2 border-orange-500 bg-orange-50">
                <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Фильтр по датам мероприятий:</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-600 mb-1">С даты:</label>
                    <input 
                      type="date" 
                      value={tempDateRange.startDate}
                      onChange={(e) => setTempDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-600 mb-1">По дату:</label>
                    <input 
                      type="date" 
                      value={tempDateRange.endDate}
                      onChange={(e) => setTempDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-6 flex justify-between">
              <button
                onClick={handleResetFilters}
                className="px-3 sm:px-4 py-1 sm:py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-xs sm:text-sm"
              >
                Сбросить
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-3 sm:px-4 py-1 sm:py-2 rounded-lg font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors text-xs sm:text-sm"
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

// --- НАЧАЛО: Локальное определение модального окна отмены ---
interface CancelTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventTitle: string;
  isLoading: boolean;
  error?: string;
  success?: string;
}

const CancelTicketModal: React.FC<CancelTicketModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
  isLoading,
  error,
  success
}) => {
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  // Добавляем useLayoutEffect для управления классом и padding
  useLayoutEffect(() => {
    const originalPaddingRight = document.body.style.paddingRight;
    if (isOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollBarWidth}px`;
      document.body.classList.add('body-scroll-locked');
    } else {
      document.body.classList.remove('body-scroll-locked');
      document.body.style.paddingRight = originalPaddingRight;
    }
    return () => {
      document.body.classList.remove('body-scroll-locked');
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

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
              disabled={isLoading}
            >
              <FaTimesCircle size={20} />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Отмена регистрации</h2>
            
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
            
            {!success && !error && (
               <p className="mb-6 text-gray-600">Вы уверены, что хотите отменить регистрацию на мероприятие &apos;{eventTitle}&apos;?</p>
            )}
            
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-medium transition-colors duration-300 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {success ? "Закрыть" : "Отмена"}
              </button>
              {!success && (
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
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
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
// --- КОНЕЦ: Локальное определение модального окна отмены ---

// Определение для ref компонента
export interface UserEventTicketsRef {
  refreshTickets: () => void;
}

interface UserEventTicketsProps {
  forceUpdateTrigger?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
}

// Функция генерации слага из events/page.tsx (адаптирована)
const generateBaseSlugWithDate = (event: EventData): string => {
  if (!event) return "";

  let startDateStr = "";
  try {
    const startDate = new Date(event.start_date);
    if (!isNaN(startDate.getTime())) {
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      startDateStr = `${year}-${month}-${day}`;
    } else {
      throw new Error("Invalid start_date");
    }
  } catch {
    // Логирование ошибки можно добавить, если нужно
    // logger.error("Error formatting start date for slug base", { eventId: event.id, startDate: event.start_date, error: e });
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    startDateStr = `${year}-${month}-${day}`;
  }

  const dateSuffix = `-${startDateStr}`;

  if (event.url_slug) {
    const parts = event.url_slug.split('-');
    let baseSlug = event.url_slug;
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      const looksLikeOldYearId = /^\d{4}$/.test(parts[parts.length - 2]) && /^\d+$/.test(lastPart);
      const looksLikeDateId = parts.length >= 4 && /^\d{4}$/.test(parts[parts.length - 4]) && /^\d{2}$/.test(parts[parts.length - 3]) && /^\d{2}$/.test(parts[parts.length - 2]) && /^\d+$/.test(lastPart);
      if (looksLikeDateId) {
        baseSlug = parts.slice(0, -4).join('-');
      } else if (looksLikeOldYearId) {
        baseSlug = parts.slice(0, -2).join('-');
      }
    }
    return `${baseSlug}${dateSuffix}`;
  }

  const safeSlug = event.title ?
    event.title.toLowerCase()
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    : 'event';

  return `${safeSlug}${dateSuffix}`;
};

export const UserEventTickets = React.forwardRef<UserEventTicketsRef, UserEventTicketsProps>(
  ({ containerRef: externalContainerRef }, ref) => {
  const { isAuth, userData } = useAuth();
  const { setStage, currentStage } = useLoadingStage();
  const { error: loadingError, setError: setLoadingError } = useLoadingError();
  
  // --- Состояния и рефы компонента ---
  // Инициализация состояний с учетом кэша
  const [tickets, setTickets] = useState<UserTicket[]>(() => {
     const cacheIsFresh = Date.now() - globalTicketsCache.lastFetched <= 180000; // 3 минуты
     if (globalTicketsCache.data.length > 0 && cacheIsFresh) {
        console.log("UserEventTickets: Initializing tickets state from fresh cache");
        return globalTicketsCache.data;
     }
     console.log("UserEventTickets: Initializing tickets state as empty (no fresh cache)");
     return [];
  });
  const [filteredTickets, setFilteredTickets] = useState<UserTicket[]>(tickets); // Инициализируем отфильтрованные сразу
  const [page, setPage] = useState(() => globalTicketsCache.currentPage);
  const [hasMore, setHasMore] = useState(() => globalTicketsCache.hasMore);
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
     const cacheIsFresh = Date.now() - globalTicketsCache.lastFetched <= 180000;
     const shouldUseCache = globalTicketsCache.data.length > 0 && cacheIsFresh;
     console.log(`UserEventTickets: Initializing isInitialLoading: ${!shouldUseCache} (shouldUseCache: ${shouldUseCache})`);
     return !shouldUseCache; // Загрузка нужна, только если не используем свежий кэш
  });

  const [isFetching, setIsFetching] = useState(false); // Флаг активного запроса
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const ticketsContainerRef = externalContainerRef || internalContainerRef;
  const ticketsPerPage = 3; // Загружаем по 3 билета за раз
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null); // Используется в fetchTickets
  const hasInitialData = useRef(false); // Флаг для отслеживания первичной загрузки данных
  const hasAttemptedInitialFetch = useRef(false); // Отслеживаем, была ли попытка первичной загрузки
  const isInitialLoadRef = useRef(true); // <-- Реф для отслеживания первого рендера

  const [activeFilter, setActiveFilter] = useState<TicketFilter>("approved");
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Рефы для отслеживания предыдущих значений фильтров
  const prevActiveFilterRef = useRef<TicketFilter>(activeFilter);
  const prevDateRangeRef = useRef<{ startDate: string; endDate: string }>(dateRange);

  const filters: { id: TicketFilter; label: string; description: string }[] = [
    { id: "approved", label: "Подтвержденные", description: "Только подтвержденные билеты" },
    { id: "cancelled", label: "Отмененные", description: "Только отмененные билеты" },
    { id: "completed", label: "Завершенные", description: "Билеты мероприятий в статусе завершено" }
  ];

  const applyFilter = useCallback((tickets: UserTicket[], filter: TicketFilter) => {
    const filteredByStatus = tickets.filter(ticket => {
      const isEventCompleted = ticket.event.status === "completed";
      
      switch (filter) {
        case "approved":
          return ticket.status === "approved" && ticket.event.status !== 'completed';
        case "cancelled":
          return ticket.status === "cancelled";
        case "completed":
          return ticket.status === "approved" && isEventCompleted;
        default:
          return true;
      }
    });
    
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
  
  useEffect(() => {
    console.log(`UserEventTickets: Filtering effect triggered. Total tickets: ${tickets.length}, Active filter: ${activeFilter}`);
    const newlyFiltered = applyFilter(tickets, activeFilter);
    console.log(`UserEventTickets: Filtering applied. Filtered count: ${newlyFiltered.length}`);
    setFilteredTickets(newlyFiltered);
  }, [tickets, activeFilter, applyFilter]);

  const shouldReplaceTicket = useCallback((existing: UserTicket, newTicket: UserTicket): boolean => {
    const statusPriority = { "approved": 0, "pending": 1, "cancelled": 2, "rejected": 3 };
    return statusPriority[newTicket.status] < statusPriority[existing.status];
  }, []);
  
  const sortByStatusAndDate = (tickets: UserTicket[]): UserTicket[] => {
    const statusPriority = { "approved": 0, "pending": 1, "cancelled": 2, "rejected": 3 };
    return [...tickets].sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(a.event.start_date).getTime() - new Date(b.event.start_date).getTime();
    });
  };
  
  const sortByDate = (tickets: UserTicket[]): UserTicket[] => {
    return [...tickets].sort((a, b) => 
      new Date(a.registration_date).getTime() - new Date(b.registration_date).getTime()
    );
  };
  
  const processTickets = useCallback((tickets: UserTicket[], filter: TicketFilter): UserTicket[] => {
    // Шаг 1: Исключаем билеты мероприятий в статусе 'draft'
    const nonDraftTickets = tickets.filter(ticket => ticket.event.status !== 'draft');
    // Шаг 2: Исключаем билеты неопубликованных мероприятий
    const publishedTickets = nonDraftTickets.filter(ticket => ticket.event.published === true);
    // Шаг 3: Убираем дубликаты
    const uniqueTicketsMap = new Map<number, UserTicket>();
    publishedTickets.forEach(ticket => {
      const existingTicket = uniqueTicketsMap.get(ticket.id);
      if (!existingTicket || shouldReplaceTicket(existingTicket, ticket)) {
        uniqueTicketsMap.set(ticket.id, ticket);
      }
    });
    // Шаг 4: Исключаем отменённые билеты только если фильтр не 'cancelled'
    const ticketsArray = Array.from(uniqueTicketsMap.values());
    const ticketsForDisplay = (filter === "cancelled")
      ? ticketsArray
      : ticketsArray.filter(t => t.status !== "cancelled");
    const ticketsByStatusAndDate = sortByStatusAndDate(ticketsForDisplay);
    return sortByDate(ticketsByStatusAndDate);
  }, [shouldReplaceTicket]);

  const fetchTickets = useCallback(async (pageToFetch = 1, abortController?: AbortController): Promise<{ fetchedTickets: UserTicket[], newHasMore: boolean } | null> => {
    if (!isAuth || !userData || !userData.id) {
      console.log("UserEventTickets: Пользователь не авторизован или нет userData.id, прерывание загрузки билетов.");
      return null;
    }
    setIsFetching(true);
    if (currentStage !== LoadingStage.DYNAMIC_CONTENT) {
      setStage(LoadingStage.DYNAMIC_CONTENT);
    }
    setLoadingError(null);
    setLocalError(null);
    console.log(`UserEventTickets: Загрузка билетов, страница ${pageToFetch}, userId: ${userData.id}`);

    const token = localStorage.getItem('token');

    // Отменяем предыдущий запрос, если он есть
    if (abortControllerRef.current) {
        abortControllerRef.current.abort('New fetch started');
    }
    abortControllerRef.current = abortController ? abortController : new AbortController();

    if (!token) {
      console.error("UserEventTickets: Токен не найден.");
      setLocalError("Ошибка аутентификации.");
      if (currentStage !== LoadingStage.ERROR) {
        setStage(LoadingStage.ERROR);
      }
      setLoadingError("Ошибка аутентификации.");
      return null;
    }

    try {
      const params: Record<string, string | number> = {
        page: pageToFetch, // page
        per_page: ticketsPerPage // per_page
      };

      if (activeFilter === "approved") {
        params.status = "approved";
      } else if (activeFilter === "completed") {
        // На бэкенде completed не является статусом билета,
        // фильтрация по статусу события происходит на фронте после получения
        // Получаем все билеты пользователя для этого фильтра
        params.status = "approved"; // Получаем только подтвержденные для завершенных
      } else if (activeFilter === "cancelled") {
        params.status = "cancelled";
      } else {
        // По умолчанию или при неожиданном значении фильтра (на всякий случай)
        params.status = "approved";
      }
      
      console.log(`UserEventTickets: Fetching tickets with filter "${activeFilter}", page ${pageToFetch}, per_page ${ticketsPerPage}`);
      const response = await apiFetch<APIResponse<UserTicket>>('/user_edits/my-tickets', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        bypassLoadingStageCheck: true,
        params,
        signal: abortControllerRef.current.signal // Передаем сигнал из рефа
      });
      
      // ЛОГИРОВАНИЕ: Проверяем сырой ответ от apiFetch
      console.log("UserEventTickets: Raw response received from apiFetch:", JSON.stringify(response));

      if (!response || typeof response !== 'object' || !response.tickets) {
        // Если запрос был отменён — не считаем это ошибкой, просто выходим
        if (response && response.aborted) {
          console.warn('UserEventTickets: Запрос был отменён, результат игнорируется');
          return null;
        }
        console.error('UserEventTickets: Invalid response format received', response);
        throw new Error('Некорректный формат ответа от сервера');
      }

      const ticketsData = response.tickets; // Берем билеты из поля tickets
      const newHasMore = response.has_more; // Используем флаг с бэкенда

      console.log(`UserEventTickets: Received ${ticketsData.length} tickets. Has more: ${newHasMore}`);
      
      const processedTickets = processTickets(ticketsData, activeFilter);
      
      if (pageToFetch === 1) {
        // При загрузке первой страницы обновляем и tickets, и filteredTickets
        const newlyFiltered = applyFilter(processedTickets, activeFilter);
        setTickets(processedTickets);
        setFilteredTickets(newlyFiltered);
        setPage(1);
        setHasMore(newHasMore);
        setIsInitialLoading(false);
        globalTicketsCache.data = processedTickets;
        globalTicketsCache.count = processedTickets.length;
        globalTicketsCache.status = 'success';
        globalTicketsCache.lastFetched = Date.now();
        globalTicketsCache.hasMore = newHasMore;
        globalTicketsCache.currentPage = 1;
        globalTicketsCache.logCacheUpdate('fetchTickets page 1');
        hasInitialData.current = true; // Устанавливаем флаг после ПЕРВОЙ успешной загрузки
      }
      
      console.log('UserEventTickets: Ticket loading complete');
      if (currentStage !== LoadingStage.COMPLETED) {
        setStage(LoadingStage.COMPLETED);
      }
      
      // Сбрасываем AbortController ref после завершения или ошибки
      abortControllerRef.current = null;
      
      // Сбрасываем ошибки при успешном завершении
      setLoadingError(null);
      setLocalError(null);
      
      return { fetchedTickets: processedTickets, newHasMore };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log("UserEventTickets: Запрос на загрузку билетов прерван.");
      } else {
        const errorMsg = err instanceof Error ? err.message : "Не удалось загрузить билеты";
        console.error("UserEventTickets: Исключение при загрузке билетов:", err);
        setLocalError(`Критическая ошибка: ${errorMsg}`);
        if (currentStage !== LoadingStage.ERROR) {
          setStage(LoadingStage.ERROR);
        }
        setLoadingError(errorMsg);
      }
      // Сбрасываем AbortController ref после завершения или ошибки
      abortControllerRef.current = null;
      return null;
    } finally {
      console.log("UserEventTickets: Завершение fetchTickets finally.");
      setIsFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStage, processTickets, ticketsPerPage, activeFilter, isAuth, userData, setLoadingError, setLocalError, setTickets, setFilteredTickets, setPage, setHasMore, setIsFetching, setIsInitialLoading, globalTicketsCache, currentStage]);

  const loadMoreTickets = useCallback(async () => {
    if (isLoadingMore || !hasMore || isFetching) return;
    // включаем скелетон
    setIsLoadingMore(true);
    // ждем следующего кадра, чтобы skeleton появился
    await new Promise(requestAnimationFrame);
    const startTime = Date.now();
    let result;
    try {
      result = await fetchTickets(page + 1);
    } catch (err) {
      console.error('Load more error', err);
      result = null;
    }
    if (result) {
      const { fetchedTickets, newHasMore } = result;
      if (fetchedTickets.length > 0) {
        if (page + 1 === 1) {
          // Если это первая страница — полный сброс
          setTickets(fetchedTickets);
        } else {
          // Для остальных страниц — добавление только новых
          setTickets(prev => {
            const ids = new Set(prev.map(t => t.id));
            return [...prev, ...fetchedTickets.filter(t => !ids.has(t.id))];
          });
        }
        setPage(page + 1);
        setHasMore(newHasMore);
      } else {
        setHasMore(false);
      }
    }
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) {
      await new Promise(res => setTimeout(res, 1000 - elapsed));
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, isFetching, page, fetchTickets]);

  // --- Эффекты --- 

  // 1. Эффект для САМОЙ ПЕРВОЙ загрузки при монтировании / появлении auth 
  useEffect(() => {
    // Запускаем только если авторизован, и еще не было попытки загрузки
    if (isAuth && userData && !hasAttemptedInitialFetch.current) {
      console.log("UserEventTickets: Initial fetch attempt triggered.");
      hasAttemptedInitialFetch.current = true; // Помечаем, что попытка была

      // Проверяем кэш
      const cacheIsFresh = Date.now() - globalTicketsCache.lastFetched <= 180000; // 3 минуты
      const shouldUseCache = globalTicketsCache.data.length > 0 && cacheIsFresh;

      if (shouldUseCache) {
        console.log("UserEventTickets: Initializing from fresh cache.");
        setTickets(globalTicketsCache.data);
        setPage(globalTicketsCache.currentPage);
        setHasMore(globalTicketsCache.hasMore);
        setIsInitialLoading(false); // Сразу убираем основной скелетон
        hasInitialData.current = true;
        if (currentStage !== LoadingStage.COMPLETED) {
          setStage(LoadingStage.COMPLETED);
        }
      }
      // В любом случае всегда делаем fetchTickets(1) для актуализации
      setIsInitialLoading(true); // Показываем основной скелетон
      fetchTickets(1); // Запускаем загрузку первой страницы
    }

    // Устанавливаем флаг первого рендера в false после первого прохода
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
    }
  }, [isAuth, userData, fetchTickets, setStage, setTickets, setPage, setHasMore, setIsInitialLoading, currentStage]);

  // 2. Эффект для перезагрузки при СМЕНЕ ФИЛЬТРОВ (после первого рендера)
  useEffect(() => {
    const prevActiveFilter = prevActiveFilterRef.current;
    const prevDateRange = prevDateRangeRef.current;

    // Пропускаем первый рендер
    if (isInitialLoadRef.current) {
      // На первом рендере обновляем рефы и выходим
      prevActiveFilterRef.current = activeFilter;
      prevDateRangeRef.current = dateRange;
      return; 
    }
    // Проверяем, изменились ли фильтры по сравнению с предыдущим рендером
    const filterChanged = activeFilter !== prevActiveFilter;
    const dateRangeChanged = dateRange.startDate !== prevDateRange.startDate || dateRange.endDate !== prevDateRange.endDate;

    if (filterChanged || dateRangeChanged) {
      console.log("UserEventTickets: Filter changed by user, refetching tickets...", { newFilter: activeFilter, newRange: dateRange });
      setIsInitialLoading(true); // Показываем скелетон при смене фильтра
      fetchTickets(1); // Запрашиваем первую страницу с новыми фильтрами
      
      // Обновляем рефы после срабатывания
      prevActiveFilterRef.current = activeFilter;
      prevDateRangeRef.current = dateRange;
    }
    // Если фильтры не изменились (например, другой ререндер), ничего не делаем
  }, [activeFilter, dateRange, fetchTickets, setIsInitialLoading]);

  // 3. Эффект для обработчика скролла (подгрузка)
  useEffect(() => {
    const container = ticketsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const shouldLoadMore = 
          tickets.length > 0 && 
          scrollHeight - scrollTop - clientHeight <= 10 && 
          hasInitialData.current && 
          !isLoadingMore && 
          !isFetching && 
          hasMore; 

      if (shouldLoadMore) {
        console.log('UserEventTickets: Scroll threshold reached, initiating load more...');
        setIsLoadingMore(true); 
        loadMoreTickets();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      if (container) {
          container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [tickets.length, hasInitialData, isLoadingMore, isFetching, hasMore, loadMoreTickets, ticketsContainerRef]);
  
  // 4. Эффект для отложенной подсказки о долгой загрузке
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    
    if (isFetching) {
      timeout = setTimeout(() => {
        setShowLoadingHint(true);
      }, 3000);
    } else {
      setShowLoadingHint(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isFetching]);
  
  // --- Автоповтор fetchTickets ---
  const autoRetryAttempts = useRef(0);
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    if (isFetching) {
      timeout = setTimeout(() => {
        if (isFetching && tickets.length === 0 && !localError && isAuth && userData && isInitialLoading) {
          if (autoRetryAttempts.current < 2) {
            autoRetryAttempts.current += 1;
            console.log('UserEventTickets: Auto-retry after long loading, attempt', autoRetryAttempts.current);
            fetchTickets(1);
          } else {
            setLocalError('Не удалось загрузить билеты. Проверьте соединение и попробуйте снова.');
          }
        }
      }, 10000);
    } else {
      autoRetryAttempts.current = 0; // сбрасываем счетчик при успешной загрузке
    }
    return () => { if (timeout) clearTimeout(timeout); };
  }, [isFetching, tickets.length, localError, isAuth, userData, isInitialLoading, fetchTickets]);

  React.useImperativeHandle(ref, () => ({
    refreshTickets: () => {
      if (!isFetching && isAuth && userData && isInitialLoading) {
        console.log('UserEventTickets: Manual refresh via ref');
        fetchTickets(1);
      }
    }
  }), [isFetching, isAuth, userData, isInitialLoading, fetchTickets]);

  // --- НАЧАЛО: Добавление состояний для модалки отмены ---
  const [selectedTicketToCancel, setSelectedTicketToCancel] = useState<UserTicket | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelModalLoading, setCancelModalLoading] = useState(false);
  const [cancelModalError, setCancelModalError] = useState<string | undefined>(undefined);
  const [cancelModalSuccess, setCancelModalSuccess] = useState<string | undefined>(undefined);
  const isTicketBeingCancelled = useRef(false); // Для предотвращения конфликтов с ticket-update
  // --- КОНЕЦ: Добавление состояний --- 
  
  // Восстанавливаем обработчики для отмены
  const handleCancelClick = useCallback((ticket: UserTicket) => {
    setSelectedTicketToCancel(ticket);
    setCancelModalError(undefined);
    setCancelModalSuccess(undefined);
    setIsCancelModalOpen(true);
  }, []);
  
  const handleCancelConfirm = useCallback(async () => {
    if (!selectedTicketToCancel) {
      setCancelModalError('Не удалось найти выбранный билет');
      return;
    }
    isTicketBeingCancelled.current = true;
    setCancelModalError(undefined);
    setCancelModalSuccess(undefined);
    setCancelModalLoading(true);
    const token = localStorage.getItem('token');
    if (!token || !userData?.id) {
      setCancelModalError("Ошибка аутентификации.");
      setCancelModalLoading(false);
      isTicketBeingCancelled.current = false;
      return;
    }
    try {
      console.log(`UserEventTickets: Попытка отмены билета ID: ${selectedTicketToCancel.id} для event ID: ${selectedTicketToCancel.event.id}`);
      // 1. Выполняем запрос на отмену
      const cancelResponse = await apiFetch<APIResponse<{ message?: string; error?: string }>>(`/registration/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          event_id: selectedTicketToCancel.event.id,
          user_id: userData.id
        },
        bypassLoadingStageCheck: true
      });

      // Проверяем ответ отмены
      if ('error' in cancelResponse || ('status' in cancelResponse && cancelResponse.status && cancelResponse.status >= 400)) {
         const errorMsg = (cancelResponse as any)?.error || (cancelResponse as any)?.detail || 'Ошибка при отмене билета';
         throw new Error(errorMsg);
      }
      if ('aborted' in cancelResponse) {
         throw new Error('Запрос отмены был прерван');
      }
      
      // 2. Успешная отмена - показываем сообщение и очищаем кэш
      setCancelModalSuccess('Билет успешно отменен!');
      clearCache('/user_edits/my-tickets');
      console.log("UserEventTickets: Cache cleared for /user_edits/my-tickets after cancellation.");

      // 3. Закрываем модальное окно и обновляем список
      setTimeout(async () => {
        setIsCancelModalOpen(false);
        setSelectedTicketToCancel(null);
        
        // 4. Загружаем ПЕРВУЮ страницу билетов заново
        console.log("UserEventTickets: Refetching tickets list (page 1) after cancellation.");
        const refreshResult = await fetchTickets(1); // Перезагружаем с 1 страницы
        
        // 5. Обновляем состояние компонента новыми данными
        if (refreshResult) {
           console.log(`UserEventTickets: Updating state with ${refreshResult.fetchedTickets.length} fetched tickets.`);
           setTickets(refreshResult.fetchedTickets); // Заменяем старые билеты новыми с 1 страницы
           setHasMore(refreshResult.newHasMore);
           setPage(1); // Сбрасываем на первую страницу
           // Фильтрация применится автоматически через useEffect
        } else {
           console.warn("UserEventTickets: Failed to refetch tickets after cancellation or user not authorized.");
           // Можно показать ошибку или просто оставить старые данные (менее желательно)
           // setLocalError("Не удалось обновить список билетов.");
        }
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Не удалось отменить билет';
      console.error(`UserEventTickets: Исключение при отмене билета ${selectedTicketToCancel?.id}:`, err);
      setCancelModalError(errorMsg);
    } finally {
      console.log(`UserEventTickets: Завершение отмены билета ${selectedTicketToCancel?.id} finally.`);
      setCancelModalLoading(false);
      isTicketBeingCancelled.current = false;
    }
  }, [selectedTicketToCancel, fetchTickets, userData, setCancelModalError, setCancelModalSuccess, setCancelModalLoading, setIsCancelModalOpen, clearCache, setTickets, setHasMore, setPage]); // Добавлены зависимости для обновления состояния и clearCache

  // Восстанавливаем состояние для hover-эффекта
  const [hoveredTicketId, setHoveredTicketId] = useState<number | null>(null);

  // Отображение ошибки загрузки, если она есть - ВОЗВРАЩАЕМ СЮДА
  if (loadingError && filteredTickets.length === 0 && !isInitialLoading && !isFetching) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500">{loadingError}</p>
        <button
          onClick={() => fetchTickets(1)}
          className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden flex flex-col">
      {/* Статическая шапка - всегда видна */} 
          <div className="flex justify-between items-center mb-4">
        {/* Кнопка фильтра */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FaFilter className="text-orange-500 text-[10px] sm:text-base" />
              <span>
                {filters.find((f: {id: TicketFilter}) => f.id === activeFilter)?.label || "Фильтровать"}
                {dateRange.startDate && dateRange.endDate && 
                  ` (${dateRange.startDate.split('-').reverse().join('.')} - ${dateRange.endDate.split('-').reverse().join('.')})`}
              </span>
            </button>
            
        {/* Счетчик билетов - со скелетоном при начальной загрузке */} 
        {isInitialLoading ? (
          <span className="text-xs sm:text-sm text-gray-500 truncate bg-white px-1 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm tickets-count">
            <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse"></span>
          </span>
        ) : (
            <span className="text-xs sm:text-sm text-gray-500 truncate bg-white px-1 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm tickets-count">
              Загружено: {filteredTickets.length}
            </span>
        )}
          </div>
          
      {/* Отображение ошибки */} 
      {localError && tickets.length === 0 && !isInitialLoading && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <p className="text-sm font-medium">{localError}</p>
            </div>
          )}
      
      {/* Контейнер с прокруткой и условным рендерингом содержимого */} 
          <div className="h-[450px] overflow-y-auto border border-gray-100 rounded-lg shadow-inner" ref={ticketsContainerRef}>
            {isInitialLoading ? (
          // --- Скелетоны для ПЕРВОЙ загрузки --- 
              <div className="space-y-4 p-3"> 
                <TicketSkeleton />
                <TicketSkeleton />
                <TicketSkeleton />
                {showLoadingHint && (
                  <div className="text-center mt-4 text-gray-500 text-sm animate-pulse">
                    Загрузка билетов может занять некоторое время...
                  </div>
                )}
              </div>
        ) : filteredTickets.length > 0 ? (
          // --- Список билетов, если они есть --- 
              <div className="space-y-4 p-3">
                {filteredTickets.map((ticket, index) => {
                  const canCancel = ticket.status === 'approved' && ticket.event.status === 'registration_open';
                  const baseSlugWithDate = generateBaseSlugWithDate(ticket.event);
                  const eventUrl = `/events/${baseSlugWithDate}?id=${ticket.event.id}`;
                  return (
                <div key={`ticket-${ticket.id}-${index}`}> 
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        onMouseEnter={() => setHoveredTicketId(ticket.id)}
                        onMouseLeave={() => setHoveredTicketId(null)}
                      >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
                          <Link 
                            href={eventUrl} 
                            className="flex items-center gap-1 text-sm sm:text-base md:text-lg font-semibold text-gray-800 hover:text-orange-600 transition-colors group relative flex-grow min-w-0 truncate sm:gap-2"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <h3 className="min-w-0 truncate sm:break-words">{ticket.event.title}</h3> 
                            <motion.div
                              initial={{ x: 0 }}
                              animate={{
                                x: hoveredTicketId === ticket.id ? [0, -3, 0] : 0,
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: hoveredTicketId === ticket.id ? Infinity : 0,
                                repeatType: "loop",
                                ease: "easeInOut",
                              }}
                              className="text-orange-500 flex-shrink-0 text-xs sm:text-sm md:text-base"
                            >
                              <FaHandPointLeft />
                            </motion.div>
                          </Link>
                          
                          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
                            <div
                              className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${getStatusColor(ticket.status)} sm:px-3`}
                            >
                              {getStatusText(ticket.status)}
                            </div>
                            {canCancel && (
                              <button 
                                onClick={() => handleCancelClick(ticket)}
                                className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium py-1 px-1 sm:px-2 rounded transition-colors whitespace-nowrap"
                              >
                                Отменить
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex h-full">
                          <div className="flex-shrink-0 w-[60px] sm:w-[75px] md:w-[90px] flex items-center justify-center">
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-2 px-1 sm:px-2 shadow-sm h-full flex">
                              <div className="flex-1 flex items-center justify-center pr-0.5 sm:pr-1 border-r border-orange-200">
                                <p className="[writing-mode:vertical-rl] rotate-180 text-[9px] sm:text-xs text-gray-500 uppercase font-medium">
                                  НОМЕР БИЛЕТА
                                </p>
                              </div>
                              
                              <div className="flex-1 flex items-center justify-center pl-0.5 sm:pl-1">
                                <p className="[writing-mode:vertical-rl] rotate-180 text-sm sm:text-lg md:text-xl font-bold text-orange-600">
                                  #{ticket.ticket_number || ticket.id}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex-1 ml-2 sm:ml-3">
                            <div className="space-y-1 sm:space-y-2">
                              <div className="flex items-start gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                <FaCalendarAlt className="text-orange-500 flex-shrink-0 mt-1 text-[10px] sm:text-base" />
                                <span className="break-words">
                                  {formatDateForDisplay(ticket.event.start_date)}
                                  {ticket.event.end_date && !isSameDay(ticket.event.start_date, ticket.event.end_date) &&
                                    ` - ${formatDateForDisplay(ticket.event.end_date)}`}
                                </span>
                              </div>
                              <div className="flex items-start gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                <FaClock className="text-orange-500 flex-shrink-0 mt-1 text-[10px] sm:text-base" />
                                <span className="break-words">
                                  {formatTimeForDisplay(ticket.event.start_date)}
                                  {ticket.event.end_date && 
                                    ` - ${formatTimeForDisplay(ticket.event.end_date)}`}
                                </span>
                              </div>
                              {ticket.event.location && (
                                <div className="flex items-start gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                  <FaMapMarkerAlt className="text-orange-500 flex-shrink-0 mt-1 text-[10px] sm:text-base" />
                                  <span className="break-words">{ticket.event.location}</span>
                                </div>
                              )}
                              <div className="flex items-start gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                <FaTicketAlt className="text-orange-500 flex-shrink-0 mt-1 text-[10px] sm:text-base" />
                                <span className="break-words">{getTicketTypeInRussian(ticket.ticket_type)}</span>
                              </div>
                              
                              <div className="flex items-start gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                <FaRegCalendarCheck className="text-orange-500 flex-shrink-0 mt-1 text-[10px] sm:text-base" />
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
                })}
                
            {/* Показываем скелетон во время ПОДГРУЗКИ */} 
                <AnimatePresence>
                  {isLoadingMore && (
                    <>
                      {[...Array(ticketsPerPage)].map((_, idx) => (
                        <motion.div
                          key={idx}
                          className="pt-4"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                        >
                          <TicketSkeleton />
                        </motion.div>
                      ))}
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
          // --- Сообщение, если билетов нет --- 
              <div className="flex flex-col items-center justify-center py-10 px-4 min-h-[300px]">
                <div className="bg-orange-50 rounded-full p-4 mb-4">
                  <FaTicketAlt className="text-orange-500 text-3xl" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Билеты не найдены</h3>
                <p className="text-gray-500 text-center max-w-md">
                  По выбранным параметрам фильтра не найдено билетов. Попробуйте изменить настройки фильтра или проверьте наличие билетов позже.
                </p>
                <button
                  onClick={() => fetchTickets(1)}
                  className="mt-4 px-4 py-2 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg transition-colors text-sm"
                >
                  Обновить
                </button>
              </div>
            )}
          </div>
          
      {/* Модальные окна */} 
          <FilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            setUseDateFilter={() => {}}
          />
          
          <CancelTicketModal 
            isOpen={isCancelModalOpen}
            onClose={() => { setIsCancelModalOpen(false); setSelectedTicketToCancel(null); }}
            onConfirm={handleCancelConfirm}
            eventTitle={selectedTicketToCancel?.event.title || ''}
            isLoading={cancelModalLoading}
            error={cancelModalError}
            success={cancelModalSuccess}
          />
    </div>
  );
  }
);

UserEventTickets.displayName = 'UserEventTickets';

export default UserEventTickets;