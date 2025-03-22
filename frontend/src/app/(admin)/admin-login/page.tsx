// frontend/src/app/(admin)/admin-login/page.tsx
"use client";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useAdminAuthForm } from "@/hooks/useAdminAuthForm";
import { useEffect } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";

export default function AdminLoginPage() {
  const { isLoading, checkAuth } = useAdminAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const {
    formValues,
    error,
    isLoading: formLoading,
    isSuccess,
    handleChange,
    handleSubmit
  } = useAdminAuthForm({
    initialValues: {
      email: "",
      password: "",
    },
    endpoint: "/admin/login",
    redirectTo: "/admin-profile"
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <AdminHeader />
      <div className="flex items-center justify-center min-h-screen bg-gray-50 pt-16">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">
            Вход для администраторов
          </h1>
          <form onSubmit={handleSubmit}>
            <InputField
              type="email"
              value={formValues.email}
              onChange={handleChange}
              placeholder="Email"
              icon={FaEnvelope}
              name="email"
              required
              disabled={isSuccess}
            />
            <InputField
              type="password"
              value={formValues.password}
              onChange={handleChange}
              placeholder="Пароль"
              icon={FaLock}
              name="password"
              required
              disabled={isSuccess}
            />
            {error && (
              <div className="text-red-500 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm mb-6">
                {error}
              </div>
            )}
            {isSuccess && (
              <div className="text-green-600 bg-green-50 p-3 rounded-lg border-l-4 border-green-500 text-sm mb-6">
                Вход выполнен успешно! Перенаправление...
              </div>
            )}
            <ModalButton 
              type="submit" 
              disabled={formLoading || isSuccess}
            >
              {formLoading ? "Вход..." : (isSuccess ? "Успешно!" : "Войти")}
            </ModalButton>
          </form>
        </div>
      </div>
    </>
  );
}