// frontend/src/app/(admin)/edit-events/page.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaPen, FaCalendar, FaMapMarkerAlt, FaImage, FaCheck, FaClock, FaTrash, FaTicketAlt } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { motion } from "framer-motion";
import { useEventForm } from "@/hooks/useEventForm";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import { EventStatus } from "@/types/events";
import Image from 'next/image'

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

const EditEventContent: React.FC = () => {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const isNew = searchParams.get("new") === "true";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();

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
      ticket_type_free_registration: false,
    },
    onSuccess: () => {
      setTimeout(() => navigateTo(router, "/dashboard", { refresh: "true" }), 1500);
    },
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authLoading) {
      if (!eventId && !isNew) {
        navigateTo(router, "/dashboard");
      } else if (!isAdminAuth) {
        navigateTo(router, "/admin-login");
      } else if (eventId) {
        loadEvent(eventId);
      }
    }
  }, [eventId, isNew, isAdminAuth, authLoading, router, loadEvent]);

  // Установка начального значения description
  useEffect(() => {
    if (editorRef.current && formData.description !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = formData.description || "Введите описание мероприятия";
    }
  }, [formData.description]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleAreaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Проверка, обернут ли текст в тег
  const isWrappedInTag = (range: Range, tagName: string): boolean => {
    const parent = range.commonAncestorContainer;
    if (parent.nodeType === Node.ELEMENT_NODE) {
      const elements = (parent as Element).getElementsByTagName(tagName);
      for (let i = 0; i < elements.length; i++) {
        if (range.intersectsNode(elements[i])) {
          return true;
        }
      }
    } else if (parent.nodeType === Node.TEXT_NODE) {
      const parentElement = parent.parentElement;
      return parentElement?.tagName.toLowerCase() === tagName;
    }
    return false;
  };

  // Удаление тега и восстановление текста
  const unwrapTag = (range: Range, tagName: string) => {
    const parent = range.commonAncestorContainer;
    let targetElement: HTMLElement | null = null;
  
    if (parent.nodeType === Node.TEXT_NODE) {
      const parentElement = parent.parentElement;
      if (parentElement?.tagName.toLowerCase() === tagName) {
        targetElement = parentElement;
      }
    } else if (parent.nodeType === Node.ELEMENT_NODE) {
      const elements = (parent as Element).getElementsByTagName(tagName);
      for (let i = 0; i < elements.length; i++) {
        if (range.intersectsNode(elements[i])) {
          targetElement = elements[i] as HTMLElement;
          break;
        }
      }
    }
  
    if (targetElement) {
      const contents = document.createDocumentFragment();
      while (targetElement.firstChild) {
        contents.appendChild(targetElement.firstChild);
      }
      targetElement.replaceWith(contents);
    }
  };

  // Функция для форматирования текста
  const formatText = (style: 'bold' | 'italic' | 'underline' | 'strike') => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      console.log("Нет выделения");
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      console.log("Выделение пустое");
      return;
    }

    let tagName: string;
    let wrapper: HTMLElement;
    switch (style) {
      case 'bold':
        tagName = 'strong';
        wrapper = document.createElement('strong');
        break;
      case 'italic':
        tagName = 'em';
        wrapper = document.createElement('em');
        break;
      case 'underline':
        tagName = 'u';
        wrapper = document.createElement('u');
        break;
      case 'strike':
        tagName = 's';
        wrapper = document.createElement('s');
        break;
      default:
        return;
    }

    try {
      if (isWrappedInTag(range, tagName)) {
        // Если текст уже обернут, убираем форматирование
        unwrapTag(range, tagName);
      } else {
        // Применяем форматирование
        const contents = range.cloneContents();
        wrapper.appendChild(contents);
        range.deleteContents();
        range.insertNode(wrapper);

        // Восстанавливаем выделение
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        selection.addRange(newRange);
      }

      // Обновляем description
      updateDescription();
    } catch (e) {
      console.error('Ошибка при форматировании:', e);
    }
  };

  // Функция для изменения размера шрифта
  const changeFontSize = (size: string) => {
    if (!size || !editorRef.current) return;

    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      console.log("Нет выделения");
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      console.log("Выделение пустое");
      return;
    }

    const span = document.createElement('span');
    span.style.fontSize = size;

    try {
      const contents = range.cloneContents();
      span.appendChild(contents);
      range.deleteContents();
      range.insertNode(span);

      // Восстанавливаем выделение
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);

      // Обновляем description
      updateDescription();
    } catch (e) {
      console.error('Ошибка при изменении размера шрифта:', e);
    }
  };

  // Обновление значения description при изменении текста в редакторе
  const updateDescription = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      setFieldValue("description", content === "Введите описание мероприятия" ? "" : content);
    }
  };

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
              {isNew ? "Создание нового мероприятия" : "Редактирование мероприятия"}
            </h1>
            
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              <ErrorDisplay error={error} className="mb-6" />
              <SuccessDisplay message={success} className="mb-6" />
              
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Основная информация</h2>
                  <InputField
                    type="text"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Введите название"
                    icon={FaPen}
                    name="title"
                    required
                  />
                  <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex space-x-2 mb-2">
                    <button
                      type="button"
                      onClick={() => formatText('bold')}
                      className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Жирный
                    </button>
                    <button
                      type="button"
                      onClick={() => formatText('italic')}
                      className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Курсив
                    </button>
                    <button
                      type="button"
                      onClick={() => formatText('underline')}
                      className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Подчеркнутый
                    </button>
                    <button
                      type="button"
                      onClick={() => formatText('strike')}
                      className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Зачеркнутый
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Размер (px)"
                      onChange={(e) => {
                        const size = e.target.value;
                        if (size) changeFontSize(`${size}px`);
                      }}
                      className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 w-24"
                    />
                  </div>
                    <div
                      ref={editorRef}
                      contentEditable="true"
                      onInput={updateDescription}
                      onBlur={updateDescription}
                      className="min-h-[200px] p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Даты и время</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField
                      type="date"
                      value={formData.start_date}
                      onChange={handleChange}
                      placeholder="Дата начала"
                      icon={FaCalendar}
                      name="start_date"
                      required
                    />
                    <InputField
                      type="time"
                      value={formData.start_time || ""}
                      onChange={handleChange}
                      placeholder="Время начала"
                      icon={FaClock}
                      name="start_time"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField
                      type="date"
                      value={formData.end_date || ""}
                      onChange={handleChange}
                      placeholder="Дата окончания"
                      icon={FaCalendar}
                      name="end_date"
                    />
                    <InputField
                      type="time"
                      value={formData.end_time || ""}
                      onChange={handleChange}
                      placeholder="Время окончания"
                      icon={FaClock}
                      name="end_time"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Местоположение и цена</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField
                      type="text"
                      value={formData.location || ""}
                      onChange={handleChange}
                      placeholder="Место проведения"
                      icon={FaMapMarkerAlt}
                      name="location"
                    />
                    <InputField
                      type="number"
                      value={formData.price.toString()}
                      onChange={handleChange}
                      placeholder="Стоимость"
                      icon={() => <span className="text-gray-500">₽</span>}
                      name="price"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Регистрация на мероприятие</h2>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Количество мест</label>
                    <InputField
                      type="number"
                      value={formData.ticket_type_available_quantity.toString()}
                      onChange={handleChange}
                      placeholder="Введите количество мест"
                      icon={FaTicketAlt}
                      name="ticket_type_available_quantity"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Тип билетов</label>
                    <select
                      name="ticket_type_name"
                      value={formData.ticket_type_name}
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
                          id="ticket_type_free_registration"
                          name="ticket_type_free_registration"
                          checked={formData.ticket_type_free_registration}
                          onChange={handleChange}
                          className="opacity-0 w-0 h-0"
                        />
                        <label
                          htmlFor="ticket_type_free_registration"
                          className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                            formData.ticket_type_free_registration ? "bg-green-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                              formData.ticket_type_free_registration ? "transform translate-x-6" : ""
                            }`}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Изображение и публикация</h2>
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={handleAreaClick}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 cursor-pointer ${
                      isLoading ? "border-gray-300 bg-gray-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          width={600} // Задаем ширину
                          height={400} // Задаем высоту
                          className="w-full h-48 object-cover rounded-lg"
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
                        <p className="text-gray-600">
                          Перетащите изображение сюда или кликните, чтобы выбрать файл
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Поддерживаются форматы: JPG, PNG</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileChange(file);
                      }}
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
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Опубликовать</label>
                      <div className="relative inline-block w-12 h-6">
                        <input
                          type="checkbox"
                          id="published"
                          name="published"
                          checked={formData.published}
                          onChange={handleChange}
                          className="opacity-0 w-0 h-0"
                        />
                        <label
                          htmlFor="published"
                          className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                            formData.published ? "bg-blue-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                              formData.published ? "transform translate-x-6" : ""
                            }`}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

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
                        {isNew ? "Создать мероприятие" : "Сохранить изменения"}
                      </span>
                    )}
                  </ModalButton>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default function EditEventPage() {
  return <EditEventContent />;
}