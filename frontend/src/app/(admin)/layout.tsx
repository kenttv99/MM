// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect } from "react";
import { LoadingProvider } from "@/contexts/loading";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";

// Создаем компонент для контента, который будет отрендерен внутри провайдера
const AdminLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin-login";
  const { 
    isAuthenticated, 
    isAuthChecked, 
    adminData, 
    logout 
  } = useAdminAuth();
  
  // Эффект для защиты маршрутов (редирект при необходимости)
  useEffect(() => {
    // Пропускаем для страницы входа
    if (isLoginPage) return;
    
    // Если проверка завершена и пользователь НЕ аутентифицирован, редиректим
    if (isAuthChecked && !isAuthenticated) {
        console.log("AdminLayout: Auth check complete, not authenticated. Redirecting...");
        // Используем router из хука
        router.push("/admin-login");
    }

  // Зависимости: статус проверки, аутентификация, путь
  }, [isLoginPage, isAuthChecked, isAuthenticated, router]); 

  // Устанавливаем флаг для админского маршрута
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('is_admin_route', 'true');
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('is_admin_route');
      }
    };
  }, []);

  // Предотвращаем рендеринг контента только если проверка завершена и пользователь не авторизован
  if (!isLoginPage && isAuthChecked && !isAuthenticated) {
    console.log("AdminLayoutContent: Returning null because auth check complete and user not authenticated (redirect pending)");
    return null;
  }

  // Во всех остальных случаях (включая isAuthChecked === false), рендерим контент
  // Дочерние компоненты сами решат, показывать ли скелетон
  // Комментируем этот лог
  // console.log("AdminLayoutContent: Rendering content or letting child decide skeleton", {
  //     pathname,
  //     isLoginPage,
  //     isAuthChecked,
  //     isAuthenticated
  // });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Передаем значения контекста как пропсы в AdminHeader */}
      {!isLoginPage && (
        <AdminHeader 
          isAuthenticated={isAuthenticated}
          adminData={adminData}
          logout={logout}
        />
      )}
      <PageTransitionWrapper>
        <div className={!isLoginPage ? "pt-16 sm:pt-20" : ""}>
          {children}
        </div>
      </PageTransitionWrapper>
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <AdminAuthProvider>
        <ErrorBoundary>
          <AdminLayoutContent>
            {children}
          </AdminLayoutContent>
        </ErrorBoundary>
      </AdminAuthProvider>
    </LoadingProvider>
  );
}