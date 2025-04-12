// frontend/src/app/(admin)/admin-login/page.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetch } from "@/utils/api";
import ClientErrorBoundary from "@/components/Errors/ClientErrorBoundary";

// Динамическая загрузка AdminHeader без SSR для страницы логина
const AdminHeader = dynamic(() => import("@/components/AdminHeader"), { ssr: false });

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [formValues, setFormValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Очищаем токен и данные администратора при загрузке страницы логина
  useEffect(() => {
    // Если мы на странице логина и у нас есть токен, вероятно он истек или недействителен
    // Очищаем локальное хранилище для предотвращения ошибок отображения
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    localStorage.removeItem("is_admin_route");
    console.log('AdminLogin: Cleared existing admin tokens and session data on login page mount');
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setError("");
    setIsLoading(true);

    try {
      console.log('AdminLogin: Sending login request with credentials');
      
      // Debug authentication state before login
      console.log('AdminLogin: Current auth state before login:', {
        isLoggedIn: localStorage.getItem('admin_token') ? true : false,
        adminData: localStorage.getItem('admin_data') ? true : false
      });
      
      const data = await apiFetch<{ access_token: string; id: number; email: string; fio?: string }>("/admin/login", {
        method: "POST",
        data: JSON.stringify(formValues),
        bypassLoadingStageCheck: true, // Ensure this works during authentication
        headers: {
          'Content-Type': 'application/json' // Ensure proper content type
        }
      });
      
      if ('aborted' in data) {
        throw new Error(data.reason || "Запрос был прерван");
      }
      
      if ('error' in data) {
        throw new Error(data.error || "Ошибка авторизации");
      }
      
      const response = data as { access_token: string; id: number; email: string; fio?: string };
      console.log('AdminLogin: Login successful, received token');
      
      if (!response.access_token) {
        throw new Error("Токен отсутствует в ответе сервера");
      }
      
      const adminData = {
        id: response.id,
        email: response.email,
        fio: response.fio || "Администратор",
      };
      
      console.log('AdminLogin: Calling login with token and user data');
      setIsSuccess(true);
      setIsLoading(false);
      login(response.access_token, adminData);
      
      // Add automatic redirect after successful login
      console.log('AdminLogin: Redirecting to admin profile page');
      setTimeout(() => {
        // Clear any existing errors in the console to make debugging easier
        console.clear();
        console.log('AdminLogin: Starting navigation to admin profile');
        
        // Use router for the navigation
        router.push('/admin-profile');
      }, 1000);
    } catch (err) {
      let errorMessage = "Произошла ошибка";
      
      if (err instanceof Error) {
        // Обработка различных типов ошибок
        if (err.message.includes("HTTP error! status: 401")) {
          errorMessage = "Неверный email или пароль";
        } else if (err.message.includes("HTTP error! status: 429")) {
          errorMessage = "Частые запросы. Попробуйте немного позже.";
        } else if (err.message.includes("HTTP error! status: 500")) {
          errorMessage = "Ошибка сервера. Попробуйте позже.";
        } else if (err.message.includes("HTTP error! status: 503")) {
          errorMessage = "Сервис временно недоступен. Попробуйте позже.";
        } else {
          errorMessage = err.message;
        }
      }
      
      console.error('AdminLogin: Error during login:', errorMessage);
      setError(errorMessage);
      setIsSuccess(false);
      setIsLoading(false);
    }
  };

  return (
    <>
      <AdminHeader />
      <div className="flex items-center justify-center min-h-screen bg-gray-50 pt-16">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">Вход для администраторов</h1>
          <ClientErrorBoundary>
            <form onSubmit={handleSubmit}>
              <InputField
                type="email"
                value={formValues.email}
                onChange={handleChange}
                placeholder="Email"
                icon={FaEnvelope}
                name="email"
                required
                disabled={isSuccess || isLoading}
              />
              <InputField
                type="password"
                value={formValues.password}
                onChange={handleChange}
                placeholder="Пароль"
                icon={FaLock}
                name="password"
                required
                disabled={isSuccess || isLoading}
              />
              {error && (
                <div className="p-2 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md mb-6 text-xs">
                  <p>{error}</p>
                </div>
              )}
              {isSuccess && (
                <div className="text-green-600 bg-green-50 p-2 rounded-lg border-l-4 border-green-500 text-xs mb-6">
                  Вход успешен! Перенаправление...
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <ModalButton
                  variant="secondary"
                  onClick={() => window.location.href = "/"}
                  disabled={isLoading || isSuccess}
                >
                  На главную
                </ModalButton>
                <ModalButton
                  type="submit"
                  variant="primary"
                  disabled={isLoading || isSuccess}
                >
                  {isLoading ? "Вход..." : isSuccess ? "Успешно!" : "Войти"}
                </ModalButton>
              </div>
            </form>
          </ClientErrorBoundary>
        </div>
      </div>
    </>
  );
}