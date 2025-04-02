// frontend/src/hooks/useAuthForm.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/api";
import { UseAuthFormProps } from "@/types/index";

type AuthFormValues = Record<string, string>;
type AuthResponse = {
  access_token?: string;
  id?: number;
  fio?: string;
  email?: string;
  telegram?: string;
  whatsapp?: string;
  avatar_url?: string;
  message?: string;
  [key: string]: unknown;
};

// Define a type for API error with status
interface ApiError extends Error {
  status?: number;
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
        const data = await apiFetch<AuthResponse>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        });

        if (isLogin && data.access_token) {
          const userData = {
            id: data.id || 0,
            fio: data.fio || "",
            email: data.email || "",
            telegram: data.telegram || "",
            whatsapp: data.whatsapp || "",
            avatar_url: data.avatar_url,
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
      } catch (err) {
        let errorMessage = "Произошла ошибка";
        if (err instanceof Error) {
          errorMessage = err.message;
          // Cast err to ApiError to access status property safely
          const apiError = err as ApiError;
          
          if (apiError.status === 429) {
            errorMessage = "Частые запросы. Попробуйте немного позже.";
          } else if (apiError.status === 401) {
            errorMessage = "Неверный логин или пароль";
          } else if (apiError.status === 400) {
            errorMessage = err.message.includes("Email already exists")
              ? "Email уже существует"
              : "Ошибка в данных формы";
          }
        }
        setError(errorMessage);
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