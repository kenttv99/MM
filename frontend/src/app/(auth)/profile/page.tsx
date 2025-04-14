// frontend/src/app/(auth)/profile/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { LoadingStage } from '@/contexts/loading/types';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { FaUser, FaTelegramPlane, FaWhatsapp, FaCamera, FaPencilAlt, FaLock, FaTrash } from "react-icons/fa";
import Image from "next/image";
import InputField from "@/components/common/InputField";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { motion } from "framer-motion";
import { UserData, FormState, ValidationErrors } from "@/types/index";
import { apiFetch } from "@/utils/api";
import UserEventTickets, { UserEventTicketsRef } from "@/components/UserEventTickets";

// --- НАЧАЛО: Локальное определение скелетона --- 
const ProfileSkeleton: React.FC = () => {
  return (
    <div className="card p-6 bg-white rounded-xl shadow-md animate-pulse">
      <div className="flex flex-col items-center gap-4 mb-6">
        {/* Skeleton for Avatar */}
        <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
        <div className="text-center w-full space-y-2">
          {/* Skeleton for Name */}
          <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
          {/* Skeleton for Email */}
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
      <div className="space-y-3 text-center">
        {/* Skeleton for Contacts */}
        <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
        {/* Skeleton for Buttons */}
        <div className="h-10 bg-gray-200 rounded w-1/3"></div>
        <div className="h-10 bg-gray-200 rounded w-1/3"></div>
      </div>
    </div>
  );
};
// --- КОНЕЦ: Локальное определение скелетона --- 

