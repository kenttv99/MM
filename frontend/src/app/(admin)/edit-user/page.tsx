// frontend/src/app/(admin)/edit-user/page.tsx
"use client";

import { useState, useEffect, ChangeEvent, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaUser, FaEnvelope, FaTelegram, FaWhatsapp, FaCheck } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { motion, AnimatePresence } from "framer-motion";

// Интерфейс для ошибок валидации
interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// Интерфейс для данных пользователя
interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  is_blocked?: boolean;
  is_partner?: boolean;
}

const EditUserContent: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");

  const initialUserState: UserData = {
    id: 0,
    fio: "",
    email: "",
    telegram: "",
    whatsapp: "",
    is_blocked: false,
    is_partner: false,
  };

  const [user, setUser] = useState<UserData>(initialUserState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [pendingBlockStatus, setPendingBlockStatus] = useState<boolean | null>(null);
  const [pendingPartnerStatus, setPendingPartnerStatus] = useState<boolean | null>(null);
  const hasFetchedRef = useRef(false); // Используем useRef вместо useState

  const router = useRouter();
  const { isAdminAuth, isLoading: authLoading, checkAuth } = useAdminAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const fetchUser = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        setError("Отсутствует токен авторизации");
        setTimeout(() => {
          router.push("/admin-login");
        }, 2000);
        return;
      }
      const response = await fetch(`/admin_edits/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json",
          "Cache-Control": "no-cache",
        },
      });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError(`Получен неверный формат ответа: ${contentType || "неизвестный тип"}`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
        return;
      }
      if (!response.ok) {
        setError(`Ошибка API: ${response.status} ${response.statusText}`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
        return;
      }
      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при загрузке данных");
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !hasFetchedRef.current) {
      if (!userId) {
        router.push("/dashboard");
        return;
      }
      if (!isAdminAuth) {
        router.push("/admin-login");
        return;
      }
      if (userId) {
        fetchUser(userId);
        hasFetchedRef.current = true; // Устанавливаем флаг через useRef
      }
    }
  }, [userId, isAdminAuth, authLoading, router, fetchUser]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === "is_blocked") {
        setPendingBlockStatus(checked);
        setShowBlockModal(true);
      } else if (name === "is_partner") {
        setPendingPartnerStatus(checked);
        setShowPartnerModal(true);
      }
    } else {
      setUser({ ...user, [name]: value });
    }
  };

  const confirmBlockChange = async () => {
    if (pendingBlockStatus === null) return;

    setUser((prev) => ({ ...prev, is_blocked: pendingBlockStatus }));
    setShowBlockModal(false);
    setPendingBlockStatus(null);
  };

  const cancelBlockChange = () => {
    setShowBlockModal(false);
    setPendingBlockStatus(null);
  };

  const confirmPartnerChange = async () => {
    if (pendingPartnerStatus === null) return;

    setUser((prev) => ({ ...prev, is_partner: pendingPartnerStatus }));
    setShowPartnerModal(false);
    setPendingPartnerStatus(null);
  };

  const cancelPartnerChange = () => {
    setShowPartnerModal(false);
    setPendingPartnerStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = "Ошибка обновления пользователя";
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((err: ValidationError) => {
              if (err.msg && err.loc) {
                return `${err.loc.join(".")}: ${err.msg}`;
              }
              return JSON.stringify(err);
            }).join("; ");
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        }
        throw new Error(errorMessage);
      }
      setSuccess("Пользователь успешно обновлён");
      setTimeout(() => {
        router.push("/dashboard?refresh=true");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 bg-red-50 p-4 rounded-lg border-l-4 border-red-500 text-red-700"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 bg-green-50 p-4 rounded-lg border-l-4 border-green-500 text-green-700"
                >
                  {success}
                </motion.div>
              )}
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Секция: Информация о пользователе */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Информация о пользователе</h2>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">ФИО</label>
                    <InputField
                      type="text"
                      value={user.fio}
                      onChange={handleChange}
                      placeholder="Введите ФИО"
                      icon={FaUser}
                      name="fio"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Email</label>
                    <InputField
                      type="email"
                      value={user.email}
                      onChange={handleChange}
                      placeholder="Введите email"
                      icon={FaEnvelope}
                      name="email"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Telegram</label>
                      <InputField
                        type="text"
                        value={user.telegram}
                        onChange={handleChange}
                        placeholder="Введите Telegram"
                        icon={FaTelegram}
                        name="telegram"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">WhatsApp</label>
                      <InputField
                        type="text"
                        value={user.whatsapp}
                        onChange={handleChange}
                        placeholder="Введите WhatsApp"
                        icon={FaWhatsapp}
                        name="whatsapp"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Секция: Управление статусом */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Управление статусом</h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium">Статус блокировки</label>
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
                      <label className="block text-gray-700 mb-2 font-medium">Статус партнёра</label>
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
                </div>

                {/* Кнопки управления */}
                <div className="flex justify-between pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
                  >
                    Отмена
                  </button>
                  <ModalButton type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Сохранение...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <FaCheck className="mr-2" />
                        Сохранить изменения
                      </span>
                    )}
                  </ModalButton>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Модальное окно для подтверждения блокировки */}
      <AnimatePresence>
        {showBlockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            >
              <h2 className="text-lg font-semibold mb-4">Подтверждение изменения статуса</h2>
              <p className="text-gray-600 mb-6">
                Вы уверены, что хотите {pendingBlockStatus ? "заблокировать" : "разблокировать"} пользователя?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelBlockChange}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmBlockChange}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Подтвердить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно для подтверждения статуса партнёра */}
      <AnimatePresence>
        {showPartnerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            >
              <h2 className="text-lg font-semibold mb-4">Подтверждение изменения статуса</h2>
              <p className="text-gray-600 mb-6">
                Вы уверены, что хотите {pendingPartnerStatus ? "включить" : "выключить"} статус партнёра для пользователя?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelPartnerChange}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmPartnerChange}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Подтвердить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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