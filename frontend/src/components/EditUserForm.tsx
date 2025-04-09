"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FaUser, FaEnvelope, FaTelegram, FaWhatsapp, FaCalendarAlt, FaArrowLeft, FaClock, FaUserClock } from "react-icons/fa";
import { MdBlock, MdVerified } from "react-icons/md";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import Switch from "@/components/common/Switch";
import { UserData, fetchUser, updateUser } from "@/utils/userService";
import { motion } from "framer-motion";

interface EditUserFormProps {
  userId: string;
  onSuccess?: (data: UserData) => void;
  onError?: (error: Error) => void;
}

// Компонент скелетона для формы пользователя
const UserFormSkeleton = () => (
  <div className="bg-white p-8 rounded-xl shadow-lg max-w-4xl mx-auto animate-pulse">
    <div className="flex items-center justify-between mb-8">
      <div className="h-8 w-64 bg-gray-200 rounded"></div>
      <div className="h-10 w-32 bg-gray-200 rounded"></div>
    </div>
    <div className="space-y-6">
      <div className="h-12 bg-gray-200 rounded mb-6"></div>
      <div className="h-12 bg-gray-200 rounded mb-6"></div>
      <div className="h-12 bg-gray-200 rounded mb-6"></div>
      <div className="h-12 bg-gray-200 rounded mb-6"></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-4">
            <div className="w-6 h-6 bg-gray-200 rounded-full mr-2"></div>
            <div className="h-6 w-40 bg-gray-200 rounded"></div>
          </div>
          <div className="h-10 w-full bg-gray-200 rounded"></div>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-4">
            <div className="w-6 h-6 bg-gray-200 rounded-full mr-2"></div>
            <div className="h-6 w-40 bg-gray-200 rounded"></div>
          </div>
          <div className="h-10 w-full bg-gray-200 rounded"></div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-4">
        <div className="h-10 w-24 bg-gray-200 rounded"></div>
        <div className="h-10 w-24 bg-gray-200 rounded"></div>
      </div>
    </div>
  </div>
);