const ProfilePage: React.FC = () => {
  const { currentStage, setStage } = useLoadingStage();
  console.log(`ProfilePage: Render start, stage: ${currentStage}`);
  const { isAuth, userData, updateUserData, isLoading: authLoading } = useAuth();
  const { error: loadingError, setError: setLoadingError } = useLoadingError();
  const router = useRouter();
  
  const ticketsRef = useRef<UserEventTicketsRef>(null);
  const needsTicketsRefresh = useRef<boolean>(false);
  
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
  const [shouldDeleteAvatar, setShouldDeleteAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetched = useRef(false);
  const isSubmitting = useRef(false);
  const [isProfileSectionReady, setIsProfileSectionReady] = useState(false);
  
  const validateForm = useCallback((state: FormState = formState): boolean => {
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
      
      if (!isAuth || !userData) {
        console.log('ProfilePage: User not authenticated or no userData, redirecting.');
        router.push("/");
        return;
      }
      
      const storedData = localStorage.getItem('userData');
      let avatarUrl = userData.avatar_url;
      
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          if (parsedData.avatar_url && !avatarUrl) {
            avatarUrl = parsedData.avatar_url;
          }
        } catch (e) {
          console.error('ProfilePage: Ошибка при разборе данных из localStorage:', e);
        }
      }
      const cachedAvatarUrl = localStorage.getItem('cached_avatar_url');
      if (cachedAvatarUrl && !avatarUrl) {
        avatarUrl = cachedAvatarUrl;
      }
      
      const initialData = {
        fio: userData.fio || "",
        telegram: userData.telegram || "",
        whatsapp: userData.whatsapp || "",
        avatarPreview: avatarUrl || null,
        email: userData.email || "",
      };
      
      setFormState(initialData);
      setInitialFormState(initialData);
      validateForm(initialData);
      hasFetched.current = true;
      console.log("ProfilePage: initProfile finished");
      setIsProfileSectionReady(true);
    };
    
    initProfile();
    
    const redirectTimeout = setTimeout(() => {
      if (authLoading || !isAuth) {
        console.log('ProfilePage: Failsafe redirect triggered');
        router.push("/");
      }
    }, 500);
    
    return () => clearTimeout(redirectTimeout);
  }, [isAuth, userData, authLoading, router, validateForm]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleAvatarUpdate = (event: CustomEvent) => {
      if (event.detail && event.detail.newAvatarUrl) {
        const newUrl = event.detail.newAvatarUrl;
        setFormState(prev => ({ ...prev, avatarPreview: newUrl }));
        setInitialFormState(prev => prev ? { ...prev, avatarPreview: newUrl } : null);
      }
    };
    const handleUserDataChange = (event: CustomEvent) => {
      const { userData: updatedUserData, avatarRemoved } = event.detail;
      if (!updatedUserData) return;
      if (avatarRemoved) {
        setFormState(prev => ({ ...prev, avatarPreview: null }));
        setInitialFormState(prev => prev ? { ...prev, avatarPreview: null } : null);
      } else if (updatedUserData.avatar_url) {
        setFormState(prev => ({ ...prev, avatarPreview: updatedUserData.avatar_url }));
        setInitialFormState(prev => prev ? { ...prev, avatarPreview: updatedUserData.avatar_url } : null);
      }
    };
    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    window.addEventListener('userDataChanged', handleUserDataChange as EventListener);
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
      window.removeEventListener('userDataChanged', handleUserDataChange as EventListener);
    };
  }, []);

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
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
        setFetchError("Пожалуйста, выберите изображение в формате JPEG, PNG, GIF или WebP.");
        return;
    }
    const maxSize = 5 * 1024 * 1024; 
    if (file.size > maxSize) {
        setFetchError("Размер изображения не должен превышать 5MB.");
        return;
    }
    setSelectedFile(file);
    setShouldDeleteAvatar(false); 
    const reader = new FileReader();
    reader.onloadend = () => setFormState((prev) => ({ ...prev, avatarPreview: reader.result as string }));
    reader.onerror = () => {
        setFetchError("Не удалось прочитать выбранный файл.");
        setSelectedFile(null);
    };
    reader.readAsDataURL(file);
  }, [initialFormState, setFetchError]);

  const handleRemoveAvatar = useCallback(() => {
      if (formState.avatarPreview && typeof window !== 'undefined') {
          localStorage.setItem('original_avatar_url', formState.avatarPreview);
      }
      setSelectedFile(null);
      setFormState((prev) => ({ ...prev, avatarPreview: null }));
      if (fileInputRef.current) fileInputRef.current.value = ""; 
      setShouldDeleteAvatar(true);
  }, [formState.avatarPreview]);

  const toggleEdit = useCallback(() => {
    setIsEditing((prev) => {
      if (prev && initialFormState) {
        setFormState(initialFormState);
        setSelectedFile(null); 
        setShouldDeleteAvatar(false);
        validateForm(initialFormState);
      }
      return !prev;
    });
    setUpdateSuccess(null);
    setFetchError(null);
  }, [initialFormState, validateForm]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting.current || !validateForm()) return;

    isSubmitting.current = true;
    setFetchError(null);
    setUpdateSuccess(null);
    setLoadingError(null);

    setStage(LoadingStage.DYNAMIC_CONTENT); 

    const token = localStorage.getItem('token');
    if (!token || !userData || !userData.id) {
        const errorMsg = "Данные авторизации не найдены.";
        setFetchError(errorMsg);
        setLoadingError(errorMsg);
        setStage(LoadingStage.ERROR);
        isSubmitting.current = false;
        return;
    }

    try {
        const userDataToUpdate = {
            id: userData.id,
            fio: formState.fio,
            telegram: formState.telegram,
            whatsapp: formState.whatsapp,
            email: userData.email,
            remove_avatar: shouldDeleteAvatar
        };
        console.log("Отправляемые данные профиля:", userDataToUpdate);
        const profileResponse = await apiFetch<UserData>("/user_edits/me", {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            data: userDataToUpdate, 
        });

        let updatedUser = profileResponse;
        if ('error' in updatedUser) {
             let message = "Ошибка обновления данных профиля";
             const errorDetails = (updatedUser as unknown as { error?: unknown }).error;
             if (typeof errorDetails === 'string') {
                 message = errorDetails;
             }
            throw new Error(message);
        } else if ('aborted' in updatedUser) {
            throw new Error("Запрос на обновление профиля был прерван.");
        }

        if (shouldDeleteAvatar) {
             console.log("ProfilePage: Avatar deletion requested...");
             if (updatedUser && 'id' in updatedUser) {
                 updatedUser.avatar_url = undefined;
             }
            const avatarCacheBuster = Date.now();
            localStorage.setItem('avatar_cache_buster', avatarCacheBuster.toString());
            const storedUserData = localStorage.getItem('userData');
            if (storedUserData) {
                try {
                    const parsedUserData = JSON.parse(storedUserData);
                    parsedUserData.avatar_url = null;
                    localStorage.setItem('userData', JSON.stringify(parsedUserData));
                } catch (e) { console.error("ProfilePage: Error updating userData in localStorage:", e); }
            }
            const originalAvatarUrl = localStorage.getItem('original_avatar_url');
            if (originalAvatarUrl) {
                const invalidateUrl = `${originalAvatarUrl}?clear=${Date.now()}`;
                const img = document.createElement('img');
                img.src = invalidateUrl;
                setTimeout(() => { img.src = ''; }, 100);
            }
             if (typeof window !== 'undefined') {
                const avatarRemovedEvent = new CustomEvent('userDataChanged', {
                    detail: { userData: updatedUser, avatarRemoved: true }
                });
                window.dispatchEvent(avatarRemovedEvent);
            }
        }

        if (selectedFile) {
            try {
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("user_id", userData.id.toString());
                const avatarResponse = await apiFetch<UserData>("/user_edits/upload-avatar", { 
                    method: "POST", 
                    data: formData,
                    headers: { "Authorization": `Bearer ${token}` },
                });
                if ('error' in avatarResponse) {
                    console.error("Ошибка загрузки аватарки:", avatarResponse);
                    setFetchError("Не удалось загрузить аватар. Данные профиля сохранены."); 
                } else if (!('aborted' in avatarResponse)) {
                    updatedUser = avatarResponse;
                    if (updatedUser.avatar_url) {
                        const avatarCacheBuster = Date.now();
                        localStorage.setItem('avatar_cache_buster', avatarCacheBuster.toString());
                         if (typeof window !== 'undefined') {
                            const avatarEvent = new CustomEvent('avatar-updated', {
                                detail: { userData: updatedUser, newAvatarUrl: updatedUser.avatar_url, timestamp: avatarCacheBuster }
                            });
                            window.dispatchEvent(avatarEvent);
                            const userDataEvent = new CustomEvent('userDataChanged', {
                                detail: { userData: updatedUser, avatarRemoved: false }
                            });
                            window.dispatchEvent(userDataEvent);
                        }
                    }
                }
            } catch (avatarError) {
                console.error("Ошибка при загрузке аватарки:", avatarError);
                setFetchError("Не удалось загрузить аватар. Данные профиля сохранены."); 
            }
        }

        if (updatedUser && 'fio' in updatedUser) { 
             if (shouldDeleteAvatar) {
                updatedUser.avatar_url = undefined;
            }
            const updatedData = {
                fio: updatedUser.fio || "",
                telegram: updatedUser.telegram || "",
                whatsapp: updatedUser.whatsapp || "",
                avatarPreview: updatedUser.avatar_url || null,
                email: updatedUser.email || "",
            };
            setFormState(updatedData);
            setInitialFormState(updatedData);
            updateUserData(updatedUser, false); 
            setUpdateSuccess("Профиль успешно обновлен!");
            setShouldDeleteAvatar(false); 
            setSelectedFile(null);
            setIsEditing(false); 
            if (needsTicketsRefresh.current) {
                ticketsRef.current?.refreshTickets();
                needsTicketsRefresh.current = false; 
            }
            setStage(LoadingStage.COMPLETED);
        } else {
             throw new Error("Не удалось обработать ответ сервера после обновления профиля.");
        }

    } catch (err) {
        console.error("Submit Profile Error:", err);
        const errorMsg = err instanceof Error ? err.message : "Ошибка обновления профиля";
        setFetchError(errorMsg);
        setLoadingError(errorMsg);
        setStage(LoadingStage.ERROR);
    } finally {
        isSubmitting.current = false;
        if (updateSuccess) setTimeout(() => setUpdateSuccess(null), 3000);
        if (fetchError) setTimeout(() => setFetchError(null), 5000);
    }
  };

  if (authLoading || (isAuth && currentStage < LoadingStage.DYNAMIC_CONTENT && currentStage !== LoadingStage.ERROR)) {
      return (
          <div className="flex justify-center items-center min-h-screen">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          </div>
      );
  }

  if (!isAuth) { 
      return null; 
  }
  
  if (currentStage === LoadingStage.ERROR && loadingError && !fetchError) {
      return <ErrorDisplay error={`Ошибка загрузки: ${loadingError}`} />;
  }

  if (!userData) {
       return <ErrorDisplay error="Данные пользователя не загружены." />;
  }

  console.log("ProfilePage: Render end");
  return (
    <div className="container mx-auto px-4 py-6 mt-16 min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Ваш профиль</h1>

        {/* --- НАЧАЛО УСЛОВНОГО РЕНДЕРИНГА --- */}
        {isProfileSectionReady ? (
          <div className="card p-6 bg-white rounded-xl shadow-md">
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="relative group w-24 h-24">
                {formState.avatarPreview ? (
                  formState.avatarPreview.startsWith('data:') ? (
                    <Image
                      src={formState.avatarPreview}
                      alt="Аватар"
                      width={96}
                      height={96}
                      className="w-full h-full rounded-full object-cover border-2 border-gray-200 group-hover:border-orange-500 transition-colors"
                      onLoad={() => console.log("ProfilePage: Аватарка (data URI) успешно загружена")}
                      onError={() => {
                        console.error("Ошибка загрузки data URI аватарки в профиле");
                        setFormState((prev) => ({ ...prev, avatarPreview: null }));
                      }}
                      unoptimized 
                      priority
                    />
                  ) : (
                    <Image
                      src={`${formState.avatarPreview}?t=${localStorage.getItem('avatar_cache_buster') || Date.now()}`}
                      alt="Аватар"
                      width={96}
                      height={96}
                      className="w-full h-full rounded-full object-cover border-2 border-gray-200 group-hover:border-orange-500 transition-colors"
                      onLoad={() => console.log("ProfilePage: Аватарка успешно загружена:", formState.avatarPreview)}
                      onError={() => {
                        console.error("Ошибка загрузки изображения аватарки в профиле:", formState.avatarPreview);
                        const cachedAvatarUrl = localStorage.getItem('cached_avatar_url');
                        if (cachedAvatarUrl && cachedAvatarUrl !== formState.avatarPreview) {
                          console.log("ProfilePage: Trying to load avatar from cache:", cachedAvatarUrl);
                          setFormState(prev => ({ ...prev, avatarPreview: cachedAvatarUrl }));
                          return;
                        }
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
                  )
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
                      aria-label="Сменить аватар"
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
                      <div
                        onClick={handleRemoveAvatar}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 z-10"
                        style={{ width: '18px', height: '18px', transform: 'translate(25%, -25%)' }}
                        title="Удалить аватар"
                        aria-label="Удалить аватар"
                      >
                        <FaTrash style={{ width: '8px', height: '8px' }} />
                      </div>
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
                <div>
                  <InputField
                    type="text"
                    placeholder="ФИО"
                    name="fio"
                    value={formState.fio}
                    onChange={handleChange}
                    icon={FaUser}
                    required
                  />
                  {validationErrors.fio && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.fio}</p>
                  )}
                </div>
                <div>
                  <InputField
                    type="text"
                    placeholder="Telegram (@username)"
                    name="telegram"
                    value={formState.telegram}
                    onChange={handleChange}
                    icon={FaTelegramPlane}
                    required
                  />
                  {validationErrors.telegram && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.telegram}</p>
                  )}
                </div>
                <div>
                  <InputField
                    type="tel"
                    placeholder="WhatsApp (только цифры)"
                    name="whatsapp"
                    value={formState.whatsapp}
                    onChange={handleChange}
                    icon={FaWhatsapp}
                    required
                  />
                  {validationErrors.whatsapp && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.whatsapp}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={Object.values(validationErrors).some(v => v) || isSubmitting.current || currentStage === LoadingStage.DYNAMIC_CONTENT}
                  className={`btn btn-primary w-full ${Object.values(validationErrors).some(v => v) || isSubmitting.current || currentStage === LoadingStage.DYNAMIC_CONTENT ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                   {(isSubmitting.current || currentStage === LoadingStage.DYNAMIC_CONTENT) ? "Сохранение..." : "Сохранить"}
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
        ) : (
          <ProfileSkeleton />
        )}
        {/* --- КОНЕЦ УСЛОВНОГО РЕНДЕРИНГА --- */}

        {isAuth && (
          <div className="card p-6 mt-6 bg-white rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Мои билеты</h3>
            <>{console.log("ProfilePage: Rendering UserEventTickets component")}</>
            <UserEventTickets 
              ref={ticketsRef} 
              needsRefresh={needsTicketsRefresh}
            />
          </div>
        )}
        
        {isChangePasswordOpen && <ChangePasswordForm
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />}
      </div>
    </div>
  );
};

export default ProfilePage;