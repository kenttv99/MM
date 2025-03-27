"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
// import Breadcrumbs from "@/components/Breadcrumbs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Настройки кэширования по умолчанию
      staleTime: 5 * 60 * 1000, // Данные считаются устаревшими через 5 минут
      gcTime: 10 * 60 * 1000, // Кэш хранится 10 минут
      refetchOnWindowFocus: false, // Отключаем повторную загрузку при фокусе окна
    },
  },
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";

  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gray-100">
          {!isLoginPage && (
            <p className="text-center text-red-500 py-4">
              {/* Можно оставить пустым или добавить уведомление */}
            </p>
          )}
          {/* <Breadcrumbs /> */}
          <PageTransitionWrapper disableLoading={isLoginPage}>
            {children}
          </PageTransitionWrapper>
        </div>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}