// frontend/src/hooks/useAuthForm.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/api";
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';
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

interface ApiError extends Error {
  status: number;
  isClientError: boolean;
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
  const [userHint, setUserHint] = useState<string>("");
  const isSubmitting = useRef(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    
    // Очищаем ошибку и подсказку при вводе
    if (error) setError("");
    if (userHint) setUserHint("");
  }, [error, userHint]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (isSubmitting.current) return;
      isSubmitting.current = true;

      setError("");
      setUserHint("");
      setIsLoading(true);
      setIsSuccess(false);

      try {
        const data = await apiFetch<AuthResponse>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(formValues),
          bypassLoadingStageCheck: true, // Обходим проверку стадии загрузки для запросов аутентификации
        });

        if ('aborted' in data) {
          const abortedResponse = data as unknown as ApiAbortedResponse;
          throw new Error(abortedResponse.reason || "Запрос был прерван");
        }

        if ('error' in data) {
          // Преобразуем технические сообщения об ошибках в понятные для пользователя
          const errorResponse = data as unknown as ApiErrorResponse;
          let userFriendlyError = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка при авторизации";
          let hint = "";
          
          if (typeof errorResponse.error === 'string') {
            // Обработка ошибок аутентификации
            if (userFriendlyError.includes('Unauthorized') || userFriendlyError.includes('401')) {
              userFriendlyError = "Неверный логин или пароль";
              hint = "";
            } else if (userFriendlyError.includes('password')) {
              userFriendlyError = "Ошибка с паролем";
              hint = "Пароль должен содержать не менее 8 символов, включая буквы и цифры";
            } else if (userFriendlyError.includes('email')) {
              userFriendlyError = "Ошибка с email";
              hint = "Пожалуйста, введите корректный email адрес";
            } else if (userFriendlyError.includes('user') || userFriendlyError.includes('пользователь')) {
              userFriendlyError = "Пользователь не найден";
              hint = "Пользователь с таким email уже существует";
            } else if (userFriendlyError.includes('credentials') || userFriendlyError.includes('неверные учетные данные')) {
              userFriendlyError = "Неверные учетные данные";
              hint = "Неверный email или пароль. Проверьте введенные данные";
            } else if (userFriendlyError.includes('network') || userFriendlyError.includes('сеть')) {
              userFriendlyError = "Ошибка сети";
              hint = "Проверьте подключение к интернету и попробуйте снова";
            } else if (userFriendlyError.includes('server') || userFriendlyError.includes('сервер')) {
              userFriendlyError = "Ошибка сервера";
              hint = "Пожалуйста, попробуйте позже";
            }
          }
          
          setError(userFriendlyError);
          if (hint) setUserHint(hint);
          return;
        }

        if (isLogin && data.access_token) {
          const userData = {
            id: data.id || 0,
            fio: data.fio || "",
            email: data.email || "",
            telegram: data.telegram || "",
            whatsapp: data.whatsapp || "",
            avatar_url: data.avatar_url,
          };
          
          // First set success state and hint
          setIsSuccess(true);
          setUserHint("Успешная авторизация! Перенаправление...");
          
          console.log('AuthForm: Login successful, token received:', data.access_token.substring(0, 10) + '...');
          console.log('AuthForm: User data:', userData);
          
          // Call handleLoginSuccess immediately without delay
          console.log('AuthForm: Calling handleLoginSuccess with token and user data');
          handleLoginSuccess(data.access_token, userData);
          
          // Call onSuccess after login is handled
          if (onSuccess) {
            console.log('AuthForm: Calling onSuccess callback');
            onSuccess();
            setFormValues(initialValues);
          }
        } else {
          setIsSuccess(true);
          setUserHint("Регистрация успешна! Перенаправление...");
          
          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
              setFormValues(initialValues);
            }, 1000);
          }
        }
      } catch (err) {
        const apiError = err as ApiError;
        let userFriendlyError = apiError.message;
        let hint = "";
        
        // Преобразуем технические сообщения об ошибках в понятные для пользователя
        if (apiError.message.includes('blocked')) {
          userFriendlyError = "Запрос заблокирован";
          hint = "Пожалуйста, подождите. Система инициализируется...";
        } else if (apiError.message.includes('network') || apiError.message.includes('сеть')) {
          userFriendlyError = "Ошибка сети";
          hint = "Проверьте подключение к интернету и попробуйте снова";
        } else if (apiError.message.includes('timeout')) {
          userFriendlyError = "Превышено время ожидания";
          hint = "Сервер не отвечает. Пожалуйста, попробуйте позже";
        } else if (apiError.message.includes('Unauthorized') || apiError.message.includes('401')) {
          userFriendlyError = "Неверный логин или пароль";
          hint = "";
        } else {
          userFriendlyError = "Произошла ошибка";
          hint = "Пожалуйста, попробуйте еще раз";
        }
        
        setError(userFriendlyError);
        if (hint) setUserHint(hint);
        console.log(`Authentication error: ${apiError.message}`);
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
    userHint,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  };
};