// frontend/src/hooks/useAdminAuthForm.ts
import { useState, FormEvent, ChangeEvent } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRouter } from 'next/navigation';

interface AdminAuthFormValues {
  email: string;
  password: string;
  fio?: string; // Опционально для регистрации
}

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
  const router = useRouter();
  const { setIsAdminAuth, checkAdminAuth } = useAdminAuth();
  const [formValues, setFormValues] = useState<AdminAuthFormValues>(initialValues);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev: AdminAuthFormValues) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setIsSuccess(false);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(formValues),
      });

      if (response.ok) {
        const data = await response.json();

        if (isLogin) {
          if (!data.access_token) {
            throw new Error('Токен не получен от сервера');
          }
          localStorage.setItem('admin_token', data.access_token);
          setIsAdminAuth(true);
          setIsSuccess(true);

          const isAuthenticated = await checkAdminAuth();
          if (!isAuthenticated) {
            throw new Error('Ошибка синхронизации состояния авторизации');
          }

          window.dispatchEvent(new Event('admin-auth-change'));

          if (redirectTo) {
            setTimeout(() => {
              router.push(redirectTo);
            }, 1500);
          }
        } else {
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
    handleSubmit,
  };
};