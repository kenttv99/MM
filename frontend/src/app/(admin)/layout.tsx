// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect, useRef } from "react";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setDynamicLoading, setStage } = useLoading();
  const isInitialized = useRef(false);

  // Эффект для предотвращения загрузки обычного пользовательского токена на админских страницах
  useEffect(() => {
    // Предотвращаем повторную инициализацию
    if (isInitialized.current) {
      return;
    }
    
    isInitialized.current = true;
    
    // Атомарно устанавливаем флаг и стадию загрузки
    if (typeof window !== 'undefined') {
      // Устанавливаем флаг, который будет использовать AuthContext
      window.localStorage.setItem('is_admin_route', 'true');
      
      // Оптимизация: устанавливаем глобальную переменную напрямую
      if ((window as any).__loading_stage__ !== LoadingStage.STATIC_CONTENT) {
        // Сначала устанавливаем глобальную переменную для предотвращения циклов
        (window as any).__loading_stage__ = LoadingStage.STATIC_CONTENT;
        
        console.log('AdminLayout: Setting STATIC_CONTENT stage for admin route');
        // Теперь обновляем контекст
        setStage(LoadingStage.STATIC_CONTENT);
      } else {
        console.log('AdminLayout: Already in STATIC_CONTENT stage, skipping transition');
      }
    }
    
    // Очищаем флаг при размонтировании
    return () => {
      isInitialized.current = false;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('is_admin_route');
      }
    };
  }, [setStage]);

  useEffect(() => {
    // Предотвращаем повторную установку таймеров
    if (!isInitialized.current) {
      return;
    }
    
    const timer = setTimeout(() => {
      if (!isLoginPage) {
        setDynamicLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      setDynamicLoading(false);
    };
  }, [isLoginPage, setDynamicLoading]);

  return (
    <AdminAuthProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-100">
          <PageTransitionWrapper disableLoading={isLoginPage}>
            {children}
          </PageTransitionWrapper>
        </div>
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}