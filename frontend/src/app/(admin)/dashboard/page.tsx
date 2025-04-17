// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FaPlus, FaSearch, FaSortUp, FaSortDown, FaFilter } from "react-icons/fa";
import { apiFetch, ApiError } from "@/utils/api";
import "@/app/globals.css";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "react-use";

// Storage key constants matching AdminAuthContext
const ADMIN_STORAGE_KEYS = {
  ADMIN_TOKEN: "admin_token",
  ADMIN_DATA: "admin_data",
};

// Interfaces for type safety
interface User {
  id: number;
  email: string;
  fio: string;
  created_at?: string;
  updated_at?: string;
  last_active?: string;
  telegram?: string;
  whatsapp?: string;
  avatar_url?: string;
  is_blocked?: boolean;
  is_partner?: boolean;
}

interface TicketType {
  name: string;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  free_registration: boolean;
}

interface Event {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  image_url?: string;
  price: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  status: "completed" | "draft" | "registration_open" | "registration_closed";
  registrations_count: number;
  ticket_type?: TicketType;
  url_slug?: string;
}

// Добавляем интерфейс для пагинированного ответа
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// Добавляем Enum для статусов событий для удобства
// (Можно вынести в отдельный файл types/enums.ts)
enum EventStatusEnum {
  DRAFT = "draft",
  REGISTRATION_OPEN = "registration_open",
  REGISTRATION_CLOSED = "registration_closed",
  COMPLETED = "completed"
}

// Динамическая загрузка компонентов без SSR
const EventsList = dynamic(() => import("@/components/admin/EventsList"), { ssr: false });
const UsersList = dynamic(() => import("@/components/admin/UsersList"), { ssr: false });

