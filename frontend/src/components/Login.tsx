"use client";

import React from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuthForm } from "@/hooks/useAuthForm";
import { motion, AnimatePresence } from "framer-motion";
import { LoginProps } from "@/types/index";

const Login: React.FC<LoginProps> = ({ isOpen, onClose, toggleMode, isAdminLogin = false }) => {
  const endpoint = isAdminLogin ? "/admin/login" : "/auth/login";

  const {
    formValues,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
    error,
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    endpoint,
    isLogin: true,
    onSuccess: () => onClose(),
  });

  if (!isOpen) return null;

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
          className="w-full"
        />
        <InputField
          type="password"
          value={formValues.password}
          onChange={handleChange}
          placeholder="Введите пароль"
          icon={FaLock}
          name="password"
          disabled={isSuccess}
          className="w-full"
        />
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-red-500 text-sm overflow-wrap-break-word"
              style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)" }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="text-sm text-gray-600" style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)" }}>
          Нет аккаунта?{" "}
          <button
            type="button"
            onClick={() => toggleMode && toggleMode()}
            className="text-orange-500 hover:text-orange-600 hover:underline transition-colors duration-300"
            disabled={isLoading || isSuccess}
          >
            Зарегистрироваться
          </button>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-4">
          <ModalButton
            variant="secondary"
            onClick={onClose}
            disabled={isLoading || isSuccess}
            className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
          >
            Закрыть
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            disabled={isLoading || isSuccess}
            className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
          >
            {isLoading ? "Вход..." : isSuccess ? "Успешно!" : "Войти"}
          </ModalButton>
        </div>
      </form>
    </div>
  );
};

export default Login;