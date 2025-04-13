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
  error?: string;
  body?: any;
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
        console.log('AuthForm: Sending login request to endpoint:', endpoint);
        // Используем обновленный apiFetch для выполнения запроса аутентификации
        const data = await apiFetch<AuthResponse>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: formValues,
          bypassLoadingStageCheck: true // Обходим проверку стадии загрузки для запросов аутентификации
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
          
          // First set success state and hint
          setIsSuccess(true);
          setUserHint("Успешная авторизация! Перенаправление...");
          
          console.log('AuthForm: Login successful, token received:', data.access_token.substring(0, 10) + '...');
          console.log('AuthForm: User data:', userData);
          console.log('AuthForm: Current loading stage before handleLoginSuccess:', typeof window !== 'undefined' ? (window as any).__loading_stage__ : 'N/A');
          
          try {
            // Принудительно устанавливаем данные в localStorage перед вызовом handleLoginSuccess
            if (typeof window !== 'undefined') {
              localStorage.setItem('token', data.access_token);
              localStorage.setItem('userData', JSON.stringify(userData));
              
              // Включаем режим отладки для системы стадий, но только если он еще не включен
              if (!(window as any).DEBUG_LOADING_CONTEXT) {
                console.log('AuthForm: Enabling DEBUG_LOADING_CONTEXT');
                (window as any).DEBUG_LOADING_CONTEXT = true;
                
                // Устанавливаем таймер для отключения режима отладки через 2 секунды
                setTimeout(() => {
                  console.log('AuthForm: Disabling DEBUG_LOADING_CONTEXT after timeout');
                  (window as any).DEBUG_LOADING_CONTEXT = false;
                }, 2000);
              }
              
              // Проверяем, не было ли уже отправлено сообщение authStateChanged
              const authEventSent = (window as any).__auth_event_sent__;
              if (!authEventSent) {
                console.log('AuthForm: Dispatching authStateChanged event');
                (window as any).__auth_event_sent__ = true;
                
                // Диспатчим событие и устанавливаем таймер для сброса флага
                window.dispatchEvent(new CustomEvent('authStateChanged', {
                  detail: {
                    isAuth: true,
                    userData,
                    token: data.access_token
                  }
                }));
                
                // Сбрасываем флаг через 2 секунды
                setTimeout(() => {
                  console.log('AuthForm: Resetting auth event sent flag');
                  (window as any).__auth_event_sent__ = false;
                }, 2000);
              }
            }
            
            // Вызываем handleLoginSuccess для обработки авторизации
            handleLoginSuccess(data.access_token, userData);
            
            // Ждем небольшую задержку перед вызовом onSuccess, чтобы дать время контексту обновиться
            setTimeout(() => {
              // Проверка состояния после вызова handleLoginSuccess
              console.log('AuthForm: Logging in complete - authentication should be updated');
              
              // Call onSuccess callback to close modal
              if (onSuccess) {
                console.log('AuthForm: Calling onSuccess callback');
                onSuccess();
                setFormValues(initialValues);
              }
            }, 100);
            
          } catch (loginError) {
            console.error('AuthForm: Error during login success handling:', loginError);
            // Даже при ошибке, пытаемся закрыть модальное окно
            if (onSuccess) {
              onSuccess();
              setFormValues(initialValues);
            }
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
        
        // Проверяем, есть ли статус и ошибка в ответе
        if ('status' in apiError && 'error' in apiError) {
          const status = apiError.status;
          
          // Обработка ошибок по статусу ответа
          if (status === 401) {
            userFriendlyError = "Неверный логин или пароль";
          } else if (status === 400) {
            userFriendlyError = "Ошибка в данных формы";
            hint = "Проверьте правильность введенных данных";
          } else if (status >= 500) {
            userFriendlyError = "Ошибка сервера";
            hint = "Пожалуйста, попробуйте позже";
          } else if (typeof apiError.error === 'string') {
            userFriendlyError = apiError.error;
          }
        } else {
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