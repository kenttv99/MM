// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import { useState, ChangeEvent, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { FaSearch, FaUsers, FaCalendarAlt, FaPlus, FaTrashAlt, FaFilter, FaTimes, FaCheck} from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetch } from "@/utils/api";
import { AnimatePresence, motion } from "framer-motion";
import { fetchAdminEvents } from "@/utils/eventService";
import { EventData } from "@/types/events";

interface User {
  id: number;
  fio: string;
  email: string;
}

async function fetchData<U>(
  url: string,
  token: string | null,
  setData: React.Dispatch<React.SetStateAction<U[]>>,
  setLoading: (value: boolean) => void,
  setError: (value: string | null) => void,
  append: boolean = false
) {
  setLoading(true);
  setError(null);
  try {
    if (!token) throw new Error("Отсутствует токен авторизации");

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

    const data: U[] = await response.json();
    setData((prev: U[]) => (append ? [...prev, ...data] : data));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
    setData(append ? (prev) => prev : []);
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState({ users: false, events: false });
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const hasFetchedEvents = useRef(false);
  const hasFetchedUsers = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const eventsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const usersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: authLoading, isAdminAuth, checkAuth } = useAdminAuth(); // Добавляем isAdminAuth

  const fetchEvents = useCallback(async (search: string, pageNum: number, append: boolean = false) => {
    let url = `?page=${pageNum}&limit=10`;
    const params = new URLSearchParams();
    
    if (search && search.trim()) params.append("search", search.trim());
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) params.append("start_date", startDate);
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) params.append("end_date", endDate);
    if (statusFilter && statusFilter.trim()) params.append("status", statusFilter);
    
    if (params.toString()) url += `&${params.toString()}`;

    const data = await fetchAdminEvents(
      localStorage.getItem("admin_token") || "",
      setEvents,
      (value) => setIsLoading((prev) => ({ ...prev, events: value })),
      setError,
      url,
      append
    );

    setHasMore(data.length === 10);
    hasFetchedEvents.current = true;
  }, [startDate, endDate, statusFilter]);

  const fetchUsers = useCallback(async (search: string) => {
    const url = search.trim()
      ? `/admin_edits/users?search=${encodeURIComponent(search)}`
      : "/admin_edits/users";
    await fetchData<User>(url, localStorage.getItem("admin_token"), setUsers,
      (value) => setIsLoading((prev) => ({ ...prev, users: value })), setError);
    hasFetchedUsers.current = true;
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated && !authLoading) {
        navigateTo(router, "/admin-login");
      } else if (isAdminAuth && !authLoading) {
        const shouldRefresh = searchParams.get("refresh") === "true";
        if (!hasFetchedEvents.current || shouldRefresh) {
          fetchEvents("", 1);
        }
        if (!hasFetchedUsers.current || shouldRefresh) {
          fetchUsers("");
        }
      }
    };
    initialize();
  }, [isAdminAuth, authLoading, searchParams, checkAuth, fetchEvents, fetchUsers, router]); // Добавлены все зависимости

  const lastEventElementRef = useCallback((node: HTMLTableRowElement | null) => {
    if (isLoading.events || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setPage((prev) => prev + 1);
        fetchEvents(eventSearch, page + 1, true);
      }
    }, { threshold: 1.0 });

    if (node) observer.current.observe(node);
  }, [isLoading.events, hasMore, eventSearch, page, fetchEvents]);

  const handleUserSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setUserSearch(searchValue);
    
    if (usersTimeoutRef.current) {
      clearTimeout(usersTimeoutRef.current);
    }
    
    usersTimeoutRef.current = setTimeout(() => {
      fetchUsers(searchValue);
    }, 500);
  };

  const handleEventSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setEventSearch(searchValue);
    
    if (eventsTimeoutRef.current) {
      clearTimeout(eventsTimeoutRef.current);
    }
    
    eventsTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setEvents([]);
      fetchEvents(searchValue, 1, false);
    }, 500);
  };

  const handleEventFilterSubmit = () => {
    setError(null);
    setPage(1);
    setEvents([]);
    fetchEvents(eventSearch, 1);
    setIsFilterOpen(false);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsLoading((prev) => ({ ...prev, events: true }));
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) throw new Error("Отсутствует токен авторизации");

      const response = await apiFetch(`/admin_edits/${eventToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API: ${response.status} - ${errorText}`);
      }

      setEvents(events.filter((event) => event.id !== eventToDelete));
      await fetchEvents(eventSearch, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить мероприятие");
    } finally {
      setIsLoading((prev) => ({ ...prev, events: false }));
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  useEffect(() => {
    return () => {
      if (eventsTimeoutRef.current) clearTimeout(eventsTimeoutRef.current);
      if (usersTimeoutRef.current) clearTimeout(usersTimeoutRef.current);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.8);
        }
      `}</style>
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Панель управления</h1>
          <button
            onClick={() => navigateTo(router, "/edit-events", { new: "true" })}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <FaPlus className="mr-2" />
            Новое мероприятие
          </button>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500 shadow-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <FaUsers className="text-blue-500 text-xl mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Пользователи</h2>
              </div>
            </div>
            <div className="mb-6">
              <InputField
                type="text"
                value={userSearch}
                onChange={handleUserSearchChange}
                placeholder="Поиск по ФИО, email, Telegram, WhatsApp..."
                icon={FaSearch}
                name="userSearch"
              />
            </div>
            {isLoading.users ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : users.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.fio}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => navigateTo(router, "/edit-user", { user_id: user.id.toString() })}
                            className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200"
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
              <p className="text-gray-500 text-center py-6">
                {userSearch.trim() ? "Пользователи не найдены" : "Нет доступных пользователей"}
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <FaCalendarAlt className="text-blue-500 text-x1 mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Мероприятия</h2>
              </div>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 shadow-sm"
              >
                <FaFilter className="mr-2" />
                Фильтры
              </button>
            </div>
            <div className="mb-6">
              <InputField
                type="text"
                value={eventSearch}
                onChange={handleEventSearchChange}
                placeholder="Поиск по названию..."
                icon={FaSearch}
                name="eventSearch"
              />
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6 p-4 bg-gray-50 rounded-lg shadow-inner border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-800">Фильтры</h3>
                    <button onClick={() => setIsFilterOpen(false)} className="text-gray-500 hover:text-gray-700">
                      <FaTimes size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="Дата начала"
                      icon={FaCalendarAlt}
                      name="startDate"
                    />
                    <InputField
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="Дата окончания"
                      icon={FaCalendarAlt}
                      name="endDate"
                    />
                  </div>
                  <div className="mt-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                      <option value="">Все статусы</option>
                      <option value="draft">Черновик</option>
                      <option value="registration_open">Регистрация открыта</option>
                      <option value="registration_closed">Регистрация закрыта</option>
                      <option value="completed">Завершено</option>
                    </select>
                  </div>
                  <button
                    onClick={handleEventFilterSubmit}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    Применить фильтры
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isLoading.events && events.length === 0 ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : events.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                  <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опубликовано</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заполненность</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {events.map((event, index) => {
                      const availableQuantity = event.ticket_type?.available_quantity || 0;
                      const soldQuantity = event.ticket_type?.sold_quantity || 0;
                      const remainingQuantity = availableQuantity - soldQuantity;
                      const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

                      return (
                        <tr
                            key={event.id ?? index}
                            ref={index === events.length - 1 ? lastEventElementRef : null}
                            className="hover:bg-gray-50 transition-colors duration-150"
                        >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.id ?? "N/A"}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.title}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {event.status === "registration_open" ? (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Регистрация открыта</span>
                                ) : event.status === "registration_closed" ? (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Регистрация закрыта</span>
                                ) : event.status === "completed" ? (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">Завершено</span>
                                ) : (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Черновик</span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {event.published ? (
                                    <FaCheck className="text-green-500 mx-auto" />
                                ) : (
                                    <FaTimes className="text-red-500 mx-auto" />
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="w-32 bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                        style={{ width: `${fillPercentage}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-gray-600 mt-2">{soldQuantity} / {availableQuantity} (Осталось: {remainingQuantity})</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <button
                                    onClick={() => event.id && navigateTo(router, "/edit-events", { event_id: event.id.toString() })}
                                    className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200 mr-4"
                                >
                                    Редактировать
                                </button>
                                {event.status === "draft" && (
                                    <button
                                        onClick={() => {
                                            if (event.id) {
                                                setEventToDelete(event.id);
                                                setShowDeleteModal(true);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-600 transition-colors duration-200"
                                    >
                                        <FaTrashAlt className="w-4 h-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
                  </tbody>
                </table>
                {isLoading.events && events.length > 0 && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">
                {eventSearch.trim() || startDate || endDate || statusFilter
                  ? "Мероприятия не найдены"
                  : "Нет доступных мероприятий"}
              </p>
            )}
          </div>
        </div>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Подтверждение удаления</h2>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить это мероприятие? Это действие нельзя отменить.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteEvent}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200"
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