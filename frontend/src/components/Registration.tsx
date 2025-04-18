"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { FaUser, FaEnvelope, FaLock, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import SuccessDisplay from "./common/SuccessDisplay";
import { useAuthForm } from "@/hooks/useAuthForm";
import { motion, AnimatePresence } from "framer-motion";
import { FieldConfig, FormErrors, TouchedFields } from "@/types/index";
import ClientErrorBoundary from "./Errors/ClientErrorBoundary";

interface RegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  toggleMode: () => void;
}

const Registration: React.FC<RegistrationProps> = ({ isOpen, onClose, toggleMode }) => {
  const fields: FieldConfig[] = useMemo(
    () => [
      { name: "fio", type: "text", placeholder: "Введите ваше ФИО", icon: FaUser, required: true, validate: (value) => (!value.trim() ? "ФИО обязательно" : value.length < 2 ? "Минимум 2 символа" : !/^[a-zA-Zа-яА-Я\s-]+$/.test(value) ? "Только буквы, пробелы и дефисы" : null) },
      { name: "email", type: "email", placeholder: "Введите email", icon: FaEnvelope, required: true, validate: (value) => (!value ? "Email обязателен" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Неверный формат email" : null) },
      { name: "password", type: "password", placeholder: "Введите пароль", icon: FaLock, required: true, validate: (value) => (!value ? "Пароль обязателен" : value.length < 8 ? "Минимум 8 символов" : !/[A-Za-z]/.test(value) || !/\d/.test(value) ? "Буквы и цифры обязательны" : null) },
      { name: "telegram", type: "text", placeholder: "Введите Telegram (например, @username)", icon: FaTelegram, required: false, validate: (value) => (!value ? null : !/^@[\w]{5,32}$/.test(value) ? "Формат: @username (5-32 символа)" : null) },
      { name: "whatsapp", type: "text", placeholder: "Введите WhatsApp (только цифры)", icon: FaWhatsapp, required: false, validate: (value) => (!value ? null : !/^\d{10,15}$/.test(value) ? "10-15 цифр без пробелов" : null) },
    ],
    []
  );

  const initialValues = useMemo(() => ({ fio: "", email: "", password: "", telegram: "", whatsapp: "" }), []);

  const [formErrors, setFormErrors] = useState<FormErrors>(Object.fromEntries(fields.map((field) => [field.name, null])));
  const [touched, setTouched] = useState<TouchedFields>(Object.fromEntries(fields.map((field) => [field.name, false])));
  const [isValid, setIsValid] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    formValues,
    isLoading,
    handleChange: authHandleChange,
    handleSubmit,
    isSuccess,
    error,
    successMessage,
    userHint,
  } = useAuthForm({
    initialValues,
    endpoint: "/auth/register",
    onSuccess: useCallback(() => {
      console.log("Registration component: onSuccess triggered from hook, calling onClose");
      onClose();
    }, [onClose]),
  });

  const validateField = useCallback((name: string, value: string) => {
    const field = fields.find((f) => f.name === name);
    return field ? field.validate(value) : null;
  }, [fields]);

  const validateForm = useCallback(() => {
    const errors = Object.fromEntries(fields.map((field) => [field.name, validateField(field.name, formValues[field.name])]));
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
      if (name === "telegram") formattedValue = value.startsWith("@") ? value : value ? `@${value}` : "";
      else if (name === "whatsapp") formattedValue = value.replace(/\D/g, "");
      const syntheticEvent = { ...e, target: { ...e.target, name, value: formattedValue } } as React.ChangeEvent<HTMLInputElement>;
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
      setTouched(Object.fromEntries(fields.map((field) => [field.name, true])));
      if (isValid) handleSubmit(e);
    },
    [isValid, handleSubmit, fields]
  );

  const shouldShowError = (field: FieldConfig, error: string | null) => {
    if (!error) return false;
    if (field.required && !formValues[field.name]) return isSubmitted;
    return touched[field.name];
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-3">
      <ClientErrorBoundary>
        <form onSubmit={onSubmit} className="space-y-2">
          <SuccessDisplay message={successMessage} />

          {fields.map((field) => (
            <div key={field.name} className="relative mb-4">
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
                className="w-full"
              />
              <AnimatePresence>
                {shouldShowError(field, formErrors[field.name]) && !successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 bottom-[-28px] z-10 bg-red-100 border border-red-300 text-red-700 text-xs py-0.5 px-2 rounded shadow-sm"
                    style={{ maxWidth: "calc(100% - 10px)" }}
                  >
                    <div className="relative">
                      {formErrors[field.name]}
                      <div className="absolute w-2 h-2 bg-red-100 border-b border-r border-red-300 transform rotate-45 left-4 top-[-6px]"></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {error && !successMessage && (
            <div className="p-1.5 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-xs">
              <p>{error}</p>
            </div>
          )}
          {userHint && !successMessage && (
            <div className="p-1.5 bg-blue-50 border-l-4 border-blue-500 text-blue-700 rounded-md text-xs">
              <p>{userHint}</p>
            </div>
          )}
          <div className="text-xs text-gray-600">
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => toggleMode && toggleMode()}
              className="text-orange-500 hover:text-orange-600 text-xs"
              disabled={isLoading || isSuccess}
            >
              Войти
            </button>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 mt-2">
            <ModalButton
              variant="secondary"
              onClick={onClose}
              disabled={isLoading || isSuccess}
              className="w-full sm:w-auto sm:min-w-[100px] min-h-[40px] text-sm"
            >
              Закрыть
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              disabled={isLoading || isSuccess || !isValid}
              className="w-full sm:w-auto sm:min-w-[100px] min-h-[40px] text-sm"
            >
              {isLoading ? "Регистрация..." : isSuccess && successMessage ? "Успешно!" : "Зарегистрироваться"}
            </ModalButton>
          </div>
        </form>
      </ClientErrorBoundary>
    </div>
  );
};

export default Registration;