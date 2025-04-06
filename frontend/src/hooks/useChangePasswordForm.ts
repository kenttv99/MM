// frontend/src/hooks/useChangePasswordForm.ts
import { useState, useCallback, FormEvent, ChangeEvent } from "react";
import { ChangePasswordFormValues, ChangePasswordFormOptions } from "@/types/index";

export const useChangePasswordForm = ({ initialValues, onSuccess }: ChangePasswordFormOptions) => {
  const [formValues, setFormValues] = useState<ChangePasswordFormValues>(initialValues);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setIsLoading(true);

      // Проверка совпадения паролей
      if (formValues.newPassword !== formValues.confirmPassword) {
        setError("Новый пароль и подтверждение не совпадают");
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: formValues.currentPassword,
            new_password: formValues.newPassword,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          let errorMessage = errorData.detail || "Ошибка при смене пароля";
          
          // Обработка различных типов ошибок
          if (response.status === 401) {
            errorMessage = "Неверный текущий пароль";
          } else if (response.status === 400) {
            if (errorMessage.includes("Password is too short")) {
              errorMessage = "Новый пароль слишком короткий";
            } else if (errorMessage.includes("Password must contain")) {
              errorMessage = "Пароль должен содержать буквы и цифры";
            } else if (errorMessage.includes("Current password is incorrect")) {
              errorMessage = "Неверный текущий пароль";
            }
          } else if (response.status === 500) {
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