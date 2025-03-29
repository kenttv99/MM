"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import InputField from "@/components/common/InputField";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { FaUser, FaTelegramPlane, FaWhatsapp, FaTrash, FaPencilAlt, FaTimes, FaLock, FaCamera } from "react-icons/fa";
import Image from "next/image";
import { apiFetch } from "@/utils/api";
import { ModalButton } from "@/components/common/AuthModal";
import { motion, AnimatePresence } from "framer-motion";
import { UserData, FormState, ValidationErrors } from "@/types/index";


const Profile: React.FC = () => {
  const { isAuth, userData: contextUserData, isLoading: authLoading, updateUserData } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [formState, setFormState] = useState<FormState>({ fio: "", telegram: "", whatsapp: "", avatarPreview: null });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetched = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const navigateTo = useCallback((path: string) => router.push(path), [router]);

  const fetchUserProfile = useCallback(async () => {
    if (!isAuth || isFetching) return;

    setIsFetching(true);
    setFetchError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Токен авторизации отсутствует");

      const response = await apiFetch("/user_edits/me", {
        headers: { Authorization: `Bearer ${token}`, "Accept": "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigateTo("/login");
          throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
        }
        throw new Error(`Ошибка API: ${errorText}`);
      }

      const freshData: UserData = await response.json();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      if (freshData.avatar_url) {
        freshData.avatar_url = freshData.avatar_url.startsWith('http')
          ? freshData.avatar_url
          : `${baseUrl}${freshData.avatar_url.startsWith('/') ? freshData.avatar_url : `/${freshData.avatar_url}`}`;
      }

      setUserData(freshData);
      setFormState({
        fio: freshData.fio || "",
        telegram: freshData.telegram || "",
        whatsapp: freshData.whatsapp || "",
        avatarPreview: freshData.avatar_url || null,
      });
      updateUserData(freshData, true);
      localStorage.setItem("user_data", JSON.stringify(freshData));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Не удалось загрузить данные профиля");
      setUserData(contextUserData);
    } finally {
      setIsFetching(false);
    }
  }, [isAuth, isFetching, contextUserData, navigateTo, updateUserData]);

  useEffect(() => {
    const initialize = async () => {
      if (!authLoading && !hasFetched.current) {
        hasFetched.current = true;
        if (!isAuth) navigateTo("/");
        else fetchUserProfile();
      }
    };
    initialize();
  }, [authLoading, isAuth, fetchUserProfile, navigateTo]);

  useEffect(() => {
    if (userData && userData.avatar_url) {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const avatarUrl = userData.avatar_url.startsWith(baseUrl)
        ? userData.avatar_url
        : `${baseUrl}${userData.avatar_url.startsWith('/') ? userData.avatar_url : `/${userData.avatar_url}`}`;
      setFormState(prev => ({
        ...prev,
        avatarPreview: avatarUrl
      }));
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    const newErrors = { ...validationErrors };

    if (name === "telegram") {
      newValue = value.startsWith("@") ? value : value ? `@${value}` : "";
      if (!newValue) newErrors.telegram = "Telegram обязателен";
      else if (!newValue.startsWith("@")) newErrors.telegram = "Telegram должен начинаться с @";
      else delete newErrors.telegram;
    }

    if (name === "whatsapp") {
      newValue = value.replace(/\D/g, "");
      if (!newValue) newErrors.whatsapp = "WhatsApp обязателен";
      else if (!/^\d+$/.test(newValue)) newErrors.whatsapp = "WhatsApp должен содержать только цифры";
      else delete newErrors.whatsapp;
    }

    if (name === "fio") {
      if (!value) newErrors.fio = "ФИО обязательно";
      else delete newErrors.fio;
    }

    setFormState((prev) => ({ ...prev, [name]: newValue }));
    setValidationErrors(newErrors);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormState((prev) => ({ ...prev, avatarPreview: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      const currentAvatarUrl = userData?.avatar_url || null;
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      setFormState((prev) => ({
        ...prev,
        avatarPreview: currentAvatarUrl
          ? currentAvatarUrl.startsWith(baseUrl)
            ? currentAvatarUrl
            : `${baseUrl}${currentAvatarUrl.startsWith('/') ? currentAvatarUrl : `/${currentAvatarUrl}`}`
          : null
      }));
    }
  };

  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};
    if (!formState.fio) errors.fio = "ФИО обязательно";
    if (!formState.telegram) errors.telegram = "Telegram обязателен";
    else if (!formState.telegram.startsWith("@")) errors.telegram = "Telegram должен начинаться с @";
    if (!formState.whatsapp) errors.whatsapp = "WhatsApp обязателен";
    else if (!/^\d+$/.test(formState.whatsapp)) errors.whatsapp = "WhatsApp должен содержать только цифры";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formState]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userData || !validateForm()) return;

    setIsFetching(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Токен авторизации отсутствует");

      const profileResponse = await apiFetch("/user_edits/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fio: formState.fio, telegram: formState.telegram, whatsapp: formState.whatsapp }),
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        if (profileResponse.status === 401) {
          localStorage.removeItem("token");
          navigateTo("/login");
          throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
        }
        throw new Error(`Ошибка обновления профиля: ${errorText}`);
      }

      let updatedUser: UserData = await profileResponse.json();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      if (updatedUser.avatar_url) {
        updatedUser.avatar_url = updatedUser.avatar_url.startsWith('http')
          ? updatedUser.avatar_url
          : `${baseUrl}${updatedUser.avatar_url.startsWith('/') ? updatedUser.avatar_url : `/${updatedUser.avatar_url}`}`;
      }

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const avatarResponse = await apiFetch("/user_edits/upload-avatar", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!avatarResponse.ok) {
          const errorText = await avatarResponse.text();
          throw new Error(`Ошибка загрузки аватарки: ${errorText}`);
        }

        const avatarData: UserData = await avatarResponse.json();
        updatedUser = {
          ...updatedUser,
          avatar_url: avatarData.avatar_url
            ? avatarData.avatar_url.startsWith('http')
              ? avatarData.avatar_url
              : `${baseUrl}${avatarData.avatar_url.startsWith('/') ? avatarData.avatar_url : `/${avatarData.avatar_url}`}`
            : undefined
        };
      }

      setFormState({
        fio: updatedUser.fio || "",
        telegram: updatedUser.telegram || "",
        whatsapp: updatedUser.whatsapp || "",
        avatarPreview: updatedUser.avatar_url || null,
      });
      setUserData(updatedUser);

      setUpdateSuccess("Профиль успешно обновлен!");
      setTimeout(() => {
        setSelectedFile(null);
        setUpdateSuccess(null);
        setIsEditing(false);
      }, 1500);

      updateUserData(updatedUser, true);
      localStorage.setItem("user_data", JSON.stringify(updatedUser));
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Не удалось обновить профиль");
    } finally {
      setIsFetching(false);
    }
  };

  const handleEditToggle = () => {
    const scrollPosition = window.scrollY;
    setIsEditing((prev) => !prev);
    setUpdateSuccess(null);
    setUpdateError(null);
    if (!isEditing && userData) {
      setFormState({
        fio: userData.fio || "",
        telegram: userData.telegram || "",
        whatsapp: userData.whatsapp || "",
        avatarPreview: userData.avatar_url || null,
      });
    }
    requestAnimationFrame(() => window.scrollTo(0, scrollPosition));
  };

  // Варианты анимации для контейнера
  const containerVariants = {
    view: { opacity: 1, transition: { staggerChildren: 0.1 } },
    edit: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  // Лёгкая анимация для дочерних элементов (без растягивания)
  const childVariants = {
    view: { opacity: 1, scale: 1 },
    edit: { opacity: 1, scale: 1 },
    hidden: { opacity: 0, scale: 0.95 },
  };

  // Анимация для подсказки (иконки камеры)
  const tooltipVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-10 mt-16">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 mt-16 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Ваш профиль</h1>
      {fetchError && <ErrorDisplay error={fetchError} />}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 justify-start">
        <motion.div
          ref={containerRef}
          className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100"
          layout
          initial="view"
          animate={isEditing ? "edit" : "view"}
          variants={containerVariants}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <motion.div
            className="flex items-start justify-between mb-6"
            variants={childVariants}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center space-x-4">
              <motion.div
                className="relative"
                variants={childVariants}
                onMouseEnter={() => setIsAvatarHovered(true)}
                onMouseLeave={() => setIsAvatarHovered(false)}
              >
                {formState.avatarPreview ? (
                  <div
                    className={`w-16 h-16 rounded-full overflow-hidden ${isEditing ? "border-2 border-orange-500 cursor-pointer" : ""}`}
                    onClick={isEditing ? () => fileInputRef.current?.click() : undefined}
                  >
                    <Image
                      src={formState.avatarPreview}
                      alt="Avatar"
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      onError={(e) => {
                        console.error("Failed to load avatar:", formState.avatarPreview);
                        setFormState(prev => ({ ...prev, avatarPreview: null }));
                      }}
                    />
                    <AnimatePresence>
                      {isEditing && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          onClick={() => {
                            setSelectedFile(null);
                            setFormState((prev) => ({ ...prev, avatarPreview: userData?.avatar_url || null }));
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <FaTrash size={12} />
                        </motion.button>
                      )}
                    </AnimatePresence>
                    {/* Подсказка при наведении */}
                    <AnimatePresence>
                      {isEditing && isAvatarHovered && (
                        <motion.div
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          variants={tooltipVariants}
                          transition={{ duration: 0.2 }}
                          className="absolute bottom-0 inset-x-0 flex items-center justify-center h-6"
                        >
                          <FaCamera className="text-white drop-shadow-md" size={16} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div
                    className={`w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-2xl font-bold ${isEditing ? "border-2 border-orange-500 cursor-pointer" : ""}`}
                    onClick={isEditing ? () => fileInputRef.current?.click() : undefined}
                    onMouseEnter={() => setIsAvatarHovered(true)}
                    onMouseLeave={() => setIsAvatarHovered(false)}
                  >
                    {formState.fio ? formState.fio.charAt(0).toUpperCase() : userData?.email.charAt(0).toUpperCase() || ""}
                    {/* Подсказка при наведении */}
                    <AnimatePresence>
                      {isEditing && isAvatarHovered && (
                        <motion.div
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          variants={tooltipVariants}
                          transition={{ duration: 0.2 }}
                          className="absolute bottom-0 inset-x-0 flex items-center justify-center h-6"
                        >
                          <FaCamera className="text-white drop-shadow-md" size={16} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
              </motion.div>
              <motion.div variants={childVariants}>
                <AnimatePresence mode="wait">
                  {!isEditing ? (
                    <motion.div
                      key="view"
                      initial="hidden"
                      animate="view"
                      exit="hidden"
                      variants={childVariants}
                      transition={{ duration: 0.3 }}
                    >
                      <h2 className="text-lg font-semibold">{formState.fio || "Не указано"}</h2>
                      <p className="text-gray-600">{userData?.email || "Не указан"}</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="edit"
                      initial="hidden"
                      animate="edit"
                      exit="hidden"
                      variants={childVariants}
                      transition={{ duration: 0.3 }}
                      className="space-y-2"
                    >
                      <div>
                        <InputField
                          type="text"
                          value={formState.fio}
                          onChange={handleChange}
                          placeholder="ФИО"
                          icon={FaUser}
                          name="fio"
                          required
                          disabled={isFetching}
                        />
                        {validationErrors.fio && <p className="text-red-500 text-xs mt-1">{validationErrors.fio}</p>}
                      </div>
                      <p className="text-gray-600 text-sm">{userData?.email || "Не указан"}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            <motion.div className="flex items-center space-x-2" variants={childVariants}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEditToggle}
                className="flex items-center justify-center w-8 h-8 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition"
              >
                {isEditing ? <FaTimes size={14} /> : <FaPencilAlt size={14} />}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsChangePasswordOpen(true)}
                className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full text-orange-500 hover:bg-orange-200 transition"
                title="Сменить пароль"
              >
                <FaLock size={14} />
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div layout variants={childVariants}>
            <AnimatePresence mode="wait">
              {!isEditing ? (
                <motion.div
                  key="view"
                  initial="hidden"
                  animate="view"
                  exit="hidden"
                  variants={childVariants}
                  transition={{ duration: 0.3 }}
                  className="space-y-2"
                >
                  <p><strong>Telegram:</strong> {formState.telegram || "Не указан"}</p>
                  <p><strong>WhatsApp:</strong> {formState.whatsapp || "Не указан"}</p>
                </motion.div>
              ) : (
                <motion.form
                  key="edit"
                  initial="hidden"
                  animate="edit"
                  exit="hidden"
                  variants={childVariants}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit}
                  className="space-y-4 relative"
                >
                  {isFetching && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                  )}
                  <div>
                    <InputField
                      type="text"
                      value={formState.telegram}
                      onChange={handleChange}
                      placeholder="Telegram"
                      icon={FaTelegramPlane}
                      name="telegram"
                      required
                      disabled={isFetching}
                    />
                    {validationErrors.telegram && <p className="text-red-500 text-xs mt-1">{validationErrors.telegram}</p>}
                  </div>
                  <div>
                    <InputField
                      type="text"
                      value={formState.whatsapp}
                      onChange={handleChange}
                      placeholder="WhatsApp"
                      icon={FaWhatsapp}
                      name="whatsapp"
                      required
                      disabled={isFetching}
                    />
                    {validationErrors.whatsapp && <p className="text-red-500 text-xs mt-1">{validationErrors.whatsapp}</p>}
                  </div>
                  {updateError && <ErrorDisplay error={updateError} />}
                  {updateSuccess && <SuccessDisplay message={updateSuccess} />}
                  <ModalButton
                    type="submit"
                    disabled={isFetching || Object.keys(validationErrors).length > 0}
                  >
                    {isFetching ? "Сохранение..." : "Сохранить"}
                  </ModalButton>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[150px] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Мои мероприятия</h3>
            <p className="text-gray-500 text-sm mb-4 whitespace-normal break-words">
              У вас пока нет зарегистрированных мероприятий. Начните с поиска интересных событий!
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigateTo("/events")}
            className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-300 shadow-sm"
          >
            Начать мероприятие
          </motion.button>
        </div>
      </div>

      <ChangePasswordForm
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
};

export default Profile;