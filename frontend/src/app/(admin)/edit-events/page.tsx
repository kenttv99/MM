// frontend/src/app/(admin)/edit-events/page.tsx
"use client";

import { useState, useEffect, ChangeEvent, FormEvent, useCallback, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaPen, FaCalendar, FaMapMarkerAlt, FaImage, FaCheck, FaClock, FaTrash, FaTicketAlt } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { motion, AnimatePresence } from "framer-motion";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

interface EventData {
  id?: number;
  title: string;
  description: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  image_file?: File | null;
  image_url?: string;
  price: number;
  published: boolean;
  created_at?: string;
  updated_at?: string;
  status?: string;
  ticket_type?: {
    name: string;
    available_quantity: number;
    free_registration: boolean;
  };
}

const EditEventContent: React.FC = () => {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const isNew = searchParams.get("new") === "true";

  const initialEventState = useMemo<EventData>(() => ({
    title: "",
    description: "",
    start_date: new Date().toISOString().split("T")[0],
    start_time: "12:00",
    price: 0,
    published: false,
    status: "draft",
    image_file: null,
    image_url: "",
    ticket_type: {
      name: "standart",
      available_quantity: 0,
      free_registration: false,
    },
  }), []);

  const [event, setEvent] = useState<EventData>(initialEventState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImageRemoved, setIsImageRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const fetchEvent = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) throw new Error("Отсутствует токен авторизации");
  
      const authToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token;
  
      // Запрос данных мероприятия
      const response = await fetch(`/events/${id}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Accept": "application/json",
        },
      });
      if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
      const data = await response.json();
  
      const startDateTime = new Date(data.start_date);
      const endDateTime = data.end_date ? new Date(data.end_date) : null;
      setEvent({
        ...data,
        start_date: startDateTime.toISOString().split("T")[0],
        start_time: startDateTime.toTimeString().slice(0, 5),
        end_date: endDateTime?.toISOString().split("T")[0] || "",
        end_time: endDateTime?.toTimeString().slice(0, 5) || "",
        ticket_type: data.ticket_type || initialEventState.ticket_type,
      });
  
      // Запрос изображения с авторизацией
      if (data.image_url) {
        const imageResponse = await fetch(data.image_url, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (imageResponse.ok) {
          const blob = await imageResponse.blob();
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(blob);
        } else {
          console.warn(`Не удалось загрузить изображение: ${imageResponse.status}`);
          setImagePreview(null); // Устанавливаем null, но не прерываем выполнение
        }
      } else {
        setImagePreview(null);
      }
  
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      setTimeout(() => navigateTo(router, "/dashboard"), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [router, initialEventState]);

  useEffect(() => {
    if (!authLoading) {
      if (!eventId && !isNew) navigateTo(router, "/dashboard");
      else if (!isAdminAuth) navigateTo(router, "/admin-login");
      else if (isNew) {
        setIsCreating(true);
        setEvent(initialEventState);
      } else if (eventId) fetchEvent(eventId);
    }
  }, [eventId, isNew, isAdminAuth, authLoading, router, fetchEvent, initialEventState]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setEvent({ ...event, [name]: (e.target as HTMLInputElement).checked });
    } else if (type === "number") {
      if (name === "available_quantity") {
        setEvent({
          ...event,
          ticket_type: { ...event.ticket_type!, available_quantity: parseInt(value) || 0 },
        });
      } else {
        setEvent({ ...event, [name]: parseFloat(value) });
      }
    } else if (name === "status") {
      setPendingStatus(value);
      setShowStatusModal(true);
    } else if (name === "ticket_type_name") {
      setEvent({
        ...event,
        ticket_type: { ...event.ticket_type!, name: value },
      });
    } else {
      setEvent({ ...event, [name]: value });
    }
  };

  const handleFileChange = (file: File | null) => {
    setEvent({ ...event, image_file: file });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setIsImageRemoved(false);
    } else {
      setImagePreview(null);
      setIsImageRemoved(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInputFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileChange(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileChange(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleAreaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFreeRegistrationChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEvent({
      ...event,
      ticket_type: { ...event.ticket_type!, free_registration: e.target.checked },
    });
  };

  const confirmStatusChange = () => {
    if (pendingStatus) setEvent({ ...event, status: pendingStatus });
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

    if (!event.title) {
      setError("Поле 'Название мероприятия' обязательно");
      setIsLoading(false);
      return;
    }
    if (!event.start_date) {
      setError("Поле 'Дата начала' обязательно");
      setIsLoading(false);
      return;
    }
    if (event.price === undefined || event.price === null) {
      setError("Поле 'Цена' обязательно");
      setIsLoading(false);
      return;
    }
    if (!event.ticket_type?.available_quantity || event.ticket_type.available_quantity <= 0) {
      setError("Укажите количество доступных мест (больше 0)");
      setIsLoading(false);
      return;
    }

    const startDateTime = new Date(`${event.start_date}T${event.start_time || "00:00"}:00Z`);
    const endDateTime = event.end_date && event.end_time
      ? new Date(`${event.end_date}T${event.end_time}:00Z`)
      : event.end_date ? new Date(`${event.end_date}T00:00:00Z`) : null;

    const formData = new FormData();
    formData.append("title", event.title);
    formData.append("description", event.description || "");
    formData.append("start_date", startDateTime.toISOString());
    if (endDateTime) formData.append("end_date", endDateTime.toISOString());
    if (event.location) formData.append("location", event.location);
    formData.append("price", String(event.price));
    formData.append("published", String(event.published));
    formData.append("created_at", new Date().toISOString());
    formData.append("updated_at", new Date().toISOString());
    formData.append("status", event.status || "draft");
    formData.append("ticket_type_name", event.ticket_type?.name || "standart");
    formData.append("ticket_type_available_quantity", String(event.ticket_type?.available_quantity || 0));
    formData.append("ticket_type_free_registration", String(event.ticket_type?.free_registration || false));
    if (event.image_file) {
      formData.append("image_file", event.image_file);
    }
    formData.append("remove_image", String(isImageRemoved));

    try {
      const url = isCreating ? "/admin_edits" : `/admin_edits/${eventId}`;
      const method = isCreating ? "POST" : "PUT";
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.detail
          ? Array.isArray(errorData.detail)
            ? errorData.detail.map((err: ValidationError) => `${err.loc.join(".")}: ${err.msg}`).join("; ")
            : errorData.detail
          : "Ошибка сохранения мероприятия";
        throw new Error(errorMessage);
      }

      setSuccess(isCreating ? "Мероприятие успешно создано" : "Мероприятие успешно обновлено");
      setTimeout(() => navigateTo(router, "/dashboard", { refresh: "true" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
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
                {/* Основная информация */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Основная информация</h2>
                  <InputField
                    type="text"
                    value={event.title}
                    onChange={handleChange}
                    placeholder="Введите название"
                    icon={FaPen}
                    name="title"
                    required
                  />
                  <textarea
                    value={event.description}
                    onChange={handleChange}
                    placeholder="Введите описание мероприятия"
                    name="description"
                    className="w-full p-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 resize-none shadow-sm hover:shadow-md"
                    rows={5}
                  />
                </div>

                {/* Даты и время */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Даты и время</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField
                      type="date"
                      value={event.start_date}
                      onChange={handleChange}
                      placeholder="Дата начала"
                      icon={FaCalendar}
                      name="start_date"
                      required
                    />
                    <InputField
                      type="time"
                      value={event.start_time || ""}
                      onChange={handleChange}
                      placeholder="Время начала"
                      icon={FaClock}
                      name="start_time"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField
                      type="date"
                      value={event.end_date || ""}
                      onChange={handleChange}
                      placeholder="Дата окончания"
                      icon={FaCalendar}
                      name="end_date"
                    />
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

                {/* Местоположение и цена */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Местоположение и цена</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField
                      type="text"
                      value={event.location || ""}
                      onChange={handleChange}
                      placeholder="Место проведения"
                      icon={FaMapMarkerAlt}
                      name="location"
                    />
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

                {/* Регистрация на мероприятие */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Регистрация на мероприятие</h2>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Количество мест</label>
                    <InputField
                      type="number"
                      value={event.ticket_type?.available_quantity.toString() || "0"}
                      onChange={handleChange}
                      placeholder="Введите количество мест"
                      icon={FaTicketAlt}
                      name="available_quantity"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Тип билетов</label>
                    <select
                      name="ticket_type_name"
                      value={event.ticket_type?.name || "standart"}
                      onChange={handleChange}
                      className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md appearance-none"
                    >
                      <option value="free">Бесплатный</option>
                      <option value="standart">Стандартный</option>
                      <option value="vip">VIP</option>
                      <option value="org">Организаторский</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Бесплатная регистрация</label>
                      <div className="relative inline-block w-12 h-6">
                        <input
                          type="checkbox"
                          id="free_registration"
                          name="free_registration"
                          checked={event.ticket_type?.free_registration || false}
                          onChange={handleFreeRegistrationChange}
                          className="opacity-0 w-0 h-0"
                        />
                        <label
                          htmlFor="free_registration"
                          className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                            event.ticket_type?.free_registration ? "bg-green-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                              event.ticket_type?.free_registration ? "transform translate-x-6" : ""
                            }`}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Изображение и публикация */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Изображение и публикация</h2>
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={handleAreaClick}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 cursor-pointer ${
                      isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        {/*eslint-disable-next-line @next/next/no-img-element*/}
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileChange(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <FaImage className="mx-auto text-gray-400 mb-2" size={32} />
                        <p className="text-gray-600">
                          Перетащите изображение сюда или кликните, чтобы выбрать файл
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Поддерживаются форматы: JPG, PNG</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleInputFileChange}
                      className="hidden"
                      ref={fileInputRef}
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
                    onClick={() => navigateTo(router, "/dashboard")}
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