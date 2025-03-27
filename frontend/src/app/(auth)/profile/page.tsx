// frontend/src/app/(auth)/profile/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import InputField from "@/components/common/InputField";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import { FaUser, FaTelegramPlane, FaWhatsapp, FaTrash, FaTimes } from "react-icons/fa";
import Image from "next/image";
import { apiFetch } from "@/utils/api";
import { ModalButton } from "@/components/common/AuthModal";
import { motion, AnimatePresence } from "framer-motion";

interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  avatar_url?: string;
}

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

const Profile: React.FC = () => {
  const { isAuth, userData: contextUserData, isLoading: authLoading, checkAuth } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(contextUserData);
  const [isEditing, setIsEditing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetched = useRef(false);
  const router = useRouter();

  const fetchUserProfile = useCallback(async () => {
    if (!isAuth || isFetching) {
      return;
    }

    setIsFetching(true);
    setFetchError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Токен авторизации отсутствует");

      const response = await apiFetch("/user_edits/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigateTo(router, "/login");
          throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
        }
        throw new Error(`Ошибка API: ${response.status} ${errorText}`);
      }

      const freshData: UserData = await response.json();
      setUserData(freshData);
      setAvatarPreview(freshData.avatar_url || null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Не удалось загрузить данные профиля");
      setUserData(contextUserData);
    } finally {
      setIsFetching(false);
    }
  }, [isAuth, contextUserData, router, isFetching]);

  useEffect(() => {
    const initialize = async () => {
      if (!authLoading && !hasFetched.current) {
        hasFetched.current = true;
        await checkAuth();
        if (!isAuth) {
          navigateTo(router, "/login");
        } else {
          fetchUserProfile();
        }
      }
    };
    initialize();
  }, [authLoading, checkAuth, isAuth, router, fetchUserProfile]);

  const handleEditToggle = () => {
    setIsEditing((prev) => !prev);
    setUpdateError(null);
    setUpdateSuccess(null);
    if (!isEditing && userData) {
      setAvatarPreview(userData.avatar_url || null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAvatarPreview(userData?.avatar_url || null);
    }
  };

  const handleAvatarClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userData) return;

    setIsFetching(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Токен авторизации отсутствует");

      const profileResponse = await apiFetch("/user_edits/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fio: userData.fio,
          telegram: userData.telegram,
          whatsapp: userData.whatsapp,
        }),
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        if (profileResponse.status === 401) {
          localStorage.removeItem("token");
          navigateTo(router, "/login");
          throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
        }
        throw new Error(`Ошибка обновления профиля: ${errorText}`);
      }

      if (fileInputRef.current?.files?.[0]) {
        const formData = new FormData();
        formData.append("file", fileInputRef.current.files[0]);
        const avatarResponse = await apiFetch("/user_edits/upload-avatar", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!avatarResponse.ok) {
          const errorText = await avatarResponse.text();
          if (avatarResponse.status === 401) {
            localStorage.removeItem("token");
            navigateTo(router, "/login");
            throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
          }
          throw new Error(`Ошибка загрузки аватарки: ${errorText}`);
        }
      }

      setUpdateSuccess("Профиль успешно обновлен!");
      await fetchUserProfile();
      setTimeout(() => setIsEditing(false), 1500);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Не удалось обновить профиль");
    } finally {
      setIsFetching(false);
    }
  };

  if (authLoading || isFetching) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="flex items-center justify-center min-h-[200px]"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </motion.div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-red-500">Не удалось загрузить данные профиля</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-10 mt-16 max-w-3xl"
    >
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-3xl font-bold mb-6"
      >
        Ваш профиль
      </motion.h1>
      <AnimatePresence>
        {fetchError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <ErrorDisplay error={fetchError} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="md:col-span-2 bg-white p-4 rounded-lg shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <motion.div
                whileHover={isEditing ? { scale: 1.05 } : {}}
                className="relative"
              >
                {avatarPreview ? (
                  <div
                    className={`w-16 h-16 rounded-full overflow-hidden cursor-pointer ${isEditing ? "border-2 border-orange-500" : ""}`}
                    onClick={handleAvatarClick}
                  >
                    <Image
                      src={avatarPreview}
                      alt="Avatar"
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    {isEditing && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileChange(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                      >
                        <FaTrash size={12} />
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div
                    className={`w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-2xl font-bold cursor-pointer ${isEditing ? "border-2 border-orange-500" : ""}`}
                    onClick={handleAvatarClick}
                  >
                    {userData.fio ? userData.fio.charAt(0).toUpperCase() : userData.email.charAt(0).toUpperCase()}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                  className="hidden"
                  ref={fileInputRef}
                />
              </motion.div>
              <div>
                <AnimatePresence mode="wait">
                  {!isEditing ? (
                    <motion.div
                      key="view-mode"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h2 className="text-lg font-semibold">{userData.fio || "Не указано"}</h2>
                      <p className="text-gray-600">{userData.email || "Не указан"}</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="edit-mode"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <InputField
                        type="text"
                        value={userData.fio || ""}
                        onChange={handleChange}
                        placeholder="ФИО"
                        icon={FaUser}
                        name="fio"
                        required
                        className="w-full p-2 rounded-lg shadow-sm border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEditToggle}
              className="flex items-center space-x-1 px-3 py-1 bg-transparent text-gray-500 border border-gray-300 rounded-full hover:bg-gray-100 transition"
            >
              {isEditing ? <FaTimes size={16} /> : <span>Редактировать</span>}
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                className="space-y-3"
              >
                <InputField
                  type="text"
                  value={userData.telegram || ""}
                  onChange={handleChange}
                  placeholder="Telegram"
                  icon={FaTelegramPlane}
                  name="telegram"
                  required
                  className="w-full p-2 rounded-lg shadow-sm border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <InputField
                  type="text"
                  value={userData.whatsapp || ""}
                  onChange={handleChange}
                  placeholder="WhatsApp"
                  icon={FaWhatsapp}
                  name="whatsapp"
                  required
                  className="w-full p-2 rounded-lg shadow-sm border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <AnimatePresence>
                  {updateError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ErrorDisplay error={updateError} />
                    </motion.div>
                  )}
                  {updateSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SuccessDisplay message={updateSuccess} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ModalButton type="submit" disabled={isFetching}>
                    {isFetching ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="inline-block mr-2 h-5 w-5 border-b-2 border-white rounded-full"
                      />
                    ) : (
                      "Сохранить"
                    )}
                  </ModalButton>
                </motion.div>
              </motion.form>
            ) : (
              <motion.div
                key="view-details"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <p>
                  <strong>Telegram:</strong> {userData.telegram || "Не указан"}
                </p>
                <p>
                  <strong>WhatsApp:</strong> {userData.whatsapp || "Не указан"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white p-4 rounded-lg shadow"
        >
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-lg font-semibold mb-3"
          >
            Мои мероприятия
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-gray-500 mb-3"
          >
            У вас пока нет зарегистрированных мероприятий.
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigateTo(router, "/events")}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            Начать мероприятие
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Profile;