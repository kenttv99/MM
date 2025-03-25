// frontend/src/components/Login.tsx
"use client";

import React from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";

interface LoginProps {
  isOpen?: boolean;
  onClose?: () => void;
  isAdminLogin?: boolean;
}

const Login: React.FC<LoginProps> = ({ isOpen, onClose, isAdminLogin = false }) => {
  const endpoint = isAdminLogin ? "/admin/login" : "/auth/login";
  
  const {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    endpoint,
    isLogin: true,
    onSuccess: onClose // Закрываем модальное окно после успешной авторизации
  });

  // If using as a standalone component and not a modal
  if (!isOpen && !onClose) {
    return (
      <div className="space-y-6">
        <form onSubmit={handleSubmit}>
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
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full mt-4 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isLoading ? "Вход..." : isSuccess ? "Успешно!" : "Войти"}
          </button>
        </form>
      </div>
    );
  }

  // Only render the modal if isOpen is true
  if (!isOpen) {
    return null;
  }

  return (
    <AuthModal
      isOpen={isOpen}
      onClose={onClose!}
      title="Вход"
      error={error}
      success={isSuccess ? "Вход выполнен успешно!" : undefined}
    >
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
        <div className="flex justify-end space-x-4">
          <ModalButton
            variant="secondary"
            onClick={() => onClose && onClose()}
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
    </AuthModal>
  );
};

export default Login;