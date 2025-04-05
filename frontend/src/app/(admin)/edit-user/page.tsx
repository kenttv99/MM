"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useUserForm } from "@/hooks/useUserForm";
import AdminHeader from "@/components/AdminHeader";
import { FaUser, FaEnvelope, FaTelegram, FaWhatsapp } from "react-icons/fa";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";

const EditUserPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");
  const router = useRouter();
  const { isAdminAuth } = useAdminAuth();
  const initialized = useRef(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { userData, error, isLoading, loadUser, handleChange, handleSubmit } = useUserForm({
    onSuccess: () => {
      setSuccess("Пользователь успешно обновлён");
      setTimeout(() => router.push("/dashboard"), 1500);
    },
  });

  useEffect(() => {
    if (initialized.current || !userId || !isAdminAuth) return;
    initialized.current = true;

    if (!isAdminAuth) {
      router.push("/admin-login");
      return;
    }

    loadUser(userId);
  }, [userId, isAdminAuth, loadUser, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Редактирование пользователя</h1>
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-3xl mx-auto">
          {error && <div className="text-red-500 mb-6">{error}</div>}
          {success && <div className="text-green-500 mb-6">{success}</div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <InputField
              type="text"
              value={userData?.fio || ""}
              onChange={handleChange}
              placeholder="Введите ФИО"
              icon={FaUser}
              name="fio"
              required
              disabled={!userData || isLoading}
            />
            <InputField
              type="email"
              value={userData?.email || ""}
              onChange={handleChange}
              placeholder="Введите email"
              icon={FaEnvelope}
              name="email"
              required
              disabled={!userData || isLoading}
            />
            <InputField
              type="text"
              value={userData?.telegram || ""}
              onChange={handleChange}
              placeholder="Введите Telegram"
              icon={FaTelegram}
              name="telegram"
              required
              disabled={!userData || isLoading}
            />
            <InputField
              type="text"
              value={userData?.whatsapp || ""}
              onChange={handleChange}
              placeholder="Введите WhatsApp"
              icon={FaWhatsapp}
              name="whatsapp"
              required
              disabled={!userData || isLoading}
            />
            {userData && (
              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Отмена
                </button>
                <ModalButton type="submit" disabled={isLoading}>
                  {isLoading ? "Сохранение..." : "Сохранить"}
                </ModalButton>
              </div>
            )}
            {!userData && <p className="text-gray-500 text-center">Загрузка данных...</p>}
          </form>
        </div>
      </main>
    </div>
  );
};

const EditUserPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditUserPageContent />
    </Suspense>
  );
};

export default EditUserPage;