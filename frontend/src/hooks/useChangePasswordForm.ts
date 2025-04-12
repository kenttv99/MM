// frontend/src/hooks/useChangePasswordForm.ts
"use client";

import { useState, useCallback, FormEvent, ChangeEvent } from "react";
import { ChangePasswordFormValues, ChangePasswordFormOptions } from "@/types/index";
import { apiFetch } from "@/utils/api";

// Тип ответа API
interface ApiErrorResponse {
  error: string;
  status: number;
}

interface ApiAbortedResponse {
  aborted: boolean;
  reason?: string;
}

interface ChangePasswordResponse {
  success: boolean;
  message?: string;
}

export const useChangePasswordForm = ({ initialValues, onSuccess }: ChangePasswordFormOptions) => {
  const [formValues, setFormValues] = useState<ChangePasswordFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      // Проверка совпадения паролей
      if (formValues.newPassword !== formValues.confirmPassword) {
        setError("Новый пароль и подтверждение не совпадают");
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await apiFetch<ChangePasswordResponse>("/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          data: JSON.stringify({
            current_password: formValues.currentPassword,
            new_password: formValues.newPassword,
          }),
          bypassLoadingStageCheck: true, // Обходим проверку стадии загрузки
        });

        if ('aborted' in response) {
          const abortedResponse = response as ApiAbortedResponse;
          throw new Error(abortedResponse.reason || "Запрос был прерван");
        }

        if ('error' in response) {
          const errorResponse = response as ApiErrorResponse;
          let errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при смене пароля";
          
          // Обработка различных типов ошибок
          if (errorResponse.status === 401) {
            errorMessage = "Неверный текущий пароль";
          } else if (errorResponse.status === 400) {
            if (errorMessage.includes("Password is too short")) {
              errorMessage = "Новый пароль слишком короткий";
            } else if (errorMessage.includes("Password must contain")) {
              errorMessage = "Пароль должен содержать буквы и цифры";
            } else if (errorMessage.includes("Current password is incorrect")) {
              errorMessage = "Неверный текущий пароль";
            }
          } else if (errorResponse.status === 500) {
            errorMessage = "Ошибка сервера. Попробуйте позже.";
          }
          
          throw new Error(errorMessage);
        }

        setIsSuccess(true);
        setTimeout(() => {
          if (onSuccess) onSuccess(); // Закрываем модальное окно
        }, 1500);
      } catch (err) {
        let errorMessage = "Произошла ошибка";
        
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        setIsSuccess(false);
      } finally {
        setIsLoading(false);
      }
    },
    [formValues, onSuccess]
  );

  return {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  };
};