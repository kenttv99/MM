// frontend/src/components/ChangePasswordForm.tsx
"use client";

import React from "react";
import { FaLock } from "react-icons/fa";
import InputField from "./common/InputField";
import { useChangePasswordForm } from "@/hooks/useChangePasswordForm";
import AuthModal, { ModalButton } from "./common/AuthModal";
import { ChangePasswordFormProps } from "@/types/index";

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ isOpen, onClose }) => {
  const {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  } = useChangePasswordForm({
    initialValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    onSuccess: onClose,
  });

  return (
    <AuthModal
      isOpen={isOpen}
      onClose={onClose}
      title="Смена пароля"
      error={error}
      success={isSuccess ? "Пароль успешно изменен!" : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField
          type="password"
          value={formValues.currentPassword}
          onChange={handleChange}
          placeholder="Текущий пароль"
          icon={FaLock}
          name="currentPassword"
          disabled={isSuccess}
        />
        <InputField
          type="password"
          value={formValues.newPassword}
          onChange={handleChange}
          placeholder="Новый пароль"
          icon={FaLock}
          name="newPassword"
          disabled={isSuccess}
        />
        <InputField
          type="password"
          value={formValues.confirmPassword}
          onChange={handleChange}
          placeholder="Подтвердите новый пароль"
          icon={FaLock}
          name="confirmPassword"
          disabled={isSuccess}
        />
        <div className="flex justify-end space-x-4">
          <ModalButton variant="secondary" onClick={onClose} disabled={isLoading || isSuccess}>
            Отмена
          </ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isLoading || isSuccess}>
            {isLoading ? "Смена..." : isSuccess ? "Успешно!" : "Сменить пароль"}
          </ModalButton>
        </div>
      </form>
    </AuthModal>
  );
};

export default ChangePasswordForm;