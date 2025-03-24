// frontend/src/app/(auth)/profile/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

const Profile = () => {
  const { isAuth, isLoading, userData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuth) {
        navigateTo(router, "/");
      }
    }
  }, [isAuth, isLoading, router]);

  if (!userData) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-10 mt-16">
      <h1 className="text-3xl font-bold mb-6">Личный кабинет</h1>
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