"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FaTimes, FaCalendar, FaClock, FaTicketAlt, FaMapMarkerAlt, FaUsers } from "react-icons/fa";

// Интерфейс для данных формы, которые нужны для превью
// (Может отличаться от EventData, т.к. содержит File и числовые строки)
export interface EventFormDataForPreview {
  title: string;
  description?: string;
  start_date: string; // Может быть строка ISO или пустая
  end_date?: string | null; // Может быть строка ISO, null или пустая
  location?: string;
  price: string | number; // Цена может быть строкой или числом из формы
  published?: boolean; // Для определения статуса "Черновик"
  status?: string; // Может быть 'draft', 'registration_open', etc.
  ticket_type_name?: string;
  ticket_type_available_quantity?: string | number;
  image_url?: string | null; // Существующий URL
  image_file?: File | null; // Новый выбранный файл
  remove_image?: boolean; // Флаг удаления изображения
}

interface PreviewEventProps {
  isOpen: boolean;
  onClose: () => void;
  eventData: EventFormDataForPreview | null;
}

// Стили для анимированного градиента
const gradientAnimationStyles = `
  .animated-gradient {
    position: relative;
    overflow: hidden;
  }
  
  .animated-gradient::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(-45deg, #ffe0c0, #ffcc99, #ffac63, #ff8c2d, #ff7700);
    background-size: 400% 400%;
    animation: moveGradient 15s ease infinite;
    z-index: 1;
  }
  
  @keyframes moveGradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  .event-title {
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    z-index: 20;
    position: relative;
  }
`;

// Компонент анимированного градиента вместо изображения
const AnimatedGradientBackground = ({ className = "", children }: { className?: string, children?: React.ReactNode }) => (
  <div className={`w-full h-full animated-gradient relative ${className}`}>
    <style jsx>{gradientAnimationStyles}</style>
    <div className="absolute inset-0 bg-black/20 z-10"></div>
    {children}
  </div>
);

// Универсальная функция для преобразования абсолютного URL к относительному
function toRelativeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url; // если уже относительный путь
  }
}

