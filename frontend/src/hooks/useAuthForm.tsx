// frontend/src/hooks/useAuthForm.tsx
import { useState, ChangeEvent, FormEvent, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
  isLogin = false
}: UseAuthFormProps) => {
  const { handleLoginSuccess } = useAuth();
  const [formValues, setFormValues] = useState<AuthFormValues>(initialValues);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
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
          const userData = {
            id: data.id,
            fio: data.fio || '',
            email: data.email,
            telegram: data.telegram || '',
            whatsapp: data.whatsapp || '',
            avatar_url: data.avatar_url || undefined
          };
          
          handleLoginSuccess(data.access_token, userData);
          setIsSuccess(true);
          
          // Вызываем onSuccess для закрытия модального окна
          if (onSuccess) {
            setTimeout(() => onSuccess(), 1000); // Задержка для отображения "Успешно!"
          }
        } else {
          setFormValues(initialValues);
          setIsSuccess(true);
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
    } finally {
      setIsLoading(false);
    }
  }, [formValues, endpoint, isLogin, onSuccess, handleLoginSuccess, initialValues]);

  return {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit
  };
};