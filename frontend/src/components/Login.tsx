// frontend/src/components/Login.tsx
"use client";

import React from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";

interface LoginProps {
  isOpen: boolean;
  onClose: () => void;
  toggleMode: () => void;
  isAdminLogin?: boolean;
}

const Login: React.FC<LoginProps> = ({ isOpen, onClose, toggleMode, isAdminLogin = false }) => {
  const endpoint = isAdminLogin ? "/admin/login" : "/auth/login";

  const {
    formValues,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    endpoint,
    isLogin: true,
    onSuccess: onClose,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField
          type="email"
          value={formValues.email}
          onChange={handleChange}
          placeholder="Введите email"
          icon={FaEnvelope}
          name="email"
          disabled={isSuccess}
        />
        <InputField
          type="password"
          value={formValues.password}
          onChange={handleChange}
          placeholder="Введите пароль"
          icon={FaLock}
          name="password"
          disabled={isSuccess}
        />
        <div className="text-sm text-gray-600">
          Нет аккаунта?{" "}
          <button
            type="button"
            onClick={toggleMode}
            className="text-orange-500 hover:text-orange-600 hover:underline transition-colors duration-300"
            disabled={isLoading || isSuccess}
          >
            Зарегистрироваться
          </button>
        </div>
        <div className="flex justify-end space-x-4">
          <ModalButton
            variant="secondary"
            onClick={onClose}
            disabled={isLoading || isSuccess}
          >
            Закрыть
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
  );
};

export default Login;