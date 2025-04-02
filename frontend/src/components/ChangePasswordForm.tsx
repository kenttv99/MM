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
      className="max-w-[90vw] min-w-[300px] w-full sm:max-w-md"
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
          className="w-full"
        />
        <InputField
          type="password"
          value={formValues.newPassword}
          onChange={handleChange}
          placeholder="Новый пароль"
          icon={FaLock}
          name="newPassword"
          disabled={isSuccess}
          className="w-full"
        />
        <InputField
          type="password"
          value={formValues.confirmPassword}
          onChange={handleChange}
          placeholder="Подтвердите новый пароль"
          icon={FaLock}
          name="confirmPassword"
          disabled={isSuccess}
          className="w-full"
        />
        <div className="flex flex-col sm:flex-row justify-end space-y-4 sm:space-y-0 sm:space-x-4">
          <ModalButton
            variant="secondary"
            onClick={onClose}
            disabled={isLoading || isSuccess}
            className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
          >
            Отмена
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            disabled={isLoading || isSuccess}
            className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
          >
            {isLoading ? "Смена..." : isSuccess ? "Успешно!" : "Сменить пароль"}
          </ModalButton>
        </div>
      </form>
    </AuthModal>
  );
};

export default ChangePasswordForm;