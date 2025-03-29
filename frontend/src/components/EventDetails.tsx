// frontend/src/components/EventDetails.tsx
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
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-gray-800 text-center">
        Информация о мероприятии
      </h2>
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaCalendarAlt className="text-orange-500 mr-3 w-5 h-5" />
            <span className="text-gray-600 font-medium text-base">Дата</span>
          </div>
          <span className="text-gray-800 text-base">{date}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaClock className="text-orange-500 mr-3 w-5 h-5" />
            <span className="text-gray-600 font-medium text-base">Время</span>
          </div>
          <span className="text-gray-800 text-base">{time}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaMapMarkerAlt className="text-orange-500 mr-3 w-5 h-5" />
            <span className="text-gray-600 font-medium text-base">Место</span>
          </div>
          <span className="text-gray-800 text-base">{location}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between"
        >
          <div className="flex items-center mb-2 sm:mb-0">
            <FaRubleSign className="text-orange-500 mr-3 w-5 h-5" />
            <span className="text-gray-600 font-medium text-base">Стоимость</span>
          </div>
          <span className="font-medium text-base">
            {freeRegistration ? (
              <span className="text-green-600">Бесплатно</span>
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