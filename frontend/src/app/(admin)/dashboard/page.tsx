// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FaPlus } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContextLegacy";
import "@/app/globals.css";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';

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
  const { currentStage, setStage } = useLoading();
  const { isAuthenticated, isAuthChecked } = useAdminAuth(); // Get auth state from AdminAuthContext
  
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState({
    users: false,
    events: false
  });

  // Функция для загрузки пользователей
  const fetchUsers = useCallback(async () => {
    try {
      console.log('Dashboard: Starting fetchUsers');
      // Get token with the correct key
      const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
      
      if (!token) {
        console.log('Dashboard: No admin token found');
        throw new Error("Токен администратора не найден");
      }
      
      // Добавляем параметр для предотвращения кэширования ответа
      const cacheBuster = `_ts=${Date.now()}`;
      
      console.log('Dashboard: Sending request to fetch users');
      const fetchedUsers = await apiFetch<User[]>(`/admin_edits/users?${cacheBuster}`, {
        bypassLoadingStageCheck: true, // Обходим проверку стадии загрузки
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if ('aborted' in fetchedUsers) {
        const abortedResponse = fetchedUsers as unknown as ApiAbortedResponse;
        console.log('Dashboard: Users request was aborted:', abortedResponse.reason);
        return false;
      }
      
      if ('error' in fetchedUsers) {
        const errorResponse = fetchedUsers as unknown as ApiErrorResponse;
        console.error('Dashboard: Error in users response:', errorResponse.error);
        setError(typeof errorResponse.error === 'string' ? errorResponse.error : 'Ошибка при загрузке пользователей');
        return false;
      }
      
      setUsers(fetchedUsers);
      console.log(`Dashboard: Fetched ${fetchedUsers.length} users`);
      setDataLoaded(prev => ({ ...prev, users: true }));
      return true;
    } catch (error) {
      console.error("Dashboard: Error fetching users:", error);
      if (error instanceof Error && error.message.includes("Токен")) {
        console.log('Dashboard: Auth error detected in fetchUsers, redirecting');
        // Если ошибка связана с токеном, очищаем данные и перенаправляем
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_DATA);
        router.push("/admin-login");
      }
      return false;
    }
  }, [router]);

  // Функция для загрузки мероприятий
  const fetchEvents = useCallback(async () => {
    try {
      console.log('Dashboard: Starting fetchEvents');
      const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
      
      if (!token) {
        console.log('Dashboard: No admin token found for events');
        throw new Error("Токен администратора не найден");
      }
      
      // Добавляем параметр для предотвращения кэширования ответа
      const cacheBuster = `_ts=${Date.now()}`;
      
      console.log('Dashboard: Sending request to fetch events');
      const fetchedEvents = await apiFetch<Event[]>(`/admin_edits/events?${cacheBuster}`, {
        bypassLoadingStageCheck: true,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if ('aborted' in fetchedEvents) {
        const abortedResponse = fetchedEvents as unknown as ApiAbortedResponse;
        console.log('Dashboard: Events request was aborted:', abortedResponse.reason);
        return false;
      }
      
      if ('error' in fetchedEvents) {
        const errorResponse = fetchedEvents as unknown as ApiErrorResponse;
        console.error('Dashboard: Error in events response:', errorResponse.error);
        setError(typeof errorResponse.error === 'string' ? errorResponse.error : 'Ошибка при загрузке мероприятий');
        return false;
      }
      
      setEvents(fetchedEvents);
      console.log(`Dashboard: Fetched ${fetchedEvents.length} events`);
      setDataLoaded(prev => ({ ...prev, events: true }));
      return true;
    } catch (error) {
      console.error("Dashboard: Error fetching events:", error);
      if (error instanceof Error && error.message.includes("Токен")) {
        console.log('Dashboard: Auth error detected in fetchEvents, redirecting');
        // Если ошибка связана с токеном, очищаем данные и перенаправляем
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_DATA);
        router.push("/admin-login");
      }
      return false;
    }
  }, [router]);

  // Установка флага клиентской загрузки при монтировании компонента
  useEffect(() => {
    setClientReady(true);
    console.log('Dashboard: Client ready set to true');
    
    // Сразу устанавливаем стадию загрузки COMPLETED для предотвращения блокировки запросов
    setStage(LoadingStage.COMPLETED);
    console.log('Dashboard: Setting stage to COMPLETED, current stage =', currentStage);
    
    // Если мы вернулись с редактирования и нужно обновить данные, сбрасываем состояние загрузки
    if (localStorage.getItem("dashboard_need_refresh") === "true") {
      console.log('Dashboard: Need refresh flag detected in initial mount');
      setDataLoaded({
        users: false,
        events: false
      });
    }
  }, [currentStage, setStage]);

  // Функция для загрузки данных
  const loadData = useCallback(async () => {
    console.log('Dashboard: Starting to load data');
    setError(null);

    try {
      // Загружаем данные параллельно
      const [usersFetched, eventsFetched] = await Promise.all([
        !dataLoaded.users ? fetchUsers() : Promise.resolve(true),
        !dataLoaded.events ? fetchEvents() : Promise.resolve(true)
      ]);

      // Обновляем состояние загрузки данных
      setDataLoaded({
        users: dataLoaded.users || usersFetched === true,
        events: dataLoaded.events || eventsFetched === true
      });

      // Продвигаем стадию загрузки
      if ((dataLoaded.users || usersFetched === true) && 
          (dataLoaded.events || eventsFetched === true)) {
        console.log('Dashboard: All data loaded successfully');
        setStage(LoadingStage.COMPLETED);
      }
    } catch (err) {
      console.error('Dashboard: Error loading data:', err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
    }
  }, [dataLoaded, setStage, fetchUsers, fetchEvents]);

  // Эффект для проверки авторизации и загрузки данных
  useEffect(() => {
    if (!isAuthChecked) return;

    if (!isAuthenticated) {
      console.log('Dashboard: Not authenticated, redirecting to login');
      router.push("/admin-login");
      return;
    }

    // Проверяем, нужно ли обновить данные (например, после редактирования пользователя)
    const needRefresh = localStorage.getItem("dashboard_need_refresh") === "true";
    if (needRefresh) {
      console.log('Dashboard: Need refresh flag detected, forcing data reload');
      // Сбрасываем флаг обновления
      localStorage.removeItem("dashboard_need_refresh");
      
      // Принудительно перезагружаем данные (даже если они уже загружены)
      setDataLoaded({
        users: false,
        events: false
      });
      loadData();
      return;
    }

    if (clientReady && (!dataLoaded.users || !dataLoaded.events)) {
      loadData();
    }
  }, [isAuthenticated, isAuthChecked, clientReady, dataLoaded, router, loadData]);

  const handleCreateEvent = () => {
    router.push("/edit-events");
  };

  // Вычисленные значения для панели статистики
  const publishedEventsCount = events.filter(event => event.published).length;
  const publishedEventsPercent = events.length ? Math.round((publishedEventsCount / events.length) * 100) : 0;
  
  const activeUsersCount = users.filter(user => 
    user.last_active && new Date(user.last_active).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length;
  const activeUsersPercent = users.length ? Math.round((activeUsersCount / users.length) * 100) : 0;

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
                  {dataLoaded.users && (
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
              {!dataLoaded.users && <div className="mt-2 h-1 w-full bg-gray-200 rounded overflow-hidden"><div className="h-full bg-blue-500 animate-pulse" style={{width: "100%"}}></div></div>}
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500">Мероприятия</h3>
                  <p className="text-3xl font-bold mt-1">{events.length || 0}</p>
                  {dataLoaded.events && (
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
              {!dataLoaded.events && <div className="mt-2 h-1 w-full bg-gray-200 rounded overflow-hidden"><div className="h-full bg-green-500 animate-pulse" style={{width: "100%"}}></div></div>}
            </div>
          </div>
          
          {/* Recent Activity Panel */}
          {dataLoaded.users && dataLoaded.events && (
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
          
          {!dataLoaded.users ? (
            <UsersSkeleton />
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Пользователи</h2>
              <UsersList users={users} />
            </div>
          )}
          
          {!dataLoaded.events ? (
            <EventsSkeleton />
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Мероприятия</h2>
              <EventsList events={events} onEventDeleted={fetchEvents} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}