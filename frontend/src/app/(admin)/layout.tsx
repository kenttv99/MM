// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect, useState } from "react";
import { LoadingProvider } from "@/contexts/loading";
import { useLoadingStage } from "@/contexts/loading/LoadingStageContext";
import { useLoadingFlags } from "@/contexts/loading/LoadingFlagsContext";
import { LoadingStage } from "@/contexts/loading/types";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminHeader from "@/components/AdminHeader";

// Создаем компонент для контента, который будет отрендерен внутри провайдера
const AdminLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setStage } = useLoadingStage();
  const { setDynamicLoading } = useLoadingFlags();
  const { isAuthenticated, isAuthChecked, checkAuth } = useAdminAuth();
  const [adminLoaded, setAdminLoaded] = useState(false);
  const router = useRouter();
  
  // Эффект для принудительной проверки авторизации и защиты маршрутов
  useEffect(() => {
    // Пропускаем проверку для страницы входа
    if (isLoginPage) return;
    
    const authCheck = async () => {
      // Проверяем, авторизован ли пользователь
      console.log("AdminLayout: Checking authentication for protected route");
      // Запускаем принудительную проверку на сервере с автоматическим перенаправлением
      const isValid = await checkAuth(true);
      
      if (!isValid) {
        console.log("AdminLayout: Authentication failed, redirecting to login");
        router.push("/admin-login");
      }
    };
    
    // Запускаем проверку при каждом изменении маршрута
    authCheck();
    
    // Создаем интервал для периодической проверки авторизации
    const intervalId = setInterval(authCheck, 5 * 60 * 1000); // Каждые 5 минут
    
    return () => {
      clearInterval(intervalId);
    };
  }, [checkAuth, isLoginPage, router]);

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
        // Перенаправляем на страницу входа, если пользователь не авторизован
        router.push("/admin-login");
      }
    }
  }, [isAuthChecked, isAuthenticated, isLoginPage, pathname, setDynamicLoading, setStage, adminLoaded, router]);

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

  // Предотвращаем рендеринг административных страниц для неавторизованных пользователей
  if (!isLoginPage && isAuthChecked && !isAuthenticated) {
    return null; // Не рендерим контент, потому что пользователь будет перенаправлен
  }

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