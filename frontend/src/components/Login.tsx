"use client";

import React from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";
import { LoginProps } from "@/types/index";
import ClientErrorBoundary from "./Errors/ClientErrorBoundary";

const Login: React.FC<LoginProps> = ({ isOpen, onClose, toggleMode, isAdminLogin = false }) => {
  const endpoint = isAdminLogin ? "/admin/login" : "/auth/login";

  const {
    formValues,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
    error,
    userHint,
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    endpoint,
    isLogin: true,
    onSuccess: () => onClose(),
  });

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      <ClientErrorBoundary>
        <form onSubmit={handleSubmit} className="space-y-6">
          <InputField
            type="email"
            value={formValues.email}
            onChange={handleChange}
            placeholder="Введите email"
            icon={FaEnvelope}
            name="email"
            disabled={isSuccess}
            className="w-full"
          />
          <InputField
            type="password"
            value={formValues.password}
            onChange={handleChange}
            placeholder="Введите пароль"
            icon={FaLock}
            name="password"
            disabled={isSuccess}
            className="w-full"
          />
          {error && (
            <div className="p-2 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-xs">
              <p>{error}</p>
            </div>
          )}
          {userHint && (
            <div className="p-2 bg-blue-50 border-l-4 border-blue-500 text-blue-700 rounded-md text-xs">
              <p>{userHint}</p>
            </div>
          )}
          <div className="text-xs text-gray-600">
            Нет аккаунта?{" "}
            <button
              type="button"
              onClick={() => toggleMode && toggleMode()}
              className="text-orange-500 hover:text-orange-600 text-xs"
              disabled={isLoading || isSuccess}
            >
              Зарегистрироваться
            </button>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-4">
            <ModalButton
              variant="secondary"
              onClick={onClose}
              disabled={isLoading || isSuccess}
              className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
            >
              Закрыть
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              disabled={isLoading || isSuccess}
              className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
            >
              {isLoading ? "Вход..." : isSuccess ? "Успешно!" : "Войти"}
            </ModalButton>
          </div>
        </form>
      </ClientErrorBoundary>
    </div>
  );
};

export default Login;