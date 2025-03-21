// src/hooks/useAdminAuthForm.ts
import { useState, FormEvent, ChangeEvent } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

type AdminAuthFormValues = Record<string, string>;

interface UseAdminAuthFormProps {
  initialValues: AdminAuthFormValues;
  endpoint: string;
  onSuccess?: () => void;
  redirectTo?: string;
  isLogin?: boolean;
}

export const useAdminAuthForm = ({
  initialValues,
  endpoint,
  onSuccess,
  redirectTo,
  isLogin = false
}: UseAdminAuthFormProps) => {
  const { setIsAdminAuth, checkAdminAuth } = useAdminAuth();
  const [formValues, setFormValues] = useState<AdminAuthFormValues>(initialValues);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setIsSuccess(false);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (isLogin && data.access_token) {
          // Сохраняем токен
          localStorage.setItem('admin_token', data.access_token);
          
          // Устанавливаем состояние авторизации
          setIsAdminAuth(true);
          setIsSuccess(true);
          
          // Явно обновляем состояние авторизации
          await checkAdminAuth();
          
          // Диспатчим событие для компонентов
          window.dispatchEvent(new Event('admin-auth-change'));
          
          if (redirectTo) {
            // Используем прямое перенаправление вместо router.push
            // для очистки состояния при переходе
            setTimeout(() => {
              window.location.href = redirectTo;
            }, 1500);
          }
        } else {
          // Для регистрации или других форм
          setFormValues(initialValues);
          if (onSuccess) onSuccess();
        }
      } else {
        const errorText = await response.text();
        let errorMessage = 'Ошибка запроса';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error('Не удалось разобрать JSON ошибки:', errorText);
        }
        setError(errorMessage);
      }
    } catch (error) {
      setError(`Произошла ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      console.error('Form submission error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit
  };
};