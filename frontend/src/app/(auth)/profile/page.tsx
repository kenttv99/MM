"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePageLoad } from "@/contexts/PageLoadContext";
import { FaUser, FaTelegramPlane, FaWhatsapp, FaCamera, FaPencilAlt, FaLock, FaTrash } from "react-icons/fa";
import Image from "next/image";
import InputField from "@/components/common/InputField";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { motion } from "framer-motion";
import { UserData, FormState, ValidationErrors } from "@/types/index";

const ProfilePage: React.FC = () => {
  const { isAuth, userData, updateUserData, isLoading: authLoading } = useAuth();
  const { wrapAsync, apiFetch, setPageLoading } = usePageLoad();
  const router = useRouter();

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

  useEffect(() => {
    const initProfile = async () => {
      if (hasFetched.current || authLoading) return;
      if (!isAuth || !userData) {
        router.push("/");
        return;
      }
      const initialData = {
        fio: userData.fio || "",
        telegram: userData.telegram || "",
        whatsapp: userData.whatsapp || "",
        avatarPreview: userData.avatar_url || null,
        email: userData.email || "",
      };
      setFormState(initialData);
      setInitialFormState(initialData);
      validateForm(initialData);
      hasFetched.current = true;
    };
    initProfile();
  }, [isAuth, userData, authLoading, router]);

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
  }, [validationErrors]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFormState((prev) => ({ ...prev, avatarPreview: reader.result as string }));
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setFormState((prev) => ({ ...prev, avatarPreview: initialFormState?.avatarPreview || null }));
    }
  }, [initialFormState]);

  const handleRemoveAvatar = useCallback(() => {
    setSelectedFile(null);
    setFormState((prev) => ({ ...prev, avatarPreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting.current || !validateForm()) return;

    isSubmitting.current = true;
    setPageLoading(true);
    setFetchError(null);
    setUpdateSuccess(null);

    try {
      const profileResponse = await wrapAsync<UserData>(
        apiFetch("/user_edits/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fio: formState.fio,
            telegram: formState.telegram,
            whatsapp: formState.whatsapp,
          }),
        })
      );

      let updatedUser = profileResponse;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        updatedUser = await wrapAsync<UserData>(
          apiFetch("/user_edits/upload-avatar", { method: "POST", body: formData })
        );
      }

      if (updatedUser) {
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
        setTimeout(() => {
          setSelectedFile(null);
          setUpdateSuccess(null);
          setIsEditing(false);
          isSubmitting.current = false;
        }, 1500);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Ошибка обновления профиля");
      setTimeout(() => setFetchError(null), 1500);
    } finally {
      setPageLoading(false);
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
  }, [initialFormState]);

  if (!isAuth) return null;

  return (
    <div className="container mx-auto px-4 py-6 mt-16 min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Ваш профиль</h1>

        <div className="card p-6 bg-white rounded-xl shadow-md">
          {/* Аватар и основные данные */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group w-24 h-24">
              {formState.avatarPreview ? (
                <Image
                  src={formState.avatarPreview}
                  alt="Аватар"
                  width={96}
                  height={96}
                  className="w-full h-full rounded-full object-cover border-2 border-gray-200 group-hover:border-orange-500 transition-colors"
                  onError={() => setFormState((prev) => ({ ...prev, avatarPreview: null }))}
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

          {/* Информация и форма */}
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

          {/* Кнопки управления */}
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

        {/* Карточка мероприятий */}
        <div className="card p-6 mt-6 bg-white rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Мои мероприятия</h3>
          <p className="text-gray-600 text-sm mb-4 text-center">
            У вас пока нет зарегистрированных мероприятий. Начните с поиска событий!
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/events")}
            className="btn btn-primary w-full"
          >
            Найти мероприятия
          </motion.button>
        </div>

        <ChangePasswordForm
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      </div>
    </div>
  );
};

export default ProfilePage;


// "use client";

// import React, { useEffect, useState, useCallback, useRef } from "react";
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/contexts/AuthContext";
// import { usePageLoad } from "@/contexts/PageLoadContext";
// import { FaUser, FaTelegramPlane, FaWhatsapp, FaCamera, FaPencilAlt, FaLock, FaTrash } from "react-icons/fa";
// import Image from "next/image";
// import InputField from "@/components/common/InputField";
// import ErrorDisplay from "@/components/common/ErrorDisplay";
// import SuccessDisplay from "@/components/common/SuccessDisplay";
// import ChangePasswordForm from "@/components/ChangePasswordForm";
// import { motion } from "framer-motion";
// import { UserData, FormState, ValidationErrors } from "@/types/index";

// const ProfilePage: React.FC = () => {
//   const { isAuth, userData, updateUserData, isLoading: authLoading } = useAuth();
//   const { wrapAsync, apiFetch, setPageLoading } = usePageLoad();
//   const router = useRouter();

//   const [formState, setFormState] = useState<FormState>({
//     fio: "",
//     telegram: "",
//     whatsapp: "",
//     avatarPreview: null,
//     email: "",
//   });
//   const [initialFormState, setInitialFormState] = useState<FormState | null>(null);
//   const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
//   const [isEditing, setIsEditing] = useState(false);
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
//   const [fetchError, setFetchError] = useState<string | null>(null);
//   const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const hasFetched = useRef(false);
//   const isSubmitting = useRef(false);

//   // Инициализация профиля
//   useEffect(() => {
//     const initProfile = async () => {
//       if (hasFetched.current || authLoading) return;
//       if (!isAuth || !userData) {
//         router.push("/");
//         return;
//       }
//       const initialData = {
//         fio: userData.fio || "",
//         telegram: userData.telegram || "",
//         whatsapp: userData.whatsapp || "",
//         avatarPreview: userData.avatar_url || null,
//         email: userData.email || "",
//       };
//       setFormState(initialData);
//       setInitialFormState(initialData);
//       validateForm(initialData);
//       hasFetched.current = true;
//     };
//     initProfile();
//   }, [isAuth, userData, authLoading, router]);

//   // Обработка изменений полей
//   const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = e.target;
//     let newValue = value;
//     const newErrors = { ...validationErrors };

//     if (name === "telegram") {
//       newValue = value.startsWith("@") ? value : value ? `@${value}` : "";
//       newErrors.telegram = !newValue ? "Telegram обязателен" : !newValue.startsWith("@") ? "Должен начинаться с @" : undefined;
//     } else if (name === "whatsapp") {
//       newValue = value.replace(/\D/g, "");
//       newErrors.whatsapp = !newValue ? "WhatsApp обязателен" : !/^\d+$/.test(newValue) ? "Только цифры" : undefined;
//     } else if (name === "fio") {
//       newErrors.fio = !value ? "ФИО обязательно" : undefined;
//     }

//     setFormState((prev) => {
//       const updatedState = { ...prev, [name]: newValue };
//       validateForm(updatedState);
//       return updatedState;
//     });
//     setValidationErrors(newErrors);
//   }, [validationErrors]);

//   // Обработка загрузки аватара
//   const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       setSelectedFile(file);
//       const reader = new FileReader();
//       reader.onloadend = () => setFormState((prev) => ({ ...prev, avatarPreview: reader.result as string }));
//       reader.readAsDataURL(file);
//     } else {
//       setSelectedFile(null);
//       setFormState((prev) => ({ ...prev, avatarPreview: initialFormState?.avatarPreview || null }));
//     }
//   }, [initialFormState]);

//   // Удаление аватара
//   const handleRemoveAvatar = useCallback(() => {
//     setSelectedFile(null);
//     setFormState((prev) => ({ ...prev, avatarPreview: null }));
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   }, []);

