// frontend/src/hooks/useAuthForm.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useCallback, useEffect } from "react";
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
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setIsLoading(true);
      setIsSuccess(false);
      setSubmitSuccess(false);

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
            setSubmitSuccess(true);
          } else {
            setSubmitSuccess(true);
          }
        } else {
          const errorText = await response.text();
          let errorMessage = "Ошибка запроса";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorMessage;
          } catch {
            console.error("Не удалось разобрать JSON ошибки:", errorText);
          }
          setError(errorMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
        setError(`Произошла ошибка: ${errorMessage}`);
        console.error("Auth form error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, formValues, isLogin, handleLoginSuccess]
  );

  useEffect(() => {
    if (submitSuccess) {
      setIsSuccess(true);
      const timer = setTimeout(() => {
        setFormValues(initialValues);
        if (onSuccess) onSuccess();
        setSubmitSuccess(false); // Сбрасываем флаг после выполнения
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess, initialValues, onSuccess]);

  return {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  };
};