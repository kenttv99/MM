// frontend/src/app/(admin)/admin-login/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetch } from "@/utils/api";

// Динамическая загрузка AdminHeader без SSR
const AdminHeader = dynamic(() => import("@/components/AdminHeader"), { ssr: false });

export default function AdminLoginPage() {
  const { loginAdmin } = useAdminAuth();
  const [formValues, setFormValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
      const data = await apiFetch<{ access_token: string; id: number; email: string; fio?: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify(formValues),
      });
      if (!data.access_token) {
        throw new Error("Токен отсутствует в ответе сервера");
      }
      const adminData = {
        id: data.id,
        email: data.email,
        fio: data.fio || "Администратор",
      };
      setIsSuccess(true);
      setIsLoading(false);
      loginAdmin(data.access_token, adminData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
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
              <div className="text-red-500 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm mb-6">
                {error}
              </div>
            )}
            {isSuccess && (
              <div className="text-green-600 bg-green-50 p-3 rounded-lg border-l-4 border-green-500 text-sm mb-6">
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
        </div>
      </div>
    </>
  );
}