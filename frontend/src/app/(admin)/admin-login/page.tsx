"use client";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useAdminAuthForm } from "@/hooks/useAdminAuthForm";

export default function AdminLoginPage() {
  
  const {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit
  } = useAdminAuthForm({
    initialValues: {
      email: "",
      password: "",
    },
    endpoint: "/admin/login",
    redirectTo: "/admin-profile",
    isLogin: true
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        {/* <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">
          Вход для администраторов
        </h1> */}
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
            disabled={isLoading || isSuccess}
          >
            {isLoading ? "Вход..." : (isSuccess ? "Успешно!" : "Войти")}
          </ModalButton>
        </form>
      </div>
    </div>
  );
}