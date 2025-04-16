// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FaPlus, FaSearch } from "react-icons/fa";
import { apiFetch, ApiError } from "@/utils/api";
import "@/app/globals.css";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "react-use";
import { useRef } from 'react';

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

  // Состояния для пагинации Мероприятий
  const [eventsSkip, setEventsSkip] = useState(0);
  const [eventsLimit] = useState(10); // Лимит на странице
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsHasMore, setEventsHasMore] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [debouncedEventSearchTerm, setDebouncedEventSearchTerm] = useState("");

  // Ref для Intersection Observer
  const { ref: usersLoadMoreRef, inView: usersInView } = useInView({
    threshold: 0.5, // Триггер при 50% видимости
    triggerOnce: false // Повторно проверять
  });
  const { ref: eventsLoadMoreRef, inView: eventsInView } = useInView({
    threshold: 0.5,
    triggerOnce: false
  });

  // Ref для контроля первичной загрузки
  const initialUsersLoadComplete = useRef(false);
  const initialEventsLoadComplete = useRef(false);
  const initialLoadTriggered = useRef(false); // <--- Флаг однократного запуска

  // Debounce для поиска
  useDebounce(
    () => {
      setDebouncedUserSearchTerm(userSearchTerm);
    },
    500, // Задержка 500 мс
    [userSearchTerm]
  );
  useDebounce(
    () => {
      setDebouncedEventSearchTerm(eventSearchTerm);
    },
    500,
    [eventSearchTerm]
  );
  
  // Функция для загрузки пользователей
  const fetchUsers = useCallback(async (currentSkip: number, search: string, isInitialLoad = false) => {
    // Предотвращаем повторные запросы, если уже грузим или нет токена
    const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;
    
    setIsUsersLoading(true);
    if (currentSkip === 0) setError(null); 
    console.log(`Dashboard: Fetching users - Skip: ${currentSkip}, Limit: ${usersLimit}, Search: '${search}', Initial: ${isInitialLoad}`);
    
    try {
      const params = new URLSearchParams({ skip: currentSkip.toString(), limit: usersLimit.toString() });
      if (search) params.append('search', search);

      const response = await apiFetch<PaginatedResponse<User>>(`/admin_edits/users?${params.toString()}`, {
        bypassLoadingStageCheck: true, 
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Проверка структуры ответа (оставляем основную проверку)
      if (!response || typeof response !== 'object' || !response.items || !Array.isArray(response.items)) {
        console.error("Dashboard fetchUsers: Invalid response structure received. Expected PaginatedResponse object with an 'items' array.", response);
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
      console.error("Dashboard: Error fetching users:", error);
      // Обработка ошибок аутентификации
      if (error instanceof ApiError && (error.status === 401 || error.body?.authError)) {
        console.log('Dashboard: Auth error detected in fetchUsers, redirecting...');
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_DATA);
        router.push("/admin-login");
      } else {
        // Устанавливаем ошибку только если это первая загрузка или новый поиск
        if (currentSkip === 0) setError("Не удалось загрузить пользователей.");
        // При ошибке сбрасываем hasMore
        setUsersHasMore(false); 
      }
    } finally {
      setIsUsersLoading(false);
    }
  // Зависимости: usersLimit и router - стабильны. isUsersLoading используется для предотвращения повторного входа.
  }, [usersLimit, router]); 

  // Функция для загрузки мероприятий
  const fetchEvents = useCallback(async (currentSkip: number, search: string, isInitialLoad = false) => {
    const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;
    setIsEventsLoading(true);
    if (currentSkip === 0) setError(null);
    console.log(`Dashboard: Fetching events - Skip: ${currentSkip}, Limit: ${eventsLimit}, Search: '${search}', Initial: ${isInitialLoad}`);

    try {
      const params = new URLSearchParams({ skip: currentSkip.toString(), limit: eventsLimit.toString() });
      if (search) params.append('search', search);
      
      const response = await apiFetch<PaginatedResponse<Event>>(`/admin_edits/events?${params.toString()}`, {
        bypassLoadingStageCheck: true,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Проверка структуры ответа (оставляем основную проверку)
      if (!response || typeof response !== 'object' || !response.items || !Array.isArray(response.items)) {
        console.error("Dashboard fetchEvents: Invalid response structure received. Expected PaginatedResponse object with an 'items' array.", response);
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
      console.error("Dashboard: Error fetching events:", error);
      if (error instanceof ApiError && (error.status === 401 || error.body?.authError)) {
        console.log('Dashboard: Auth error detected in fetchEvents, redirecting...');
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_DATA);
        router.push("/admin-login");
      } else {
        if (currentSkip === 0) setError("Не удалось загрузить мероприятия.");
        setEventsHasMore(false);
      }
    } finally {
      setIsEventsLoading(false);
    }
  // Зависимости: eventsLimit и router.
  }, [eventsLimit, router]);

  // Установка флага клиентской загрузки при монтировании компонента
  useEffect(() => {
    setClientReady(true);
    console.log('Dashboard: Client ready set to true');
  }, []);

  // Эффект для ПЕРВИЧНОЙ загрузки данных при монтировании и готовности
  useEffect(() => {
    if (clientReady && isAuthChecked && isAuthenticated && !initialLoadTriggered.current) {
      initialLoadTriggered.current = true; 
      console.log('Dashboard: Initial load conditions met, triggering fetches ONCE.');
      // Загружаем с ПУСТЫМ поиском и флагом isInitialLoad = true
      fetchUsers(0, "", true); 
      fetchEvents(0, "", true);
    }
  // Зависит ТОЛЬКО от условий готовности/аутентификации и стабильных fetch функций
  }, [clientReady, isAuthChecked, isAuthenticated, fetchUsers, fetchEvents]); 

  // Эффект для загрузки СЛЕДУЮЩЕЙ страницы Пользователей
  useEffect(() => {
    if (usersInView && !isUsersLoading && usersHasMore && initialUsersLoadComplete.current) { 
      console.log("Dashboard: Users Load More Triggered");
      fetchUsers(usersSkip, debouncedUserSearchTerm);
    }
  }, [usersInView, usersHasMore, usersSkip, debouncedUserSearchTerm, fetchUsers]);

  // Эффект для загрузки СЛЕДУЮЩЕЙ страницы Мероприятий
  useEffect(() => {
    if (eventsInView && !isEventsLoading && eventsHasMore && initialEventsLoadComplete.current) { 
      console.log("Dashboard: Events Load More Triggered");
      fetchEvents(eventsSkip, debouncedEventSearchTerm);
    }
  }, [eventsInView, eventsHasMore, eventsSkip, debouncedEventSearchTerm, fetchEvents]);

  // Эффект для сброса и перезагрузки при ИЗМЕНЕНИИ ПОИСКА Пользователей
  const isFirstUserSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstUserSearchRun.current) {
        isFirstUserSearchRun.current = false;
        return; 
    }

    console.log(`Dashboard: User search term changed to '${debouncedUserSearchTerm}', resetting and fetching.`);
    setUsers([]); 
    setUsersSkip(0); 
    setUsersHasMore(true); 
    initialUsersLoadComplete.current = false; 

    // Вызываем загрузку с новым поиском и isInitialLoad = true
    fetchUsers(0, debouncedUserSearchTerm, true);

  // Зависим ТОЛЬКО от debounced значения и стабильной функции fetch
  }, [debouncedUserSearchTerm, fetchUsers]);

  // Эффект для сброса и перезагрузки при ИЗМЕНЕНИИ ПОИСКА Мероприятий
  const isFirstEventSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstEventSearchRun.current) {
        isFirstEventSearchRun.current = false;
        return;
    }

    console.log(`Dashboard: Event search term changed to '${debouncedEventSearchTerm}', resetting and fetching.`);
    setEvents([]);
    setEventsSkip(0);
    setEventsHasMore(true);
    initialEventsLoadComplete.current = false;

    fetchEvents(0, debouncedEventSearchTerm, true);

  // Зависим ТОЛЬКО от debounced значения и стабильной функции fetch
  }, [debouncedEventSearchTerm, fetchEvents]);

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

  // Сортировка теперь применяется к текущему списку users/events
  const sortedUsers = [...users].sort((a, b) => {
    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const sortedEvents = [...events].sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

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
          
          {!isUsersLoading ? (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Пользователи</h2>
              
              {/* Поиск пользователей */}
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Поиск по ФИО, email, Telegram, WhatsApp..."
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              
              {/* Показываем скелетон ТОЛЬКО при САМОЙ первой загрузке */} 
              {isUsersLoading && !initialUsersLoadComplete.current && users.length === 0 ? (
                <UsersSkeleton />
              ) : users.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  <UsersList users={sortedUsers} />
                  {/* Триггер для подгрузки */}
                  <div ref={usersLoadMoreRef} style={{ height: "10px" }} />
                </div>
              ) : !isUsersLoading ? ( // Сообщение "не найдено" только если НЕ идет загрузка
                 <p className="text-center text-gray-500 py-4">Пользователи не найдены.</p>
              ) : null}
              {/* Индикатор загрузки при подгрузке */} 
              {isUsersLoading && initialUsersLoadComplete.current && <div className="text-center py-4">Загрузка пользователей...</div>}
            </div>
          ) : (
            <UsersSkeleton />
          )}
          
          {!isEventsLoading ? (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Мероприятия</h2>
              
              {/* Поиск мероприятий */}
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={eventSearchTerm}
                    onChange={(e) => setEventSearchTerm(e.target.value)}
                    placeholder="Поиск по названию мероприятия..."
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              
              {/* Показываем скелетон ТОЛЬКО при САМОЙ первой загрузке */} 
              {isEventsLoading && !initialEventsLoadComplete.current && events.length === 0 ? (
                <EventsSkeleton />
              ) : events.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  <EventsList events={sortedEvents} onEventDeleted={() => { 
                      console.log('Dashboard: Event deleted, resetting events list');
                      setEvents([]); 
                      setEventsSkip(0); 
                      setEventsHasMore(true); 
                      initialEventsLoadComplete.current = false;
                      fetchEvents(0, debouncedEventSearchTerm, true); 
                  }} />
                  {/* Триггер для подгрузки */}
                  <div ref={eventsLoadMoreRef} style={{ height: "10px" }} />
                </div>
              ) : !isEventsLoading ? (
                <p className="text-center text-gray-500 py-4">Мероприятия не найдены.</p>
              ) : null}
              {/* Индикатор загрузки при подгрузке */} 
              {isEventsLoading && initialEventsLoadComplete.current && <div className="text-center py-4">Загрузка мероприятий...</div>}
            </div>
          ) : (
            <EventsSkeleton />
          )}
        </div>
      </main>
    </div>
  );
}