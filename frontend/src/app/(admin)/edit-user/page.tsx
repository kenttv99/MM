  // frontend/src/app/(admin)/edit-user/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaUser, FaEnvelope, FaTelegram, FaWhatsapp } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useUserForm } from "@/hooks/useUserForm";
import ErrorDisplay from "@/components/common/ErrorDisplay";
import SuccessDisplay from "@/components/common/SuccessDisplay";
import { motion } from "framer-motion"; // Добавляем framer-motion

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search, { scroll: false });
};

const EditUserPage: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");
  const router = useRouter();
  const { isAdminAuth } = useAdminAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  const {
    userData,
    isLoading,
    error,
    loadUser,
    handleChange,
    handleSubmit
  } = useUserForm({
    onSuccess: () => {
      setLocalSuccess("Пользователь успешно обновлён");
      setTimeout(() => navigateTo(router, "/dashboard"), 1500); // Убираем refresh=true
    }
  });

  useEffect(() => {
    if (!userId) {
      navigateTo(router, "/dashboard");
      return;
    }
    if (!isAdminAuth) {
      navigateTo(router, "/admin-login");
      return;
    }

    loadUser(userId);
  }, [userId, isAdminAuth, router, loadUser]);

  if (isLoading || !userData) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Редактирование пользователя</h1>
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              <ErrorDisplay error={error} className="mb-6" />
              <SuccessDisplay message={localSuccess} className="mb-6" />
              
              <form onSubmit={(e) => {
                e.preventDefault();
                setIsSubmitting(true);
                handleSubmit(e).finally(() => setIsSubmitting(false));
              }} className="space-y-6">
                <InputField
                  type="text"
                  value={userData.fio}
                  onChange={handleChange}
                  placeholder="Введите ФИО"
                  icon={FaUser}
                  name="fio"
                  required
                />
                <InputField
                  type="email"
                  value={userData.email}
                  onChange={handleChange}
                  placeholder="Введите email"
                  icon={FaEnvelope}
                  name="email"
                  required
                />
                <InputField
                  type="text"
                  value={userData.telegram}
                  onChange={handleChange}
                  placeholder="Введите Telegram"
                  icon={FaTelegram}
                  name="telegram"
                  required
                />
                <InputField
                  type="text"
                  value={userData.whatsapp}
                  onChange={handleChange}
                  placeholder="Введите WhatsApp"
                  icon={FaWhatsapp}
                  name="whatsapp"
                  required
                />
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Заблокирован</label>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        id="is_blocked"
                        name="is_blocked"
                        checked={userData.is_blocked || false}
                        onChange={handleChange}
                        className="opacity-0 w-0 h-0"
                      />
                      <label
                        htmlFor="is_blocked"
                        className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                          userData.is_blocked ? "bg-red-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                            userData.is_blocked ? "transform translate-x-6" : ""
                          }`}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Партнёр</label>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        id="is_partner"
                        name="is_partner"
                        checked={userData.is_partner || false}
                        onChange={handleChange}
                        className="opacity-0 w-0 h-0"
                      />
                      <label
                        htmlFor="is_partner"
                        className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                          userData.is_partner ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                            userData.is_partner ? "transform translate-x-6" : ""
                          }`}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => navigateTo(router, "/dashboard")}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                  <ModalButton type="submit" disabled={isSubmitting || isLoading}>
                    {isSubmitting || isLoading ? "Сохранение..." : "Сохранить"}
                  </ModalButton>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default EditUserPage;