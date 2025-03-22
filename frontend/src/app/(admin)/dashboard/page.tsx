"use client";
import { useState, ChangeEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/common/InputField";
import { FaSearch, FaUsers, FaCalendarAlt, FaPlus } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface User {
  id: number;
  fio: string;
  email: string;
}

interface Event {
  id: number;
  title: string;
  start_date: string;
  location?: string;
  published: boolean;
}

export default function DashboardPage() {
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAdminAuth, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    // Перенаправляем неавторизованных пользователей
    if (!authLoading && !isAdminAuth) {
      router.push("/admin-login");
    } else if (isAdminAuth) {
      // Загружаем события при первой загрузке страницы
      fetchEvents();
    }
  }, [isAdminAuth, authLoading, router]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      
      // Проверяем наличие токена
      if (!token) {
        console.error("Отсутствует токен авторизации");
        setIsLoading(false);
        return;
      }
      
      const response = await fetch("/events", {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        },
      });
      
      // Проверяем тип содержимого ответа
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Получен неверный формат ответа:", contentType);
        setEvents([]);
        setIsLoading(false);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      } else {
        console.error(`Ошибка API: ${response.status} ${response.statusText}`);
        setEvents([]);
      }
    } catch (err) {
      console.error("Ошибка при загрузке мероприятий:", err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSearch = async () => {
    if (!userSearch.trim()) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      
      // Проверяем наличие токена
      if (!token) {
        console.error("Отсутствует токен авторизации");
        setIsLoading(false);
        return;
      }
      
      const response = await fetch(`/admin_edits/users?search=${encodeURIComponent(userSearch)}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Accept": "application/json" 
        },
      });
      
      // Проверяем тип содержимого ответа
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Получен неверный формат ответа:", contentType);
        setUsers([]);
        setIsLoading(false);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error(`Ошибка API: ${response.status} ${response.statusText}`);
        setUsers([]);
      }
    } catch (err) {
      console.error("Ошибка поиска пользователей:", err);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventSearch = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      
      // Проверяем наличие токена
      if (!token) {
        console.error("Отсутствует токен авторизации");
        setIsLoading(false);
        return;
      }
      
      const url = eventSearch.trim() 
        ? `/events?search=${encodeURIComponent(eventSearch)}`
        : '/events';
        
      const response = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Accept": "application/json"
        },
      });
      
      // Проверяем тип содержимого ответа
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Получен неверный формат ответа:", contentType);
        setEvents([]);
        setIsLoading(false);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      } else {
        console.error(`Ошибка API: ${response.status} ${response.statusText}`);
        setEvents([]);
      }
    } catch (err) {
      console.error("Ошибка поиска мероприятий:", err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Панель управления</h1>
            <button 
              onClick={() => router.push("/edit-events?new=true")}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-600 transition-colors"
            >
              <FaPlus className="mr-2" />
              Новое мероприятие
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Управление пользователями */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-6">
                <FaUsers className="text-blue-500 text-xl mr-2" />
                <h2 className="text-xl font-semibold">Пользователи</h2>
              </div>
              
              <div className="mb-6">
                <InputField
                  type="text"
                  value={userSearch}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setUserSearch(e.target.value)}
                  placeholder="Поиск пользователей..."
                  icon={FaSearch}
                  onBlur={handleUserSearch}
                />
              </div>
              
              {isLoading && users.length === 0 ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              ) : users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.fio}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {userSearch.trim() ? "Пользователи не найдены" : "Введите запрос для поиска пользователей"}
                </p>
              )}
            </div>
            
            {/* Управление мероприятиями */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-6">
                <FaCalendarAlt className="text-blue-500 text-xl mr-2" />
                <h2 className="text-xl font-semibold">Мероприятия</h2>
              </div>
              
              <div className="mb-6">
                <InputField
                  type="text"
                  value={eventSearch}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEventSearch(e.target.value)}
                  placeholder="Поиск мероприятий..."
                  icon={FaSearch}
                  onBlur={handleEventSearch}
                />
              </div>
              
              {isLoading && events.length === 0 ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              ) : events.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {events.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{event.id}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{event.title}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {event.published ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Опубликовано</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Черновик</span>
                            )}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            <button 
                              onClick={() => router.push(`/edit-events?event_id=${event.id}`)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              Редактировать
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {eventSearch.trim() ? "Мероприятия не найдены" : "Нет доступных мероприятий"}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}