// Компонент скелетона для пользователей
const UsersSkeleton = () => (
  <div className="bg-white p-6 rounded-lg shadow-md mb-8 animate-pulse">
    <div className="flex justify-between items-center mb-4">
      <div className="h-7 bg-gray-200 rounded w-36"></div>
      <div className="h-9 bg-gray-200 rounded w-24"></div>
    </div>
    <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gray-200 mr-3"></div>
            <div>
              <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
          <div className="flex space-x-2">
            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Компонент скелетона для мероприятий
const EventsSkeleton = () => (
  <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
    <div className="flex justify-between items-center mb-4">
      <div className="h-7 bg-gray-200 rounded w-48"></div>
      <div className="h-9 bg-gray-200 rounded w-32"></div>
    </div>
    <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-4 border border-gray-100 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="flex space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-200"></div>
              <div className="w-8 h-8 rounded-full bg-gray-200"></div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
          <div className="flex justify-between items-center">
            <div className="h-5 bg-gray-200 rounded w-24"></div>
            <div className="h-8 bg-gray-200 rounded w-28"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Компонент скелетона для всего дашборда
const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    <main className="container mx-auto px-4 pt-24 pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded w-36"></div>
        </div>
        
        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="bg-blue-50 p-3 rounded-full">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="bg-green-50 p-3 rounded-full">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
        
        <UsersSkeleton />
        <EventsSkeleton />
      </div>
    </main>
  </div>
);

// Добавляем хелпер для проверки формата даты YYYY-MM-DD
const isValidDateFilter = (dateString: string): boolean => {
  if (!dateString) return true; // Пустая строка - валидно (нет фильтра)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
};

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, isAuthChecked } = useAdminAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  
  // Состояния для пагинации Пользователей
  const [usersSkip, setUsersSkip] = useState(0);
  const [usersLimit] = useState(20); // Лимит на странице
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [debouncedUserSearchTerm, setDebouncedUserSearchTerm] = useState("");

  // Удалены состояния для сортировки Пользователей
  // const [userSortBy, setUserSortBy] = useState("created_at");
  // const [userSortOrder, setUserSortOrder] = useState("asc");
  // Устанавливаем сортировку по умолчанию
  const defaultUserSortBy = "created_at";
  const defaultUserSortOrder = "desc"; // Новые сверху

  // Состояния для пагинации Мероприятий
  const [eventsSkip, setEventsSkip] = useState(0);
  const [eventsLimit] = useState(10); // Лимит на странице
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsHasMore, setEventsHasMore] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [debouncedEventSearchTerm, setDebouncedEventSearchTerm] = useState("");

  // Состояния для фильтров и сортировки Мероприятий
  const [eventSortBy, setEventSortBy] = useState("published");
  const [eventSortOrder, setEventSortOrder] = useState("desc");
  const [eventStatusFilter, setEventStatusFilter] = useState<string>("");
  // Мгновенные состояния для полей ввода дат
  const [eventStartDateFilter, setEventStartDateFilter] = useState<string>("");
  const [eventEndDateFilter, setEventEndDateFilter] = useState<string>("");
  // Дебаунсированные состояния для дат
  const [debouncedEventStartDateFilter, setDebouncedEventStartDateFilter] = useState<string>("");
  const [debouncedEventEndDateFilter, setDebouncedEventEndDateFilter] = useState<string>("");

  const [isEventFilterPanelOpen, setIsEventFilterPanelOpen] = useState(false);

  // Refs для Intersection Observer и начальной загрузки
  const { ref: usersLoadMoreRef, inView: usersInView } = useInView({ threshold: 0.5, triggerOnce: false });
  const { ref: eventsLoadMoreRef, inView: eventsInView } = useInView({ threshold: 0.5, triggerOnce: false });
  const initialUsersLoadComplete = useRef(false);
  const initialEventsLoadComplete = useRef(false);
  const initialLoadTriggered = useRef(false);

  // Debounce для поиска
  useDebounce(() => { setDebouncedUserSearchTerm(userSearchTerm); }, 500, [userSearchTerm]);
  useDebounce(() => { setDebouncedEventSearchTerm(eventSearchTerm); }, 500, [eventSearchTerm]);
  // Debounce для фильтров дат
  useDebounce(() => { setDebouncedEventStartDateFilter(eventStartDateFilter); }, 750, [eventStartDateFilter]);
  useDebounce(() => { setDebouncedEventEndDateFilter(eventEndDateFilter); }, 750, [eventEndDateFilter]);

  // Функция для загрузки пользователей
  const fetchUsers = useCallback(async (currentSkip: number, search: string, isInitialLoad = false) => {
    const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;
    
    setIsUsersLoading(true);
    if (currentSkip === 0) setError(null);
    console.log(`Dashboard: Fetching users - Skip: ${currentSkip}, Limit: ${usersLimit}, Search: '${search}', SortBy: ${defaultUserSortBy}, SortOrder: ${defaultUserSortOrder}, Initial: ${isInitialLoad}`);
    
    try {
      const params = new URLSearchParams({ 
        skip: currentSkip.toString(), 
        limit: usersLimit.toString(),
        sortBy: defaultUserSortBy,
        sortOrder: defaultUserSortOrder
      });
      if (search) params.append('search', search);

      const response = await apiFetch<PaginatedResponse<User>>(`/admin_edits/users?${params.toString()}`, {
        bypassLoadingStageCheck: true, 
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response || typeof response !== 'object' || !response.items || !Array.isArray(response.items)) {
        console.error("Dashboard fetchUsers: Invalid response structure.", response);
        setError("Не удалось получить данные пользователей. Некорректная структура ответа сервера.");
        setUsersHasMore(false); 
        return; 
      }

      setUsersTotal(response.total);
      const newHasMore = response.items.length >= usersLimit;
      setUsersHasMore(newHasMore); 
      
      if (currentSkip === 0) {
        setUsers(response.items); 
        console.log(`Dashboard: Fetched FIRST PAGE of ${response.items.length} users (Total: ${response.total}), HasMore: ${newHasMore}`);
      } else {
        setUsers(prev => {
            const existingIds = new Set(prev.map(u => u.id));
            const uniqueNewItems = response.items.filter(u => !existingIds.has(u.id));
            return [...prev, ...uniqueNewItems];
        });
        console.log(`Dashboard: Fetched MORE ${response.items.length} users (Total: ${response.total}), HasMore: ${newHasMore}`);
      }
      setUsersSkip(currentSkip + response.items.length);
      
      if (isInitialLoad) initialUsersLoadComplete.current = true;

    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.body?.authError)) {
        console.log('Dashboard: Auth error detected in fetchUsers, redirecting...');
        router.push("/admin-login");
      } else {
        if (currentSkip === 0) setError("Не удалось загрузить пользователей.");
        setUsersHasMore(false); 
      }
    } finally {
      setIsUsersLoading(false);
    }
  }, [usersLimit, router]);

  // Функция для загрузки мероприятий
  const fetchEvents = useCallback(async (
    currentSkip: number,
    search: string,
    sortBy: string,
    sortOrder: string,
    status: string,
    startDate: string,
    endDate: string,
    isInitialLoad = false
  ) => {
    const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;
    setIsEventsLoading(true);
    if (currentSkip === 0) setError(null);
    console.log(`Dashboard: Fetching events - Skip: ${currentSkip}, Limit: ${eventsLimit}, Search: '${search}', SortBy: ${sortBy}, SortOrder: ${sortOrder}, Status: ${status}, Start: ${startDate}, End: ${endDate}, Initial: ${isInitialLoad}`);

    try {
      const params = new URLSearchParams({
        skip: currentSkip.toString(),
        limit: eventsLimit.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder
      });
      if (search) params.append('search', search);
      if (status) params.append('statusFilter', status);
      // Передаем только валидные даты на бэкенд
      if (isValidDateFilter(startDate)) params.append('startDateFilter', startDate);
      if (isValidDateFilter(endDate)) params.append('endDateFilter', endDate);

      const response = await apiFetch<PaginatedResponse<Event>>(`/admin_edits/events?${params.toString()}`, {
        bypassLoadingStageCheck: true,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response || typeof response !== 'object' || !response.items || !Array.isArray(response.items)) {
        console.error("Dashboard fetchEvents: Invalid response structure.", response);
        setError("Не удалось получить данные мероприятий. Некорректная структура ответа сервера.");
        setEventsHasMore(false); 
        return;
      }

      setEventsTotal(response.total);
      const newHasMore = response.items.length >= eventsLimit;
      setEventsHasMore(newHasMore);
      
      if (currentSkip === 0) {
        setEvents(response.items);
        console.log(`Dashboard: Fetched FIRST PAGE of ${response.items.length} events (Total: ${response.total}), HasMore: ${newHasMore}`);
      } else {
        setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const uniqueNewItems = response.items.filter(e => !existingIds.has(e.id));
            return [...prev, ...uniqueNewItems];
        });
        console.log(`Dashboard: Fetched MORE ${response.items.length} events (Total: ${response.total}), HasMore: ${newHasMore}`);
      }
      setEventsSkip(currentSkip + response.items.length);
      
      if (isInitialLoad) initialEventsLoadComplete.current = true;

    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.body?.authError)) {
        console.log('Dashboard: Auth error detected in fetchEvents, redirecting...');
        router.push("/admin-login");
      } else {
        if (currentSkip === 0) setError("Не удалось загрузить мероприятия.");
        setEventsHasMore(false);
      }
    } finally {
      setIsEventsLoading(false);
    }
  }, [eventsLimit, router]);

  // Установка флага клиентской загрузки при монтировании компонента
  useEffect(() => {
    setClientReady(true);
    console.log('Dashboard: Client ready');
  }, []);

  // Эффект для ПЕРВИЧНОЙ загрузки данных при монтировании и готовности
  useEffect(() => {
    if (clientReady && isAuthChecked && isAuthenticated && !initialLoadTriggered.current) {
      initialLoadTriggered.current = true; 
      console.log('Dashboard: Initial load');
      fetchUsers(0, debouncedUserSearchTerm, true);
      fetchEvents(0, debouncedEventSearchTerm, eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter, true);
    }
  }, [clientReady, isAuthChecked, isAuthenticated, fetchUsers, fetchEvents, 
      debouncedUserSearchTerm,
      debouncedEventSearchTerm, eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter]);

  // Эффект для загрузки СЛЕДУЮЩЕЙ страницы Пользователей
  useEffect(() => {
    if (usersInView && !isUsersLoading && usersHasMore && initialUsersLoadComplete.current) { 
      console.log("Dashboard: Users Load More Triggered");
      fetchUsers(usersSkip, debouncedUserSearchTerm);
    }
  }, [usersInView, isUsersLoading, usersHasMore, usersSkip, debouncedUserSearchTerm, fetchUsers]);

  // Эффект для загрузки СЛЕДУЮЩЕЙ страницы Мероприятий
  useEffect(() => {
    if (eventsInView && !isEventsLoading && eventsHasMore && initialEventsLoadComplete.current) {
      console.log("Dashboard: Events Load More Triggered");
      fetchEvents(eventsSkip, debouncedEventSearchTerm, eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter);
    }
  }, [eventsInView, isEventsLoading, eventsHasMore, eventsSkip, debouncedEventSearchTerm, fetchEvents, 
      eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter]);

  // Эффект для перезагрузки при изменении поиска (УДАЛЕНО setUsers([]))
  const resetAndFetchUsers = useCallback(() => {
      console.log('Dashboard: User search changed, resetting and fetching.');
      // setUsers([]); // <-- УДАЛЕНО
      setUsersSkip(0);
      setUsersHasMore(true);
      initialUsersLoadComplete.current = false;
      fetchUsers(0, debouncedUserSearchTerm, true);
  }, [debouncedUserSearchTerm, fetchUsers]);

  // Эффект для перезагрузки Мероприятий (УДАЛЕНО setEvents([]))
  const resetAndFetchEvents = useCallback(() => {
      // Проверяем валидность дебаунсированных дат перед запросом
      if (!isValidDateFilter(debouncedEventStartDateFilter) || !isValidDateFilter(debouncedEventEndDateFilter)) {
          console.log("Dashboard: resetAndFetchEvents skipped due to invalid debounced date format.");
          return; // Не делаем запрос, если формат некорректен
      }
      console.log('Dashboard: Event search/filter/sort changed, resetting and fetching with debounced dates.');
      setEventsSkip(0);
      setEventsHasMore(true);
      initialEventsLoadComplete.current = false;
      // Передаем дебаунсированные даты
      fetchEvents(0, debouncedEventSearchTerm, eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter, true);
  }, [// Зависит от debounced дат
      debouncedEventSearchTerm, eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter, fetchEvents]);

  // Пользователи: перезагрузка при поиске или сортировке
  const isFirstUserParamsRun = useRef(true);
  useEffect(() => {
    if (isFirstUserParamsRun.current) {
        isFirstUserParamsRun.current = false;
        return; 
    }
    resetAndFetchUsers();
  }, [debouncedUserSearchTerm, resetAndFetchUsers]); 

  // Мероприятия: перезагрузка при поиске, фильтре или сортировке (С ДОБАВЛЕННОЙ ПРОВЕРКОЙ ДАТ)
  const isFirstEventParamsRun = useRef(true);
  useEffect(() => {
    if (isFirstEventParamsRun.current) {
        isFirstEventParamsRun.current = false;
        return;
    }
    // Теперь триггерится на изменение дебаунсированных значений
    resetAndFetchEvents();
  }, [// Зависит от debounced дат
      debouncedEventSearchTerm, eventSortBy, eventSortOrder, eventStatusFilter, debouncedEventStartDateFilter, debouncedEventEndDateFilter, resetAndFetchEvents]);

  const handleCreateEvent = () => {
    router.push("/edit-events");
  };

  // Вычисленные значения для панели статистики
  const publishedEventsCount = events.filter(event => event.published).length;
  const publishedEventsPercent = eventsTotal ? Math.round((publishedEventsCount / eventsTotal) * 100) : 0;
  
  const activeUsersCount = users.filter(user => 
    user.last_active && new Date(user.last_active).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length;
  const activeUsersPercent = usersTotal ? Math.round((activeUsersCount / usersTotal) * 100) : 0;

  // Если проверка авторизации еще не завершена, показываем скелетон
  if (!isAuthChecked) {
    return <DashboardSkeleton />;
  }
  
  // Если пользователь не авторизован, показываем сообщение об ошибке
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Доступ запрещен</h1>
          <p className="mb-6">Для доступа к этой странице требуется авторизация администратора.</p>
          <button
            onClick={() => router.push("/admin-login")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Перейти на страницу входа
          </button>
        </div>
      </div>
    );
  }

  // Показываем скелетон только если клиент не готов или данные не загружены
  // Важно: dataLoaded проверяется на ИЛИ, а не на И, чтобы контент отображался по мере загрузки
  if (!clientReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        
        /* Кастомный скроллбар */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
          transition: background 0.3s ease;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        
        /* Для Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #d1d5db #f1f1f1;
          /* Плавный переход при появлении скроллбара */
          transition: padding-right 0.3s ease;
        }
      `}</style>
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-5xl mx-auto fade-in">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Панель управления</h1>
            <button
              onClick={handleCreateEvent}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <FaPlus className="mr-2" /> Создать мероприятие
            </button>
          </div>
          
          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500">
              {error}
            </div>
          )}
          
          {/* Dashboard Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500">Пользователи</h3>
                  <p className="text-3xl font-bold mt-1">{users.length || 0}</p>
                  {usersTotal > 0 && (
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="font-medium text-blue-600">{activeUsersCount || 0}</span> активных за 30 дней 
                      <span className="inline-block ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {activeUsersPercent}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              {isUsersLoading && <div className="mt-2 h-1 w-full bg-gray-200 rounded overflow-hidden"><div className="h-full bg-blue-500 animate-pulse" style={{width: "100%"}}></div></div>}
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500">Мероприятия</h3>
                  <p className="text-3xl font-bold mt-1">{events.length || 0}</p>
                  {eventsTotal > 0 && (
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="font-medium text-green-600">{publishedEventsCount || 0}</span> опубликовано
                      <span className="inline-block ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        {publishedEventsPercent}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              {isEventsLoading && <div className="mt-2 h-1 w-full bg-gray-200 rounded overflow-hidden"><div className="h-full bg-green-500 animate-pulse" style={{width: "100%"}}></div></div>}
            </div>
          </div>
          
          {/* Recent Activity Panel */}
          {users.length > 0 && events.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Общая статистика</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-gray-500 font-medium mb-1">Регистрации на мероприятия</h3>
                  <p className="text-xl font-bold">
                    {events.reduce((sum: number, event: Event) => 
                      sum + (event.registrations_count || 0), 0
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-gray-500 font-medium mb-1">Мероприятия за месяц</h3>
                  <p className="text-xl font-bold">
                    {events.filter((event: Event) => 
                      event.created_at && new Date(event.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
                    ).length}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-gray-500 font-medium mb-1">Новые пользователи за месяц</h3>
                  <p className="text-xl font-bold">
                    {users.filter((user: User) => 
                      user.created_at && new Date(user.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
                    ).length}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Раздел Пользователей */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Пользователи</h2>
            {/* Поиск Пользователей */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Поиск по ФИО, email..."
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              
            {/* Список Пользователей + Улучшенная логика скелетона/загрузки */}
            {isUsersLoading && users.length === 0 ? (
              <UsersSkeleton />
            ) : (
              <div className="relative"> {/* Контейнер для оверлея */}
                {users.length > 0 ? (
                  <div className={`max-h-[400px] overflow-y-auto pr-1 custom-scrollbar transition-opacity duration-300 ${isUsersLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}> {/* Плавное затемнение */} 
                    <UsersList users={users} />
                    <div ref={usersLoadMoreRef} style={{ height: "10px" }} />
                  </div>
                ) : (
                  !isUsersLoading && <p className="text-center text-gray-500 py-4">Пользователи не найдены.</p>
                )}
                {/* Индикатор загрузки поверх списка */} 
                {isUsersLoading && users.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-b-lg"> 
                    <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4" style={{ borderTopColor: '#3b82f6' }}></div> {/* Tailwind Spinner */}
                  </div>
                )}
              </div>
            )}
            </div>
          
          {/* Раздел Мероприятий */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Мероприятия</h2>
            {/* Поиск, Фильтры и Сортировка Мероприятий */}
            <div className="mb-4 space-y-4">
              {/* Поиск */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={eventSearchTerm}
                    onChange={(e) => setEventSearchTerm(e.target.value)}
                  placeholder="Поиск по названию..."
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              {/* Кнопка открытия панели фильтров и сама панель */}
              <div className="flex justify-end">
                <button
                  onClick={() => setIsEventFilterPanelOpen(!isEventFilterPanelOpen)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors bg-gray-100 hover:bg-gray-200`}
                >
                  <FaFilter /> {isEventFilterPanelOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
                </button>
              </div>
              {isEventFilterPanelOpen && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                  {/* Фильтр по статусу */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Статус:</label>
                    <select
                      value={eventStatusFilter}
                      onChange={e => setEventStatusFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Все статусы</option>
                      <option value={EventStatusEnum.DRAFT}>Черновик</option>
                      <option value={EventStatusEnum.REGISTRATION_OPEN}>Регистрация открыта</option>
                      <option value={EventStatusEnum.REGISTRATION_CLOSED}>Регистрация закрыта</option>
                      <option value={EventStatusEnum.COMPLETED}>Завершено</option>
                    </select>
                  </div>
                  {/* Фильтр по дате */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала (от):</label>
                      <input
                        type="date"
                        value={eventStartDateFilter}
                        onChange={e => setEventStartDateFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала (до):</label>
                      <input
                        type="date"
                        value={eventEndDateFilter}
                        onChange={e => setEventEndDateFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {/* Сортировка */}
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-gray-700 flex-shrink-0">Сортировать по:</label>
                    <select
                      value={eventSortBy}
                      onChange={e => setEventSortBy(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-grow"
                    >
                      <option value="published">Публикация</option>
                      <option value="occupancy">Заполненность</option>
                    </select>
                    <button
                      onClick={() => setEventSortOrder(eventSortOrder === 'asc' ? 'desc' : 'asc')}
                      className={`p-2 border border-gray-300 rounded-lg flex-shrink-0 transition-colors hover:bg-gray-100`}
                    >
                      {eventSortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
                    </button>
                  </div>
                </div>
              )}
              </div>
              
            {/* Список Мероприятий + Улучшенная логика скелетона/загрузки */}
            {isEventsLoading && events.length === 0 ? (
                <EventsSkeleton />
            ) : (
              <div className="relative"> {/* Контейнер для оверлея */}
                {events.length > 0 ? (
                  <div className={`max-h-[500px] overflow-y-auto pr-1 custom-scrollbar transition-opacity duration-300 ${isEventsLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}> {/* Плавное затемнение */} 
                    <EventsList events={events} onEventDeleted={resetAndFetchEvents} />
                    <div ref={eventsLoadMoreRef} style={{ height: "10px" }} />
                  </div>
                ) : (
                  !isEventsLoading && <p className="text-center text-gray-500 py-4">Мероприятия не найдены.</p>
                )}
                {/* Индикатор загрузки поверх списка */} 
                {isEventsLoading && events.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-b-lg">
                    <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4" style={{ borderTopColor: '#10b981' }}></div>
                  </div>
                )}
              </div>
            )}
            </div>
        </div>
      </main>
    </div>
  );
}