// frontend/src/hooks/useAuthForm.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/api";

type AuthFormValues = Record<string, string>;

interface UseAuthFormProps {
  initialValues: AuthFormValues;
  endpoint: string;
  onSuccess?: () => void;
  isLogin?: boolean;
}

export const useAuthForm = ({
  initialValues,
  endpoint,
  onSuccess,
  isLogin = false,
}: UseAuthFormProps) => {
  const { handleLoginSuccess } = useAuth();
  const [formValues, setFormValues] = useState<AuthFormValues>(initialValues);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const isSubmitting = useRef(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (isSubmitting.current) return;
      isSubmitting.current = true;

      setError("");
      setIsLoading(true);
      setIsSuccess(false);

      try {
        const response = await apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        });

        if (response.ok) {
          const data = await response.json();

          if (isLogin && data.access_token) {
            const userData = {
              id: data.id,
              fio: data.fio || "",
              email: data.email,
              telegram: data.telegram || "",
              whatsapp: data.whatsapp || "",
              avatar_url: data.avatar_url || undefined,
            };
            handleLoginSuccess(data.access_token, userData);
            setIsSuccess(true);
          } else {
            setIsSuccess(true);
          }

          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
              setFormValues(initialValues);
            }, 1000);
          }
        } else {
          // Обрабатываем все ошибки, включая 429
          const errorText = await response.text();
          let errorMessage = "Произошла ошибка";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || "Произошла ошибка";
          } catch {
            errorMessage = "Произошла ошибка";
          }
          // Проверяем статус ответа, чтобы перехватить 429
          if (response.status === 429) {
            errorMessage = "Частые запросы. Попробуйте немного позже.";
          }
          setError(errorMessage);
        }
      } catch (err) {
        // Обрабатываем только сетевые ошибки или 500-е ошибки
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        setIsLoading(false);
        isSubmitting.current = false;
      }
    },
    [endpoint, formValues, isLogin, handleLoginSuccess, onSuccess, initialValues]
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