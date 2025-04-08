// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { FaTicketAlt, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { EventRegistrationProps } from "@/types/index";
import { apiFetch } from "@/utils/api";

const EventRegistration: React.FC<EventRegistrationProps> = ({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  availableQuantity,
  soldQuantity,
  price,
  freeRegistration,
  onBookingClick,
  onLoginClick,
  onBookingSuccess,
  displayStatus,
}) => {
  const { userData, isAuth } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  const remainingQuantity = availableQuantity - soldQuantity;
  const maxVisibleSeats = 10;
  const seatsArray = Array.from(
    { length: Math.min(remainingQuantity, maxVisibleSeats) },
    (_, index) => index
  );

  const isRegistrationClosedOrCompleted =
    displayStatus === "Регистрация закрыта" || displayStatus === "Мероприятие завершено";

  const handleConfirmBooking = async () => {
    setError(undefined);
    setSuccess(undefined);

    try {
      // Check if registration is closed or completed
      if (isRegistrationClosedOrCompleted) {
        throw new Error("Регистрация на это мероприятие закрыта");
      }

      // Check if there are available tickets
      if (remainingQuantity <= 0) {
        throw new Error("К сожалению, все билеты уже распроданы");
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      console.log('Sending registration request with data:', {
        event_id: parseInt(eventId),
        user_id: userData!.id
      });

      // Use the correct endpoint format with standard fetch for better debugging
      const response = await fetch('/registration/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_id: parseInt(eventId),
          user_id: userData!.id
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Ошибка при бронировании: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Success response:', data);

      setSuccess("Вы успешно забронировали билет!");
      setTimeout(() => {
        setIsModalOpen(false);
        if (onBookingSuccess) onBookingSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при бронировании.");
      console.error('Booking error:', err);
    }
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isAuth && userData) {
      setIsModalOpen(true);
    } else {
      onLoginClick();
    }
    onBookingClick();
  };

  return (
    <>
      <div className="flex flex-col items-center space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
          <div className="flex items-center mb-2 sm:mb-0">
            <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 text-center sm:text-left">
              {isRegistrationClosedOrCompleted
                ? "Места распределены"
                : `Доступные места: ${remainingQuantity}`}
            </h3>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleButtonClick}
            disabled={remainingQuantity === 0}
            className={`px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md min-w-[120px] min-h-[44px] text-sm sm:text-base ${
              remainingQuantity === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg"
            }`}
          >
            Забронировать
          </motion.button>
        </div>
        {!isRegistrationClosedOrCompleted && remainingQuantity > 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            <AnimatePresence>
              {seatsArray.map((seat) => (
                <motion.button
                  key={seat}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, delay: seat * 0.05 }}
                  onClick={handleButtonClick}
                  className="w-10 h-10 rounded-md transition-all duration-200 text-base bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center font-medium min-w-[40px] min-h-[40px]"
                  title={`Место ${seat + 1}`}
                >
                  {seat + 1}
                </motion.button>
              ))}
            </AnimatePresence>
            {remainingQuantity > maxVisibleSeats && (
              <span className="text-gray-500 text-sm mt-2">+{remainingQuantity - maxVisibleSeats} мест</span>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center text-sm sm:text-base">
            {isRegistrationClosedOrCompleted ? "Места распределены" : "Места закончились"}
          </p>
        )}
      </div>

      <AuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Бронирование билета"
        error={error}
        success={success}
        className="max-w-[90vw] min-w-[300px] w-full sm:max-w-md"
      >
        <div className="space-y-6">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-lg sm:text-xl font-semibold text-gray-800 text-center"
          >
            {eventTitle}
          </motion.h3>
          <div className="space-y-3 text-gray-600">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex items-center"
            >
              <FaCalendarAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventDate}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex items-center"
            >
              <FaClock className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventTime}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex items-center"
            >
              <FaMapMarkerAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{eventLocation}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="flex items-center"
            >
              <FaRubleSign className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
              <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
                {freeRegistration ? "Бесплатно" : `${price} ₽`}
              </span>
            </motion.div>
          </div>
          <div className="flex justify-end gap-4">
            <ModalButton variant="secondary" onClick={() => setIsModalOpen(false)} disabled={!!success}>
              Отмена
            </ModalButton>
            <ModalButton variant="primary" onClick={handleConfirmBooking} disabled={!!success}>
              {success ? "Успешно!" : "Подтвердить"}
            </ModalButton>
          </div>
        </div>
      </AuthModal>
    </>
  );
};

export default EventRegistration;