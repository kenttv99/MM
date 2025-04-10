"use client";

import React from "react";
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { motion } from "framer-motion";
import { EventDetailsProps } from "@/types/index";

const EventDetails: React.FC<EventDetailsProps> = ({
  date,
  time,
  location,
  price,
  freeRegistration,
}) => {
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
          <span className="text-gray-800" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{date}</span>
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
          <span className="text-gray-800" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{time}</span>
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