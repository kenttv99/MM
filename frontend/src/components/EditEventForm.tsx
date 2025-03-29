// frontend/src/components/EditEventForm.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "./common/InputField";
import { ModalButton } from "./common/AuthModal";
import { FaPen, FaCalendar, FaMapMarkerAlt, FaImage, FaCheck, FaClock, FaTrash, FaTicketAlt, FaPlus } from "react-icons/fa";
import AdminHeader from "./AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { motion } from "framer-motion";
import { useEventForm } from "@/hooks/useEventForm";
import ErrorDisplay from "./common/ErrorDisplay";
import SuccessDisplay from "./common/SuccessDisplay";
import { EventData, EventStatus } from "@/types/events";
import Image from "next/image";
import { fetchAdminEvents } from "@/utils/eventService";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

// Компонент редактора текста
const TextEditor = ({ value, onChange }: { value: string; onChange: (content: string) => void }) => {
  const insertFormatting = (tag: string) => {
    const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const formattedText = `<${tag}>${selectedText}</${tag}>`;
    const newText = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + formattedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => insertFormatting('b')} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Жирный</button>
        <button type="button" onClick={() => insertFormatting('i')} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Курсив</button>
        <button type="button" onClick={() => insertFormatting('u')} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Подчеркнутый</button>
        <button type="button" onClick={() => insertFormatting('s')} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Зачеркнутый</button>
      </div>
      <textarea
        name="description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Введите описание мероприятия"
        className="w-full min-h-[200px] p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={10}
      />
    </div>
  );
};

const EditEventForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const isNew = searchParams.get("new") === "true";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedEvent = useRef(false); // Флаг для предотвращения повторных загрузок

  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    formData,
    isLoading,
    error,
    success,
    imagePreview,
    handleChange,
    handleFileChange,
    handleSubmit,
    loadEvent,
    setFieldValue,
    resetForm,
  } = useEventForm({
    initialValues: {
      title: "",
      description: "",
      start_date: new Date().toISOString().split("T")[0],
      start_time: "12:00",
      price: 0,
      published: false,
      status: "draft" as EventStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ticket_type_name: "standart",
      ticket_type_available_quantity: 0,
      ticket_type_sold_quantity: 0,
      ticket_type_free_registration: false,
      registrations_count: 0,
    },
    onSuccess: () => {
      setTimeout(() => {
        resetForm();
        setShowForm(false);
        fetchEvents();
        navigateTo(router, "/dashboard", { refresh: "true" });
      }, 1500);
    },
  });

  const fetchEvents = useCallback(async () => {
    await fetchAdminEvents(
      localStorage.getItem("admin_token") || "",
      setEvents,
      setIsLoadingEvents,
      setEventsError,
      "",
      false
    );
  }, []);

  useEffect(() => {
    checkAuth();
    if (isAdminAuth && !eventId && !isNew) fetchEvents();
  }, [checkAuth, isAdminAuth, eventId, isNew, fetchEvents]);

  useEffect(() => {
    if (!authLoading && isAdminAuth && !hasLoadedEvent.current) {
      if (eventId) {
        loadEvent(eventId);
        setShowForm(true);
        hasLoadedEvent.current = true; // Устанавливаем флаг после первой загрузки
      } else if (isNew) {
        resetForm();
        setShowForm(true);
        hasLoadedEvent.current = true; // Устанавливаем флаг для нового события
      }
    } else if (!authLoading && !isAdminAuth) {
      navigateTo(router, "/admin-login");
    }
  }, [eventId, isNew, isAdminAuth, authLoading, loadEvent, resetForm, router]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileChange(file);
  };

  const handleAreaClick = () => fileInputRef.current?.click();

  const handleDescriptionChange = (content: string) => setFieldValue("description", content);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {!showForm ? (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">Мероприятия</h1>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                  navigateTo(router, "/edit-events", { new: "true" });
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <FaPlus className="mr-2" />
                Новое мероприятие
              </button>
            </div>
            {isLoadingEvents ? (
              <div className="text-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></div>
            ) : eventsError ? (
              <ErrorDisplay error={eventsError} />
            ) : events.length > 0 ? (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {events.map((event, index) => (
                      <tr key={event.id ?? index} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.id ?? "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{event.status}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => event.id && navigateTo(router, "/edit-events", { event_id: event.id.toString() })}
                            className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200 mr-4"
                            disabled={!event.id}
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
              <p className="text-gray-500 text-center py-6">Нет доступных мероприятий</p>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-3xl font-bold mb-8 text-gray-800">
                {isNew ? "Создание нового мероприятия" : "Редактирование мероприятия"}
              </h1>
              <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                {formData.id && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Статистика регистрации</h3>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{
                          width: `${formData.ticket_type_available_quantity > 0
                            ? ((formData.ticket_type_sold_quantity || 0) / formData.ticket_type_available_quantity) * 100
                            : 0
                        }%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                      Продано билетов: {formData.ticket_type_sold_quantity || 0} из {formData.ticket_type_available_quantity} 
                      <br/>(Остаток: {formData.ticket_type_available_quantity - (formData.ticket_type_sold_quantity || 0)})
                    </p>
                  </div>
                )}
                <ErrorDisplay error={error} className="mb-6" />
                <SuccessDisplay message={success} className="mb-6" />
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Основная информация</h2>
                    <InputField type="text" value={formData.title} onChange={handleChange} placeholder="Введите название" icon={FaPen} name="title" required />
                    <TextEditor value={formData.description || ""} onChange={handleDescriptionChange} />
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Даты и время</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField type="date" value={formData.start_date} onChange={handleChange} placeholder="Дата начала" icon={FaCalendar} name="start_date" required />
                      <InputField type="time" value={formData.start_time || ""} onChange={handleChange} placeholder="Время начала" icon={FaClock} name="start_time" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField type="date" value={formData.end_date || ""} onChange={handleChange} placeholder="Дата окончания" icon={FaCalendar} name="end_date" />
                      <InputField type="time" value={formData.end_time || ""} onChange={handleChange} placeholder="Время окончания" icon={FaClock} name="end_time" />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Местоположение и цена</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField type="text" value={formData.location || ""} onChange={handleChange} placeholder="Место проведения" icon={FaMapMarkerAlt} name="location" />
                      <InputField type="number" value={formData.price.toString()} onChange={handleChange} placeholder="Стоимость" icon={() => <span className="text-gray-500">₽</span>} name="price" required />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Регистрация на мероприятие</h2>
                    <InputField type="number" value={formData.ticket_type_available_quantity.toString()} onChange={handleChange} placeholder="Количество мест" icon={FaTicketAlt} name="ticket_type_available_quantity" required />
                    <select
                      name="ticket_type_name"
                      value={formData.ticket_type_name}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="free">Бесплатный</option>
                      <option value="standart">Стандартный</option>
                      <option value="vip">VIP</option>
                      <option value="org">Организаторский</option>
                    </select>
                    <div className="flex items-center">
                      <label className="text-gray-700 mr-3">Бесплатная регистрация</label>
                      <input
                        type="checkbox"
                        name="ticket_type_free_registration"
                        checked={formData.ticket_type_free_registration}
                        onChange={handleChange}
                        className="form-checkbox h-5 w-5 text-blue-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Изображение и публикация</h2>
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={handleAreaClick}
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-100 transition-all duration-300"
                    >
                      {imagePreview ? (
                        <div className="relative">
                          <Image src={imagePreview} alt="Preview" width={600} height={400} className="w-full h-48 object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileChange(null, true);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                          >
                            <FaTrash size={16} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <FaImage className="mx-auto text-gray-400 mb-2" size={32} />
                          <p className="text-gray-600">Перетащите изображение сюда или кликните</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                        className="hidden"
                        ref={fileInputRef}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="w-1/2">
                        <label className="block text-gray-700 mb-2 font-medium">Статус мероприятия</label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleChange}
                          className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md appearance-none"
                        >
                          <option value="draft">Черновик</option>
                          <option value="registration_open">Регистрация открыта</option>
                          <option value="registration_closed">Регистрация закрыта</option>
                          <option value="completed">Завершено</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <label className="text-gray-700 mr-3">Опубликовать</label>
                        <input
                          type="checkbox"
                          name="published"
                          checked={formData.published}
                          onChange={handleChange}
                          className="form-checkbox h-5 w-5 text-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between pt-6 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        navigateTo(router, "/dashboard");
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
                    >
                      Отмена
                    </button>
                    <ModalButton type="submit" disabled={isLoading}>
                      <div className="flex items-center whitespace-nowrap">
                        <FaCheck className="mr-2" />
                        <span>{isLoading ? "Сохранение..." : (isNew ? "Создать" : "Сохранить")}</span>
                      </div>
                    </ModalButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EditEventForm;