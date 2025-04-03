// frontend/src/components/Notifications.tsx
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

interface NotificationResponse {
  id: number;
  type: string;
  message: string;
  created_at: string;
  is_viewed: boolean;
}

interface CustomError extends Error {
  isAuthError?: boolean;
}

const Notifications: React.FC = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const { isAuth } = useAuth(); // Use isAuth directly instead of checkAuth
  const hasFetched = useRef(false); // Track initial fetch to avoid redundant calls

  const fetchNotifications = useCallback(async () => {
    if (!isAuth) {
      console.log("User not authenticated - skipping notifications fetch");
      setNotifications([]);
      return;
    }
  
    try {
      const response = await apiFetch<NotificationResponse[]>("/user_edits/notifications", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`, // Явно используем token
        },
      });
      setNotifications(
        response.map((n) => ({
          id: n.id,
          title: n.type === "publication" ? "Новое мероприятие" : "Изменение статуса",
          body: n.message,
          timestamp: n.created_at,
          isViewed: n.is_viewed,
        }))
      );
    } catch (error) {
      const err = error as CustomError;
      if (err.isAuthError) {
        console.log("User not authenticated for notifications - skipping fetch silently");
        setNotifications([]);
      } else {
        console.warn("Failed to fetch notifications:", error);
      }
    }
  }, [isAuth]);

  // useEffect(() => {
  //   if (!hasFetched.current) {
  //     fetchNotifications();
  //     hasFetched.current = true;
  //   }

  //   const interval = setInterval(() => {
  //     if (isAuth) {
  //       fetchNotifications(); // Only fetch periodically if authenticated
  //     }
  //   }, 30000);

  //   return () => clearInterval(interval);
  // }, [fetchNotifications, isAuth]); // Add isAuth to prevent unnecessary runs

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
        setNotifications((prev) => prev.map((notif) => ({ ...notif, isViewed: true })));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationsOpen]);

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
          className="absolute left-0 top-[calc(100%+0.5rem)] w-64 bg-white rounded-md shadow-lg py-4 border border-gray-200 z-[1000] max-h-[120px] overflow-y-auto"
        >
          {notifications.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {notifications.map((notif) => (
                <li key={notif.id} className="px-4 py-2 hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-500">{notif.body}</p>
                  <p className="text-xs text-gray-400">{new Date(notif.timestamp).toLocaleTimeString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-gray-500 text-sm px-2">Нет уведомлений</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;