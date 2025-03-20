// frontend/src/components/Registration.tsx
"use client";

import React, { Dispatch, SetStateAction } from "react";
import { FaUser, FaEnvelope, FaLock, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { IconType } from "react-icons";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";

interface RegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  setLoginOpen: Dispatch<SetStateAction<boolean>>;
}

interface FieldConfig {
  name: string;
  type: string;
  placeholder: string;
  icon: IconType;
}

const Registration: React.FC<RegistrationProps> = ({ isOpen, onClose, setLoginOpen }) => {
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

  const onSuccess = () => {
    onClose();
    setLoginOpen(true);
  };

  const {
    formValues,
    error,
    isLoading,
    handleChange,
    handleSubmit
  } = useAuthForm({
    initialValues,
    endpoint: "/auth/register",
    onSuccess
  });

  return (
    <AuthModal isOpen={isOpen} onClose={onClose} title="Регистрация" error={error}>
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
          />
        ))}
        <div className="flex justify-end space-x-4">
          <ModalButton variant="secondary" onClick={onClose} disabled={isLoading}>
            Закрыть
          </ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </ModalButton>
        </div>
      </form>
    </AuthModal>
  );
};

export default Registration;