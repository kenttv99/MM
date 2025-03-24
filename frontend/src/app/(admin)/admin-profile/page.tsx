// frontend/src/app/(admin)/admin-profile/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { FaUserCircle, FaEnvelope, FaCalendarAlt, FaCog } from "react-icons/fa";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

interface AdminProfile {
  id: number;
  fio: string;
  email: string;
  avatar_url?: string;
}

const AdminProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);

  const router = useRouter();
  const { isLoading: authLoading, checkAuth } = useAdminAuth();

  const fetchAdminProfile = useCallback(async () => {
    setIsProfileLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setError("Отсутствует токен авторизации");
        setIsProfileLoading(false);
        return;
      }

      const authToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token;

      const response = await fetch("/admin/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка API: ${response.status} ${response.statusText} - ${errorText}`);
        setProfile(null);
      } else {
        const data = await response.json();
        setProfile(data);
      }
    } catch {
      setError("Не удалось загрузить профиль. Проверьте соединение с сервером.");
      setProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        await fetchAdminProfile();
      } else {
        navigateTo(router, "/admin-login");
      }
    };
    initialize().catch(err => console.error("Profile initialization failed:", err));
  }, [checkAuth, fetchAdminProfile, router]);

  if (authLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Профиль администратора</h1>
          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500">
              {error}
            </div>
          )}
          {profile ? (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <div className="flex items-center mb-6">
                <FaUserCircle className="text-gray-400 text-5xl mr-4" />
                <div>
                  <h2 className="text-xl font-semibold">{profile.fio}</h2>
                  <p className="text-gray-600 flex items-center">
                    <FaEnvelope className="mr-2" /> {profile.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center mb-6">
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                  <FaCog className="mr-1 text-blue-600" />
                  Администратор
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center">Профиль не найден</p>
          )}
          <div className="grid grid-cols-1 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-6">
                <FaCalendarAlt className="text-blue-500 text-xl mr-2" />
                <h2 className="text-xl font-semibold">Управление мероприятиями</h2>
              </div>
              <p className="text-gray-600 mb-6">
                Создавайте, редактируйте и управляйте мероприятиями на платформе.
              </p>
              <button
                onClick={() => navigateTo(router, "/dashboard")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors w-full"
              >
                Перейти к мероприятиям
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminProfilePage;