// frontend/src/hooks/useUserForm.ts
import { useState, useCallback } from 'react';
import { UserData, fetchUser, updateUser } from '@/utils/userService';

interface UseUserFormOptions {
  onSuccess?: (data: UserData) => void;
  onError?: (error: Error) => void;
}

export const useUserForm = ({ onSuccess, onError }: UseUserFormOptions = {}) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Загрузка данных пользователя
  const loadUser = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchUser(userId);
      setUserData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки данных пользователя";
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Обработчик изменений полей формы
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setUserData((prev: UserData | null) => {
      if (!prev) return prev;
      
      return {
        ...prev,
        [name]: type === "checkbox" ? checked : value
      };
    });
  }, []);

  // Отправка формы
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userData) return;
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      const result = await updateUser(userData.id, userData);
      setSuccess("Пользователь успешно обновлён");
      setUserData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка при обновлении пользователя";
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [userData, onSuccess, onError]);

  return {
    userData,
    isLoading,
    error,
    success,
    loadUser,
    handleChange,
    handleSubmit
  };
};