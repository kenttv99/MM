"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";
import { FaUser, FaEnvelope, FaCalendarAlt, FaCog } from "react-icons/fa";

export default function AdminProfilePage() {
  const { adminData, isAdminAuth, isLoading, checkAdminAuth } = useAdminAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  // Инициализация и проверка авторизации
  useEffect(() => {
    const init = async () => {
      try {
        await checkAdminAuth();
      } catch (error) {
        console.error("Ошибка при проверке авторизации:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    init();
  }, [checkAdminAuth]);

  // Перенаправление неавторизованных пользователей
  useEffect(() => {
    if (isInitialized && !isLoading && !isAdminAuth) {
      router.push("/admin-login");
    }
  }, [isInitialized, isLoading, isAdminAuth, router]);

  // Показываем спиннер, пока идет инициализация
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Если нет авторизации (будет перенаправление)
  if (!isAdminAuth || !adminData) {
    return null;
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
                <h2 className="text-2xl font-semibold mb-1">{adminData.fio}</h2>
                <div className="flex items-center text-gray-600 mb-4">
                  <FaEnvelope className="mr-2" />
                  <span>{adminData.email}</span>
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