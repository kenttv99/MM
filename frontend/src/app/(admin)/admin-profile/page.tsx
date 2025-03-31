// src/app/(admin)/admin-profile/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaUserCircle, FaEnvelope, FaCalendarAlt, FaCog, FaUser} from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { usePageLoad } from "@/contexts/PageLoadContext";

interface AdminData {
  id: number;
  email: string;
  fio: string;
}

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

export default function AdminProfilePage() {
  const router = useRouter();
  const { checkAuth, updateAdminData, adminData } = useAdminAuth();
  const { wrapAsync, apiFetch, setPageLoading } = usePageLoad();
  const [formValues, setFormValues] = useState<AdminData>({ email: "", fio: "", id: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const isLoadingRef = useRef(false);

  // Initialize form values from adminData when it becomes available
  useEffect(() => {
    if (adminData && !hasFetched.current) {
      setFormValues({
        id: adminData.id,
        email: adminData.email,
        fio: adminData.fio,
      });
      hasFetched.current = true;
    }
  }, [adminData]);

  useEffect(() => {
    const initialLoad = async () => {
      if (isLoadingRef.current || hasFetched.current) return;
      isLoadingRef.current = true;

      try {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
          navigateTo(router, "/admin-login");
          return;
        }

        if (!hasFetched.current && adminData) {
          setFormValues({
            id: adminData.id, 
            email: adminData.email,
            fio: adminData.fio
          });
          hasFetched.current = true;
        } else if (!hasFetched.current) {
          // Only fetch if we don't have data
          const data = await wrapAsync<AdminData>(
            apiFetch("/admin/me", { headers: { Accept: "application/json" } })
          );
          if (data) {
            setFormValues(data);
            updateAdminData(data);
            hasFetched.current = true;
          }
        }
      } catch (err) {
        console.error("AdminProfilePage: initial load failed:", err);
        setFetchError(err instanceof Error ? err.message : "Не удалось загрузить данные профиля");
      } finally {
        isLoadingRef.current = false;
        setPageLoading(false);
      }
    };

    initialLoad();
    
    // Safety reset of loading state
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [checkAuth, router, updateAdminData, wrapAsync, apiFetch, adminData, setPageLoading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const data = await wrapAsync<AdminData>(
        apiFetch("/admin/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fio: formValues.fio }),
        })
      );
      if (data) {
        setFormValues((prev) => ({ ...prev, fio: data.fio }));
        updateAdminData(data);
        setSuccessMessage("Профиль успешно обновлен!");
        setTimeout(() => {
          setSuccessMessage(null);
          setIsEditing(false);
        }, 1500);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Не удалось обновить профиль");
    } finally {
      isLoadingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
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
                  disabled={successMessage !== null || isLoadingRef.current}
                >
                  {isEditing ? "Отмена" : "Редактировать"}
                </ModalButton>
                {isEditing && (
                  <ModalButton
                    type="submit"
                    variant="primary"
                    disabled={successMessage !== null || isLoadingRef.current}
                  >
                    Сохранить
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
}