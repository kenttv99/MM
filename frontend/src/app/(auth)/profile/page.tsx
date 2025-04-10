// frontend/src/app/(auth)/profile/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { FaUser, FaTelegramPlane, FaWhatsapp, FaCamera, FaPencilAlt, FaLock, FaTrash } from "react-icons/fa";
import Image from "next/image";
import InputField from "@/components/common/InputField";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { motion } from "framer-motion";
import { UserData, FormState, ValidationErrors } from "@/types/index";
import { apiFetch } from "@/utils/api";
import UserEventTickets from "@/components/UserEventTickets";

const ProfilePage: React.FC = () => {
  const { isAuth, userData, updateUserData, isLoading: authLoading } = useAuth();
  const { setStage, detectAndFixLoadingInconsistency } = useLoading();
  const router = useRouter();

  // Add a ref to track ticket updates for UserEventTickets component
  const ticketsNeedRefresh = useRef(false);
  const ticketsComponentRef = useRef<{ refreshTickets: () => void }>(null);
  
  // Function to force refresh tickets
  const refreshTickets = useCallback(() => {
    console.log('ProfilePage: Forcing tickets refresh');
    ticketsNeedRefresh.current = true;
    setForceUpdate(prev => prev + 1);
    
    // Use the ref method if available
    if (ticketsComponentRef.current) {
      console.log('ProfilePage: Using direct refreshTickets method');
      ticketsComponentRef.current.refreshTickets();
    }
  }, []);

  // Check for notification about ticket updates - just log them
  useEffect(() => {
    const handleTicketUpdate = (event: Event) => {
      console.log('ProfilePage: Received ticket update event');
      
      // Mark that tickets need refreshing
      ticketsNeedRefresh.current = true;
      
      // If the event has detail data, log it
      if (event instanceof CustomEvent && event.detail) {
        const { source, action, ticketId, eventId } = event.detail;
        console.log('ProfilePage: Ticket update details:', { 
          source, 
          action, 
          ticketId,
          eventId,
          needsRefresh: ticketsNeedRefresh.current
        });
      }
      
      // Force a rerender to ensure UserEventTickets notices the change
      setForceUpdate(prev => prev + 1);
    };
    
    window.addEventListener('ticket-update', handleTicketUpdate);
    return () => {
      window.removeEventListener('ticket-update', handleTicketUpdate);
    };
  }, []);
  
  // Add a state to force updates when needed
  const [forceUpdate, setForceUpdate] = useState(0);

  const [formState, setFormState] = useState<FormState>({
    fio: "",
    telegram: "",
    whatsapp: "",
    avatarPreview: null,
    email: "",
  });
  const [initialFormState, setInitialFormState] = useState<FormState | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetched = useRef(false);
  const isSubmitting = useRef(false);

  const validateForm = useCallback((state: FormState = formState) => {
    const errors: ValidationErrors = {};
    if (!state.fio) errors.fio = "ФИО обязательно";
    if (!state.telegram) errors.telegram = "Telegram обязателен";
    else if (!state.telegram.startsWith("@")) errors.telegram = "Должен начинаться с @";
    if (!state.whatsapp) errors.whatsapp = "WhatsApp обязателен";
    else if (!/^\d+$/.test(state.whatsapp)) errors.whatsapp = "Только цифры";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formState]);

  useEffect(() => {
    const initProfile = async () => {
      if (hasFetched.current || authLoading) return;
      
      // More aggressive redirect if not authenticated
      if (!isAuth) {
        console.log('ProfilePage: User not authenticated, redirecting to home page');
        router.push("/");
        return;
      }
      
      if (!userData) {
        console.log('ProfilePage: No user data available, redirecting to home page');
        router.push("/");
        return;
      }
      
      // Проверяем данные из localStorage
      const storedData = localStorage.getItem('userData');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          console.log('ProfilePage: Данные из localStorage:', {
            id: parsedData.id,
            email: parsedData.email,
            avatarUrl: parsedData.avatar_url,
            rawData: parsedData
          });
        } catch (e) {
          console.error('ProfilePage: Ошибка при разборе данных из localStorage:', e);
        }
      } else {
        console.log('ProfilePage: Данные в localStorage отсутствуют');
      }
      
      console.log('ProfilePage: Инициализация профиля с данными пользователя:', { 
        id: userData.id,
        email: userData.email,
        avatarUrl: userData.avatar_url
      });
      
      // Тестовая загрузка изображения для отладки
      if (userData.avatar_url) {
        console.log('ProfilePage: Тестовая загрузка аватарки:', userData.avatar_url);
        // Используем стандартный DOM API вместо Next.js Image
        const testImg = document.createElement('img');
        testImg.onload = () => console.log('ProfilePage: Тест загрузки аватарки успешен');
        testImg.onerror = () => console.error('ProfilePage: Тест загрузки аватарки провален');
        testImg.src = userData.avatar_url;
        
        // Тест загрузки аватарки через fetch для проверки сетевого доступа
        fetch(userData.avatar_url)
          .then(response => {
            console.log('ProfilePage: Fetch тест аватарки - статус:', response.status);
            return response.blob();
          })
          .then(() => console.log('ProfilePage: Fetch тест аватарки успешен'))
          .catch(error => console.error('ProfilePage: Fetch тест аватарки провален:', error));
      }
      
      const initialData = {
        fio: userData.fio || "",
        telegram: userData.telegram || "",
        whatsapp: userData.whatsapp || "",
        avatarPreview: userData.avatar_url || null,
        email: userData.email || "",
      };
      
      console.log('ProfilePage: Установлены начальные данные формы:', {
        avatarPreview: initialData.avatarPreview,
        fio: initialData.fio
      });
      
      setFormState(initialData);
      setInitialFormState(initialData);
      validateForm(initialData);
      hasFetched.current = true;
    };
    
    initProfile();
    
    // Add failsafe redirect after a short timeout if we're still loading
    const redirectTimeout = setTimeout(() => {
      if (authLoading || !isAuth) {
        console.log('ProfilePage: Failsafe redirect triggered');
        router.push("/");
      }
    }, 500);
    
    return () => clearTimeout(redirectTimeout);
  }, [isAuth, userData, authLoading, router, validateForm]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;
    const newErrors = { ...validationErrors };

    if (name === "telegram") {
      newValue = value.startsWith("@") ? value : value ? `@${value}` : "";
      newErrors.telegram = !newValue ? "Telegram обязателен" : !newValue.startsWith("@") ? "Должен начинаться с @" : undefined;
    } else if (name === "whatsapp") {
      newValue = value.replace(/\D/g, "");
      newErrors.whatsapp = !newValue ? "WhatsApp обязателен" : !/^\d+$/.test(newValue) ? "Только цифры" : undefined;
    } else if (name === "fio") {
      newErrors.fio = !value ? "ФИО обязательно" : undefined;
    }

    setFormState((prev) => {
      const updatedState = { ...prev, [name]: newValue };
      validateForm(updatedState);
      return updatedState;
    });
    setValidationErrors(newErrors);
  }, [validationErrors, validateForm]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFormState((prev) => ({ ...prev, avatarPreview: initialFormState?.avatarPreview || null }));
      return;
    }
    
    // Проверка типа файла
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      setFetchError("Пожалуйста, выберите изображение в формате JPEG, PNG, GIF или WebP.");
      return;
    }
    
    // Проверка размера файла (ограничение 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setFetchError("Размер изображения не должен превышать 5MB.");
      return;
    }
    
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => setFormState((prev) => ({ ...prev, avatarPreview: reader.result as string }));
    reader.onerror = () => {
      console.error("Ошибка чтения файла аватарки");
      setFetchError("Не удалось прочитать выбранный файл.");
      setSelectedFile(null);
    };
    reader.readAsDataURL(file);
  }, [initialFormState, setFetchError]);

  const handleRemoveAvatar = useCallback(() => {
    setSelectedFile(null);
    setFormState((prev) => ({ ...prev, avatarPreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting.current || !validateForm()) return;

    isSubmitting.current = true;
    setFetchError(null);
    setUpdateSuccess(null);

    try {
      detectAndFixLoadingInconsistency();
      
      setStage(LoadingStage.STATIC_CONTENT);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        setFetchError("Токен авторизации не найден. Пожалуйста, войдите в систему снова.");
        isSubmitting.current = false;
        return;
      }
      
      // Убедимся, что у нас есть userData с id
      if (!userData || !userData.id) {
        setFetchError("Данные пользователя не найдены.");
        isSubmitting.current = false;
        return;
      }

      // Формируем полные данные пользователя для обновления
      const userDataToUpdate = {
        id: userData.id,
        fio: formState.fio,
        telegram: formState.telegram,
        whatsapp: formState.whatsapp,
        email: userData.email, // Сохраняем текущий email, чтобы не потерять его
      };
      
      console.log("Отправляемые данные профиля:", userDataToUpdate);
      
      const profileResponse = await apiFetch<UserData>("/user_edits/me", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        data: userDataToUpdate,
        bypassLoadingStageCheck: true
      });

      // Проверяем наличие ошибок в ответе
      if (profileResponse && 'error' in profileResponse) {
        // Если ошибка авторизации, выполняем выход и перенаправляем на страницу входа
        if (profileResponse.status === 401 || profileResponse.status === 403) {
          console.error("Ошибка авторизации при обновлении профиля:", profileResponse);
          // Очищаем данные сессии
          localStorage.removeItem("token");
          localStorage.removeItem("userData");
          // Перенаправляем на страницу входа
          router.push("/login");
          throw new Error("Сессия истекла или недействительна. Пожалуйста, войдите снова.");
        }
        throw new Error(`Ошибка обновления профиля: ${profileResponse.error || 'Неизвестная ошибка'}`);
      }

      let updatedUser = profileResponse;
      if (selectedFile) {
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);
          // Добавляем id пользователя в FormData
          formData.append("user_id", userData.id.toString());
          
          const avatarResponse = await apiFetch<UserData>("/user_edits/upload-avatar", { 
            method: "POST", 
            data: formData,
            headers: {
              "Authorization": `Bearer ${token}`
            },
            bypassLoadingStageCheck: true
          });
          
          // Проверяем наличие ошибок в ответе
          if ('error' in avatarResponse) {
            console.error("Ошибка загрузки аватарки:", avatarResponse);
            // Продолжаем с обновлением профиля, даже если аватарка не загрузилась
          } else if (!('aborted' in avatarResponse)) {
            updatedUser = avatarResponse;
          }
        } catch (avatarError) {
          console.error("Ошибка при загрузке аватарки:", avatarError);
          // Продолжаем с обновлением профиля, даже если аватарка не загрузилась
        }
      }

      if (updatedUser && !('aborted' in updatedUser) && 'fio' in updatedUser) {
        const updatedData = {
          fio: updatedUser.fio || "",
          telegram: updatedUser.telegram || "",
          whatsapp: updatedUser.whatsapp || "",
          avatarPreview: updatedUser.avatar_url || null,
          email: updatedUser.email || "",
        };
        
        setFormState(updatedData);
        setInitialFormState(updatedData);
        updateUserData(updatedUser as UserData, false);
        setUpdateSuccess("Профиль успешно обновлен!");
        setTimeout(() => {
          setSelectedFile(null);
          setUpdateSuccess(null);
          setIsEditing(false);
          isSubmitting.current = false;
        }, 1500);
      } else {
        throw new Error("Не удалось обновить данные профиля. Пожалуйста, попробуйте снова.");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Ошибка обновления профиля");
      setTimeout(() => setFetchError(null), 3000); // Увеличено время показа ошибки
      isSubmitting.current = false;
    }
  };

  const toggleEdit = useCallback(() => {
    setIsEditing((prev) => {
      if (prev && initialFormState) {
        setFormState(initialFormState);
        setSelectedFile(null);
        validateForm(initialFormState);
      }
      return !prev;
    });
    setUpdateSuccess(null);
    setFetchError(null);
  }, [initialFormState, validateForm]);

  // Force refresh tickets when user data changes
  useEffect(() => {
    if (userData && !authLoading) {
      console.log('ProfilePage: User data loaded, refreshing tickets');
      refreshTickets();
    }
  }, [userData, authLoading, refreshTickets]);

  if (!isAuth) return null;

  return (
    <div className="container mx-auto px-4 py-6 mt-16 min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Ваш профиль</h1>
        <div className="card p-6 bg-white rounded-xl shadow-md">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group w-24 h-24">
              {formState.avatarPreview ? (
                <Image
                  src={formState.avatarPreview}
                  alt="Аватар"
                  width={96}
                  height={96}
                  className="w-full h-full rounded-full object-cover border-2 border-gray-200 group-hover:border-orange-500 transition-colors"
                  onLoad={() => {
                    console.log("ProfilePage: Аватарка успешно загружена:", formState.avatarPreview);
                  }}
                  onError={() => {
                    console.error("Ошибка загрузки изображения аватарки в профиле:", formState.avatarPreview);
                    console.error("Текущее состояние формы:", { 
                      fio: formState.fio,
                      hasAvatar: !!formState.avatarPreview 
                    });
                    // Пытаемся загрузить изображение напрямую для проверки доступности
                    if (typeof window !== 'undefined' && formState.avatarPreview) {
                      const testImg = document.createElement('img');
                      testImg.onload = () => console.log("Тест прямой загрузки аватарки успешен");
                      testImg.onerror = () => console.error("Тест прямой загрузки аватарки провален");
                      testImg.src = formState.avatarPreview;
                    }
                    setFormState((prev) => ({ ...prev, avatarPreview: null }));
                  }}
                  unoptimized
                  priority
                />
              ) : (
                <div className="w-full h-full bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-3xl font-bold group-hover:bg-orange-200 transition-colors">
                  {formState.fio?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-orange-500 rounded-full p-2"
                    >
                      <FaCamera className="text-white w-5 h-5" />
                    </motion.div>
                  </button>
                  {formState.avatarPreview && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onClick={handleRemoveAvatar}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center transform translate-x-1/3 -translate-y-1/3 hover:bg-red-600 transition-colors"
                    >
                      <FaTrash className="w-2 h-2" />
                    </motion.button>
                  )}
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                ref={fileInputRef}
              />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800">{formState.fio || "Не указано"}</h2>
              <p className="text-gray-600 text-sm">{formState.email || "Не указан"}</p>
            </div>
          </div>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputField
                type="text"
                name="fio"
                value={formState.fio}
                onChange={handleChange}
                placeholder="Введите ваше ФИО"
                icon={FaUser}
                required
                className="form-input"
              />
              {validationErrors.fio && <p className="text-red-500 text-xs mt-1">{validationErrors.fio}</p>}
              <InputField
                type="text"
                name="telegram"
                value={formState.telegram}
                onChange={handleChange}
                placeholder="Telegram (например, @username)"
                icon={FaTelegramPlane}
                required
                className="form-input"
              />
              {validationErrors.telegram && <p className="text-red-500 text-xs mt-1">{validationErrors.telegram}</p>}
              <InputField
                type="text"
                name="whatsapp"
                value={formState.whatsapp}
                onChange={handleChange}
                placeholder="WhatsApp (только цифры)"
                icon={FaWhatsapp}
                required
                className="form-input"
              />
              {validationErrors.whatsapp && <p className="text-red-500 text-xs mt-1">{validationErrors.whatsapp}</p>}
              <button
                type="submit"
                disabled={Object.keys(validationErrors).length > 0 || isSubmitting.current}
                className={`btn btn-primary w-full ${Object.keys(validationErrors).length > 0 || isSubmitting.current ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Сохранить
              </button>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-gray-600"><strong>Telegram:</strong> {formState.telegram || "Не указан"}</p>
              <p className="text-gray-600"><strong>WhatsApp:</strong> {formState.whatsapp || "Не указан"}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleEdit}
              className="btn btn-secondary flex items-center justify-center gap-2"
            >
              <FaPencilAlt className="w-4 h-4" /> {isEditing ? "Отмена" : "Редактировать"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsChangePasswordOpen(true)}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <FaLock className="w-4 h-4" /> Сменить пароль
            </motion.button>
          </div>
          {fetchError && <ErrorDisplay error={fetchError} className="mt-4" />}
          {updateSuccess && <SuccessDisplay message={updateSuccess} className="mt-4" />}
        </div>
        <div className="card p-6 mt-6 bg-white rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Мои билеты</h3>
          {userData && <UserEventTickets 
            ref={ticketsComponentRef}
            needsRefresh={ticketsNeedRefresh} 
            forceUpdateTrigger={forceUpdate} 
          />}
        </div>
        {isChangePasswordOpen && <ChangePasswordForm
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />}
      </div>
    </div>
  );
};

export default ProfilePage;