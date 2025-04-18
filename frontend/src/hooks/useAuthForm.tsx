// frontend/src/hooks/useAuthForm.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useCallback, useRef, useEffect } from "react";
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

interface ApiError extends Error {
  status: number;
  isClientError: boolean;
  error?: string;
  body?: unknown;
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
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [userHint, setUserHint] = useState<string>("");
  const isSubmitting = useRef(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preventModalClose = useRef(false);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
    if (userHint) setUserHint("");
    setIsSuccess(false);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, [error, successMessage, userHint]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (isSubmitting.current) return;
      isSubmitting.current = true;
      preventModalClose.current = false;

      setError("");
      setSuccessMessage("");
      setUserHint("");
      setIsLoading(true);
      setIsSuccess(false);
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }

      try {
        console.log('AuthForm: Sending login request to endpoint:', endpoint);
        const data = await apiFetch<AuthResponse>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: { ...formValues, isLoginAttempt: isLogin },
          bypassLoadingStageCheck: true
        });

        setIsSuccess(true);
        setSuccessMessage(isLogin ? "Успешный вход!" : "Регистрация успешна!");

        if (isLogin && data.access_token) {
          const userData = {
            id: data.id || 0,
            fio: data.fio || "",
            email: data.email || "",
            telegram: data.telegram || "",
            whatsapp: data.whatsapp || "",
            avatar_url: data.avatar_url,
          };
          
          console.log('AuthForm: Login successful, token received:', data.access_token.substring(0, 10) + '...');
          console.log('AuthForm: User data:', userData);
          console.log('AuthForm: Current loading stage before handleLoginSuccess:', typeof window !== 'undefined' ? (window as Window & { __loading_stage__?: string }).__loading_stage__ : 'N/A');
          
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('token', data.access_token);
              localStorage.setItem('userData', JSON.stringify(userData));
              
              if (!(window as Window & { DEBUG_LOADING_CONTEXT?: boolean }).DEBUG_LOADING_CONTEXT) {
                console.log('AuthForm: Enabling DEBUG_LOADING_CONTEXT');
                (window as Window & { DEBUG_LOADING_CONTEXT?: boolean }).DEBUG_LOADING_CONTEXT = true;
                
                setTimeout(() => {
                  console.log('AuthForm: Disabling DEBUG_LOADING_CONTEXT after timeout');
                  (window as Window & { DEBUG_LOADING_CONTEXT?: boolean }).DEBUG_LOADING_CONTEXT = false;
                }, 2000);
              }
              
              const authEventSent = (window as Window & { __auth_event_sent__?: boolean }).__auth_event_sent__;
              if (!authEventSent) {
                console.log('AuthForm: Dispatching authStateChanged event');
                (window as Window & { __auth_event_sent__?: boolean }).__auth_event_sent__ = true;
                
                window.dispatchEvent(new CustomEvent('authStateChanged', {
                  detail: {
                    isAuth: true,
                    userData,
                    token: data.access_token
                  }
                }));
                
                setTimeout(() => {
                  console.log('AuthForm: Resetting auth event sent flag');
                  (window as Window & { __auth_event_sent__?: boolean }).__auth_event_sent__ = false;
                }, 2000);
              }
            }
            
            handleLoginSuccess(data.access_token, userData);
            
            successTimerRef.current = setTimeout(() => {
              console.log('AuthForm: Closing modal after login success timeout');
              setSuccessMessage("");
              if (onSuccess) {
                console.log('AuthForm: Calling onSuccess callback');
                onSuccess();
                setFormValues(initialValues);
              }
              successTimerRef.current = null;
            }, 1000);
            
          } catch (loginError) {
            console.error('AuthForm: Error during login success handling:', loginError);
            setError("Ошибка обработки входа.");
            setIsSuccess(false);
            setSuccessMessage("");
            preventModalClose.current = true;
            console.log('AuthForm: Keeping modal open due to login error');
          }
        } else if (!isLogin) {
          console.log('AuthForm: Registration successful');
          successTimerRef.current = setTimeout(() => {
            console.log('AuthForm: Closing modal after registration success timeout');
            setSuccessMessage("");
            if (onSuccess) {
              onSuccess();
              setFormValues(initialValues);
            }
            successTimerRef.current = null;
          }, 1000);
        } else {
          throw new Error("Токен авторизации не получен.");
        }
      } catch (err) {
        const apiError = err as ApiError;
        let userFriendlyError = apiError.message;
        let hint = "";
        
        preventModalClose.current = true;
        console.log('AuthForm: Error occurred, preventing modal close');
        
        if ('status' in apiError && 'error' in apiError) {
          if (apiError.status === 401) {
            console.log('Login attempt failed with 401, keeping modal open');
            preventModalClose.current = true;
            userFriendlyError = "Неверные учетные данные, проверьте email и пароль";
            hint = "Проверьте правильность ввода email и пароля.";
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth-unauthorized', { 
                detail: { 
                  endpoint,
                  isLoginAttempt: isLogin
                }
              }));
            }
          } else if (apiError.status === 400) {
            userFriendlyError = "Ошибка в данных формы";
            hint = "Проверьте правильность введенных данных";
          } else if (apiError.status >= 500) {
            userFriendlyError = "Ошибка сервера";
            hint = "Пожалуйста, попробуйте позже";
          } else if (typeof apiError.error === 'string') {
            userFriendlyError = apiError.error;
          }
        } else {
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
            console.log('AuthForm: Authorization error, keeping modal open');
            preventModalClose.current = true;
          } else {
            userFriendlyError = "Произошла ошибка";
            hint = "Пожалуйста, попробуйте еще раз";
          }
        }
        
        setError(userFriendlyError);
        if (hint) setUserHint(hint);
        setIsSuccess(false);
        setSuccessMessage("");
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
    successMessage,
    userHint,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
    preventModalClose: preventModalClose.current,
  };
};