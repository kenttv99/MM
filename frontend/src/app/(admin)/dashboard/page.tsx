// frontend/src/app/(admin)/dashboard/page.tsx
"use client";

import { useState, ChangeEvent, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/common/InputField";
import {
  FaSearch, FaUsers, FaCalendarAlt, FaPlus, FaTrashAlt, FaFilter, FaTimes, FaCheck, FaInfoCircle, FaBell,
} from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { EventData } from "@/types/events";
import { User } from "@/types/index";

interface CustomError extends Error {
  status?: number;
}

const fetchWithAuth = async <T,>(url: string, token: string, method: string = "GET", body?: Record<string, unknown>): Promise<T | null> => {
  if (!token) {
    throw new Error("Токен администратора отсутствует");
  }

  console.log("Токен перед запросом:", token); // Отладка токена

  try {
    const headers: HeadersInit = {
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token.trim()}`, // Убеждаемся, что префикс "Bearer" присутствует
      Accept: "application/json",
    };
    if (body && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error: CustomError = new Error(`Ошибка ${response.status}: ${errorText || 'Неизвестная ошибка'}`);
      error.status = response.status;
      throw error;
    }
    if (method === "DELETE") return null;
    return await response.json();
  } catch (error) {
    throw error;
  }
};

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
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const initialized = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const { isAdminAuth } = useAdminAuth();

  const getAdminToken = useCallback(() => {
    return typeof window !== 'undefined' ? localStorage.getItem("admin_token") : null;
  }, []);

  const fetchEvents = useCallback(async (search: string, pageNum: number, append: boolean = false) => {
    if (isLoading || !isAdminAuth) return;
    setIsLoading(true);

    const token = getAdminToken();
    if (!token) {
      setError("Токен администратора не найден");
      setIsLoading(false);
      router.push("/admin-login");
      return;
    }

    let url = `/admin_edits/events?page=${pageNum}&limit=10`;
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) params.append("start_date", startDate);
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) params.append("end_date", endDate);
    if (statusFilter.trim()) {
      const statusMap: { [key: string]: string } = {
        "Черновик": "draft",
        "Регистрация открыта": "registration_open",
        "Регистрация закрыта": "registration_closed",
        "Завершено": "completed",
      };
      const mappedStatus = statusMap[statusFilter] || "";
      if (mappedStatus) params.append("status", mappedStatus);
    }
    if (params.toString()) url += `&${params.toString()}`;

    try {
      const data = await fetchWithAuth<EventData[]>(url, token);
      if (data) {
        setHasMore(data.length === 10);
        setEvents((prev) => (append ? [...prev, ...data] : data));
      } else if (!append) {
        setEvents([]);
      }
    } catch (error: unknown) {
      const err = error as CustomError;
      if (err.status === 401) {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        router.push("/admin-login"); // Редирект на логин, а не профиль
      } else {
        setError(err.message || "Не удалось загрузить мероприятия");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isAdminAuth, startDate, endDate, statusFilter, getAdminToken, router]);

  const fetchUsers = useCallback(async (search: string) => {
    if (isLoading || !isAdminAuth) return;
    setIsLoading(true);

    const token = getAdminToken();
    if (!token) {
      setError("Токен администратора не найден");
      setIsLoading(false);
      router.push("/admin-login");
      return;
    }

    const url = search.trim() ? `/admin_edits/users?search=${encodeURIComponent(search)}` : "/admin_edits/users";
    try {
      const data = await fetchWithAuth<User[]>(url, token);
      setUsers(data || []);
    } catch (error: unknown) {
      const err = error as CustomError;
      if (err.status === 401) {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        router.push("/admin-login"); // Редирект на логин
      } else {
        setError(err.message || "Не удалось загрузить пользователей");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isAdminAuth, getAdminToken, router]);

  const sendNotification = useCallback(async (eventId: number, eventTitle: string) => {
    if (!isAdminAuth) return;
    setIsLoading(true);
    setError(null);

    const token = getAdminToken();
    if (!token) {
      setError("Токен администратора не найден");
      setIsLoading(false);
      router.push("/admin-login");
      return;
    }

    try {
      const message = `Новое мероприятие "${eventTitle}" добавлено!`;
      await fetchWithAuth("/notifications/send", token, "POST", { event_id: eventId, message });
      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId ? { ...event, notificationSent: true } as EventData : event
        )
      );
    } catch (error: unknown) {
      const err = error as CustomError;
      if (err.status === 401) {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        router.push("/admin-login"); // Редирект на логин
      } else {
        setError(err.message || "Не удалось отправить уведомление");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAdminAuth, getAdminToken, router]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!isAdminAuth) {
      navigateTo(router, "/admin-login");
      return;
    }

    fetchEvents("", 1);
    fetchUsers("");
  }, [isAdminAuth, fetchEvents, fetchUsers, router]);

  const lastEventElementRef = useCallback((node: HTMLDivElement | null) => {
    if (!hasMore || isLoading || !isAdminAuth) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchEvents(eventSearch, nextPage, true);
        }
      },
      { threshold: 0.5 }
    );

    if (node) observer.current.observe(node);
  }, [hasMore, eventSearch, page, fetchEvents, isLoading, isAdminAuth]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>, type: "users" | "events") => {
    const searchValue = e.target.value;
    if (type === "users") setUserSearch(searchValue);
    else setEventSearch(searchValue);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      if (type === "users") {
        fetchUsers(searchValue);
      } else {
        setPage(1);
        setEvents([]);
        fetchEvents(searchValue, 1);
      }
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

    setError(null);
    setIsLoading(true);

    const token = getAdminToken();
    if (!token) {
      setError("Токен администратора не найден");
      setIsLoading(false);
      router.push("/admin-login");
      return;
    }

    try {
      const response = await fetchWithAuth<null>(`/admin_edits/${eventToDelete}`, token, "DELETE");
      if (response === null) {
        setEvents((prev) => prev.filter((event) => event.id !== eventToDelete));
        await fetchEvents(eventSearch, 1);
      }
    } catch (error: unknown) {
      const err = error as CustomError;
      if (err.status === 401) {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        router.push("/admin-login"); // Редирект на логин
      } else if (err.status === 400) {
        setError("Мероприятие можно удалить только в статусе 'черновик'");
      } else if (err.status === 404) {
        setError("Мероприятие не найдено");
      } else {
        setError(`Не удалось удалить мероприятие: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

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
      <main className="container mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mb-8">
          <div className="flex items-center mb-4">
            <FaInfoCircle className="text-blue-500 text-xl mr-3" />
            <h2 className="text-xl font-semibold text-gray-800">Общая статистика</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center">
              <FaUsers className="text-blue-500 mr-2" />
              <p className="text-base text-gray-700">
                Всего пользователей: <span className="font-bold">{users.length}</span>
              </p>
            </div>
            <div className="flex items-center">
              <FaCalendarAlt className="text-blue-500 mr-2" />
              <p className="text-base text-gray-700">
                Всего мероприятий: <span className="font-bold">{events.length}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">Панель управления</h1>
          <button
            onClick={() => navigateTo(router, "/edit-events", { new: "true" })}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg min-h-[44px] text-base"
          >
            <FaPlus className="mr-2" />
            Новое мероприятие
          </button>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500 shadow-sm text-base">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <FaUsers className="text-blue-500 text-xl mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Пользователи</h2>
              </div>
              {isLoading && <div className="text-sm text-blue-500">Загрузка...</div>}
            </div>
            <div className="mb-6">
              <InputField
                type="text"
                value={userSearch}
                onChange={(e) => handleSearchChange(e, "users")}
                placeholder="Поиск по ФИО, email, Telegram, WhatsApp..."
                icon={FaSearch}
                name="userSearch"
                className="w-full"
              />
            </div>
            {users.length > 0 ? (
              <>
                <div className="md:hidden flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                  {users.map((user) => (
                    <div key={user.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-base text-gray-900"><strong>ID:</strong> {user.id}</p>
                      <p className="text-base text-gray-900"><strong>ФИО:</strong> {user.fio}</p>
                      <p className="text-base text-gray-900"><strong>Email:</strong> {user.email}</p>
                      <button
                        onClick={() => navigateTo(router, "/edit-user", { user_id: user.id.toString() })}
                        className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-base min-h-[44px]"
                      >
                        Управлять
                      </button>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block max-h-[400px] overflow-y-auto">
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
                          <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{user.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{user.fio}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{user.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-base">
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
              </>
            ) : (
              <p className="text-gray-500 text-center py-6 text-base">
                {userSearch.trim() ? "Пользователи не найдены" : (isLoading ? "Загрузка пользователей..." : "Нет доступных пользователей")}
              </p>
            )}
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3">
              <div className="flex items-center mb-4 sm:mb-0">
                <FaCalendarAlt className="text-blue-500 text-xl mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Мероприятия</h2>
              </div>
              <div className="flex items-center">
                {isLoading && <div className="text-sm text-blue-500 mr-3">Загрузка...</div>}
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 shadow-sm min-h-[44px] text-base"
                >
                  <FaFilter className="mr-2" />
                  Фильтры
                </button>
              </div>
            </div>
            <div className="mb-6">
              <InputField
                type="text"
                value={eventSearch}
                onChange={(e) => handleSearchChange(e, "events")}
                placeholder="Поиск по названию..."
                icon={FaSearch}
                name="eventSearch"
                className="w-full"
              />
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6 p-4 bg-gray-50 rounded-lg shadow-inner border border-gray-200 w-full max-w-[300px]"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-800">Фильтры</h3>
                    <button onClick={() => setIsFilterOpen(false)} className="text-gray-500 hover:text-gray-700">
                      <FaTimes size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <InputField
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="Дата начала"
                      icon={FaCalendarAlt}
                      name="startDate"
                      className="w-full"
                    />
                    <InputField
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="Дата окончания"
                      icon={FaCalendarAlt}
                      name="endDate"
                      className="w-full"
                    />
                  </div>
                  <div className="mt-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition-all duration-300 text-base"
                    >
                      <option value="">Все статусы</option>
                      <option value="Черновик">Черновик</option>
                      <option value="Регистрация открыта">Регистрация открыта</option>
                      <option value="Регистрация закрыта">Регистрация закрыта</option>
                      <option value="Завершено">Завершено</option>
                    </select>
                  </div>
                  <button
                    onClick={handleEventFilterSubmit}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg text-base min-h-[44px]"
                  >
                    Применить фильтры
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {events.length > 0 ? (
              <>
                <div className="md:hidden flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                  {events.map((event, index) => {
                    const availableQuantity = event.ticket_type?.available_quantity || 0;
                    const soldQuantity = event.ticket_type?.sold_quantity || 0;
                    const remainingQuantity = availableQuantity - soldQuantity;
                    const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

                    return (
                      <div
                        key={event.id ?? index}
                        ref={index === events.length - 1 ? lastEventElementRef : null}
                        className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200"
                      >
                        <p className="text-base text-gray-900"><strong>ID:</strong> {event.id ?? "N/A"}</p>
                        <p className="text-base text-gray-900"><strong>Название:</strong> {event.title}</p>
                        <p className="text-base">
                          <strong>Статус:</strong>{" "}
                          {event.status === "registration_open" ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Регистрация открыта</span>
                          ) : event.status === "registration_closed" ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Регистрация закрыта</span>
                          ) : event.status === "completed" ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">Завершено</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Черновик</span>
                          )}
                        </p>
                        <p className="text-base">
                          <strong>Опубликовано:</strong>{" "}
                          {event.published ? <FaCheck className="inline text-green-500" /> : <FaTimes className="inline text-red-500" />}
                        </p>
                        <div className="mt-2">
                          <p className="text-base"><strong>Заполненность:</strong></p>
                          <div className="w-32 bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${fillPercentage}%` }}></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">{soldQuantity} / {availableQuantity} (Осталось: {remainingQuantity})</p>
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                          <button
                            onClick={() => event.id && navigateTo(router, "/edit-events", { event_id: event.id.toString() })}
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-base min-h-[44px]"
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
                              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-base min-h-[44px] flex items-center justify-center"
                            >
                              <FaTrashAlt className="mr-2 w-4 h-4" />
                              Удалить
                            </button>
                          )}
                          <button
                            onClick={() => event.id && sendNotification(event.id, event.title)}
                            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-base min-h-[44px] flex items-center justify-center"
                            disabled={isLoading || event.notificationSent}
                          >
                            <FaBell className="mr-2 w-4 h-4" />
                            {event.notificationSent ? "Отправлено" : "Отправить уведомление"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden md:block max-h-[400px] overflow-y-auto">
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
                            <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{event.id ?? "N/A"}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{event.title}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-base">
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
                            <td className="px-6 py-4 whitespace-nowrap text-base text-center">
                              {event.published ? <FaCheck className="text-green-500 mx-auto" /> : <FaTimes className="text-red-500 mx-auto" />}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-base">
                              <div className="w-32 bg-gray-200 rounded-full h-2.5">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${fillPercentage}%` }}></div>
                              </div>
                              <p className="text-sm text-gray-600 mt-2">{soldQuantity} / {availableQuantity} (Осталось: {remainingQuantity})</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-base">
                              <div className="flex items-center space-x-4">
                                <button
                                  onClick={() => event.id && navigateTo(router, "/edit-events", { event_id: event.id.toString() })}
                                  className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200 min-h-[24px] flex items-center"
                                >
                                  Редактировать
                                </button>
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {event.status === "draft" ? (
                                    <button
                                      onClick={() => {
                                        if (event.id) {
                                          setEventToDelete(event.id);
                                          setShowDeleteModal(true);
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-600 transition-colors duration-200 inline-flex items-center justify-center w-6 h-6"
                                      title="Удалить мероприятие"
                                    >
                                      <FaTrashAlt className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <span className="w-6 h-6" />
                                  )}
                                </div>
                                <button
                                  onClick={() => event.id && sendNotification(event.id, event.title)}
                                  className="text-green-500 hover:text-green-600 transition-colors duration-200 inline-flex items-center justify-center w-6 h-6"
                                  title="Отправить уведомление"
                                  disabled={isLoading || event.notificationSent}
                                >
                                  <FaBell className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-6 text-base">
                {eventSearch.trim() || startDate || endDate || statusFilter ?
                  "Мероприятия не найдены" :
                  (isLoading ? "Загрузка мероприятий..." : "Нет доступных мероприятий")}
              </p>
            )}
          </div>
        </div>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Подтверждение удаления</h2>
            <p className="text-gray-600 mb-6 text-base">Вы уверены, что хотите удалить это мероприятие? Это действие нельзя отменить.</p>
            <div className="flex flex-col sm:flex-row justify-end space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 text-base min-h-[44px]"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteEvent}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 text-base min-h-[44px]"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}