"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  timestamp: string;
  isViewed: boolean;
}

// Заглушка с начальными данными для уведомлений
const MOCK_NOTIFICATIONS: NotificationItem[] = [];

const Notifications: React.FC = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const { isAuth } = useAuth();

  const markNotificationViewed = useCallback(async (templateId: number) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (isAuth) {
        headers.Authorization = `Bearer ${localStorage.getItem("token")}`;
      }

      await apiFetch("/notifications/view", {
        method: "POST",
        headers,
        data: JSON.stringify({ template_id: templateId }),
      });
    } catch (error) {
      console.warn("Failed to mark notification as viewed:", error);
    }
  }, [isAuth]);

  const clearNotifications = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (isAuth) {
        headers.Authorization = `Bearer ${localStorage.getItem("token")}`;
      }

      await apiFetch("/notifications/clear", {
        method: "DELETE",
        headers,
      });
      setNotifications([]); // Очищаем список на клиенте
      setIsNotificationsOpen(false); // Закрываем панель
    } catch (error) {
      console.warn("Failed to clear notifications:", error);
    }
  }, [isAuth]);

  // Обработчик клика вне панели уведомлений
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotificationsOpen &&
        notificationRef.current &&
        notificationButtonRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        console.log("Closing notification panel");
        setIsNotificationsOpen(false);
        const unreadNotifications = notifications.filter((n) => !n.isViewed);
        unreadNotifications.forEach((notif) => markNotificationViewed(notif.id));
        setNotifications((prev) => prev.map((notif) => ({ ...notif, isViewed: true })));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationsOpen, notifications, markNotificationViewed]);

  const toggleNotifications = useCallback(() => {
    console.log("Toggling notifications, current state:", isNotificationsOpen);
    setIsNotificationsOpen((prev) => !prev);
  }, [isNotificationsOpen]);

  const unreadCount = notifications.filter((notif) => !notif.isViewed).length;

  return (
    <div className="relative">
      <motion.button
        ref={notificationButtonRef}
        onClick={toggleNotifications}
        className="md:hidden text-orange-500 hover:text-orange-600 p-2 min-w-[44px] min-h-[44px] z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="h-6 w-6 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </motion.button>

      <motion.button
        ref={notificationButtonRef}
        onClick={toggleNotifications}
        className="hidden md:block text-orange-500 hover:text-orange-600 p-2 min-w-[44px] min-h-[44px]"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="w-10 h-10 sm:w-8 sm:h-8 bg-orange-100 rounded-full flex items-center justify-center hover:bg-orange-200">
          <svg className="h-6 w-6 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
      </motion.button>

      {isNotificationsOpen && (
        <div
          ref={notificationRef}
          className="absolute left-0 top-[calc(100%+0.5rem)] w-64 bg-white rounded-md shadow-lg py-4 border border-gray-200 z-[1000] max-h-[200px] overflow-y-auto"
        >
          {notifications.length > 0 ? (
            <>
              <ul className="divide-y divide-gray-200">
                {notifications.map((notif) => (
                  <li key={notif.id} className="px-4 py-2 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                    <p className="text-xs text-gray-500">{notif.body}</p>
                    <p className="text-xs text-gray-400">{new Date(notif.timestamp).toLocaleTimeString()}</p>
                  </li>
                ))}
              </ul>
              <div className="px-4 pt-2">
                <button
                  onClick={clearNotifications}
                  className="w-full px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm transition-colors"
                >
                  Очистить все
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 text-sm px-2">Нет уведомлений</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;