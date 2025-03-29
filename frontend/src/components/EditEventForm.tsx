"use client";

import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useRouter } from "next/navigation";
import InputField from "./common/InputField";
import { ModalButton } from "./common/AuthModal";
import {
  FaPen,
  FaCalendar,
  FaMapMarkerAlt,
  FaImage,
  FaClock,
  FaTrash,
  FaTicketAlt,
  FaPlus,
  FaArrowLeft,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useEventForm } from "@/hooks/useEventForm";
import ErrorDisplay from "./common/ErrorDisplay";
import SuccessDisplay from "./common/SuccessDisplay";
import { EventData, EventStatus } from "@/types/events";
import Image from "next/image";
import { fetchAdminEvents } from "@/utils/eventService";
import { PageLoadContext } from "@/contexts/PageLoadContext";

interface EditEventFormProps {
  initialEventId?: string | null;
  isNewEvent?: boolean;
}

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

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
    <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => insertFormatting("b")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm sm:text-base min-h-[44px]"
        >
          Жирный
        </button>
        <button
          type="button"
          onClick={() => insertFormatting("i")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm sm:text-base min-h-[44px]"
        >
          Курсив
        </button>
        <button
          type="button"
          onClick={() => insertFormatting("u")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm sm:text-base min-h-[44px]"
        >
          Подчеркнутый
        </button>
        <button
          type="button"
          onClick={() => insertFormatting("s")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm sm:text-base min-h-[44px]"
        >
          Зачеркнутый
        </button>
      </div>
      <textarea
        name="description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Введите описание мероприятия"
        className="w-full min-h-[150px] sm:min-h-[200px] p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
        rows={10}
      />
    </div>
  );
};

const EditEventForm: React.FC<EditEventFormProps> = ({ initialEventId, isNewEvent }) => {
  const router = useRouter();
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedEvent = useRef(false);
  const { setPageLoaded } = useContext(PageLoadContext);

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
    if (initialEventId) {
      loadEvent(initialEventId);
      setShowForm(true);
      hasLoadedEvent.current = true;
    } else if (isNewEvent) {
      resetForm();
      setShowForm(true);
      hasLoadedEvent.current = true;
    } else {
      fetchEvents();
    }
  }, [initialEventId, isNewEvent, resetForm, loadEvent, fetchEvents]);

  useEffect(() => {
    if (!isLoading && !isLoadingEvents && (events.length > 0 || showForm || error || eventsError)) {
      setPageLoaded(true);
    }
  }, [isLoading, isLoadingEvents, events, showForm, error, eventsError, setPageLoaded]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileChange(file);
  };

  const handleAreaClick = () => fileInputRef.current?.click();

  const handleDescriptionChange = (content: string) => setFieldValue("description", content);

  if (isLoading && (initialEventId || isNewEvent)) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12">
        {!showForm ? (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">Мероприятия</h1>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                  navigateTo(router, "/edit-events", { new: "true" });
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg text-sm sm:text-base min-h-[44px]"
              >
                <FaPlus className="mr-2" />
                Новое мероприятие
              </button>
            </div>
            {isLoadingEvents ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : eventsError ? (
              <ErrorDisplay error={eventsError} />
            ) : events.length > 0 ? (
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                <div className="md:hidden flex flex-col gap-4">
                  {events.map((event, index) => (
                    <div
                      key={event.id ?? index}
                      className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <p className="text-sm sm:text-base">
                        <strong>ID:</strong> {event.id ?? "N/A"}
                      </p>
                      <p className="text-sm sm:text-base">
                        <strong>Название:</strong> {event.title}
                      </p>
                      <p className="text-sm sm:text-base">
                        <strong>Статус:</strong> {event.status}
                      </p>
                      <button
                        onClick={() =>
                          event.id && navigateTo(router, "/edit-events", { event_id: event.id.toString() })
                        }
                        className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base min-h-[44px]"
                        disabled={!event.id}
                      >
                        Редактировать
                      </button>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Название
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Статус
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {events.map((event, index) => (
                        <tr
                          key={event.id ?? index}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm sm:text-base text-gray-900">
                            {event.id ?? "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm sm:text-base text-gray-900">
                            {event.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm sm:text-base">{event.status}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm sm:text-base">
                            <button
                              onClick={() =>
                                event.id && navigateTo(router, "/edit-events", { event_id: event.id.toString() })
                              }
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
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6 text-sm sm:text-base">Нет доступных мероприятий</p>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="flex items-center mb-6 sm:mb-8">
                <button
                  onClick={() => navigateTo(router, "/dashboard")}
                  className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  aria-label="Назад"
                >
                  <FaArrowLeft className="text-gray-600" />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {formData.id ? "Редактирование мероприятия" : "Создание нового мероприятия"}
                </h1>
              </div>

              <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg border border-gray-100">
                {formData.id && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Статистика регистрации</h3>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{
                          width: `${
                            formData.ticket_type_available_quantity > 0
                              ? ((formData.ticket_type_sold_quantity || 0) / formData.ticket_type_available_quantity) *
                                100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Продано билетов: {formData.ticket_type_sold_quantity || 0} из{" "}
                      {formData.ticket_type_available_quantity} <br />
                      (Остаток: {formData.ticket_type_available_quantity - (formData.ticket_type_sold_quantity || 0)})
                    </p>
                  </div>
                )}
                <ErrorDisplay error={error} className="mb-6" />
                <SuccessDisplay message={success} className="mb-6" />
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 lg:space-y-8">
                  <div className="space-y-4 sm:space-y-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 border-b pb-2">
                      Основная информация
                    </h2>
                    <InputField
                      type="text"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="Введите название"
                      icon={FaPen}
                      name="title"
                      required
                      className="w-full"
                    />
                    <TextEditor value={formData.description || ""} onChange={handleDescriptionChange} />
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 border-b pb-2">Даты и время</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <InputField
                        type="date"
                        value={formData.start_date}
                        onChange={handleChange}
                        placeholder="Дата начала"
                        icon={FaCalendar}
                        name="start_date"
                        required
                        className="w-full"
                      />
                      <InputField
                        type="time"
                        value={formData.start_time || ""}
                        onChange={handleChange}
                        placeholder="Время начала"
                        icon={FaClock}
                        name="start_time"
                        className="w-full"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <InputField
                        type="date"
                        value={formData.end_date || ""}
                        onChange={handleChange}
                        placeholder="Дата окончания"
                        icon={FaCalendar}
                        name="end_date"
                        className="w-full"
                      />
                      <InputField
                        type="time"
                        value={formData.end_time || ""}
                        onChange={handleChange}
                        placeholder="Время окончания"
                        icon={FaClock}
                        name="end_time"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 border-b pb-2">
                      Местоположение и цена
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <InputField
                        type="text"
                        value={formData.location || ""}
                        onChange={handleChange}
                        placeholder="Место проведения"
                        icon={FaMapMarkerAlt}
                        name="location"
                        className="w-full"
                      />
                      <InputField
                        type="number"
                        value={formData.price.toString()}
                        onChange={handleChange}
                        placeholder="Стоимость"
                        icon={() => <span className="text-gray-500">₽</span>}
                        name="price"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 border-b pb-2">
                      Регистрация на мероприятие
                    </h2>
                    <InputField
                      type="number"
                      value={formData.ticket_type_available_quantity.toString()}
                      onChange={handleChange}
                      placeholder="Количество мест"
                      icon={FaTicketAlt}
                      name="ticket_type_available_quantity"
                      required
                      className="w-full"
                    />
                    <select
                      name="ticket_type_name"
                      value={formData.ticket_type_name}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    >
                      <option value="free">Бесплатный</option>
                      <option value="standart">Стандартный</option>
                      <option value="vip">VIP</option>
                      <option value="org">Организаторский</option>
                    </select>
                    <div className="flex items-center">
                      <label className="text-gray-700 mr-3 text-sm sm:text-base">Бесплатная регистрация</label>
                      <input
                        type="checkbox"
                        name="ticket_type_free_registration"
                        checked={formData.ticket_type_free_registration}
                        onChange={handleChange}
                        className="form-checkbox h-5 w-5 text-blue-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 border-b pb-2">
                      Изображение и публикация
                    </h2>
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={handleAreaClick}
                      className="border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:bg-gray-100 transition-all duration-300"
                    >
                      {imagePreview ? (
                        <div className="relative">
                          <Image
                            src={imagePreview}
                            alt="Preview"
                            width={600}
                            height={400}
                            className="w-full h-40 sm:h-48 object-cover rounded-lg"
                          />
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
                          <p className="text-gray-600 text-sm sm:text-base">
                            Перетащите изображение сюда или кликните
                          </p>
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center">
                        <label className="text-gray-700 mr-3 text-sm sm:text-base">Опубликовать</label>
                        <input
                          type="checkbox"
                          name="published"
                          checked={formData.published}
                          onChange={handleChange}
                          className="form-checkbox h-5 w-5 text-blue-600"
                        />
                      </div>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full sm:w-1/2 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      >
                        <option value="draft">Черновик</option>
                        <option value="registration_open">Регистрация открыта</option>
                        <option value="registration_closed">Регистрация закрыта</option>
                        <option value="completed">Завершено</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between pt-6 sm:pt-8 gap-4 sm:gap-6">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setShowForm(false);
                        navigateTo(router, "/dashboard");
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300 text-sm sm:text-base min-h-[44px]"
                    >
                      Отмена
                    </button>
                    <ModalButton
                      type="submit"
                      disabled={isLoading}
                      className="w-full sm:w-auto"
                    >
                      {isLoading ? "Сохранение..." : formData.id ? "Обновить" : "Создать"}
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