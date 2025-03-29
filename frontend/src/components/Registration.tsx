// frontend/src/components/Registration.tsx
"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { FaUser, FaEnvelope, FaLock, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";
import { motion, AnimatePresence } from "framer-motion";
import { FieldConfig, FormErrors, TouchedFields } from "@/types/index";

interface RegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  toggleMode: () => void;
}

const Registration: React.FC<RegistrationProps> = ({ isOpen, onClose, toggleMode }) => {
  const fields: FieldConfig[] = useMemo(
    () => [
      {
        name: "fio",
        type: "text",
        placeholder: "Введите ваше ФИО",
        icon: FaUser,
        required: true,
        validate: (value) => {
          if (!value.trim() && !value) return "ФИО обязательно";
          if (value.length < 2) return "ФИО должно содержать минимум 2 символа";
          if (!/^[a-zA-Zа-яА-Я\s-]+$/.test(value)) return "Только буквы, пробелы и дефисы";
          return null;
        },
      },
      {
        name: "email",
        type: "email",
        placeholder: "Введите email",
        icon: FaEnvelope,
        required: true,
        validate: (value) => {
          if (!value) return "Email обязателен";
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Неверный формат email";
          return null;
        },
      },
      {
        name: "password",
        type: "password",
        placeholder: "Введите пароль",
        icon: FaLock,
        required: true,
        validate: (value) => {
          if (!value) return "Пароль обязателен";
          if (value.length < 8) return "Минимум 8 символов";
          if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Буквы и цифры обязательны";
          return null;
        },
      },
      {
        name: "telegram",
        type: "text",
        placeholder: "Введите Telegram (например, @username)",
        icon: FaTelegram,
        required: false,
        validate: (value) => {
          if (!value) return null;
          if (!/^@[\w]{5,32}$/.test(value)) return "Формат: @username (5-32 символа)";
          return null;
        },
      },
      {
        name: "whatsapp",
        type: "text",
        placeholder: "Введите WhatsApp (только цифры)",
        icon: FaWhatsapp,
        required: false,
        validate: (value) => {
          if (!value) return null;
          if (!/^\d{10,15}$/.test(value)) return "10-15 цифр без пробелов";
          return null;
        },
      },
    ],
    []
  );

  const initialValues = useMemo(
    () => ({
      fio: "",
      email: "",
      password: "",
      telegram: "",
      whatsapp: "",
    }),
    []
  );

  const [formErrors, setFormErrors] = useState<FormErrors>(
    Object.fromEntries(fields.map((field) => [field.name, null]))
  );
  const [touched, setTouched] = useState<TouchedFields>(
    Object.fromEntries(fields.map((field) => [field.name, false]))
  );
  const [isValid, setIsValid] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { formValues, isLoading, handleChange: authHandleChange, handleSubmit, isSuccess, error } =
    useAuthForm({
      initialValues,
      endpoint: "/auth/register",
      onSuccess: useCallback(() => {
        console.log("Registration: onSuccess called, closing modal");
        onClose();
        if (toggleMode) toggleMode();
      }, [onClose, toggleMode]),
    });

  console.log("Registration: isOpen:", isOpen, "isSuccess:", isSuccess, "isLoading:", isLoading);

  const validateField = useCallback(
    (name: string, value: string) => {
      const field = fields.find((f) => f.name === name);
      return field ? field.validate(value) : null;
    },
    [fields]
  );

  const validateForm = useCallback(() => {
    const errors = Object.fromEntries(
      fields.map((field) => [field.name, validateField(field.name, formValues[field.name])])
    );
    return errors;
  }, [fields, formValues, validateField]);

  useEffect(() => {
    const errors = validateForm();
    setFormErrors(errors);
    setIsValid(Object.values(errors).every((error) => error === null));
  }, [formValues, validateForm]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      let formattedValue = value;

      if (name === "telegram") {
        formattedValue = value.startsWith("@") ? value : value ? `@${value}` : "";
      } else if (name === "whatsapp") {
        formattedValue = value.replace(/\D/g, "");
      }

      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: name,
          value: formattedValue,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      authHandleChange(syntheticEvent);

      const error = validateField(name, formattedValue);
      setFormErrors((prev) => ({ ...prev, [name]: error }));
      setTouched((prev) => ({ ...prev, [name]: true }));
    },
    [authHandleChange, validateField]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setTouched((prev) => ({ ...prev, [name]: true }));
      const error = validateField(name, value);
      setFormErrors((prev) => ({ ...prev, [name]: error }));
    },
    [validateField]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitted(true);
      setTouched(
        Object.fromEntries(fields.map((field) => [field.name, true]))
      );
      if (isValid) {
        handleSubmit(e);
      }
    },
    [isValid, handleSubmit, fields]
  );

  const shouldShowError = (field: FieldConfig, error: string | null) => {
    if (!error) return false;
    if (field.required && !formValues[field.name]) {
      return isSubmitted;
    }
    return touched[field.name];
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name} className="relative">
            <InputField
              type={field.type}
              value={formValues[field.name]}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={field.placeholder}
              icon={field.icon}
              name={field.name}
              disabled={isLoading || isSuccess}
              required={field.required}
            />
            <AnimatePresence>
              {shouldShowError(field, formErrors[field.name]) && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 -bottom-5 text-red-500 text-xs mt-1"
                >
                  {formErrors[field.name]}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        ))}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-red-500 text-sm"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="text-sm text-gray-600">
          Уже есть аккаунт?{" "}
          <button
            type="button"
            onClick={() => {
              if (toggleMode) toggleMode();
            }}
            className="text-orange-500 hover:text-orange-600 hover:underline transition-colors duration-300"
            disabled={isLoading || isSuccess}
          >
            Войти
          </button>
        </div>
        <div className="flex justify-end space-x-4 pt-2">
          <ModalButton variant="secondary" onClick={onClose} disabled={isLoading || isSuccess}>
            Закрыть
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            disabled={isLoading || isSuccess || !isValid}
          >
            {isLoading ? "Регистрация..." : isSuccess ? "Успешно!" : "Зарегистрироваться"}
          </ModalButton>
        </div>
      </form>
    </div>
  );
};

export default Registration;