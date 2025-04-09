// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FaPlus } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import "@/app/globals.css";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

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
  status: string;
  registrations_count: number;
  ticket_type?: TicketType;
  url_slug?: string;
}

// Динамическая загрузка компонентов без SSR
const AdminHeader = dynamic(() => import("@/components/AdminHeader"), { ssr: false });
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
    <AdminHeader />
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
  const { stage, setStage } = useLoading();
  const { isAdminAuth, isAuthChecked } = useAdminAuth(); // Get auth state from AdminAuthContext
  
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState({
    users: false,
    events: false
  });

  // Функция для загрузки пользователей
  const fetchUsers = async () => {
    try {
      // Get token with the correct key
      const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
      
      if (!token) {
        throw new Error("Токен администратора не найден");
      }
      
      const fetchedUsers = await apiFetch("/admin_edits/users", {
        bypassLoadingStageCheck: true, // Обходим проверку стадии загрузки
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if ('aborted' in fetchedUsers) {
        throw new Error(fetchedUsers.reason || "Запрос пользователей был прерван");
      }
      setUsers(fetchedUsers);
      setDataLoaded(prev => ({ ...prev, users: true }));
      return true;
    } catch (err: any) {
      console.error("Ошибка при загрузке пользователей:", err);
      
      // Check for 401/403 errors and redirect to login
      if (err.status === 401 || err.status === 403) {
        setError("Требуется авторизация администратора. Перенаправление на страницу входа...");
        setTimeout(() => router.push("/admin-login"), 2000);
        return false;
      }
      
      setError("Не удалось загрузить пользователей");
      setDataLoaded(prev => ({ ...prev, users: true })); // Отмечаем как загруженное даже при ошибке, чтобы убрать скелетон
      return false;
    }
  };

  // Функция для загрузки мероприятий
  const fetchEvents = async () => {
    try {
      // Get token with the correct key
      const token = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_TOKEN);
      
      if (!token) {
        throw new Error("Токен администратора не найден");
      }
      
      const fetchedEvents = await apiFetch("/admin_edits/events", {
        bypassLoadingStageCheck: true, // Обходим проверку стадии загрузки
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if ('aborted' in fetchedEvents) {
        throw new Error(fetchedEvents.reason || "Запрос мероприятий был прерван");
      }
      setEvents(fetchedEvents);
      setDataLoaded(prev => ({ ...prev, events: true }));
      return true;
    } catch (err: any) {
      console.error("Ошибка при загрузке мероприятий:", err);
      
      // Check for 401/403 errors and redirect to login
      if (err.status === 401 || err.status === 403) {
        setError("Требуется авторизация администратора. Перенаправление на страницу входа...");
        setTimeout(() => router.push("/admin-login"), 2000);
        return false;
      }
      
      setError("Не удалось загрузить мероприятия");
      setDataLoaded(prev => ({ ...prev, events: true })); // Отмечаем как загруженное даже при ошибке, чтобы убрать скелетон
      return false;
    }
  };

  // Загрузка данных и управление стадиями загрузки
  useEffect(() => {
    // Установка флага клиентской загрузки
    setClientReady(true);
    
    // Сразу устанавливаем стадию загрузки COMPLETED для предотвращения блокировки запросов
    setStage(LoadingStage.COMPLETED);
    
    // Check if authenticated before loading data
    if (!isAuthChecked) {
      // Authentication is still being checked, wait
      return;
    }
    
    if (!isAdminAuth) {
      // Not authenticated, redirect to login
      setError("Требуется авторизация администратора");
      router.push("/admin-login");
      return;
    }
    
    // Немедленно запускаем загрузку данных если пользователь авторизован
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Используем Promise.all для параллельной загрузки
        const results = await Promise.all([
          fetchUsers(),
          fetchEvents()
        ]);
        
        // Check if any requests failed with auth errors
        if (results.includes(false)) {
          console.log("Some requests failed, check individual error handlers");
        }
        
        // После загрузки данных (успешной или нет) скрываем индикатор загрузки
        setIsLoading(false);
      } catch (e) {
        console.error("Ошибка при загрузке данных:", e);
        setError("Не удалось загрузить данные для дашборда");
        setIsLoading(false);
        
        // Отмечаем данные как загруженные, даже при ошибке
        setDataLoaded({
          users: true,
          events: true
        });
      }
    };
    
    // Запускаем загрузку при первом рендере если пользователь авторизован
    loadData();
  }, [setStage, isAuthChecked, isAdminAuth, router]);

  const handleCreateEvent = () => {
    router.push("/event-edit");
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
  if (!isAdminAuth) {
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
      <AdminHeader />
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
                    {events.reduce((sum: number, event: any) => 
                      sum + (event.registrations_count || 0), 0
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-gray-500 font-medium mb-1">Мероприятия за месяц</h3>
                  <p className="text-xl font-bold">
                    {events.filter((event: any) => 
                      event.created_at && new Date(event.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
                    ).length}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-gray-500 font-medium mb-1">Новые пользователи за месяц</h3>
                  <p className="text-xl font-bold">
                    {users.filter((user: any) => 
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
              <EventsList events={events} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}