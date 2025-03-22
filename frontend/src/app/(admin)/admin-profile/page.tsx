// frontend/src/app/(admin)/admin-profile/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";
import { FaUser, FaEnvelope, FaCalendarAlt, FaCog } from "react-icons/fa";

export default function AdminProfilePage() {
  const { isAdminAuth, adminData, isLoading, checkAuth } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAdminAuth) {
      router.push("/admin-login");
    }
  }, [isAdminAuth, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <AdminHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!isAdminAuth) {
    return null;
  }

  if (!adminData) {
    return (
      <div className="min-h-screen">
        <AdminHeader />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="bg-red-50 p-4 rounded-lg text-red-600 max-w-md mx-auto mt-10">
            Не удалось загрузить данные администратора.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Профиль администратора</h1>
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="flex items-start md:items-center flex-col md:flex-row">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mr-6 mb-4 md:mb-0">
                <FaUser className="text-blue-500 text-2xl" />
              </div>
              <div className="flex-grow">
                <h2 className="text-2xl font-semibold mb-1">{adminData?.fio || "Администратор"}</h2>
                <div className="flex items-center mb-4 text-gray-600">
                  <FaEnvelope className="mr-2" />
                  <span>{adminData?.email || "Нет данных"}</span>
                </div>
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm inline-flex items-center">
                  <FaCog className="mr-1" />
                  Администратор
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <FaCalendarAlt className="mr-2 text-blue-500" />
                Управление мероприятиями
              </h3>
              <p className="text-gray-600 mb-4">
                Создавайте, редактируйте и управляйте мероприятиями на платформе.
              </p>
              <button
                onClick={() => router.push("/edit-events")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Перейти к мероприятиям
              </button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <FaCog className="mr-2 text-blue-500" />
                Настройки
              </h3>
              <p className="text-gray-600 mb-4">
                Управляйте настройками системы и вашего профиля.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Перейти в панель управления
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}