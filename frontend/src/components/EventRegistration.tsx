"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { FaTicketAlt, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { EventRegistrationProps } from "@/types/index";
import { usePageLoad } from "@/contexts/PageLoadContext";

const EventRegistration: React.FC<EventRegistrationProps> = ({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  ticketType,
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
  const { wrapAsync } = usePageLoad();
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
      const token = localStorage.getItem("token");
      const response = await wrapAsync(
        fetch("/user_edits/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event_id: eventId,
            user_id: userData!.id,
          }),
        })
      );

      if (response.ok) {
        setSuccess("Вы успешно забронировали билет!");
        setTimeout(() => {
          setIsModalOpen(false);
          if (onBookingSuccess) onBookingSuccess();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Ошибка при бронировании.");
      }
    } catch (err) {
      setError("Произошла ошибка при бронировании. Попробуйте позже.");
      console.error(err);
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
        <div className="flex flex-col sm:flex-row items-center justify-between w-full">
          <div className="flex items-center mb-2 sm:mb-0">
            <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
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
            className={`px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md min-w-[120px] min-h-[44px] text-base ${
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
                  className="w-10 h-10 rounded-md transition-all duration-200 text-base bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center font-medium"
                  title={`Место ${seat + 1}`}
                >
                  {seat + 1}
                </motion.button>
              ))}
            </AnimatePresence>
            {remainingQuantity > maxVisibleSeats && (
              <span className="text-gray-500 text-sm mt-2">
                +{remainingQuantity - maxVisibleSeats} мест
              </span>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center text-base">
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
      >
        <div className="space-y-6">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-lg sm:text-xl font-semibold text-gray-800"
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
              <FaCalendarAlt className="text-orange-500 mr-2 w-5 h-5" />
              <span className="text-base">{eventDate}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex items-center"
            >
              <FaClock className="text-orange-500 mr-2 w-5 h-5" />
              <span className="text-base">{eventTime}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex items-center"
            >
              <FaMapMarkerAlt className="text-orange-500 mr-2 w-5 h-5" />
              <span className="text-base">{eventLocation}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="flex items-center"
            >
              <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5" />
              <span className="text-base">{ticketType}</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="flex items-center"
            >
              <FaRubleSign className="text-orange-500 mr-2 w-5 h-5" />
              <span className="text-base">{freeRegistration ? "Бесплатно" : `${price} ₽`}</span>
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className="text-gray-600 text-base"
          >
            Вы собираетесь забронировать билет на это мероприятие.
          </motion.p>
          <div className="flex justify-end space-x-4">
            <ModalButton
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Отмена
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={handleConfirmBooking}
            >
              Подтвердить
            </ModalButton>
          </div>
        </div>
      </AuthModal>
    </>
  );
};

export default EventRegistration;