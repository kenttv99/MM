"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FaEdit, FaTrashAlt, FaBell, FaCheck, FaTimes } from "react-icons/fa";

interface TicketType {
  available_quantity: number;
  sold_quantity: number;
}

interface EventData {
  id: number;
  title: string;
  status: "draft" | "registration_open" | "registration_closed" | "completed";
  published: boolean;
  notificationSent?: boolean;
  ticket_type?: TicketType;
}

interface EventsListProps {
  events: EventData[];
  onEventDeleted?: () => void;
}

const EventsList: React.FC<EventsListProps> = ({ events, onEventDeleted }) => {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Навигация к странице редактирования мероприятия
  const handleEditEvent = (eventId: number) => {
    router.push(`/edit-events?event_id=${eventId}`);
  };

  // Функция для удаления мероприятия
  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    
    setDeleting(true);

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        throw new Error("Токен администратора не найден");
      }

      const response = await fetch(`/admin_edits/${eventToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка удаления: ${response.status}`, errorText);
        throw new Error(`Ошибка удаления: ${response.status} - ${errorText}`);
      }

      // Вызываем колбэк об успешном удалении, если он был передан
      if (onEventDeleted) {
        onEventDeleted();
      }
      
      // Перенаправляем на текущую страницу для обновления данных
      router.refresh();
    } catch (error) {
      console.error("Ошибка при удалении мероприятия:", error);
      alert(error instanceof Error ? error.message : "Не удалось удалить мероприятие");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  // Функция для отправки уведомления
  const sendNotification = async (eventId: number, eventTitle: string) => {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        throw new Error("Токен администратора не найден");
      }

      const response = await fetch("/notifications/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ 
          event_id: eventId, 
          message: `Новое мероприятие "${eventTitle}" добавлено!` 
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка отправки: ${response.status}`);
      }

      // Обновляем страницу для отображения изменений
      router.refresh();
    } catch (error) {
      console.error("Ошибка при отправке уведомления:", error);
      alert(error instanceof Error ? error.message : "Не удалось отправить уведомление");
    }
  };

  // Функция для преобразования статуса в текст
  const getStatusText = (status: string) => {
    switch (status) {
      case "registration_open":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Регистрация открыта</span>;
      case "registration_closed":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Регистрация закрыта</span>;
      case "completed":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">Завершено</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Черновик</span>;
    }
  };

  return (
    <div>
      {/* Список мероприятий для мобильных устройств */}
      <div className="md:hidden space-y-4">
        {events.length > 0 ? (
          events.map((event) => {
            const availableQuantity = event.ticket_type?.available_quantity || 0;
            const soldQuantity = event.ticket_type?.sold_quantity || 0;
            const remainingQuantity = availableQuantity - soldQuantity;
            const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

            return (
              <div 
                key={event.id} 
                className="p-4 border border-gray-100 rounded-lg shadow-sm hover:shadow transition-shadow"
              >
                <h3 className="font-semibold text-gray-800 text-lg mb-2">{event.title}</h3>
                <div className="space-y-2 mb-3">
                  <p className="text-sm flex items-center justify-between">
                    <span className="text-gray-600">Статус:</span> 
                    {getStatusText(event.status)}
                  </p>
                  <p className="text-sm flex items-center justify-between">
                    <span className="text-gray-600">Опубликовано:</span> 
                    {event.published ? <FaCheck className="text-green-500" /> : <FaTimes className="text-red-500" />}
                  </p>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Заполненность:</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${fillPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {soldQuantity} / {availableQuantity} (Осталось: {remainingQuantity})
                    </p>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleEditEvent(event.id)}
                    className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <FaEdit className="mr-2" /> Редактировать
                  </button>
                  {event.status === "draft" && (
                    <button
                      onClick={() => {
                        setEventToDelete(event.id);
                        setShowDeleteModal(true);
                      }}
                      className="flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                    >
                      <FaTrashAlt className="mr-2" /> Удалить
                    </button>
                  )}
                  <button
                    onClick={() => sendNotification(event.id, event.title)}
                    className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm ${
                      event.notificationSent 
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed" 
                        : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                    disabled={event.notificationSent}
                  >
                    <FaBell className="mr-2" /> {event.notificationSent ? "Отправлено" : "Отправить уведомление"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center py-4 text-gray-500">
            Нет доступных мероприятий
          </p>
        )}
      </div>

      {/* Таблица мероприятий для десктопа */}
      <div className="hidden md:block">
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опубликовано</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заполненность</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => {
                  const availableQuantity = event.ticket_type?.available_quantity || 0;
                  const soldQuantity = event.ticket_type?.sold_quantity || 0;
                  const remainingQuantity = availableQuantity - soldQuantity;
                  const fillPercentage = availableQuantity > 0 ? (soldQuantity / availableQuantity) * 100 : 0;

                  return (
                    <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{event.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{event.title}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{getStatusText(event.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {event.published ? 
                          <FaCheck className="text-green-500 mx-auto" /> : 
                          <FaTimes className="text-red-500 mx-auto" />
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="w-32 bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${fillPercentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {soldQuantity} / {availableQuantity} (Осталось: {remainingQuantity})
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => handleEditEvent(event.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Редактировать"
                          >
                            <FaEdit />
                          </button>
                          {event.status === "draft" && (
                            <button
                              onClick={() => {
                                setEventToDelete(event.id);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Удалить"
                            >
                              <FaTrashAlt />
                            </button>
                          )}
                          <button
                            onClick={() => sendNotification(event.id, event.title)}
                            className={`${
                              event.notificationSent ? "text-gray-400 cursor-not-allowed" : "text-green-500 hover:text-green-700"
                            }`}
                            disabled={event.notificationSent}
                            title={event.notificationSent ? "Уведомление отправлено" : "Отправить уведомление"}
                          >
                            <FaBell />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-6 text-gray-500">
            Нет доступных мероприятий
          </p>
        )}
      </div>

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Подтверждение удаления</h2>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить это мероприятие? Это действие нельзя отменить.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteEvent}
                className={`px-4 py-2 ${deleting ? 'bg-red-400' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg transition-colors flex items-center justify-center min-w-[80px]`}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Удаление...
                  </>
                ) : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsList; 