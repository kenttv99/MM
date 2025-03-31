"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useAdminAuthForm } from "@/hooks/useAdminAuthForm";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";
import { usePageLoad } from "@/contexts/PageLoadContext";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

export default function AdminLoginPage() {
  const router = useRouter();
  const { checkAuth } = useAdminAuth();
  const { setPageLoading } = usePageLoad();

  useEffect(() => {
    const initialLoad = async () => {
      try {
        const isAuthenticated = await checkAuth();
        if (isAuthenticated) {
          navigateTo(router, "/admin-profile");
        }
      } catch (err) {
        console.error("AdminLoginPage: checkAuth failed:", err);
      } finally {
        setPageLoading(false);
      }
    };
    
    initialLoad();
  }, [checkAuth, router, setPageLoading]);

  const {
    formValues,
    error,
    isLoading: formLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  } = useAdminAuthForm({
    initialValues: {
      email: "",
      password: "",
    },
    endpoint: "/admin/login",
    redirectTo: "/admin-profile",
  });

  return (
    <>
      <AdminHeader />
      <div className="flex items-center justify-center min-h-screen bg-gray-50 pt-16">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">Вход для администраторов</h1>
          <form onSubmit={handleSubmit}>
            <InputField
              type="email"
              value={formValues.email}
              onChange={handleChange}
              placeholder="Email"
              icon={FaEnvelope}
              name="email"
              required
              disabled={isSuccess}
            />
            <InputField
              type="password"
              value={formValues.password}
              onChange={handleChange}
              placeholder="Пароль"
              icon={FaLock}
              name="password"
              required
              disabled={isSuccess}
            />
            {error && (
              <div className="text-red-500 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm mb-6">
                {error}
              </div>
            )}
            {isSuccess && (
              <div className="text-green-600 bg-green-50 p-3 rounded-lg border-l-4 border-green-500 text-sm mb-6">
                Вход успешен!
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <ModalButton
                variant="secondary"
                onClick={() => navigateTo(router, "/")}
                disabled={formLoading || isSuccess}
              >
                На главную
              </ModalButton>
              <ModalButton
                type="submit"
                variant="primary"
                disabled={formLoading || isSuccess}
              >
                {formLoading ? "Вход..." : isSuccess ? "Успешно!" : "Войти"}
              </ModalButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}