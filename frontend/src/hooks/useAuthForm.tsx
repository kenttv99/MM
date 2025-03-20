// src/hooks/useAuthForm.ts
import { useState, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

type AuthFormValues = Record<string, string>;

interface UseAuthFormProps {
  initialValues: AuthFormValues;
  endpoint: string;
  onSuccess?: () => void;
  redirectTo?: string;
  isLogin?: boolean;
}

export const useAuthForm = ({
  initialValues,
  endpoint,
  onSuccess,
  redirectTo,
  isLogin = false
}: UseAuthFormProps) => {
  const router = useRouter();
  const { setIsAuth, checkAuth } = useAuth();
  const [formValues, setFormValues] = useState<AuthFormValues>(initialValues);
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
          localStorage.setItem('token', data.access_token);
          setIsAuth(true);
          setIsSuccess(true);
          await checkAuth();
          window.dispatchEvent(new Event('auth-change'));
          
          if (redirectTo) {
            setTimeout(() => {
              router.push(redirectTo);
            }, 1000);
          }
        } else {
          // Для регистрации или других типов форм
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