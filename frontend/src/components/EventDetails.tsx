"use client";

import React from "react";
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { motion } from "framer-motion";
import { EventDetailsProps } from "@/types/index";

// Функции форматирования для отображения даты и времени
const formatDateForDisplay = (dateString: string): string => {
  try {
    if (!dateString || dateString === "Загрузка...") {
      return dateString || "";
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn("Invalid date in formatDateForDisplay:", dateString);
      return dateString; // Возвращаем строку как есть, если она не форматируемая
    }
    
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch (error) {
    console.error("Error in formatDateForDisplay:", error);
    return dateString || "";
  }
};

// Функция для форматирования времени
const formatTimeForDisplay = (dateString: string): string => {
  try {
    if (!dateString || dateString === "Загрузка...") {
      return dateString || "";
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn("Invalid date in formatTimeForDisplay:", dateString);
      return "";
    }
    
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch (error) {
    console.error("Error in formatTimeForDisplay:", error);
    return "";
  }
};

// Функция для проверки, являются ли даты одним и тем же днем
const isSameDay = (date1: string, date2: string): boolean => {
  try {
    if (!date1 || !date2 || date1 === "Загрузка..." || date2 === "Загрузка...") {
      return false;
    }
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return false;
    }
    
    return d1.getFullYear() === d2.getFullYear() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getDate() === d2.getDate();
  } catch (error) {
    console.error("Error in isSameDay:", error);
    return false;
  }
};

// Функция для форматирования временного интервала - используется утилитами приложения
export const formatTimeInterval = (startDate: string, endDate?: string): string => {
  try {
    if (!startDate || startDate === "Загрузка...") {
      return startDate || "";
    }
    
    const startTime = formatTimeForDisplay(startDate);
    
    if (!startTime) {
      return "";
    }
    
    if (!endDate) {
      return startTime;
    }

    const endTime = formatTimeForDisplay(endDate);
    
    if (!endTime) {
      return startTime;
    }
    
    if (isSameDay(startDate, endDate)) {
      // Если одинаковые дни, показываем "10:00 - 12:00"
      return `${startTime} - ${endTime}`;
    } else {
      // Если разные дни, показываем с датами "10 мая 10:00 - 11 мая 12:00"
      return `${formatDateForDisplay(startDate)} ${startTime} - ${formatDateForDisplay(endDate)} ${endTime}`;
    }
  } catch (e) {
    console.error("Error formatting time interval:", e);
    return "";
  }
};

const EventDetails: React.FC<EventDetailsProps> = ({
  date,
  time,
  location,
  price,
  freeRegistration,
}) => {
  const isLoading = date === "Загрузка..." || time === "Загрузка...";
  
  // Обработка времени, если date и time представлены как объекты Date или строки ISO
  const formattedDate = typeof date === 'string' ? 
    (date.includes('T') && date !== "Загрузка..." ? formatDateForDisplay(date) : date) : 
    date;
    
  const formattedTime = typeof time === 'string' ? 
    (/^\d{2}:\d{2}$/.test(time) || /^\d{2}:\d{2} - \d{2}:\d{2}$/.test(time) || time === "Загрузка..." ? 
      time : formatTimeForDisplay(time)) : 
    time;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto overflow-hidden">
      <h2
        className="text-xl sm:text-2xl font-semibold mb-6 text-gray-800 text-center"
        style={{ fontSize: "clamp(1.25rem, 3vw, 1.5rem)" }}
      >
        Информация о мероприятии
      </h2>
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3 gap-2"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaCalendarAlt className="text-orange-500 mr-3 w-5 h-5 min-w-[20px]" />
            <span className="text-gray-600 font-medium" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
              Дата
            </span>
          </div>
          <span className={`text-gray-800 ${isLoading ? "animate-pulse" : ""}`} style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
            {formattedDate || (isLoading ? "Загрузка..." : "Не указано")}
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3 gap-2"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaClock className="text-orange-500 mr-3 w-5 h-5 min-w-[20px]" />
            <span className="text-gray-600 font-medium" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
              Время
            </span>
          </div>
          <span className={`text-gray-800 ${isLoading ? "animate-pulse" : ""}`} style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
            {formattedTime || (isLoading ? "Загрузка..." : "Не указано")}
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3 gap-2"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaMapMarkerAlt className="text-orange-500 mr-3 w-5 h-5 min-w-[20px]" />
            <span className="text-gray-600 font-medium" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
              Место
            </span>
          </div>
          <span className="text-gray-800" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{location}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaRubleSign className="text-orange-500 mr-3 w-5 h-5 min-w-[20px]" />
            <span className="text-gray-600 font-medium" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
              Стоимость
            </span>
          </div>
          <span className="font-medium" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
            {freeRegistration ? (
              <span className="text-green-600">Бесплатно</span>
            ) : price === 0 ? (
              <span className="text-green-600">Свободный взнос</span>
            ) : (
              `${price} ₽`
            )}
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default EventDetails;