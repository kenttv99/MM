// frontend/src/components/Registration.tsx
"use client";

import React, { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FaUser, FaEnvelope, FaLock, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { IconType } from "react-icons";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";

interface RegistrationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormDataType {
  fio: string;
  email: string;
  password: string;
  telegram: string;
  whatsapp: string;
  [key: string]: string; // Index signature to allow access with dynamic keys
}

interface FieldConfig {
  name: string;
  type: string;
  placeholder: string;
  icon: IconType;
}

const Registration: React.FC<RegistrationProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<FormDataType>({
    fio: "",
    email: "",
    password: "",
    telegram: "",
    whatsapp: ""
  });
  const [error, setError] = useState("");
  const router = useRouter();

  // Handle all input changes with a single function
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onClose();
        router.push("/auth/login");
      } else {
        const data = await response.json();
        setError(data.detail || "Ошибка регистрации");
      }
    } catch (error) {
      setError("Произошла ошибка при попытке регистрации");
      console.error("Registration error:", error);
    }
  };

  // Form fields configuration to reduce duplication
  const fields: FieldConfig[] = [
    { name: "fio", type: "text", placeholder: "Введите ваше ФИО", icon: FaUser },
    { name: "email", type: "email", placeholder: "Введите email", icon: FaEnvelope },
    { name: "password", type: "password", placeholder: "Введите пароль", icon: FaLock },
    { name: "telegram", type: "text", placeholder: "Введите Telegram", icon: FaTelegram },
    { name: "whatsapp", type: "text", placeholder: "Введите WhatsApp", icon: FaWhatsapp }
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
          <ModalButton 
            variant="secondary" 
            onClick={onClose}
          >
            Закрыть
          </ModalButton>
          <ModalButton 
            type="submit" 
            variant="primary"
          >
            Зарегистрироваться
          </ModalButton>
        </div>
      </form>
    </AuthModal>
  );
};

export default Registration;