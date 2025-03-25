// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { FaTicketAlt } from "react-icons/fa";

interface EventRegistrationProps {
  eventId: number;
  availableQuantity: number;
  price: number;
  freeRegistration: boolean;
}

const EventRegistration: React.FC<EventRegistrationProps> = ({
  eventId,
  availableQuantity,
  price,
  freeRegistration,
}) => {
  const { userData, isAuth } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  // Создаем массив для отображения квадратиков в количестве availableQuantity
  const seatsArray = Array.from({ length: availableQuantity }, (_, index) => index);

  const handleRegisterClick = () => {
    if (!isAuth || !userData) {
      setError("Пожалуйста, авторизуйтесь для регистрации на мероприятие.");
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    setIsRegistering(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_id: eventId,
          user_id: userData!.id,
        }),
      });

      if (response.ok) {
        setSuccess("Вы успешно зарегистрированы на мероприятие!");
        setTimeout(() => setIsModalOpen(false), 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Ошибка при регистрации.");
      }
    } catch (err) {
      setError("Произошла ошибка при регистрации. Попробуйте позже.");
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FaTicketAlt className="text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">
              Доступные места: {availableQuantity}
            </h3>
          </div>
          <button
            onClick={handleRegisterClick}
            disabled={availableQuantity === 0 || isRegistering}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              availableQuantity === 0 || isRegistering
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Забронировать
          </button>
        </div>
        {availableQuantity > 0 ? (
          <div className="flex flex-wrap gap-2">
            {seatsArray.map((seat) => (
              <button
                key={seat}
                onClick={handleRegisterClick}
                disabled={isRegistering}
                className={`w-6 h-6 rounded-sm transition-colors duration-200 ${
                  isRegistering
                    ? "bg-gray-200 cursor-not-allowed"
                    : "bg-gray-200 hover:bg-blue-200"
                }`}
                title={`Место ${seat + 1}`}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Места закончились</p>
        )}
      </div>

      <AuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Подтверждение регистрации"
        error={error}
        success={success}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Вы собираетесь зарегистрироваться на мероприятие.
          </p>
          <p className="text-gray-600">
            Стоимость: {freeRegistration ? "Бесплатно" : `${price} ₽`}
          </p>
          <div className="flex justify-end space-x-4">
            <ModalButton
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isRegistering}
            >
              Отмена
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={handleConfirmRegister}
              disabled={isRegistering}
            >
              {isRegistering ? "Регистрация..." : "Подтвердить"}
            </ModalButton>
          </div>
        </div>
      </AuthModal>
    </div>
  );
};

export default EventRegistration;