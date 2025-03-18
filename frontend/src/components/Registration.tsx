// frontend/src/components/Registration.tsx
"use client";

import React, { useState, FormEvent, ChangeEvent, Dispatch, SetStateAction } from "react";
import { FaUser, FaEnvelope, FaLock, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { IconType } from "react-icons";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
// No need to import useAuth as we don't use it

interface RegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  setLoginOpen: Dispatch<SetStateAction<boolean>>;
}

interface FormDataType {
  fio: string;
  email: string;
  password: string;
  telegram: string;
  whatsapp: string;
  [key: string]: string;
}

interface FieldConfig {
  name: string;
  type: string;
  placeholder: string;
  icon: IconType;
}

const Registration: React.FC<RegistrationProps> = ({ isOpen, onClose, setLoginOpen }) => {
  // We don't need any auth context here since we just redirect to login
  const [formData, setFormData] = useState<FormDataType>({
    fio: "",
    email: "",
    password: "",
    telegram: "",
    whatsapp: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Registration successful
        onClose();
        
        // Reset form
        setFormData({
          fio: "",
          email: "",
          password: "",
          telegram: "",
          whatsapp: "",
        });
        
        // Open login modal
        setLoginOpen(true);
      } else {
        const errorText = await response.text();
        let errorMessage = "Ошибка регистрации";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error("Не удалось разобрать JSON ошибки:", errorText);
        }
        setError(errorMessage);
      }
    } catch (error) {
      setError("Произошла ошибка при попытке регистрации");
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fields: FieldConfig[] = [
    { name: "fio", type: "text", placeholder: "Введите ваше ФИО", icon: FaUser },
    { name: "email", type: "email", placeholder: "Введите email", icon: FaEnvelope },
    { name: "password", type: "password", placeholder: "Введите пароль", icon: FaLock },
    { name: "telegram", type: "text", placeholder: "Введите Telegram", icon: FaTelegram },
    { name: "whatsapp", type: "text", placeholder: "Введите WhatsApp", icon: FaWhatsapp },
  ];

  return (
    <AuthModal isOpen={isOpen} onClose={onClose} title="Регистрация" error={error}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {fields.map((field) => (
          <InputField
            key={field.name}
            type={field.type}
            value={formData[field.name]}
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