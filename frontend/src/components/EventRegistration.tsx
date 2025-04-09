// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { FaTicketAlt, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaRubleSign } from "react-icons/fa";
import { FaRegCalendarCheck } from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";
import { EventRegistrationProps } from "@/types/index";
import { apiFetch } from "@/utils/api";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Интерфейс для билета пользователя
interface UserTicket {
  id: number;
  event: {
    id: number;
    title: string;
    start_date: string;
    end_date?: string;
    location?: string;
  };
  ticket_type: string;
  registration_date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  ticket_number?: string;
}

// Helper function to format date
const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return format(date, "d MMMM yyyy", { locale: ru });
};

// Helper function to format time
const formatTimeForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return format(date, "HH:mm", { locale: ru });
};

// Helper function to get status text
const getStatusText = (status: string): string => {
  switch (status) {
    case "pending": return "Ожидание";
    case "confirmed": return "Подтвержден";
    case "cancelled": return "Отменен";
    case "completed": return "Завершен";
    default: return "Активный";
  }
};

// Helper function to get status color
const getStatusColor = (status: string): string => {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "confirmed": return "bg-green-100 text-green-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "completed": return "bg-blue-100 text-blue-800";
    default: return "bg-green-100 text-green-800";
  }
};

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
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [userTicket, setUserTicket] = useState<UserTicket | null>(null);
  const [isCheckingTicket, setIsCheckingTicket] = useState(false);

  const remainingQuantity = availableQuantity - soldQuantity;
  const maxVisibleSeats = 10;
  const seatsArray = Array.from(
    { length: Math.min(remainingQuantity, maxVisibleSeats) },
    (_, index) => index
  );

  const isRegistrationClosedOrCompleted =
    displayStatus === "Регистрация закрыта" || displayStatus === "Мероприятие завершено";

  // Проверяем, есть ли у пользователя уже билет на это мероприятие
  useEffect(() => {
    if (isAuth && userData) {
      const checkUserTicket = async () => {
        setIsCheckingTicket(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) return;

          const response = await apiFetch<any>('/user_edits/my-tickets', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            bypassLoadingStageCheck: true
          });

          // Проверяем на ошибку 401
          if (response && 'status' in response && response.status === 401) {
            console.log('EventRegistration: Получена ошибка 401, сбрасываем авторизацию');
            // Сбрасываем авторизацию как при выходе из системы
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            // Не делаем перенаправление на главную страницу
            return;
          }

          let tickets: UserTicket[] = [];
          
          // Обработка различных форматов ответа
          if (Array.isArray(response)) {
            tickets = response;
          } else if (response) {
            if (response.data) {
              tickets = Array.isArray(response.data) ? response.data : [response.data];
            } else if (response.items) {
              tickets = Array.isArray(response.items) ? response.items : [response.items];
            } else if (response.tickets) {
              tickets = Array.isArray(response.tickets) ? response.tickets : [response.tickets];
            }
          }

          // Ищем билет на это мероприятие
          const eventTicket = tickets.find(
            ticket => 
              ticket.event.id === parseInt(eventId.toString()) && 
              ticket.status !== "cancelled"
          );

          if (eventTicket) {
            setUserTicket(eventTicket);
          }
        } catch (err) {
          console.error('Error checking user ticket:', err);
          
          // Проверяем на ошибку 401 в исключении
          if (err instanceof Error && (
            err.message.includes('401') || 
            err.message.includes('Unauthorized') || 
            err.message.toLowerCase().includes('авториз')
          )) {
            console.log('EventRegistration: Получена ошибка 401 в исключении, сбрасываем авторизацию');
            // Сбрасываем авторизацию как при выходе из системы
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            // Не делаем перенаправление на главную страницу
          }
        } finally {
          setIsCheckingTicket(false);
        }
      };

      checkUserTicket();
    }
  }, [isAuth, userData, eventId]);

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
        
        // Обработка конкретных типов ошибок для более дружелюбных сообщений
        try {
          let errorData;
          
          // Проверяем, является ли текст JSON-объектом
          if (errorText.startsWith('{') && errorText.endsWith('}')) {
            errorData = JSON.parse(errorText);
          } else {
            // Ищем внутри текста JSON-объект
            const jsonMatch = errorText.match(/{.*}/s);
            if (jsonMatch) {
              errorData = JSON.parse(jsonMatch[0]);
            }
          }
          
          if (errorData && errorData.detail) {
            // Обработка конкретных сообщений об ошибках
            if (errorData.detail.includes("Превышен лимит отмен регистраций")) {
              throw new Error("Вы уже отменяли регистрацию на это мероприятие 3 раза. Дальнейшая регистрация недоступна.");
            } else if (errorData.detail.includes("Вы уже зарегистрированы")) {
              throw new Error("Вы уже зарегистрированы на это мероприятие.");
            } else if (errorData.detail.includes("Билеты на это мероприятие распроданы")) {
              throw new Error("К сожалению, все билеты на это мероприятие уже распроданы.");
            } else if (errorData.detail.includes("Регистрация на это мероприятие недоступна")) {
              throw new Error("Регистрация на это мероприятие в данный момент недоступна.");
            } else {
              throw new Error(errorData.detail);
            }
          } else {
            // Если не удалось найти detail в JSON или это не JSON
            throw new Error(`Ошибка при бронировании: ${response.status === 400 ? 'Невозможно забронировать билет' : response.statusText}`);
          }
        } catch (parseError) {
          // Если это ошибка парсинга, значит текст ответа не валидный JSON
          console.error('Parse error:', parseError);
          
          // Пробуем найти понятное сообщение об ошибке в тексте
          if (errorText.includes("Превышен лимит отмен регистраций")) {
            throw new Error("Вы уже отменяли регистрацию на это мероприятие 3 раза. Дальнейшая регистрация недоступна.");
          } else if (errorText.includes("Вы уже зарегистрированы")) {
            throw new Error("Вы уже зарегистрированы на это мероприятие.");
          } else {
            throw new Error(`Ошибка при бронировании: ${response.status === 400 ? 'Невозможно забронировать билет' : response.statusText}`);
          }
        }
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

  // Перенаправление в профиль пользователя при нажатии на кнопку "Активная бронь"
  const handleGoToProfile = () => {
    router.push("/profile");
  };

  // Рендер компонента, если у пользователя уже есть билет
  if (userTicket) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
          <div className="flex items-center mb-2 sm:mb-0">
            <FaTicketAlt className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 text-center sm:text-left">
              Доступные места: {remainingQuantity}
            </h3>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGoToProfile}
            className="px-4 sm:px-6 py-2 rounded-lg font-medium transition-all duration-300 shadow-md min-w-[120px] min-h-[44px] text-sm sm:text-base bg-orange-200 text-orange-700 hover:bg-orange-300"
          >
            Активная бронь
          </motion.button>
        </div>
        
        {!isRegistrationClosedOrCompleted && (
          <div className="flex flex-wrap gap-2 justify-center">
            {/* Горизонтальный номер билета */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg py-3 px-5 shadow-sm flex flex-row items-center">
                {/* Левая часть - заголовок */}
                <div className="flex items-center justify-center pr-3 border-r border-orange-200">
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    НОМЕР БИЛЕТА
                  </p>
                </div>
                
                {/* Правая часть - номер */}
                <div className="flex items-center justify-center pl-3">
                  <p className="text-xl font-bold text-orange-600">
                    #{userTicket.ticket_number || userTicket.id}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Рендер стандартного компонента бронирования
  return (
    <>
      <div className="flex flex-col items-center space-y-4">
        {isCheckingTicket ? (
          <div className="flex items-center justify-center h-[120px]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          </div>
        ) : (
          <>
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
          </>
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
            {!freeRegistration && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="flex items-center"
              >
                <FaRubleSign className="text-orange-500 mr-2 w-5 h-5 shrink-0" />
                <span className="text-sm sm:text-base" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{price} ₽</span>
              </motion.div>
            )}
          </div>
          
          <div className="flex flex-row gap-2 pt-4">
            <ModalButton onClick={() => setIsModalOpen(false)} className="w-1/2 bg-gray-100 text-gray-700 hover:bg-gray-200">
              Отмена
            </ModalButton>
            <ModalButton 
              onClick={handleConfirmBooking} 
              className="w-1/2 bg-orange-500 text-white hover:bg-orange-600"
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