//   // Валидация формы
//   const validateForm = useCallback((state: FormState = formState) => {
//     const errors: ValidationErrors = {};
//     if (!state.fio) errors.fio = "ФИО обязательно";
//     if (!state.telegram) errors.telegram = "Telegram обязателен";
//     else if (!state.telegram.startsWith("@")) errors.telegram = "Должен начинаться с @";
//     if (!state.whatsapp) errors.whatsapp = "WhatsApp обязателен";
//     else if (!/^\d+$/.test(state.whatsapp)) errors.whatsapp = "Только цифры";
//     setValidationErrors(errors);
//     return Object.keys(errors).length === 0;
//   }, [formState]);

//   // Отправка формы
//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     if (isSubmitting.current) return;

//     if (!validateForm()) return;

//     isSubmitting.current = true;
//     setPageLoading(true);
//     setFetchError(null);
//     setUpdateSuccess(null);

//     try {
//       const profileResponse = await wrapAsync<UserData>(
//         apiFetch("/user_edits/me", {
//           method: "PUT",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             fio: formState.fio,
//             telegram: formState.telegram,
//             whatsapp: formState.whatsapp,
//           }),
//         })
//       );

//       let updatedUser = profileResponse;
//       if (selectedFile) {
//         const formData = new FormData();
//         formData.append("file", selectedFile);
//         updatedUser = await wrapAsync<UserData>(
//           apiFetch("/user_edits/upload-avatar", { method: "POST", body: formData })
//         );
//       }

