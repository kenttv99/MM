"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import { useEventForm } from "@/hooks/useEventForm";
import { EventFormData } from "@/types/events";
import { motion } from "framer-motion";
import { 
  FaCalendarAlt, FaMapMarkerAlt, FaMoneyBillWave, FaTicketAlt, 
  FaImage, FaTrash, FaEye, FaBold, FaItalic, FaLink, FaListUl,
  FaListOl, FaHeading, FaQuoteRight, FaUsers, FaTicketAlt as FaTicket
} from "react-icons/fa";
import { usePageLoad } from "@/contexts/PageLoadContext";
import { ModalButton } from "@/components/common/AuthModal";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";

interface EditEventFormProps {
  initialEventId: string | null;
  isNewEvent: boolean;
}

const EditEventForm: React.FC<EditEventFormProps> = ({ initialEventId, isNewEvent }) => {
  const router = useRouter();
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const { wrapAsync } = usePageLoad();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedEvent = useRef(false);

  const initialValues: EventFormData = {
    title: "",
    description: "",
    start_date: new Date().toISOString().split("T")[0],
    start_time: "12:00",
    end_date: "",
    end_time: "",
    location: "",
    price: 0,
    ticket_type_name: "standart",
    ticket_type_available_quantity: 0,
    ticket_type_free_registration: false,
    published: false,
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { 
    formData, 
    error, 
    success, 
    imagePreview,
    handleChange, 
    handleFileChange, 
    handleSubmit,
    loadEvent,
    setFieldValue
  } = useEventForm({
    initialValues,
    onSuccess: () => {
      setTimeout(() => setShouldNavigate(true), 1500);
    }
  });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      handleFileChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if ((initialEventId && !hasLoadedEvent.current) || isNewEvent) {
      const initializeEvent = async () => {
        if (initialEventId) {
          hasLoadedEvent.current = true;
          try {
            await wrapAsync(
              loadEvent(initialEventId)
            );
          } catch (error) {
            console.error("Failed to load event:", error);
          }
        }
      };
      initializeEvent();
    }
  }, [initialEventId, isNewEvent, loadEvent, wrapAsync]);

  useEffect(() => {
    if (shouldNavigate) {
      router.push("/dashboard?refresh=true");
    }
  }, [shouldNavigate, router]);

  const handleRemoveImage = () => {
    handleFileChange(null, true);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFieldValue("status", value);
    if (value === "draft") {
      setFieldValue("published", false);
    }
  };

  const handlePublishedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFieldValue("published", checked);
    if (checked && formData.status === "draft") {
      setFieldValue("status", "registration_open");
    }
  };

  const handlePreview = () => {
    console.log("Preview event:", formData);
    alert("Функция предварительного просмотра находится в разработке.");
  };

  const insertFormatting = (startTag: string, endTag: string = "") => {
    if (!textAreaRef.current) return;
    
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    
    const newText = beforeText + startTag + selectedText + (endTag || startTag) + afterText;
    setFieldValue("description", newText);
    
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(
        start + startTag.length,
        start + startTag.length + selectedText.length
      );
    }, 0);
  };

  const addHeading = () => insertFormatting("## ");
  const addBold = () => insertFormatting("**");
  const addItalic = () => insertFormatting("*");
  const addQuote = () => insertFormatting("> ");
  const addBulletList = () => {
    if (!textAreaRef.current) return;
    
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    
    const newText = selectedText
      .split("\n")
      .map(line => line.trim() ? `- ${line}` : line)
      .join("\n");
    
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    
    setFieldValue("description", beforeText + newText + afterText);
    
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start, start + newText.length);
    }, 0);
  };

  const addNumberedList = () => {
    if (!textAreaRef.current) return;
    
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    
    const lines = selectedText.split("\n");
    const newText = lines
      .map((line, index) => line.trim() ? `${index + 1}. ${line}` : line)
      .join("\n");
    
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    
    setFieldValue("description", beforeText + newText + afterText);
    
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start, start + newText.length);
    }, 0);
  };

  const addLink = () => {
    if (!textAreaRef.current) return;
    
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    
    const newText = selectedText ? `[${selectedText}](url)` : "[Текст ссылки](url)";
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    
    setFieldValue("description", beforeText + newText + afterText);
    
    const cursorPosition = beforeText.length + newText.length - 1;
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(cursorPosition - 3, cursorPosition);
    }, 0);
  };

  const availableQuantity = formData.ticket_type_available_quantity || 0;
  const soldQuantity = formData.ticket_type_sold_quantity || 0;
  const remainingQuantity = availableQuantity - soldQuantity;
  const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminHeader />
      <main className="container mx-auto px-4 sm:px-6 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                {isNewEvent ? "Создание мероприятия" : "Редактирование мероприятия"}
              </h1>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Назад к списку
              </button>
            </div>

            {error && <ErrorDisplay error={error} />}
            {success && <SuccessDisplay message={success} />}

            {!isNewEvent && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
                <h2 className="text-xl font-semibold mb-4">Статистика мероприятия</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <FaTicket className="text-blue-500 mr-2" />
                      <h3 className="text-lg font-medium">Билеты</h3>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{soldQuantity} / {availableQuantity}</p>
                    <p className="text-sm text-gray-600">Продано билетов</p>
                    <div className="w-full mt-2">
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                              Заполненность: {fillPercentage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold inline-block text-blue-600">
                              Осталось: {remainingQuantity}
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                          <div 
                            style={{ width: `${fillPercentage}%` }} 
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <FaUsers className="text-green-500 mr-2" />
                      <h3 className="text-lg font-medium">Регистрации</h3>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{formData.registrations_count || 0}</p>
                    <p className="text-sm text-gray-600">Всего регистраций</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <FaCalendarAlt className="text-orange-500 mr-2" />
                      <h3 className="text-lg font-medium">Статус</h3>
                    </div>
                    <p className="text-xl font-bold text-orange-600">
                      {formData.status === "draft" && "Черновик"}
                      {formData.status === "registration_open" && "Регистрация открыта"}
                      {formData.status === "registration_closed" && "Регистрация закрыта"}
                      {formData.status === "completed" && "Завершено"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formData.published ? "Опубликовано" : "Не опубликовано"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Название мероприятия*</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Описание</label>
                <div className="flex flex-wrap gap-2 mb-2 bg-gray-100 p-2 rounded-lg">
                  <button
                    type="button"
                    onClick={addHeading}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Заголовок"
                  >
                    <FaHeading />
                  </button>
                  <button
                    type="button"
                    onClick={addBold}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Жирный"
                  >
                    <FaBold />
                  </button>
                  <button
                    type="button"
                    onClick={addItalic}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Курсив"
                  >
                    <FaItalic />
                  </button>
                  <button
                    type="button"
                    onClick={addLink}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Ссылка"
                  >
                    <FaLink />
                  </button>
                  <button
                    type="button"
                    onClick={addBulletList}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Маркированный список"
                  >
                    <FaListUl />
                  </button>
                  <button
                    type="button"
                    onClick={addNumberedList}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Нумерованный список"
                  >
                    <FaListOl />
                  </button>
                  <button
                    type="button"
                    onClick={addQuote}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700"
                    title="Цитата"
                  >
                    <FaQuoteRight />
                  </button>
                </div>
                <textarea
                  name="description"
                  value={formData.description || ""}
                  onChange={handleChange}
                  rows={10}
                  ref={textAreaRef}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Поддерживается Markdown-форматирование. Используйте кнопки или добавляйте теги вручную.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Дата начала*</label>
                  <div className="flex items-center">
                    <FaCalendarAlt className="text-gray-400 mr-2" />
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Время начала*</label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time || ""}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Дата окончания</label>
                  <div className="flex items-center">
                    <FaCalendarAlt className="text-gray-400 mr-2" />
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date || ""}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Время окончания</label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time || ""}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Место проведения</label>
                <div className="flex items-center">
                  <FaMapMarkerAlt className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    name="location"
                    value={formData.location || ""}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Адрес или название места"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Цена</label>
                  <div className="flex items-center">
                    <FaMoneyBillWave className="text-gray-400 mr-2" />
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Бесплатная регистрация</label>
                  <div className="flex items-center mt-3">
                    <input
                      type="checkbox"
                      name="ticket_type_free_registration"
                      checked={formData.ticket_type_free_registration}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700">Да</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Тип билета</label>
                  <div className="flex items-center">
                    <FaTicketAlt className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      name="ticket_type_name"
                      value={formData.ticket_type_name}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Например: 'Стандартный', 'VIP'"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Количество мест</label>
                  <input
                    type="number"
                    name="ticket_type_available_quantity"
                    value={formData.ticket_type_available_quantity}
                    onChange={handleChange}
                    min="0"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Изображение мероприятия</label>
                <div className="flex items-start">
                  <div className="mr-4">
                    <div
                      className={`w-32 h-32 border-2 border-dashed flex items-center justify-center cursor-pointer rounded-lg overflow-hidden ${imagePreview || filePreview ? "border-transparent" : "border-gray-300 hover:border-blue-500"}`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {(imagePreview || filePreview) ? (
                        <div className="relative w-full h-full">
                          <img
                            src={filePreview || imagePreview || ""}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage();
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      ) : (
                        <FaImage className="text-gray-400 text-3xl" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                      ref={fileInputRef}
                    />
                    <p className="text-gray-600 text-sm mb-2">Рекомендуемые размеры: 1200x630px</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Выбрать изображение
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Статус мероприятия</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleStatusChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="draft">Черновик</option>
                    <option value="registration_open">Регистрация открыта</option>
                    <option value="registration_closed">Регистрация закрыта</option>
                    <option value="completed">Завершено</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Публикация</label>
                  <div className="flex items-center mt-3">
                    <input
                      type="checkbox"
                      name="published"
                      checked={formData.published}
                      onChange={handlePublishedChange}
                      disabled={formData.status === "draft"}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700">
                      Опубликовать на сайте
                      {formData.status === "draft" && (
                        <span className="text-orange-500 ml-2">(недоступно для черновиков)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-4">
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <FaEye className="mr-2" />
                    Предпросмотр
                  </button>
                </div>
                <ModalButton type="submit">
                  Сохранить
                </ModalButton>
              </div>
            </form>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default EditEventForm;