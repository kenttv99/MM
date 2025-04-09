// frontend/src/app/(admin)/admin-profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaUserCircle, FaEnvelope, FaCalendarAlt, FaCog, FaUser } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { useRouter } from "next/navigation";

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

// Компонент скелетона для профиля
const ProfileSkeleton = () => (
  <div className="min-h-screen bg-gray-50 relative">
    <AdminHeader />
    <main className="container mx-auto px-4 pt-24 pb-12">
      <div className="max-w-3xl mx-auto">
        <div className="h-10 bg-gray-200 rounded w-1/3 mb-8 animate-pulse"></div>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-8 animate-pulse">
          <div className="flex items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gray-200 mr-4"></div>
            <div>
              <div className="h-6 bg-gray-200 rounded w-40 mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-32 flex items-center"></div>
            </div>
          </div>
          
          <div className="flex items-center mb-6">
            <div className="h-8 bg-gray-200 rounded-full w-32"></div>
          </div>
          
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="flex justify-between space-x-4">
              <div className="h-10 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 rounded-full bg-gray-200 mr-2"></div>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    </main>
  </div>
);

export default function AdminProfilePage() {
  const { isAdminAuth, adminData, isLoading: authLoading, logoutAdmin } = useAdminAuth();
  const { stage, setStage, setDynamicLoading } = useLoading();
  const router = useRouter();
  
  const [formValues, setFormValues] = useState<AdminData>({ email: "", fio: "", id: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Обработка инициализации и загрузки профиля
  useEffect(() => {
    // Установка флага клиентской загрузки
    setClientReady(true);
    
    // Обновляем стадию загрузки (на случай, если мы в другой стадии)
    if (stage !== LoadingStage.COMPLETED) {
      setStage(LoadingStage.COMPLETED);
    }
    
    // Если у нас есть данные админа, немедленно устанавливаем их
    if (adminData) {
      setFormValues(adminData);
      setProfileLoaded(true);
    } else {
      setProfileLoaded(true); // Всё равно отмечаем как загруженное, чтобы не показывать скелетон вечно
    }
  }, [adminData, stage, setStage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setDynamicLoading(true);
    setFetchError(null);

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setFetchError("Токен отсутствует. Пожалуйста, войдите снова.");
        logoutAdmin();
        return;
      }

      console.log('Токен перед запросом:', token);
      const data = await apiFetch<AdminData>("/admin/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({ fio: formValues.fio }),
        bypassLoadingStageCheck: true // Обходим проверку стадии загрузки
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
      setDynamicLoading(false);
    }
  };

  // Показываем скелетон только при первичной загрузке
  if (!clientReady) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
      <AdminHeader />
      {authLoading && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-50">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      )}
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto fade-in" style={{ visibility: authLoading ? 'hidden' : 'visible' }}>
          {(!isAdminAuth || !adminData) ? (
            <div className="text-center py-8">
              <p className="text-lg text-gray-600 mb-4">Необходима авторизация администратора</p>
              <button 
                onClick={() => router.push('/admin-login')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Войти
              </button>
            </div>
          ) : (
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
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}