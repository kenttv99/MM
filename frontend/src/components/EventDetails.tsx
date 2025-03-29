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
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 text-center">
        Информация о мероприятии
      </h2>
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between border-b border-gray-100 pb-3"
        >
          <div className="flex items-center">
            <FaCalendarAlt className="text-orange-500 mr-3" size={20} />
            <span className="text-gray-600 font-medium">Дата</span>
          </div>
          <span className="text-gray-800">{date}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center justify-between border-b border-gray-100 pb-3"
        >
          <div className="flex items-center">
            <FaClock className="text-orange-500 mr-3" size={20} />
            <span className="text-gray-600 font-medium">Время</span>
          </div>
          <span className="text-gray-800">{time}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex items-center justify-between border-b border-gray-100 pb-3"
        >
          <div className="flex items-center">
            <FaMapMarkerAlt className="text-orange-500 mr-3" size={20} />
            <span className="text-gray-600 font-medium">Место</span>
          </div>
          <span className="text-gray-800">{location}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center">
            <FaRubleSign className="text-orange-500 mr-3" size={20} />
            <span className="text-gray-600 font-medium">Стоимость</span>
          </div>
          <span className="font-medium">
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