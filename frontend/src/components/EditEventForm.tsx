"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { EventFormData, TicketTypeEnum } from "@/types/events";
import {
  FaCalendarAlt, FaMapMarkerAlt, FaMoneyBillWave, FaTicketAlt,
  FaImage, FaTrash, FaEye, FaBold, FaItalic, FaLink, FaListUl,
  FaListOl, FaHeading, FaQuoteRight, FaSync
} from "react-icons/fa";
import { ModalButton } from "@/components/common/AuthModal";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import Image from "next/image";
import Switch from "@/components/common/Switch";
import { createPortal } from "react-dom";

interface EditEventFormProps {
  isNewEvent: boolean;
  formData: EventFormData;
  error: string | null;
  success: string | null;
  imagePreview: string | null;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleFileChange: (file: File | null, isRemoved?: boolean) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setFieldValue: (name: keyof EventFormData, value: unknown) => void;
  isLoading: boolean;
  isPageLoading: boolean;
  setImagePreview: (url: string | null) => void;
  setIsPageLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
  refreshEventData?: () => void;
}

// Вспомогательная функция для проверки токена локально
const validateTokenLocally = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload && payload.exp && payload.exp > now;
  } catch (e) {
    console.error("Error validating token locally:", e);
    return false;
  }
};

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
  setImagePreview,
  setIsPageLoading,
  setError,
  setSuccess,
  refreshEventData
}) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const headingButtonRef = useRef<HTMLButtonElement>(null);
  const [descriptionHistory, setDescriptionHistory] = useState<string[]>([formData.description || ""]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false);
  const [selectedHeadingLevel, setSelectedHeadingLevel] = useState<number>(2);
  const [imageError, setImageError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<{ isValid: boolean | null; message: string | null }>({ isValid: null, message: null });
  
  // Обновляем локальные состояния при изменении пропсов
  useEffect(() => {
    setLocalError(error);
  }, [error]);
  
  useEffect(() => {
    setLocalSuccess(success);
  }, [success]);
  
  // Refs для отслеживания состояния компонента
  const isMountedRef = useRef(true);
  const isVerifyingRef = useRef(false);

  // const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  //   if (e.target.value === "0") {
  //     e.target.value = "";
  //   }
  // };

  // const handleNumberBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  //   if (e.target.value === "") {
  //     setFieldValue(e.target.name as keyof EventFormData, 0);
  //   }
  // };

  const handleHeadingSelect = (level: number) => {
    setSelectedHeadingLevel(level);
    if (textAreaRef.current) {
      const textArea = textAreaRef.current;
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const selectedText = textArea.value.substring(start, end) || "Заголовок";
      const beforeText = textArea.value.substring(0, start);
      const afterText = textArea.value.substring(end);
      const headingPrefix = "#".repeat(level) + " ";
      const newText = `${beforeText}${headingPrefix}${selectedText}${afterText}`;
      setFieldValue("description", newText);
      setDescriptionHistory(prev => [...prev.slice(0, historyIndex + 1), newText].slice(-20));
      setHistoryIndex(prev => prev + 1);
      setTimeout(() => {
        textArea.focus();
        textArea.setSelectionRange(
          start + headingPrefix.length,
          start + headingPrefix.length + selectedText.length
        );
      }, 0);
    }
    setIsHeadingDropdownOpen(false);
  };

  const applyFormatting = (format: string, defaultText = "Текст") => {
    if (!textAreaRef.current) return;
    const textArea = textAreaRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end) || defaultText;
    const beforeText = textArea.value.substring(0, start);
    const afterText = textArea.value.substring(end);
    let newText = "";

    switch (format) {
      case "bold": newText = `${beforeText}**${selectedText}**${afterText}`; break;
      case "italic": newText = `${beforeText}*${selectedText}*${afterText}`; break;
      case "quote": newText = `${beforeText}> ${selectedText}${afterText}`; break;
      case "bullet": 
        newText = `${beforeText}${selectedText.split("\n").map(line => 
          line.trim() ? `- ${line}` : line).join("\n")}${afterText}`; 
        break;
      case "numbered": 
        newText = `${beforeText}${selectedText.split("\n").map((line, i) => 
          line.trim() ? `${i + 1}. ${line}` : line).join("\n")}${afterText}`; 
        break;
      case "link": newText = `${beforeText}[${selectedText}](url)${afterText}`; break;
      case "size+": newText = `${beforeText}{+size+}${selectedText}{+size+}${afterText}`; break;
      case "size-": newText = `${beforeText}{-size-}${selectedText}{-size-}${afterText}`; break;
      case "heading":
        const headingPrefix = "#".repeat(selectedHeadingLevel) + " ";
        newText = `${beforeText}${headingPrefix}${selectedText}${afterText}`;
        break;
      default: return;
    }

    setFieldValue("description", newText);
    setDescriptionHistory(prev => [...prev.slice(0, historyIndex + 1), newText].slice(-20));
    setHistoryIndex(prev => prev + 1);
    setTimeout(() => {
      textArea.focus();
      if (format === "heading") {
        const prefixLength = selectedHeadingLevel + 1;
        textArea.setSelectionRange(start + prefixLength, start + prefixLength + selectedText.length);
      } else if (format === "link") {
        textArea.setSelectionRange(start + 1, start + 1 + selectedText.length);
      } else {
        textArea.setSelectionRange(start + 2, start + 2 + selectedText.length);
      }
    }, 0);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
    const newValue = e.target.value;
    setDescriptionHistory(prev => [...prev.slice(0, historyIndex + 1), newValue].slice(-20));
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setFieldValue("description", descriptionHistory[historyIndex - 1]);
    }
  }, [historyIndex, descriptionHistory, setFieldValue])

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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Изображение слишком большое. Максимальный размер 5MB.");
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setImageError("Пожалуйста, загрузите изображение.");
        return;
      }
      
      setImageError(null);
      handleFileChange(file);
    }
  };

  const handleRemoveImage = () => {
    handleFileChange(null, true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImageError(null);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as EventFormData["status"];
    setFieldValue("status", value);
    if (value === "draft") setFieldValue("published", false);
  };

  const handlePublishedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFieldValue("published", checked);
    if (checked && formData.status === "draft") setFieldValue("status", "registration_open");
  };

  const handlePreview = () => {
    alert("Функция предварительного просмотра находится в разработке.");
  };

  // Обработчики для даты и времени
  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Проверяем, является ли имя поля допустимым ключом для EventFormData
    if (name === "start_date" || name === "start_time" || name === "end_date" || name === "end_time") {
      // Сначала обновляем значение в форме
      setFieldValue(name as keyof EventFormData, value);
      
      // Проверка только для изменения даты начала
      if (name === "start_date") {
        // Если дата окончания не задана или меньше даты начала, устанавливаем её равной дате начала
        if (!formData.end_date || new Date(value) > new Date(formData.end_date)) {
          setFieldValue("end_date", value);
        }
      }
      
      // Обновляем полные datetime значения
      updateDateTimeFields();
    }
  };
  
  // Функция для форматирования даты и времени в формат ISO
  const formatDateTime = (date: string, time: string): string => {
    if (!date || !time) return '';
    
    try {
      // Создаем объект Date из комбинации даты и времени
      const dateTime = new Date(`${date}T${time}`);
      
      // Проверяем, что дата валидная
      if (isNaN(dateTime.getTime())) {
        console.warn('Невалидная дата/время', { date, time });
        return '';
      }
      
      // Возвращаем в формате ISO
      return dateTime.toISOString();
    } catch (e) {
      console.error('Ошибка при форматировании даты/времени', e);
      return '';
    }
  };

  // Функция для обновления полных datetime полей
  const updateDateTimeFields = useCallback(() => {
    // Обновляем значение даты и времени начала
    if (formData.start_date && formData.start_time) {
      const startIso = formatDateTime(formData.start_date, formData.start_time);
      if (startIso) {
        setFieldValue('start_datetime', startIso);
      }
    }
    
    // Обновляем значение даты и времени окончания
    if (formData.end_date && formData.end_time) {
      const endIso = formatDateTime(formData.end_date, formData.end_time);
      if (endIso) {
        setFieldValue('end_datetime', endIso);
      }
    }
  }, [formData.start_date, formData.start_time, formData.end_date, formData.end_time, setFieldValue]);

  // Эффект для обновления полных datetime значений при загрузке формы
  useEffect(() => {
    // При первоначальной загрузке или изменении даты/времени
    updateDateTimeFields();
  }, [updateDateTimeFields]);
  
  // Отдельные обработчики для каждого поля
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleDateTimeChange(e);
  };
  
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleDateTimeChange(e);
  };
  
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleDateTimeChange(e);
  };
  
  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleDateTimeChange(e);
  };

  // Проверка валидности времени (вызывается, когда пользователь переключается на другое поле)
  const validateDateTime = () => {
    if (!formData.start_date || !formData.end_date || !formData.start_time || !formData.end_time) {
      return true; // Если какое-то из полей не заполнено, валидация не требуется
    }
    
    // Создаём объекты Date для корректного сравнения
    const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
    const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);
    
    // Если даты разные, сравниваем даты целиком
    if (formData.start_date !== formData.end_date) {
      return startDateTime <= endDateTime;
    }
    
    // Если даты одинаковые, сравниваем только времена
    return startDateTime <= endDateTime;
  };

  // Обработчик потери фокуса для полей даты и времени
  const handleDateTimeBlur = () => {
    if (!validateDateTime()) {
      setLocalError("Время окончания не может быть раньше времени начала");
      setTimeout(() => setLocalError(null), 3000);
    } else {
      // Явно вызываем функцию обновления полных datetime значений
      updateDateTimeFields();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        headingButtonRef.current &&
        !headingButtonRef.current.contains(event.target as Node)
      ) {
        setIsHeadingDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableQuantity = formData.ticket_type_available_quantity || 0;
  const soldQuantity = formData.ticket_type_sold_quantity || 0;
  const remainingQuantity = availableQuantity - soldQuantity;
  const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

  // Add restoration of saved form data
  useEffect(() => {
    // Check if we have saved form data from a previous session
    const savedFormData = localStorage.getItem('event_form_draft');
    if (savedFormData && isNewEvent) {
      try {
        const parsedData = JSON.parse(savedFormData);
        
        // Check if the data is valid by looking for required fields
        if (parsedData.title && parsedData.start_date) {
          // Restore form data
          for (const key in parsedData) {
            if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
              setFieldValue(key as keyof EventFormData, parsedData[key]);
            }
          }
          
          // If there was an image preview, restore it
          if (parsedData.image_url) {
            setImagePreview(parsedData.image_url);
          }
          
          // Show notification to user
          setLocalSuccess("Форма восстановлена из сохраненного черновика");
        }
      } catch (e) {
        console.error("Error restoring form data:", e);
      }
    }
  }, [isNewEvent, setFieldValue, setImagePreview]);

  // Session checking effect that avoids state updates during render
  useEffect(() => {
    // Используем refs, объявленные на уровне компонента
    let sessionCheckInterval: NodeJS.Timeout;
    
    // Function to verify admin session
    const verifySession = async () => {
      // Prevent concurrent verification attempts
      if (!isMountedRef.current || isVerifyingRef.current) return;
      isVerifyingRef.current = true;
      
      try {
        // Вместо вызова checkAdminSession напрямую, проверяем токен локально
        const token = localStorage.getItem("admin_token");
        let isActive = false;
        
        if (token) {
          isActive = validateTokenLocally(token);
          console.log(`EditEventForm: Session validation result: ${isActive}`);
        }
        
        // Only proceed if component is still mounted
        if (!isMountedRef.current) return;
        
        // Handle session expiration
        if (!isActive) {
          // Save form data before redirecting
          localStorage.setItem('event_form_draft', JSON.stringify(formData));
          
          // Redirect with delay to allow rendering to complete
          setTimeout(() => {
            router.push("/admin-login");
          }, 1500);
        }
      } catch (e) {
        console.error("Error checking session:", e);
      } finally {
        // Reset verification flag only if component is still mounted
        if (isMountedRef.current) {
          isVerifyingRef.current = false;
        }
      }
    };
    
    // Schedule initial verification with delay to avoid render-time state updates
    const initialCheckTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        verifySession();
      }
    }, 3000);
    
    // Set up interval for periodic checks with more delay
    const intervalSetupTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        sessionCheckInterval = setInterval(verifySession, 5 * 60 * 1000);
      }
    }, 6000);
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      clearTimeout(initialCheckTimeout);
      clearTimeout(intervalSetupTimeout);
      clearInterval(sessionCheckInterval);
    };
  }, [router, formData]);

  // Эффект для обработки размонтирования компонента
  useEffect(() => {
    return () => {
      // Устанавливаем флаг, что компонент размонтирован
      isMountedRef.current = false;
    };
  }, []);

  // Обработчик нажатия на кнопку "Отмена"
  const handleCancel = () => {
    // Сбрасываем локальные сообщения об ошибках и успехе
    setLocalError(null);
    setLocalSuccess(null);
    // Также сбрасываем глобальные сообщения
    setError(null);
    setSuccess(null);
    router.push("/dashboard");
  };

  // Упрощенная валидация URL slug
  const validateSlug = useCallback((slug: string) => {
    // Если слаг пустой или слишком короткий, не валидируем
    if (!slug || slug.length < 3) {
      setSlugStatus({ 
        isValid: null,
        message: slug ? "URL должен быть не менее 3 символов" : null 
      });
      return;
    }
    
    // Проверка на наличие не-латинских символов
    if (/[^\x00-\x7F]/.test(slug)) {
      setSlugStatus({
        isValid: false,
        message: "URL может содержать только латинские буквы, цифры и дефисы"
      });
      return;
    }
    
    // Проверка на недопустимые символы (разрешены только буквы, цифры и дефисы)
    const cleanedSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (cleanedSlug !== slug.toLowerCase()) {
      setSlugStatus({
        isValid: false,
        message: "URL может содержать только латинские буквы, цифры и дефисы"
      });
      return;
    }
    
    // Проверка на зарезервированные слова
    const reservedSlugs = ['admin', 'api', 'dashboard', 'auth', 'login', 'register', 'settings', 'profile'];
    const slugLower = slug.toLowerCase();
    
    for (const reserved of reservedSlugs) {
      if (slugLower === reserved || slugLower.startsWith(`${reserved}-`)) {
        setSlugStatus({
          isValid: false,
          message: `URL содержит зарезервированное слово "${reserved}"`
        });
        return;
      }
    }
    
    // Если все проверки пройдены, слаг валиден
    setSlugStatus({ 
      isValid: true, 
      message: "URL доступен" 
    });
  }, []);
  
  // Упрощенная валидация slug при изменении
  useEffect(() => {
    if (formData.url_slug) {
      validateSlug(formData.url_slug);
    } else {
      setSlugStatus({ isValid: null, message: null });
    }
  }, [formData.url_slug, validateSlug]);

  // Упрощенный обработчик изменения url_slug
  const handleUrlSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Фильтруем ввод, оставляем только допустимые символы (a-z, 0-9, дефис)
    // НЕ заменяем недопустимые символы на дефисы, а просто игнорируем их
    const validChars = rawValue.split('').filter(char => /[a-z0-9-]/.test(char));
    const cleanedSlug = validChars.join('').toLowerCase();
    
    // Обновляем значение в форме
    setFieldValue('url_slug', cleanedSlug);
    
    // Помечаем как измененное пользователем
    setFieldValue('url_slug_changed', true);
  }, [setFieldValue]);

  // Используем setIsPageLoading при загрузке компонента
  useEffect(() => {
    setIsPageLoading(isPageLoading);
    return () => {
      setIsPageLoading(false);
    };
  }, [isPageLoading, setIsPageLoading]);

  // Модифицируем обработчик отправки формы для корректного форматирования даты и времени
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      // Обрабатываем дату и время начала
      if (formData.start_date && formData.start_time) {
        // Создаем корректную строку даты-времени для API
        const startDateTime = `${formData.start_date}T${formData.start_time}:00`;
        setFieldValue("start_datetime", startDateTime);
      }
      
      // Обрабатываем дату и время окончания, если они заданы
      if (formData.end_date && formData.end_time) {
        // Создаем корректную строку даты-времени для API
        const endDateTime = `${formData.end_date}T${formData.end_time}:00`;
        setFieldValue("end_datetime", endDateTime);
      }
      
      // Вызываем оригинальный обработчик с существующими данными формы
      // Так как setFieldValue обновляет formData, все новые значения уже будут в handleSubmit
      await handleSubmit(e);
    } catch (error) {
      console.error("Error processing form submission:", error);
      setLocalError("Ошибка при обработке формы. Пожалуйста, проверьте введенные данные.");
    }
  };

  if (isLoading) {
    return <FormSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
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
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors min-w-[120px] min-h-[44px]"
              >
                Отмена
              </button>
              {!isNewEvent && refreshEventData && (
                <button
                  type="button"
                  onClick={refreshEventData}
                  className="flex items-center justify-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors min-w-[120px] min-h-[44px]"
                >
                  <FaSync className="mr-2" />
                  Обновить
                </button>
              )}
              <button
                type="button"
                onClick={handlePreview}
                className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors min-w-[120px] min-h-[44px]"
              >
                <FaEye className="mr-2" />
                Предпросмотр
              </button>
            </div>
          </div>

          {localError && (
            <ErrorDisplay
              error={localError}
              className="mb-4"
            />
          )}
          
          {localSuccess && (
            <SuccessDisplay 
              message={localSuccess}
              className="mb-4"
            />
          )}

          {!isNewEvent && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
              <h2 className="text-xl font-semibold mb-4">Статистика мероприятия</h2>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="bg-blue-50 p-4 rounded-lg flex-1 min-w-0">
                  <div className="flex items-center mb-2">
                    <FaTicketAlt className="text-blue-500 mr-2" />
                    <h3 className="text-lg font-medium">Билеты</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-2xl font-bold text-blue-600">{soldQuantity} / {availableQuantity}</p>
                  </div>
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

          <form onSubmit={onSubmit} className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
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
              <div className="flex flex-nowrap gap-2 mb-2 bg-gray-100 p-2 rounded-lg overflow-x-auto snap-x">
                <div className="relative flex items-center snap-start">
                  <button
                    type="button"
                    onClick={() => applyFormatting("heading")}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                    title="Заголовок"
                  >
                    <span className="flex items-center">
                      <FaHeading className="mr-1" />
                      <span className="text-xs">{selectedHeadingLevel}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    ref={headingButtonRef}
                    onClick={() => setIsHeadingDropdownOpen(prev => !prev)}
                    className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[20px] min-h-[40px] flex items-center justify-center"
                    title="Выбрать уровень заголовка"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => applyFormatting("bold")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Жирный"
                >
                  <FaBold />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("italic")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Курсив"
                >
                  <FaItalic />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("link")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Ссылка"
                >
                  <FaLink />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("bullet")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Маркированный список"
                >
                  <FaListUl />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("numbered")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Нумерованный список"
                >
                  <FaListOl />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("quote")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Цитата"
                >
                  <FaQuoteRight />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("size+")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Увеличить размер"
                >
                  <span className="text-lg">A+</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("size-")}
                  className="p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Уменьшить размер"
                >
                  <span className="text-sm">A-</span>
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                  className={`p-2 rounded hover:bg-gray-200 text-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center ${historyIndex === 0 ? "text-gray-400 cursor-not-allowed" : ""}`}
                  title="Отменить (Ctrl+Z)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 15L3 9m0 0l6-6M3 9h18" />
                  </svg>
                </button>
              </div>

              {isHeadingDropdownOpen && headingButtonRef.current && createPortal(
                <div
                  className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-24"
                  style={{
                    top: headingButtonRef.current.getBoundingClientRect().bottom + window.scrollY,
                    left: headingButtonRef.current.getBoundingClientRect().left,
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleHeadingSelect(level)}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${selectedHeadingLevel === level ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
                    >
                      H{level}
                    </button>
                  ))}
                </div>,
                document.body
              )}

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
                    onChange={handleStartDateChange}
                    onBlur={handleDateTimeBlur}
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
                  onChange={handleStartTimeChange}
                  onBlur={handleDateTimeBlur}
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
                    onChange={handleEndDateChange}
                    onBlur={handleDateTimeBlur}
                    min={formData.start_date}
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
                  onChange={handleEndTimeChange}
                  onBlur={handleDateTimeBlur}
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

            <div className="mb-6">
              <div className="flex flex-col sm:flex-row gap-2 mb-1">
                <label htmlFor="url_slug" className="text-sm font-medium text-gray-700">
                  URL мероприятия <span className="text-red-500">*</span>
                </label>
                {slugStatus.isValid === true && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {slugStatus.message}
                  </span>
                )}
                {slugStatus.isValid === false && slugStatus.message && (
                  <span className="text-xs text-red-600 font-medium">
                    {slugStatus.message}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  id="url_slug"
                  name="url_slug"
                  value={formData.url_slug || ""}
                  onChange={handleUrlSlugChange}
                  className={`w-full p-3 pl-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 min-h-[44px] ${
                    slugStatus.isValid === false || (localError && localError.includes("URL не был изменен"))
                      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                      : slugStatus.isValid === true
                      ? "border-green-300 focus:border-green-400 focus:ring-green-200"
                      : "border-gray-300 focus:border-gray-400 focus:ring-gray-200"
                  }`}
                  placeholder={isNewEvent ? "kirtan-mela" : "базовая часть адреса (год и ID добавляются автоматически)"}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {slugStatus.isValid === true && (
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {slugStatus.isValid === false && (
                    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Пример URL на сайте: 
                <strong>/events/{formData.url_slug || "ваш-слаг"}{formData.start_date ? `-${formData.start_date}` : '-ГГГГ-ММ-ДД'}</strong>
                <span className="text-gray-600">?id={formData.id || "ID"}</span>
                <br/>
                <span className="text-gray-400">Введите только базовую часть URL (дата и ID добавляются автоматически).</span>
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="flex-1 min-w-0">
                <label className="block text-gray-700 font-medium mb-2">Цена</label>
                <div className="flex items-center">
                  <FaMoneyBillWave className="text-gray-400 mr-2 shrink-0 w-5 h-5" />
                  <input
                    id="price"
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
                        onError={() => {
                          // If image fails to load, remove it and show error
                          handleRemoveImage();
                          setImageError("Ошибка загрузки изображения. Пожалуйста, выберите другой файл.");
                        }}
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
                  {imageError && (
                    <p className="text-red-500 text-sm mt-1">{imageError}</p>
                  )}
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
                  <Switch
                    name="published"
                    checked={formData.published}
                    onChange={handlePublishedChange}
                    disabled={formData.status === "draft"}
                    label={
                      <>
                        Опубликовать на сайте
                        {formData.status === "draft" && (
                          <span className="text-orange-500 ml-2 text-xs" style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)" }}>
                            (недоступно для черновиков)
                          </span>
                        )}
                      </>
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={handleCancel}
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

export const FormSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md">
            {/* Заголовок */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="h-8 bg-gray-300 rounded w-64 mb-4 animate-pulse"></div>
              <div className="flex gap-4">
                <div className="h-10 bg-gray-300 rounded w-28 animate-pulse"></div>
                <div className="h-10 bg-gray-300 rounded w-28 animate-pulse"></div>
              </div>
            </div>
            
            {/* Основная форма */}
            <div className="bg-white p-8 rounded-lg mb-6">
              {/* Поля формы */}
              <div className="mb-8">
                <div className="h-5 bg-gray-300 rounded w-40 mb-2 animate-pulse"></div>
                <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 mb-8">
                <div className="flex-1">
                  <div className="h-5 bg-gray-300 rounded w-40 mb-2 animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-300 rounded w-40 mb-2 animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
              </div>
              
              <div className="mb-8">
                <div className="h-5 bg-gray-300 rounded w-40 mb-2 animate-pulse"></div>
                <div className="h-36 bg-gray-200 rounded w-full animate-pulse"></div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 mb-8">
                <div className="flex-1">
                  <div className="h-5 bg-gray-300 rounded w-40 mb-2 animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-300 rounded w-40 mb-2 animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
              </div>
              
              {/* Кнопки внизу */}
              <div className="flex justify-end gap-4">
                <div className="h-10 bg-gray-300 rounded w-28 animate-pulse"></div>
                <div className="h-10 bg-blue-300 rounded w-28 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditEventForm;