// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect, useState } from "react";
import { useLoading, LoadingStage } from "@/contexts/LoadingContextLegacy";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";

// Создаем компонент для контента, который будет отрендерен внутри провайдера
const AdminLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setDynamicLoading, setStage } = useLoading();
  const { isAuthenticated, isAuthChecked } = useAdminAuth();
  const [adminLoaded, setAdminLoaded] = useState(false);

  // Эффект для отслеживания состояния аутентификации
  useEffect(() => {
    if (isAuthChecked && !adminLoaded) {
      console.log("AdminLayout: Auth check completed, setting adminLoaded=true");
      setAdminLoaded(true);
      
      // Если на странице логина, не устанавливаем стадию загрузки
      if (isLoginPage) return;
      
      // Устанавливаем стадию загрузки в зависимости от аутентификации
      if (isAuthenticated) {
        console.log("AdminLayout: Auth completed, setting stage to COMPLETED");
        setStage(LoadingStage.COMPLETED);
        setDynamicLoading(false);
      } else if (!isAuthenticated && pathname !== "/admin-login") {
        console.log("AdminLayout: Not authenticated, setting stage to STATIC_CONTENT");
        setStage(LoadingStage.STATIC_CONTENT);
      }
    }
  }, [isAuthChecked, isAuthenticated, isLoginPage, pathname, setDynamicLoading, setStage, adminLoaded]);

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Размещаем AdminHeader здесь, чтобы он не перерисовывался при навигации */}
      {!isLoginPage && <AdminHeader />}
      <PageTransitionWrapper disableLoading={isLoginPage || adminLoaded}>
        <div className={!isLoginPage ? "pt-16 sm:pt-20" : ""}>
          {children}
        </div>
      </PageTransitionWrapper>
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ErrorBoundary>
        <AdminLayoutContent>
          {children}
        </AdminLayoutContent>
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}