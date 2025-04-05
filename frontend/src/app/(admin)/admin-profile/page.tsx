// frontend/src/app/(admin)/admin-profile/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaUserCircle, FaEnvelope, FaCalendarAlt, FaCog, FaUser } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetch } from "@/utils/api";

// Динамическая загрузка AdminHeader без SSR
const AdminHeader = dynamic(() => import("@/components/AdminHeader"), { ssr: false });

interface AdminData {
  id: number;
  email: string;
  fio: string;
}

const navigateTo = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  window.location.href = url.pathname + url.search;
};

export default function AdminProfilePage() {
  const { isAdminAuth, adminData, isLoading, logoutAdmin } = useAdminAuth();
  const [formValues, setFormValues] = useState<AdminData>(
    adminData || { email: "", fio: "", id: 0 }
  );
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFetchError(null);

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setFetchError("Токен отсутствует. Пожалуйста, войдите снова.");
        logoutAdmin();
        return;
      }

      const data = await apiFetch<AdminData>("/admin/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({ fio: formValues.fio }),
      });
      
      if ('aborted' in data) {
        throw new Error(data.reason || "Запрос был прерван");
      }
      
      setFormValues((prev) => ({ ...prev, fio: data.fio }));
      setSuccessMessage("Профиль успешно обновлен!");
      localStorage.setItem("admin_data", JSON.stringify(data));
      setTimeout(() => {
        setSuccessMessage(null);
        setIsEditing(false);
      }, 1500);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Не удалось обновить профиль");
      if (err instanceof Error && "status" in err && err.status === 401) {
        logoutAdmin();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <AdminHeader />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-50">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      )}
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto" style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
          {(!isAdminAuth || !adminData) ? null : (
            <>
              <h1 className="text-3xl font-bold mb-8 text-gray-800">Профиль администратора</h1>
              {fetchError && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border-l-4 border-red-500">
                  {fetchError}
                </div>
              )}
              {successMessage && (
                <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg border-l-4 border-green-500">
                  {successMessage}
                </div>
              )}
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <div className="flex items-center mb-6">
                  <FaUserCircle className="text-gray-400 text-5xl mr-4" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{formValues.fio || "Администратор"}</h2>
                    <p className="text-gray-600 flex items-center">
                      <FaEnvelope className="mr-2" /> {formValues.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center mb-6">
                  <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                    <FaCog className="mr-1 text-blue-600" />
                    Администратор
                  </span>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <InputField
                    type="email"
                    value={formValues.email}
                    onChange={handleChange}
                    placeholder="Email"
                    icon={FaEnvelope}
                    name="email"
                    disabled
                  />
                  <InputField
                    type="text"
                    value={formValues.fio}
                    onChange={handleChange}
                    placeholder="ФИО"
                    icon={FaUser}
                    name="fio"
                    disabled={!isEditing}
                  />
                  <div className="flex justify-between space-x-4">
                    <ModalButton
                      variant="secondary"
                      onClick={() => setIsEditing((prev) => !prev)}
                      disabled={successMessage !== null || isSubmitting}
                    >
                      {isEditing ? "Отмена" : "Редактировать"}
                    </ModalButton>
                    {isEditing && (
                      <ModalButton
                        type="submit"
                        variant="primary"
                        disabled={successMessage !== null || isSubmitting}
                      >
                        {isSubmitting ? "Сохранение..." : "Сохранить"}
                      </ModalButton>
                    )}
                  </div>
                </form>
              </div>
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex items-center mb-6">
                    <FaCalendarAlt className="text-blue-500 text-xl mr-2" />
                    <h2 className="text-xl font-semibold text-gray-800">Управление мероприятиями</h2>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Создавайте, редактируйте и управляйте мероприятиями на платформе.
                  </p>
                  <button
                    onClick={() => navigateTo("/dashboard")}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors w-full"
                  >
                    Перейти к мероприятиям
                  </button>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex items-center mb-6">
                    <FaUserCircle className="text-red-500 text-xl mr-2" />
                    <h2 className="text-xl font-semibold text-gray-800">Выход</h2>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Завершите текущую сессию администратора.
                  </p>
                  <button
                    onClick={logoutAdmin}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors w-full"
                  >
                    Выйти
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}