//       if (updatedUser) {
//         const updatedData = {
//           fio: updatedUser.fio || "",
//           telegram: updatedUser.telegram || "",
//           whatsapp: updatedUser.whatsapp || "",
//           avatarPreview: updatedUser.avatar_url || null,
//           email: updatedUser.email || "",
//         };
//         setFormState(updatedData);
//         setInitialFormState(updatedData);
//         updateUserData(updatedUser, false);
//         setUpdateSuccess("Профиль успешно обновлен!");
//         setTimeout(() => {
//           setSelectedFile(null);
//           setUpdateSuccess(null);
//           setIsEditing(false);
//           isSubmitting.current = false;
//         }, 1500);
//       } else {
//         setFetchError("Не удалось обновить профиль: данные не получены");
//         setTimeout(() => {
//           setFetchError(null);
//           setIsEditing(false);
//           isSubmitting.current = false;
//         }, 1500);
//       }
//     } catch (err) {
//       setFetchError(err instanceof Error ? err.message : "Ошибка обновления профиля");
//       setTimeout(() => {
//         setFetchError(null);
//         setIsEditing(false);
//         isSubmitting.current = false;
//       }, 1500);
//     } finally {
//       setPageLoading(false);
//     }
//   };

//   // Переключение режима редактирования
//   const toggleEdit = useCallback(() => {
//     setIsEditing((prev) => {
//       if (prev && initialFormState) {
//         setFormState(initialFormState);
//         setSelectedFile(null);
//         validateForm(initialFormState);
//       }
//       return !prev;
//     });
//     setUpdateSuccess(null);
//     setFetchError(null);
//   }, [initialFormState]);

//   if (!isAuth) return null;

//   return (
//     <div className="container mx-auto px-4 py-6 sm:py-10 mt-16 max-w-4xl">
//       <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 text-center md:text-left">
//         Ваш профиль
//       </h1>

//       <div className="flex flex-col md:grid md:grid-cols-5 gap-4 sm:gap-6">
//         {/* Основная карточка профиля */}
//         <div className="md:col-span-3 card p-4 sm:p-6">
//           <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
//             <div className="relative group">
//               {formState.avatarPreview ? (
//                 <Image
//                   src={formState.avatarPreview}
//                   alt="Аватар"
//                   width={80}
//                   height={80}
//                   className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-gray-200 group-hover:border-orange-500 transition-colors"
//                   onError={() => setFormState((prev) => ({ ...prev, avatarPreview: null }))}
//                 />
//               ) : (
//                 <div className="w-20 h-20 sm:w-24 sm:h-24 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-2xl sm:text-3xl font-bold group-hover:bg-orange-200 transition-colors">
//                   {formState.fio?.charAt(0)?.toUpperCase() || "U"}
//                 </div>
//               )}
//               {isEditing && (
//                 <>
//                   <button
//                     onClick={() => fileInputRef.current?.click()}
//                     className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
//                   >
//                     <motion.div
//                       initial={{ y: 20, opacity: 0 }}
//                       animate={{ y: 0, opacity: 1 }}
//                       exit={{ y: 20, opacity: 0 }}
//                       transition={{ duration: 0.2 }}
//                       className="bg-orange-500 rounded-full p-2"
//                     >
//                       <FaCamera className="text-white w-4 h-4 sm:w-5 sm:h-5" />
//                     </motion.div>
//                   </button>
//                   {formState.avatarPreview && (
//                     <motion.button
//                       initial={{ scale: 0 }}
//                       animate={{ scale: 1 }}
//                       exit={{ scale: 0 }}
//                       onClick={handleRemoveAvatar}
//                       className="absolute top-0 right-0 bg-red-400 text-white rounded-full w-5 h-5 flex items-center justify-center transform translate-x-1 -translate-y-1 hover:bg-red-500 transition-colors shadow-sm"
//                     >
//                       <FaTrash className="w-2.5 h-2.5" />
//                     </motion.button>
//                   )}
//                 </>
//               )}
//               <input
//                 type="file"
//                 accept="image/*"
//                 onChange={handleFileChange}
//                 className="hidden"
//                 ref={fileInputRef}
//               />
//             </div>

//             <div className="flex-1 text-center sm:text-left">
//               <h2 className="text-lg sm:text-xl font-semibold text-gray-800">{formState.fio || "Не указано"}</h2>
//               <p className="text-gray-600 text-sm sm:text-base">{formState.email || "Не указан"}</p>
//               <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center sm:justify-start">
//                 <motion.button
//                   whileHover={{ scale: 1.05 }}
//                   whileTap={{ scale: 0.95 }}
//                   onClick={toggleEdit}
//                   className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
//                 >
//                   <FaPencilAlt className="w-3 h-3 sm:w-4 sm:h-4" /> {isEditing ? "Отмена" : "Редактировать"}
//                 </motion.button>
//                 <motion.button
//                   whileHover={{ scale: 1.05 }}
//                   whileTap={{ scale: 0.95 }}
//                   onClick={() => setIsChangePasswordOpen(true)}
//                   className="btn btn-primary flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
//                 >
//                   <FaLock className="w-3 h-3 sm:w-4 sm:h-4" /> Сменить пароль
//                 </motion.button>
//               </div>
//             </div>
//           </div>

//           {isEditing ? (
//             <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
//               <div>
//                 <InputField
//                   type="text"
//                   name="fio"
//                   value={formState.fio}
//                   onChange={handleChange}
//                   placeholder="Введите ваше ФИО"
//                   icon={FaUser}
//                   required
//                   className="form-input text-sm sm:text-base"
//                 />
//                 {validationErrors.fio && (
//                   <p className="text-red-500 text-xs mt-1">{validationErrors.fio}</p>
//                 )}
//               </div>
//               <div>
//                 <InputField
//                   type="text"
//                   name="telegram"
//                   value={formState.telegram}
//                   onChange={handleChange}
//                   placeholder="Telegram (например, @username)"
//                   icon={FaTelegramPlane}
//                   required
//                   className="form-input text-sm sm:text-base"
//                 />
//                 {validationErrors.telegram && (
//                   <p className="text-red-500 text-xs mt-1">{validationErrors.telegram}</p>
//                 )}
//               </div>
//               <div>
//                 <InputField
//                   type="text"
//                   name="whatsapp"
//                   value={formState.whatsapp}
//                   onChange={handleChange}
//                   placeholder="WhatsApp (только цифры)"
//                   icon={FaWhatsapp}
//                   required
//                   className="form-input text-sm sm:text-base"
//                 />
//                 {validationErrors.whatsapp && (
//                   <p className="text-red-500 text-xs mt-1">{validationErrors.whatsapp}</p>
//                 )}
//               </div>
//               <button
//                 type="submit"
//                 disabled={Object.keys(validationErrors).length > 0 || isSubmitting.current}
//                 className={`btn btn-primary w-full text-sm sm:text-base ${
//                   Object.keys(validationErrors).length > 0 || isSubmitting.current
//                     ? "cursor-not-allowed opacity-50"
//                     : "cursor-pointer"
//                 }`}
//               >
//                 Сохранить
//               </button>
//             </form>
//           ) : (
//             <div className="space-y-2 sm:space-y-4 flex flex-col items-center sm:items-start">
//     <p className="text-gray-600 text-xs sm:text-sm break-words text-center sm:text-left">
//       <strong className="text-gray-800 text-xs sm:text-sm">Telegram:</strong>{" "}
//       {formState.telegram || "Не указан"}
//     </p>
//     <p className="text-gray-600 text-xs sm:text-sm break-words text-center sm:text-left">
//       <strong className="text-gray-800 text-xs sm:text-sm">WhatsApp:</strong>{" "}
//       {formState.whatsapp || "Не указан"}
//     </p>
//   </div>
//           )}

//           {fetchError && <ErrorDisplay error={fetchError} className="mt-3 sm:mt-4" />}
//           {updateSuccess && <SuccessDisplay message={updateSuccess} className="mt-3 sm:mt-4" />}
//         </div>

//         {/* Карточка мероприятий */}
//         <div className="md:col-span-2 card p-4 sm:p-6 flex flex-col justify-between">
//           <div>
//             <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Мои мероприятия</h3>
//             <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4">
//               У вас пока нет зарегистрированных мероприятий. Начните с поиска интересных событий!
//             </p>
//           </div>
//           <motion.button
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             onClick={() => router.push("/events")}
//             className="btn btn-primary w-full text-sm sm:text-base"
//           >
//             Найти мероприятия
//           </motion.button>
//         </div>
//       </div>

//       <ChangePasswordForm
//         isOpen={isChangePasswordOpen}
//         onClose={() => setIsChangePasswordOpen(false)}
//       />
//     </div>
//   );
// };

// export default ProfilePage;