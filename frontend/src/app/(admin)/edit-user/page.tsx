// frontend/src/app/(admin)/edit-user/page.tsx
"use client";

import { Suspense, useState, useEffect, ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaUser, FaEnvelope, FaTelegram, FaWhatsapp } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { motion } from "framer-motion";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  is_blocked?: boolean;
  is_partner?: boolean;
}

async function fetchUserData(userId: string, token: string): Promise<UserData> {
  const response = await fetch(`/admin_edits/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept": "application/json",
      "Cache-Control": "no-cache",
    },
  });
  if (!response.ok) throw new Error("Не удалось загрузить данные пользователя");
  return response.json();
}

const EditUserContent: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");
  const router = useRouter();
  const { isAdminAuth, checkAuth } = useAdminAuth();

  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!userId) {
      navigateTo(router, "/dashboard");
      return;
    }
    if (!isAdminAuth) {
      navigateTo(router, "/admin-login");
      return;
    }

    const loadUser = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("admin_token");
        if (!token) throw new Error("Отсутствует токен авторизации");
        const data = await fetchUserData(userId, token);
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
        setTimeout(() => navigateTo(router, "/dashboard"), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
    loadUser();
  }, [userId, isAdminAuth, router, checkAuth]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (user) {
      setUser({
        ...user,
        [name]: type === "checkbox" ? checked : value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSuccess("");
    setIsLoading(true);
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setError("Не авторизован");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/admin_edits/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(user),
      });
      if (!response.ok) throw new Error("Ошибка обновления пользователя");
      setSuccess("Пользователь успешно обновлён");
      setTimeout(() => navigateTo(router, "/dashboard", { refresh: "true" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gray-50"
    >
      <AdminHeader />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Редактирование пользователя</h1>
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            {error && <div className="text-red-500 mb-6">{error}</div>}
            {success && <div className="text-green-600 mb-6">{success}</div>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <InputField
                type="text"
                value={user.fio}
                onChange={handleChange}
                placeholder="Введите ФИО"
                icon={FaUser}
                name="fio"
                required
              />
              <InputField
                type="email"
                value={user.email}
                onChange={handleChange}
                placeholder="Введите email"
                icon={FaEnvelope}
                name="email"
                required
              />
              <InputField
                type="text"
                value={user.telegram}
                onChange={handleChange}
                placeholder="Введите Telegram"
                icon={FaTelegram}
                name="telegram"
                required
              />
              <InputField
                type="text"
                value={user.whatsapp}
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
                      checked={user.is_blocked || false}
                      onChange={handleChange}
                      className="opacity-0 w-0 h-0"
                    />
                    <label
                      htmlFor="is_blocked"
                      className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                        user.is_blocked ? "bg-red-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                          user.is_blocked ? "transform translate-x-6" : ""
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
                      checked={user.is_partner || false}
                      onChange={handleChange}
                      className="opacity-0 w-0 h-0"
                    />
                    <label
                      htmlFor="is_partner"
                      className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${
                        user.is_partner ? "bg-blue-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                          user.is_partner ? "transform translate-x-6" : ""
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
                <ModalButton type="submit" disabled={isLoading}>
                  {isLoading ? "Сохранение..." : "Сохранить"}
                </ModalButton>
              </div>
            </form>
          </div>
        </div>
      </main>
    </motion.div>
  );
};

export default function EditUserPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <EditUserContent />
    </Suspense>
  );
}