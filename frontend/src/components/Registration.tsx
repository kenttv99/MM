// frontend/src/components/Registration.tsx
"use client";

import React from "react";
import { FaUser, FaEnvelope, FaLock, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { IconType } from "react-icons";
import { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";

interface RegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  toggleMode: () => void;
}

interface FieldConfig {
  name: string;
  type: string;
  placeholder: string;
  icon: IconType;
}

const Registration: React.FC<RegistrationProps> = ({ isOpen, onClose, toggleMode }) => {
  const fields: FieldConfig[] = [
    { name: "fio", type: "text", placeholder: "Введите ваше ФИО", icon: FaUser },
    { name: "email", type: "email", placeholder: "Введите email", icon: FaEnvelope },
    { name: "password", type: "password", placeholder: "Введите пароль", icon: FaLock },
    { name: "telegram", type: "text", placeholder: "Введите Telegram", icon: FaTelegram },
    { name: "whatsapp", type: "text", placeholder: "Введите WhatsApp", icon: FaWhatsapp },
  ];

  const initialValues = {
    fio: "",
    email: "",
    password: "",
    telegram: "",
    whatsapp: "",
  };

  const {
    formValues,
    isLoading,
    handleChange,
    handleSubmit,
    isSuccess,
  } = useAuthForm({
    initialValues,
    endpoint: "/auth/register",
    onSuccess: () => {
      onClose();
      toggleMode(); // Переключаемся на логин после успешной регистрации
    },
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {fields.map((field) => (
          <InputField
            key={field.name}
            type={field.type}
            value={formValues[field.name]}
            onChange={handleChange}
            placeholder={field.placeholder}
            icon={field.icon}
            name={field.name}
            disabled={isSuccess}
          />
        ))}
        <div className="text-sm text-gray-600">
          Уже есть аккаунт?{" "}
          <button
            type="button"
            onClick={toggleMode}
            className="text-orange-500 hover:text-orange-600 hover:underline transition-colors duration-300"
            disabled={isLoading || isSuccess}
          >
            Войти
          </button>
        </div>
        <div className="flex justify-end space-x-4">
          <ModalButton variant="secondary" onClick={onClose} disabled={isLoading || isSuccess}>
            Закрыть
          </ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isLoading || isSuccess}>
            {isLoading ? "Регистрация..." : isSuccess ? "Успешно!" : "Зарегистрироваться"}
          </ModalButton>
        </div>
      </form>
    </div>
  );
};

export default Registration;