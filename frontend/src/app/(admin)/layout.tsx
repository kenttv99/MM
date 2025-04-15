// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect, useState } from "react";
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
  const [adminLoaded, setAdminLoaded] = useState(false);
  
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
    
    // Устанавливаем adminLoaded, когда проверка завершена (для скрытия скелетона PageTransitionWrapper)
    if (isAuthChecked) {
        setAdminLoaded(true);
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

  // Предотвращаем рендеринг контента до завершения проверки авторизации 
  // или если пользователь не авторизован (он будет перенаправлен)
  if (!isLoginPage && (!isAuthChecked || !isAuthenticated)) {
    // Добавляем лог перед возвратом null
    console.log("AdminLayoutContent: Returning null due to rendering condition", {
      pathname,
      isLoginPage,
      isAuthChecked,
      isAuthenticated
    });
    // Можно вернуть скелетон или null
    // Возвращаем null, т.к. PageTransitionWrapper может иметь свой скелетон
    return null; 
  }

  // Если дошли сюда, рендерим контент
  console.log("AdminLayoutContent: Rendering content", { 
      pathname,
      isLoginPage,
      isAuthChecked,
      isAuthenticated 
  });

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