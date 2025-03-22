"use client";

import React from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAdminAuthForm } from "@/hooks/useAdminAuthForm";

interface LoginProps {
  isOpen?: boolean; // Опционально для модального окна
  onClose?: () => void; // Опционально для модального окна
  isAdminLogin?: boolean; // Указывает, что это админская авторизация
}

const Login: React.FC<LoginProps> = ({ isOpen, onClose, isAdminLogin = false }) => {
  const endpoint = isAdminLogin ? "/admin/login" : "/auth/login";
  const redirectTo = isAdminLogin ? "/admin" : "/";
  
  const {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  } = useAdminAuthForm({
    initialValues: { email: "", password: "" },
    endpoint,
    redirectTo,
    isLogin: true,
  });

  // Если используется как страница, а не модалка
  if (!isOpen || !onClose) {
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

  // Если используется как модалка
  return (
    <AuthModal
      isOpen={isOpen}
      onClose={onClose}
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
    </AuthModal>
  );
};

export default Login;