// frontend\src\hooks\useUserForm.ts
import { useState, useCallback, useRef } from 'react';
import { UserData, fetchUser, updateUser } from '@/utils/userService';

// Кэш для данных пользователя
const userCache: Record<string, UserData> = {};

interface UseUserFormOptions {
  onSuccess?: (data: UserData) => void;
  onError?: (error: Error) => void;
}

export const useUserForm = ({ onSuccess, onError }: UseUserFormOptions = {}) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedUserId = useRef<string | null>(null); // Флаг для отслеживания загруженного userId

  const loadUser = useCallback(async (userId: string) => {
    // Проверка: если данные для этого userId уже загружены, пропускаем запрос
    if (loadedUserId.current === userId) {
      console.log(`User ${userId} already loaded, skipping fetch`);
      return;
    }

    // Проверка кэша
    if (userCache[userId]) {
      console.log(`Loading user ${userId} from cache`);
      setUserData(userCache[userId]);
      loadedUserId.current = userId;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchUser(userId);
      userCache[userId] = data; // Сохранение в кэш
      setUserData(data);
      loadedUserId.current = userId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки данных пользователя";
      setError(errorMessage);
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setUserData((prev: UserData | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userData) return;

    setError(null);
    setIsLoading(true);

    try {
      const result = await updateUser(userData.id, userData);
      userCache[userData.id.toString()] = result; // Обновление кэша
      if (onSuccess) onSuccess(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка при обновлении пользователя";
      setError(errorMessage);
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [userData, onSuccess, onError]);

  return {
    userData,
    isLoading,
    error,
    loadUser,
    handleChange,
    handleSubmit,
  };
};