// frontend/src/app/(auth)/profile/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  avatar_url?: string;
}


const Profile = () => {
  const { isAuth, isLoading: authLoading, userData: contextUserData, checkAuth } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(contextUserData);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Токен авторизации отсутствует");
      }

      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API: ${response.status} ${errorText}`);
      }

      const freshData: UserData = await response.json();
      setUserData(freshData);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Не удалось загрузить данные профиля");
      setUserData(contextUserData);
    } finally {
      setIsFetching(false);
    }
  }, [contextUserData]);

  useEffect(() => {
    const handleAuthChange = () => {
      checkAuth();
      if (!isAuth) {
        setUserData(null); // Очищаем данные профиля при логауте
      }
    };

    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [checkAuth, isAuth]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuth) {
        // Не перенаправляем, просто очищаем данные
        setUserData(null);
      } else {
        fetchUserProfile();
      }
    }
  }, [isAuth, authLoading, fetchUserProfile]);

  if (authLoading || isFetching) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!isAuth) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        <p className="text-gray-500 text-center">Пожалуйста, авторизуйтесь, чтобы просмотреть профиль.</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        <p className="text-red-500">Не удалось загрузить данные профиля</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 mt-16">
      <h1 className="text-3xl font-bold mb-6">Личный кабинет</h1>
      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border-l-4 border-red-500">
          {fetchError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-2xl font-bold">
              {userData.fio ? userData.fio.charAt(0).toUpperCase() : userData.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{userData.fio || "Не указано"}</h2>
              <p className="text-gray-600">{userData.email || "Не указан"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p><strong>Telegram:</strong> {userData.telegram || "Не указан"}</p>
            <p><strong>WhatsApp:</strong> {userData.whatsapp || "Не указан"}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Мероприятия</h3>
          <p className="text-gray-500">У вас пока нет зарегистрированных мероприятий.</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;