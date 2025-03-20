// frontend/src/components/Login.tsx
"use client";

import React from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";

interface LoginProps {
  isOpen: boolean;
  onClose: () => void;
}

const Login: React.FC<LoginProps> = ({ isOpen, onClose }) => {
  const {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    endpoint: "/auth/login",
    redirectTo: "/",
    isLogin: true
  });

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
            {isLoading ? "Вход..." : (isSuccess ? "Успешно!" : "Войти")}
          </ModalButton>
        </div>
      </form>
    </AuthModal>
  );
};

export default Login;