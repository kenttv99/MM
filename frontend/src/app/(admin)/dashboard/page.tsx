// frontend/src/app/(admin)/dashboard/page.tsx
"use client";
import { useState, ChangeEvent, useEffect, useCallback, useRef } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const hasFetchedEvents = useRef(false);

  const router = useRouter();
  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authLoading && !isAdminAuth) {
      router.push("/admin-login");
    }
  }, [isAdminAuth, authLoading, router]);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setError("Отсутствует токен авторизации");
        return;
      }
      const url = eventSearch.trim()
        ? `/admin_edits/events?search=${encodeURIComponent(eventSearch)}`
        : "/admin_edits/events";
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка API: ${response.status} ${response.statusText} - ${errorText}`);
        setEvents([]);
        return;
      }
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setError("Не удалось загрузить мероприятия");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventSearch]);

  useEffect(() => {
    if (!authLoading && isAdminAuth && !hasFetchedEvents.current) {
      hasFetchedEvents.current = true;
      fetchEvents();
    }
  }, [isAdminAuth, authLoading, fetchEvents]);

  const handleUserSearch = async () => {
    if (!userSearch.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setError("Отсутствует токен авторизации");
        return;
      }
      const response = await fetch(`/admin_edits/users?search=${encodeURIComponent(userSearch)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
        },
      });
      if (!response.ok) {
        setError(`Ошибка API: ${response.status} ${response.statusText}`);
        setUsers([]);
      } else {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Не удалось выполнить поиск пользователей");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventSearch = () => {
    hasFetchedEvents.current = false;
    fetchEvents();
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
          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{event.id || "N/A"}</td>
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