// frontend/src/app/(admin)/edit-events/page.tsx
"use client";

import { useState, useEffect, ChangeEvent, FormEvent, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaPen, FaCalendar, FaMapMarkerAlt, FaImage, FaCheck, FaClock } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { motion, AnimatePresence } from "framer-motion";

// Интерфейс для ошибок валидации
interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// Интерфейс для данных мероприятия
interface EventData {
  id?: number;
  title: string;
  description: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  image_url?: string;
  price: number;
  published: boolean;
  created_at?: string;
  updated_at?: string;
  status?: string;
}

const EditEventContent: React.FC = () => {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const isNew = searchParams.get("new") === "true";

  const initialEventState = useMemo<EventData>(() => ({
    title: "",
    description: "",
    start_date: new Date().toISOString().split('T')[0],
    start_time: "12:00",
    price: 0,
    published: false,
    status: "draft",
  }), []);

  const [event, setEvent] = useState<EventData>(initialEventState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const router = useRouter();
  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const fetchEvent = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setError("Отсутствует токен авторизации");
        setTimeout(() => {
          router.push("/admin-login");
        }, 2000);
        return;
      }
      const response = await fetch(`/events/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
          "Cache-Control": "no-cache",
        },
      });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError(`Получен неверный формат ответа: ${contentType || "неизвестный тип"}`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
        return;
      }
      if (!response.ok) {
        setError(`Ошибка API: ${response.status} ${response.statusText}`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
        return;
      }
      const data = await response.json();
      if (data.start_date) {
        const startDateTime = new Date(data.start_date);
        data.start_date = startDateTime.toISOString().split('T')[0];
        data.start_time = startDateTime.toTimeString().slice(0, 5);
      }
      if (data.end_date) {
        const endDateTime = new Date(data.end_date);
        data.end_date = endDateTime.toISOString().split('T')[0];
        data.end_time = endDateTime.toTimeString().slice(0, 5);
      }
      setEvent(data);
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при загрузке данных");
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading) {
      if (!eventId && !isNew) {
        router.push("/dashboard");
        return;
      }
      if (!isAdminAuth) {
        router.push("/admin-login");
        return;
      }
      if (isNew) {
        setIsCreating(true);
        setEvent(initialEventState);
        return;
      }
      if (eventId) {
        fetchEvent(eventId);
      }
    }
  }, [eventId, isNew, isAdminAuth, authLoading, router, fetchEvent, initialEventState]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setEvent({ ...event, [name]: target.checked });
    } else if (type === 'number') {
      setEvent({ ...event, [name]: parseFloat(value) });
    } else if (name === "status") {
      setPendingStatus(value);
      setShowStatusModal(true);
    } else {
      setEvent({ ...event, [name]: value });
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatus) return;

    setEvent((prev) => ({ ...prev, status: pendingStatus }));
    setShowStatusModal(false);
    setPendingStatus(null);
  };

  const cancelStatusChange = () => {
    setShowStatusModal(false);
    setPendingStatus(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setError("Не авторизован");
      setIsLoading(false);
      return;
    }

    const startDateTime = event.start_date && event.start_time
      ? new Date(`${event.start_date}T${event.start_time}:00Z`)
      : new Date(event.start_date);
    const endDateTime = event.end_date && event.end_time
      ? new Date(`${event.end_date}T${event.end_time}:00Z`)
      : event.end_date ? new Date(event.end_date) : null;

    const eventData = {
      ...event,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime ? endDateTime.toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const url = isCreating ? "/admin_edits" : `/admin_edits/${eventId}`;
      const method = isCreating ? "POST" : "PUT";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = "Ошибка сохранения мероприятия";
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((err: ValidationError) => {
              if (err.msg && err.loc) {
                return `${err.loc.join(".")}: ${err.msg}`;
              }
              return JSON.stringify(err);
            }).join("; ");
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        }
        throw new Error(errorMessage);
      }
      // const responseData = await response.json();
      setSuccess(isCreating ? "Мероприятие успешно создано" : "Мероприятие успешно обновлено");
      // Перенаправляем на /dashboard с флагом для перезагрузки
      setTimeout(() => {
        router.push("/dashboard?refresh=true");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isLoading && !isNew && !eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-8 text-gray-800">
              {isCreating ? "Создание нового мероприятия" : "Редактирование мероприятия"}
            </h1>
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 bg-red-50 p-4 rounded-lg border-l-4 border-red-500 text-red-700"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 bg-green-50 p-4 rounded-lg border-l-4 border-green-500 text-green-700"
                >
                  {success}
                </motion.div>
              )}
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Секция: Основная информация */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Основная информация</h2>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Название мероприятия</label>
                    <InputField
                      type="text"
                      value={event.title}
                      onChange={handleChange}
                      placeholder="Введите название"
                      icon={FaPen}
                      name="title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Описание</label>
                    <textarea
                      value={event.description}
                      onChange={handleChange}
                      placeholder="Введите описание мероприятия"
                      name="description"
                      className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 resize-none shadow-sm hover:shadow-md"
                      rows={5}
                    />
                  </div>
                </div>

                {/* Секция: Даты и время */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Даты и время</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Дата начала</label>
                      <InputField
                        type="date"
                        value={event.start_date}
                        onChange={handleChange}
                        placeholder="Дата начала"
                        icon={FaCalendar}
                        name="start_date"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Время начала</label>
                      <InputField
                        type="time"
                        value={event.start_time || ""}
                        onChange={handleChange}
                        placeholder="Время начала"
                        icon={FaClock}
                        name="start_time"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Дата окончания</label>
                      <InputField
                        type="date"
                        value={event.end_date || ""}
                        onChange={handleChange}
                        placeholder="Дата окончания"
                        icon={FaCalendar}
                        name="end_date"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Время окончания</label>
                      <InputField
                        type="time"
                        value={event.end_time || ""}
                        onChange={handleChange}
                        placeholder="Время окончания"
                        icon={FaClock}
                        name="end_time"
                      />
                    </div>
                  </div>
                </div>

                {/* Секция: Местоположение и цена */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Местоположение и цена</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Местоположение</label>
                      <InputField
                        type="text"
                        value={event.location || ""}
                        onChange={handleChange}
                        placeholder="Место проведения"
                        icon={FaMapMarkerAlt}
                        name="location"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Цена (₽)</label>
                      <div className="relative">
                        <InputField
                          type="number"
                          value={event.price.toString()}
                          onChange={handleChange}
                          placeholder="Стоимость"
                          icon={() => <span className="text-gray-500">₽</span>}
                          name="price"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Секция: Изображение и публикация */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Изображение и публикация</h2>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">URL изображения</label>
                    <InputField
                      type="text"
                      value={event.image_url || ""}
                      onChange={handleChange}
                      placeholder="URL изображения для мероприятия"
                      icon={FaImage}
                      name="image_url"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="w-1/2">
                      <label className="block text-gray-700 mb-2 font-medium">Статус мероприятия</label>
                      <select
                        name="status"
                        value={event.status || "draft"}
                        onChange={handleChange}
                        className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md appearance-none"
                      >
                        <option value="draft">Черновик</option>
                        <option value="registration_open">Регистрация открыта</option>
                        <option value="registration_closed">Регистрация закрыта</option>
                        <option value="completed">Завершено</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Опубликовать</label>
                      <div className="relative inline-block w-12 h-6">
                        <input
                          type="checkbox"
                          id="published"
                          name="published"
                          checked={event.published}
                          onChange={handleChange}
                          className="opacity-0 w-0 h-0"
                        />
                        <label
                          htmlFor="published"
                          className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                            event.published ? "bg-blue-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                              event.published ? "transform translate-x-6" : ""
                            }`}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Кнопки управления */}
                <div className="flex justify-between pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
                  >
                    Отмена
                  </button>
                  <ModalButton type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Сохранение...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <FaCheck className="mr-2" />
                        {isCreating ? "Создать мероприятие" : "Сохранить изменения"}
                      </span>
                    )}
                  </ModalButton>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Модальное окно для подтверждения смены статуса */}
      <AnimatePresence>
        {showStatusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            >
              <h2 className="text-lg font-semibold mb-4">Подтверждение смены статуса</h2>
              <p className="text-gray-600 mb-6">
                Вы уверены, что хотите изменить статус мероприятия на <strong>{pendingStatus}</strong>?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelStatusChange}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Подтвердить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function EditEventPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <EditEventContent />
    </Suspense>
  );
}