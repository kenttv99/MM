// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import { useState, ChangeEvent, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { FaSearch, FaUsers, FaCalendarAlt, FaPlus, FaTrashAlt } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetch } from "@/utils/api";

function debounce<F extends (arg: string) => void>(func: F, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  return (arg: string) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(arg), wait);
  };
}

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
  status: string;
}

async function fetchData<U>(
  url: string,
  token: string | null,
  setData: React.Dispatch<React.SetStateAction<U[]>>,
  setLoading: (value: boolean) => void,
  setError: (value: string | null) => void
) {
  setLoading(true);
  setError(null);
  try {
    if (!token) {
      throw new Error("Отсутствует токен авторизации");
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    setData(Array.isArray(data) ? data : []);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
    setData([] as U[]);
  } finally {
    setLoading(false);
  }
}

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

export default function DashboardPage() {
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState({ users: false, events: false });
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const hasFetchedEvents = useRef(false);
  const hasFetchedUsers = useRef(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated && !authLoading) {
        navigateTo(router, "/admin-login");
      }
    };
    initialize();
  }, [checkAuth, authLoading, router]);

  const fetchEvents = async (search: string) => {
    const url = search.trim()
      ? `/admin_edits/events?search=${encodeURIComponent(search)}`
      : "/admin_edits/events";
    await fetchData<Event>(url, localStorage.getItem("admin_token"), setEvents, (value) => setIsLoading((prev) => ({ ...prev, events: value })), setError);
  };

  const fetchUsers = async (search: string) => {
    const url = search.trim()
      ? `/admin_edits/users?search=${encodeURIComponent(search)}`
      : "/admin_edits/users";
    await fetchData<User>(url, localStorage.getItem("admin_token"), setUsers, (value) => setIsLoading((prev) => ({ ...prev, users: value })), setError);
  };

  const debouncedFetchUsers = debounce(fetchUsers, 500);
  const debouncedFetchEvents = debounce(fetchEvents, 500);

  useEffect(() => {
    if (!authLoading && isAdminAuth) {
      const shouldRefresh = searchParams.get("refresh") === "true";
      if (!hasFetchedEvents.current || shouldRefresh) {
        hasFetchedEvents.current = true;
        fetchEvents(eventSearch);
      }
      if (!hasFetchedUsers.current || shouldRefresh) {
        hasFetchedUsers.current = true;
        fetchUsers(userSearch);
      }
    }
  }, [isAdminAuth, authLoading, searchParams, eventSearch, userSearch]);

  const handleUserSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUserSearch(e.target.value);
    hasFetchedUsers.current = false;
    debouncedFetchUsers(e.target.value);
  };

  const handleEventSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEventSearch(e.target.value);
    hasFetchedEvents.current = false;
    debouncedFetchEvents(e.target.value);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsLoading((prev) => ({ ...prev, events: true }));
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }

      const response = await apiFetch(`/admin_edits/${eventToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API: ${response.status} - ${errorText}`);
      }

      setEvents(events.filter((event) => event.id !== eventToDelete));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить мероприятие");
    } finally {
      setIsLoading((prev) => ({ ...prev, events: false }));
      setShowDeleteModal(false);
      setEventToDelete(null);
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
              onClick={() => navigateTo(router, "/edit-events", { new: "true" })}
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
                  onChange={handleUserSearchChange}
                  placeholder="Поиск пользователей..."
                  icon={FaSearch}
                  name="userSearch"
                />
              </div>
              {isLoading.users ? (
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.fio}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            <button
                              onClick={() => navigateTo(router, "/edit-user", { user_id: user.id.toString() })}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              Управлять
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {userSearch.trim() ? "Пользователи не найдены" : "Нет доступных пользователей"}
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
                  onChange={handleEventSearchChange}
                  placeholder="Поиск мероприятий..."
                  icon={FaSearch}
                  name="eventSearch"
                />
              </div>
              {isLoading.events ? (
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
                            {event.status === "registration_open" ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Регистрация открыта</span>
                            ) : event.status === "registration_closed" ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Регистрация закрыта</span>
                            ) : event.status === "completed" ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Завершено</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Черновик</span>
                            )}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm relative">
                            <button
                              onClick={() => navigateTo(router, "/edit-events", { event_id: event.id.toString() })}
                              className="text-blue-500 hover:text-blue-700 inline-block"
                            >
                              Редактировать
                            </button>
                            {event.status === "draft" && (
                              <button
                                onClick={() => {
                                  setEventToDelete(event.id);
                                  setShowDeleteModal(true);
                                }}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-red-500 hover:text-red-700"
                              >
                                <FaTrashAlt className="w-2.5 h-2.5" />
                              </button>
                            )}
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
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4">Подтверждение удаления</h2>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить это мероприятие? Это действие нельзя отменить.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteEvent}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                disabled={isLoading.events}
              >
                {isLoading.events ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}