const PreviewEvent: React.FC<PreviewEventProps> = ({ isOpen, onClose, eventData }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let currentObjectUrl: string | null = null;
    if (eventData?.image_file) {
      currentObjectUrl = URL.createObjectURL(eventData.image_file);
      setObjectUrl(currentObjectUrl);
    } else {
      setObjectUrl(null); // Сбрасываем, если нет нового файла
    }

    return () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [eventData?.image_file]);

  // Формируем URL для отображения (либо blob, либо полный URL с бэкенда)
  const displayImageUrl = useMemo(() => {
    if (objectUrl) return objectUrl; // Приоритет у нового файла
    if (eventData?.image_url && !eventData?.remove_image) {
      // Для next/image всегда возвращаем относительный путь
      return toRelativeImageUrl(eventData.image_url);
    }
    return null; // Нет изображения
  }, [objectUrl, eventData?.image_url, eventData?.remove_image]);

  // --- Форматирование данных для дочерних компонентов ---
  const formattedData = useMemo(() => {
    if (!eventData) return null;

    const { start_date, end_date, price: rawPrice, ticket_type_available_quantity: rawQuantity } = eventData;
    let dateStr = "Не указано";
    let timeStr = "";
    let price = 0;
    let availableQuantity = 0;
    let isFree = false;

    // Парсинг и форматирование дат
    try {
      const startDateObj = start_date ? new Date(start_date) : null;
      const endDateObj = end_date ? new Date(end_date) : null;

      if (startDateObj && !isNaN(startDateObj.getTime())) {
        dateStr = format(startDateObj, "d MMMM yyyy", { locale: ru });
        timeStr = format(startDateObj, "HH:mm", { locale: ru });

        if (endDateObj && !isNaN(endDateObj.getTime())) {
          // Если день тот же, показываем диапазон времени
          if (format(startDateObj, "yyyy-MM-dd") === format(endDateObj, "yyyy-MM-dd")) {
            timeStr += ` - ${format(endDateObj, "HH:mm", { locale: ru })}`;
          } else {
            // Если дни разные, можно добавить дату окончания (опционально)
            // timeStr += ` (до ${format(endDateObj, "d MMM HH:mm", { locale: ru })})`;
          }
        }
      }
    } catch (e) {
      console.error("Error parsing dates for preview:", e);
      dateStr = "Ошибка даты";
    }

    // Парсинг цены
    try {
      const parsedPrice = parseFloat(String(rawPrice));
      if (!isNaN(parsedPrice)) {
        price = parsedPrice;
      }
      isFree = price === 0;
    } catch {
      price = 0;
    }
    
    // Парсинг количества
    try {
        const parsedQuantity = parseInt(String(rawQuantity), 10);
        if (!isNaN(parsedQuantity)) {
            availableQuantity = parsedQuantity;
        }
    } catch {
        availableQuantity = 0;
    }

    return {
      dateStr,
      timeStr,
      price,
      isFree,
      availableQuantity,
    };
  }, [eventData]);
  
   // Определяем статус для отображения в превью
  const displayStatus = useMemo(() => {
    if (!eventData) return "Не определен";
    // Сначала проверяем флаг 'published'
    if (eventData.published === false) return "Черновик (не опубликован)";
    // Затем проверяем статус из формы, если он есть
    if (eventData.status === 'completed') return "Завершено";
    if (eventData.status === 'registration_closed') return "Регистрация закрыта";
    // Если мест 0, но статус 'open' - считаем, что мест нет
    if (eventData.status === 'registration_open' && (formattedData?.availableQuantity ?? 0) <= 0) {
        return "Регистрация закрыта (мест нет)";
    }
    if (eventData.status === 'registration_open') return "Регистрация открыта";
    // По умолчанию (если статус не определен, но published=true)
    return "Опубликовано";
  }, [eventData, formattedData]);

  return (
    <AnimatePresence>
      {isOpen && eventData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose} // Закрытие по клику на overlay
        >
          {/* Кнопка закрытия - улучшенная версия */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="absolute top-4 right-4 z-[60] bg-white shadow-lg hover:shadow-xl rounded-full w-10 h-10 flex items-center justify-center transition-all duration-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
            aria-label="Закрыть"
          >
            <FaTimes className="text-gray-800 text-lg transition-colors duration-300 hover:text-orange-500" />
          </motion.button>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие по клику на контент
          >
            {/* --- Контент превью (аналогично page.tsx) --- */}
            <main className="flex-grow">
              {/* Обложка */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative h-[400px] w-full mb-8"
              >
                <div className="relative h-full w-full rounded-t-xl overflow-hidden">
                  {displayImageUrl ? (
                    <Image
                      src={displayImageUrl}
                      alt={eventData.title || 'Превью мероприятия'}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <AnimatedGradientBackground />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <motion.h1
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-4xl font-bold text-white text-center px-4 max-w-[90vw] event-title"
                      style={{ fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }}
                    >
                      {eventData.title}
                    </motion.h1>
                  </div>
                </div>
              </motion.section>

              <div className="container mx-auto px-6 pb-12">
                {/* Информация о мероприятии */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  {/* Карточка информации о мероприятии */}
                  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold text-center mb-6">Информация о мероприятии</h2>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex items-start">
                        <div className="text-orange-500 mr-4 text-2xl">
                          <FaCalendar />
                        </div>
                        <div>
                          <div className="text-gray-500">Дата</div>
                          <div>{formattedData?.dateStr}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="text-orange-500 mr-4 text-2xl">
                          <FaClock />
                        </div>
                        <div>
                          <div className="text-gray-500">Время</div>
                          <div>{formattedData?.timeStr || "15:00 - 18:00"}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="text-orange-500 mr-4 text-2xl">
                          <FaMapMarkerAlt />
                        </div>
                        <div>
                          <div className="text-gray-500">Место</div>
                          <div>{eventData.location || "Адрес не указан"}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="text-orange-500 mr-4 text-2xl">
                          <FaTicketAlt />
                        </div>
                        <div>
                          <div className="text-gray-500">Стоимость</div>
                          <div className="text-green-500">{formattedData?.price === 0 ? 'Свободный взнос' : `${formattedData?.price ?? 0} ₽`}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Блок регистрации */}
                  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">{displayStatus}</h2>
                      <button 
                        className="mt-4 md:mt-0 bg-gray-200 text-gray-500 rounded-md py-2 px-6 font-medium cursor-not-allowed"
                        disabled
                      >
                        Забронировать
                      </button>
                    </div>
                    
                    <div className="flex items-center mb-4">
                      <div className="flex items-center text-orange-500 mr-2">
                        <FaUsers className="text-2xl" />
                      </div>
                      <div>Места распределены</div>
                    </div>
                    
                    {/* Нумерация мест */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <div 
                          key={num} 
                          className="w-8 h-8 rounded-md flex items-center justify-center text-sm bg-gray-100"
                        >
                          {num}
                        </div>
                      ))}
                      <div className="text-sm text-gray-500 ml-1 flex items-center">
                        + распределено
                      </div>
                    </div>
                    
                    <div className="mt-4 text-center">
                      <div className="bg-orange-50 rounded-full py-2 px-4">
                        Для бронирования билета <a href="#" className="text-orange-500 font-medium">войдите в аккаунт</a>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Описание мероприятия */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8"
                >
                  <h3 className="text-2xl font-semibold mb-4">Описание</h3>
                  <div className="text-gray-700">
                    <p>МЕЛА</p>
                  </div>
                </motion.div>
              </div>
            </main>
            {/* --- Конец контента превью --- */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PreviewEvent;