// Вспомогательная функция форматирования даты
const formatDate = (dateString?: string) => {
  if (!dateString) return "Нет данных";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const EditUserForm: React.FC<EditUserFormProps> = ({ userId, onSuccess, onError }) => {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [originalData, setOriginalData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isFormModified, setIsFormModified] = useState(false);
  const mountedRef = useRef(true);
  const loadAttempts = useRef(0);
  const maxAttempts = 3;

  // Загрузка данных пользователя
  const loadUser = useCallback(async () => {
    if (!userId || !mountedRef.current) return;
    
    setIsFetching(true);
    setError(null);
    
    try {
      console.log(`EditUserForm: Loading user data for ID ${userId}, attempt ${loadAttempts.current + 1}`);
      const data = await fetchUser(userId);
      
      if (mountedRef.current) {
        setUserData(data);
        setOriginalData(JSON.parse(JSON.stringify(data))); // Создаем копию для отслеживания изменений
        console.log("EditUserForm: User data loaded successfully", data);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки данных пользователя";
        console.error("EditUserForm: Error loading user data", errorMessage);
        setError(errorMessage);
        
        // Повторяем попытку загрузки данных
        loadAttempts.current += 1;
        if (loadAttempts.current < maxAttempts) {
          console.log(`EditUserForm: Retrying in 2 seconds, attempt ${loadAttempts.current + 1}/${maxAttempts}`);
          setTimeout(loadUser, 2000);
          return; // Выходим из функции, чтобы не устанавливать isFetching в false
        }
        
        if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false);
      }
    }
  }, [userId, onError]);

  // Загрузка данных при монтировании
  useEffect(() => {
    mountedRef.current = true;
    loadUser();
    
    // Устанавливаем таймаут для гарантированного скрытия скелетона через 5 секунд
    const timeout = setTimeout(() => {
      if (mountedRef.current && isFetching) {
        setIsFetching(false);
        if (!userData && !error) {
          setError("Превышено время ожидания загрузки данных");
        }
      }
    }, 5000);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
    };
  }, [loadUser]);

  // Отслеживание изменений формы
  useEffect(() => {
    if (userData && originalData) {
      const isModified = JSON.stringify(userData) !== JSON.stringify(originalData);
      setIsFormModified(isModified);
    }
  }, [userData, originalData]);

  // Обработка изменения полей
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setUserData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
    });
  };

  // Обработка изменения переключателей
  const handleSwitchChange = (name: string, value: boolean) => {
    setUserData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  // Обработка отправки формы
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userData) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      console.log("EditUserForm: Submitting user data", userData);
      const result = await updateUser(userData.id, userData);
      
      console.log("EditUserForm: User updated successfully", result);
      setSuccess("Пользователь успешно обновлён");
      setOriginalData(JSON.parse(JSON.stringify(result)));
      setIsFormModified(false);
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess(result);
        }, 1500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка при обновлении пользователя";
      console.error("EditUserForm: Error updating user", errorMessage);
      setError(errorMessage);
      
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  // Отмена изменений
  const handleCancel = () => {
    router.push("/dashboard");
  };

  // Сброс изменений до исходных данных
  const handleReset = () => {
    if (originalData) {
      setUserData(JSON.parse(JSON.stringify(originalData)));
      setIsFormModified(false);
    }
  };

  // Если идет начальная загрузка данных, показываем скелетон
  if (isFetching) {
    return <UserFormSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white p-8 rounded-xl shadow-lg max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.push("/dashboard")}
          className="flex items-center text-blue-500 hover:text-blue-700 transition-colors"
        >
          <FaArrowLeft className="mr-2" />
          Вернуться к списку пользователей
        </button>
        
        {userData && (
          <div className="text-gray-500 text-sm">
            ID: {userData.id}
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border-l-4 border-red-500">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border-l-4 border-green-500">
          {success}
        </div>
      )}
      
      {!userData && !isFetching && (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Не удалось загрузить данные пользователя</p>
          <button 
            onClick={loadUser}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Попробовать снова
          </button>
        </div>
      )}
      
      {userData && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <InputField
            type="text"
            value={userData.fio || ""}
            onChange={handleChange}
            placeholder="Введите ФИО"
            icon={FaUser}
            name="fio"
            required
            disabled={isLoading}
          />
          
          <InputField
            type="email"
            value={userData.email || ""}
            onChange={handleChange}
            placeholder="Введите email"
            icon={FaEnvelope}
            name="email"
            required
            disabled={isLoading}
          />
          
          <InputField
            type="text"
            value={userData.telegram || ""}
            onChange={handleChange}
            placeholder="Введите Telegram"
            icon={FaTelegram}
            name="telegram"
            disabled={isLoading}
          />
          
          <InputField
            type="text"
            value={userData.whatsapp || ""}
            onChange={handleChange}
            placeholder="Введите WhatsApp"
            icon={FaWhatsapp}
            name="whatsapp"
            disabled={isLoading}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Блок для управления статусом партнера */}
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center mb-4">
                <MdVerified className="text-blue-500 mr-2" size={20} />
                <h3 className="text-lg font-medium text-gray-800">Статус партнера</h3>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {userData.is_partner 
                    ? "Пользователь является партнером" 
                    : "Пользователь не является партнером"}
                </span>
                <Switch
                  name="is_partner"
                  checked={userData.is_partner || false}
                  onChange={(e) => handleSwitchChange("is_partner", e.target.checked)}
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {/* Блок для блокировки пользователя */}
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center mb-4">
                <MdBlock className="text-red-500 mr-2" size={20} />
                <h3 className="text-lg font-medium text-gray-800">Блокировка пользователя</h3>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {userData.is_blocked 
                    ? "Пользователь заблокирован" 
                    : "Пользователь активен"}
                </span>
                <Switch
                  name="is_blocked"
                  checked={userData.is_blocked || false}
                  onChange={(e) => handleSwitchChange("is_blocked", e.target.checked)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
          
          {/* Блок с дополнительной информацией */}
          <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Дополнительная информация</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start">
                <FaCalendarAlt className="text-gray-500 mt-1 mr-2" />
                <div>
                  <span className="text-gray-600 block">Дата регистрации</span>
                  <span className="font-medium">{userData.created_at ? formatDate(userData.created_at) : "Нет данных"}</span>
                </div>
              </div>
              <div className="flex items-start">
                <FaClock className="text-gray-500 mt-1 mr-2" />
                <div>
                  <span className="text-gray-600 block">Последнее обновление</span>
                  <span className="font-medium">{userData.updated_at ? formatDate(userData.updated_at) : "Нет данных"}</span>
                </div>
              </div>
              <div className="flex items-start">
                <FaUserClock className="text-gray-500 mt-1 mr-2" />
                <div>
                  <span className="text-gray-600 block">Последняя активность</span>
                  <span className="font-medium">{userData.last_active ? formatDate(userData.last_active) : "Нет данных"}</span>
                </div>
              </div>
              {userData.avatar_url && (
                <div className="flex items-start">
                  <FaUser className="text-gray-500 mt-1 mr-2" />
                  <div>
                    <span className="text-gray-600 block">Аватар</span>
                    <a 
                      href={userData.avatar_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Просмотреть
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between pt-6">
            <div className="space-x-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Вернуться назад
              </button>
              
              {isFormModified && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-3 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100"
                  disabled={isLoading}
                >
                  Отменить изменения
                </button>
              )}
            </div>
            
            <ModalButton 
              type="submit" 
              disabled={isLoading || !isFormModified}
              variant={isFormModified ? "primary" : "secondary"}
            >
              {isLoading ? "Сохранение..." : "Сохранить"}
            </ModalButton>
          </div>
        </form>
      )}
    </motion.div>
  );
};

export default EditUserForm;
