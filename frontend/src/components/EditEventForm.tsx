"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import { EventFormData, TicketTypeEnum } from "@/types/events";
import { motion } from "framer-motion";
import {
  FaCalendarAlt, FaMapMarkerAlt, FaMoneyBillWave, FaTicketAlt,
  FaImage, FaTrash, FaEye, FaBold, FaItalic, FaLink, FaListUl,
  FaListOl, FaHeading, FaQuoteRight
} from "react-icons/fa";
import { ModalButton } from "@/components/common/AuthModal";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import Image from "next/image";

interface EditEventFormProps {
  isNewEvent: boolean;
  formData: EventFormData;
  error: string | null;
  success: string | null;
  imagePreview: string | null;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleFileChange: (file: File | null, isRemoved?: boolean) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  setFieldValue: (name: keyof EventFormData, value: unknown) => void;
  isLoading: boolean;
  isPageLoading: boolean;
}

const EditEventForm: React.FC<EditEventFormProps> = ({
  isNewEvent,
  formData,
  error,
  success,
  imagePreview,
  handleChange,
  handleFileChange,
  handleSubmit,
  setFieldValue,
  isLoading,
  isPageLoading,
}) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [descriptionHistory, setDescriptionHistory] = useState<string[]>([formData.description || ""]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
    const newValue = e.target.value;
    setDescriptionHistory((prev) => [...prev.slice(0, historyIndex + 1), newValue].slice(-20));
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  }, [handleChange, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setFieldValue("description", descriptionHistory[prevIndex]);
      setHistoryIndex(prevIndex);
    }
  }, [historyIndex, descriptionHistory, setFieldValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  useEffect(() => {
    if (formData.description !== descriptionHistory[historyIndex]) {
      setDescriptionHistory((prev) => [...prev.slice(0, historyIndex + 1), formData.description || ""].slice(-20));
      setHistoryIndex((prev) => Math.min(prev + 1, 19));
    }
  }, [formData.description, historyIndex]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) handleFileChange(file);
  }, [handleFileChange]);

  const handleRemoveImage = useCallback(() => {
    handleFileChange(null, true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFileChange]);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFieldValue("status", value);
    if (value === "draft") setFieldValue("published", false);
  }, [setFieldValue]);

  const handlePublishedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFieldValue("published", checked);
    if (checked && formData.status === "draft") setFieldValue("status", "registration_open");
  }, [formData.status, setFieldValue]);

  const handlePreview = useCallback(() => {
    alert("Функция предварительного просмотра находится в разработке.");
  }, []);

  const insertFormatting = useCallback((startTag: string, endTag: string = "") => {
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
      textArea.setSelectionRange(start + startTag.length, start + startTag.length + selectedText.length);
    }, 0);
  }, [setFieldValue]);

  const addHeading = useCallback((level: number = 2) => {
    if (!textAreaRef.current) return;
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    let selectedText = textArea.value.substring(start, end);
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    selectedText = selectedText.replace(/^#+\s*/, '').replace(/\s*#+$/, '');
    const headingPrefix = '#'.repeat(level) + ' ';
    const newText = `${beforeText}${headingPrefix}${selectedText}${afterText}`;
    setFieldValue("description", newText);
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start + headingPrefix.length, start + headingPrefix.length + selectedText.length);
    }, 0);
    setIsHeadingDropdownOpen(false);
  }, [setFieldValue]);

  const toggleHeadingDropdown = useCallback(() => setIsHeadingDropdownOpen((prev) => !prev), []);

  const addBold = useCallback(() => insertFormatting("**"), [insertFormatting]);
  const addItalic = useCallback(() => insertFormatting("*"), [insertFormatting]);
  const addQuote = useCallback(() => insertFormatting("> "), [insertFormatting]);
  const addBulletList = useCallback(() => {
    if (!textAreaRef.current) return;
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    const newText = selectedText.split("\n").map(line => line.trim() ? `- ${line}` : line).join("\n");
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    setFieldValue("description", beforeText + newText + afterText);
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start, start + newText.length);
    }, 0);
  }, [setFieldValue]);

  const addNumberedList = useCallback(() => {
    if (!textAreaRef.current) return;
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    const lines = selectedText.split("\n");
    const newText = lines
      .map((line, index) => (line.trim() ? `${index + 1}. ${line}` : line))
      .join("\n");
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    setFieldValue("description", beforeText + newText + afterText);
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start, start + newText.length); // Исправлено
    }, 0);
  }, [setFieldValue]);
  
  useEffect(() => {
    if (formData.description !== descriptionHistory[historyIndex]) {
      setDescriptionHistory((prev) => [...prev.slice(0, historyIndex + 1), formData.description || ""].slice(-20));
      setHistoryIndex((prev) => Math.min(prev + 1, 19));
    }
  }, [formData.description, historyIndex, descriptionHistory]);

  const addLink = useCallback(() => {
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
  }, [setFieldValue]);

  const increaseTextSize = useCallback(() => {
    if (!textAreaRef.current) return;
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end) || "Текст";
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    const newText = `${beforeText}{+size+}${selectedText}{+size+}${afterText}`;
    setFieldValue("description", newText);
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start + 7, start + 7 + selectedText.length);
    }, 0);
  }, [setFieldValue]);

  const decreaseTextSize = useCallback(() => {
    if (!textAreaRef.current) return;
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end) || "Текст";
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    const newText = `${beforeText}{-size-}${selectedText}{-size-}${afterText}`;
    setFieldValue("description", newText);
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start + 7, start + 7 + selectedText.length);
    }, 0);
  }, [setFieldValue]);

  const availableQuantity = formData.ticket_type_available_quantity || 0;
  const soldQuantity = formData.ticket_type_sold_quantity || 0;
  const remainingQuantity = availableQuantity - soldQuantity;
  const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

  if (isLoading) {
    return <div className="text-center py-10">Загрузка данных мероприятия...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center sm:text-left">
              {isNewEvent ? "Создание мероприятия" : "Редактирование мероприятия"}
            </h1>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors min-w-[120px] min-h-[44px] shrink-0"
            >
              Назад к списку
            </button>
          </div>

          {error && <ErrorDisplay error={error} />}
          {success && <SuccessDisplay message={success} />}

          {!isNewEvent && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
              <h2 className="text-xl font-semibold mb-4">Статистика мероприятия</h2>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="bg-blue-50 p-4 rounded-lg flex-1 min-w-0">
                  <div className="flex items-center mb-2">
                    <FaTicketAlt className="text-blue-500 mr-2" />
                    <h3 className="text-lg font-medium">Билеты</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{soldQuantity} / {availableQuantity}</p>
                  <p className="text-sm text-gray-600">Продано билетов</p>
                  <div className="w-full mt-2">
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between text-xs font-semibold">
                        <span className="py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                          Заполненность: {fillPercentage.toFixed(0)}%
                        </span>
                        <span className="text-blue-600">Осталось: {remainingQuantity}</span>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 max-w-full">
                        <div
                          style={{ width: `${fillPercentage}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg flex-1 min-w-0">
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
                  <p className="text-sm text-gray-600">{formData.published ? "Опубликовано" : "Не опубликовано"}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Название мероприятия*</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Описание</label>
              <div className="relative flex flex-nowrap gap-2 mb-2 bg-gray-100 p-2 rounded-lg overflow-x-auto snap-x">
                <div className="relative snap-start">
                  <button
                    type="button"
                    onClick={toggleHeadingDropdown}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px]"
                    title="Заголовок"
                  >
                    <FaHeading />
                  </button>
                  {isHeadingDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-24">
                      {[1, 2, 3, 4, 5, 6].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => addHeading(level)}
                          className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                        >
                          H{level}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addBold}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Жирный"
                >
                  <FaBold />
                </button>
                <button
                  type="button"
                  onClick={addItalic}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Курсив"
                >
                  <FaItalic />
                </button>
                <button
                  type="button"
                  onClick={addLink}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Ссылка"
                >
                  <FaLink />
                </button>
                <button
                  type="button"
                  onClick={addBulletList}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Маркированный список"
                >
                  <FaListUl />
                </button>
                <button
                  type="button"
                  onClick={addNumberedList}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Нумерованный список"
                >
                  <FaListOl />
                </button>
                <button
                  type="button"
                  onClick={addQuote}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Цитата"
                >
                  <FaQuoteRight />
                </button>
                <button
                  type="button"
                  onClick={increaseTextSize}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Увеличить размер текста"
                >
                  <span className="text-lg">A+</span>
                </button>
                <button
                  type="button"
                  onClick={decreaseTextSize}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] snap-start"
                  title="Уменьшить размер текста"
                >
                  <span className="text-sm">A-</span>
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 disabled:text-gray-400 disabled:hover:bg-gray-100 min-w-[40px] min-h-[40px] snap-start"
                  title="Отменить (Ctrl+Z)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 15L3 9m0 0l6-6M3 9h18" />
                  </svg>
                </button>
              </div>
              <textarea
                name="description"
                value={formData.description || ""}
                onChange={handleDescriptionChange}
                rows={10}
                ref={textAreaRef}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm sm:text-base resize-y min-h-[150px]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Поддерживается Markdown. Используйте кнопки или теги (например, {"{+size+}"}) для размера.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Дата начала*</label>
                <div className="flex items-center">
                  <FaCalendarAlt className="text-gray-400 mr-2 shrink-0" />
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    required
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Время начала*</label>
                <input
                  type="time"
                  name="start_time"
                  value={formData.start_time || ""}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Дата окончания</label>
                <div className="flex items-center">
                  <FaCalendarAlt className="text-gray-400 mr-2 shrink-0" />
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date || ""}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Время окончания</label>
                <input
                  type="time"
                  name="end_time"
                  value={formData.end_time || ""}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Место проведения</label>
              <div className="flex items-center">
                <FaMapMarkerAlt className="text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  name="location"
                  value={formData.location || ""}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  placeholder="Адрес или название места"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
  <div className="flex-1 min-w-0">
    <label className="block text-gray-700 font-medium mb-2">Цена</label>
    <div className="flex items-center">
      <FaMoneyBillWave className="text-gray-400 mr-2 shrink-0 w-5 h-5" />
      <input
        type="number"
        name="price"
        value={formData.price}
        onChange={handleChange}
        min="0"
        step="0.01"
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
      />
    </div>
  </div>
  <div className="flex-1 min-w-0">
    <label className="block text-gray-700 font-medium mb-2">Бесплатная регистрация</label>
    <div className="flex items-center mt-2">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          name="ticket_type_free_registration"
          checked={formData.ticket_type_free_registration}
          onChange={handleChange}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-all duration-200 ease-in-out px-0.5 flex items-center">
          <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transform transition-all duration-200 ease-in-out ${formData.ticket_type_free_registration ? "translate-x-4" : "translate-x-0"}`}></div>
        </div>
        <span className="ml-2 text-gray-700 text-sm" style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)" }}>Да</span>
      </label>
    </div>
  </div>
</div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Тип билета</label>
                <div className="flex items-center">
                  <FaTicketAlt className="text-gray-400 mr-2 shrink-0" />
                  <select
                    name="ticket_type_name"
                    value={formData.ticket_type_name}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  >
                    {Object.values(TicketTypeEnum).map((type) => (
                      <option key={type} value={type}>
                        {type === TicketTypeEnum.free && "Бесплатный"}
                        {type === TicketTypeEnum.standart && "Стандартный"}
                        {type === TicketTypeEnum.vip && "VIP"}
                        {type === TicketTypeEnum.org && "Организаторский"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Количество мест</label>
                <input
                  type="number"
                  name="ticket_type_available_quantity"
                  value={formData.ticket_type_available_quantity}
                  onChange={handleChange}
                  min="0"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Изображение мероприятия</label>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div
                  className={`w-32 h-32 border-2 border-dashed flex items-center justify-center cursor-pointer rounded-lg overflow-hidden shrink-0 ${imagePreview ? "border-transparent" : "border-gray-300 hover:border-blue-500"}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage();
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors min-w-[24px] min-h-[24px]"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ) : (
                    <FaImage className="text-gray-400 text-3xl" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <p className="text-gray-600 text-sm mb-2">
                    Рекомендуемые размеры: 1200x630
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors ml-2 min-w-[120px] min-h-[44px] inline-block mt-2 sm:mt-0"
                    >
                      Выбрать изображение
                    </button>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-8">
  <div className="flex-1 min-w-0">
    <label className="block text-gray-700 font-medium mb-2">Статус мероприятия</label>
    <select
      name="status"
      value={formData.status}
      onChange={handleStatusChange}
      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
    >
      <option value="draft">Черновик</option>
      <option value="registration_open">Регистрация открыта</option>
      <option value="registration_closed">Регистрация закрыта</option>
      <option value="completed">Завершено</option>
    </select>
  </div>
  <div className="flex-1 min-w-0">
    <label className="block text-gray-700 font-medium mb-2">Публикация</label>
    <div className="flex items-center mt-2">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          name="published"
          checked={formData.published}
          onChange={handlePublishedChange}
          disabled={formData.status === "draft"}
          className="sr-only peer"
        />
        <div className="w-9 h-4 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-all duration-200 ease-in-out peer-disabled:bg-gray-200 peer-disabled:opacity-50">
          <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-all duration-200 ease-in-out absolute top-0.5 ${formData.published && formData.status !== "draft" ? "translate-x-5" : "translate-x-0.5"}`}></div>
        </div>
        <span className="ml-2 text-gray-700 text-sm" style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)" }}>
          Опубликовать на сайте
          {formData.status === "draft" && (
            <span className="text-orange-500 ml-2 text-xs" style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)" }}>
              (недоступно для черновиков)
            </span>
          )}
        </span>
      </label>
    </div>
  </div>
</div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors min-w-[120px] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors min-w-[120px] min-h-[44px]"
                >
                  <FaEye className="mr-2" />
                  Предпросмотр
                </button>
              </div>
              <ModalButton
                type="submit"
                disabled={isPageLoading}
                className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
              >
                {isPageLoading ? "Сохранение..." : "Сохранить"}
              </ModalButton>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
};

export default EditEventForm;