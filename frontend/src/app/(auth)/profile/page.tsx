// frontend/src/app/(auth)/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const { isAuth, isLoading, userData, checkAuth } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuth) router.push("/");
    if (isAuth) checkAuth().catch(console.error);
    
    // Устанавливаем таймаут для показа сообщения о долгой загрузке
    const timer = setTimeout(() => {
      if (isLoading || !userData) setLoadingTimeout(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isAuth, isLoading, userData, router, checkAuth]);

  if (isLoading && !loadingTimeout) {
    return (
      <div className="min-h-screen">
        <Loading />
      </div>
    );
  }
  
  if (!userData) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        {!loadingTimeout && <Loading />}
        {loadingTimeout && (
          <div className="text-center mt-8 p-6 bg-orange-50 rounded-lg border border-orange-200 shadow-md z-50 relative">
            <p className="text-orange-700 font-medium mb-2 text-lg">Загрузка данных занимает больше времени, чем обычно.</p>
            <p className="text-gray-600 mb-6">Возможно, есть проблемы с соединением или сервером.</p>
            <div className="flex justify-center space-x-4">
              <button 
                onClick={() => {
                  setLoadingTimeout(false);
                  checkAuth();
                }}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Попробовать снова
              </button>
              <button 
                onClick={() => router.push("/")}
                className="px-6 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Вернуться на главную
              </button>
            </div>
          </div>
        )}
      </div>
    );
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