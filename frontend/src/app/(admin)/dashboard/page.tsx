// src/app/(admin)/dashboard/page.tsx
"use client";

import { useState, ChangeEvent, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import {
  FaSearch,
  FaUsers,
  FaCalendarAlt,
  FaPlus,
  FaTrashAlt,
  FaFilter,
  FaTimes,
  FaCheck,
  FaInfoCircle,
} from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { EventData } from "@/types/events";
import { User } from "@/types/index";
import { usePageLoad } from "@/contexts/PageLoadContext";

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
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isBrowser, setIsBrowser] = useState(false);
  
  const hasFetched = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initAttempted = useRef(false);

  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const searchParams = useSearchParams();
  const { checkAuth, isAdminAuth } = useAdminAuth();
  const { wrapAsync, setPageLoading } = usePageLoad();

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  const getAdminToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("admin_token");
    }
    return null;
  }, []);

  const fetchWithErrorHandling = async <T,>(url: string, options: RequestInit = {}): Promise<T | null> => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка ${response.status}: ${errorText || 'Неизвестная ошибка'}`);
        return null;
      }
      return await response.json() as T;
    } catch {
      setError('Ошибка сети. Проверьте подключение и попробуйте снова.');
      return null;
    }
  };

  const fetchEvents = useCallback(
    async (search: string, pageNum: number, append: boolean = false) => {
      if (isLoadingEvents || !isBrowser) return;
      setIsLoadingEvents(true);

      let url = `/admin_edits/events?page=${pageNum}&limit=10`;
      const params = new URLSearchParams();

      if (search.trim()) params.append("search", search.trim());
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) params.append("start_date", startDate);
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) params.append("end_date", endDate);
      if (statusFilter.trim()) params.append("status", statusFilter);

      if (params.toString()) url += `&${params.toString()}`;

      try {
        const token = getAdminToken();
        if (!token) {
          setError("Токен администратора не найден");
          return;
        }
        
        const data = await wrapAsync(fetchWithErrorHandling<EventData[]>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          }
        }));
        
        if (data) {
          setHasMore(data.length === 10);
          setEvents((prev) => (append ? [...prev, ...data] : data));
        } else if (!append) {
          setEvents([]);
        }
      } finally {
        setIsLoadingEvents(false);
      }
    },
    [startDate, endDate, statusFilter, isLoadingEvents, isBrowser, getAdminToken, wrapAsync]
  );

  const fetchUsers = useCallback(
    async (search: string) => {
      if (isLoadingUsers || !isBrowser) return;
      setIsLoadingUsers(true);

      const url = search.trim()
        ? `/admin_edits/users?search=${encodeURIComponent(search)}`
        : "/admin_edits/users";
      
      try {
        const token = getAdminToken();
        if (!token) {
          setError("Токен администратора не найден");
          return;
        }
        
        const data = await wrapAsync(fetchWithErrorHandling<User[]>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          }
        }));
        
        if (data) {
          setUsers(data);
        } else {
          setUsers([]);
        }
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [isLoadingUsers, isBrowser, getAdminToken, wrapAsync]
  );

  useEffect(() => {
    if (!isBrowser) return;
    
    const initialize = async () => {
      if (hasFetched.current || initAttempted.current) return;
      initAttempted.current = true;

      try {
        // const isAuthenticated = await checkAuth();
        if (!isAdminAuth) {
          navigateTo(router, "/admin-login");
          return;
        }

        await Promise.all([
          fetchEvents("", 1),
          fetchUsers("")
        ]);
        
        hasFetched.current = true;
      } catch {
        setError("Ошибка инициализации дашборда");
      } finally {
        setPageLoading(false);
      }
    };

    const timer = setTimeout(() => {
      initialize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (observer.current) observer.current.disconnect();
    };
  }, [isBrowser, checkAuth, router, fetchEvents, fetchUsers, setPageLoading, isAdminAuth]);

  const lastEventElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!hasMore || !hasFetched.current || isLoadingEvents || !isBrowser) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingEvents) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchEvents(eventSearch, nextPage, true);
          }
        },
        { threshold: 0.5 }
      );

      if (node) observer.current.observe(node);
    },
    [hasMore, eventSearch, page, fetchEvents, isLoadingEvents, isBrowser]
  );

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
    if (!eventToDelete || !isBrowser) return;

    setError(null);
    try {
      const token = getAdminToken();
      if (!token) {
        setError("Токен администратора не найден");
        return;
      }
      
      const response = await fetch(`/admin_edits/${eventToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Ошибка ${response.status}`);
      }
      
      setEvents((prev) => prev.filter((event) => event.id !== eventToDelete));
      await fetchEvents(eventSearch, 1);
    } catch {
      setError("Не удалось удалить мероприятие");
    } finally {
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
        {/* Общая информация */}
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
          {/* Users Section */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <FaUsers className="text-blue-500 text-xl mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Пользователи</h2>
              </div>
              {isLoadingUsers && (
                <div className="text-sm text-blue-500">Загрузка...</div>
              )}
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
                {userSearch.trim() ? "Пользователи не найдены" : (isLoadingUsers ? "Загрузка пользователей..." : "Нет доступных пользователей")}
              </p>
            )}
          </div>

          {/* Events Section */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3">
              <div className="flex items-center mb-4 sm:mb-0">
                <FaCalendarAlt className="text-blue-500 text-xl mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Мероприятия</h2>
              </div>
              <div className="flex items-center">
                {isLoadingEvents && (
                  <div className="text-sm text-blue-500 mr-3">Загрузка...</div>
                )}
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
                      <option value="draft">Черновик</option>
                      <option value="registration_open">Регистрация открыта</option>
                      <option value="registration_closed">Регистрация закрыта</option>
                      <option value="completed">Завершено</option>
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
                              <FaTrashAlt className="mr-2" />
                              Удалить
                            </button>
                          )}
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
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-6 text-base">
                {eventSearch.trim() || startDate || endDate || statusFilter ? 
                  "Мероприятия не найдены" : 
                  (isLoadingEvents ? "Загрузка мероприятий..." : "Нет доступных мероприятий")}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Delete confirmation modal */}
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