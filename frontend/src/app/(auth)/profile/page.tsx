"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import { UserResponse } from "@/types/user";

const Profile = () => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      
      try {
        const response = await fetch("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          console.error("Error response:", response.status);
          localStorage.removeItem("token");
          router.push("/login");
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [router]);

  if (loading) return <Loading />;

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Личный кабинет</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Блок с профилем */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-20 h-20 bg-gray-300 rounded-full"></div>
            <div>
              <h2 className="text-xl font-semibold">{user?.fio || "Не указано"}</h2>
              <p className="text-gray-600">{user?.email || "Не указан"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p><strong>Telegram:</strong> {user?.telegram || "Не указан"}</p>
            <p><strong>WhatsApp:</strong> {user?.whatsapp || "Не указан"}</p>
          </div>
        </div>
        {/* Блок с мероприятиями */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Мероприятия</h3>
          <p className="text-gray-500">Заглушка: Список зарегистрированных мероприятий будет здесь.</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;