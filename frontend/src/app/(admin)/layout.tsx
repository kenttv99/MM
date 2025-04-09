// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect, useRef, useState } from "react";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setDynamicLoading, setStage, stage } = useLoading();
  const isInitialized = useRef(false);
  const [adminLoaded, setAdminLoaded] = useState(false);

  // Эффект для принудительного отключения загрузки на админских маршрутах
  useEffect(() => {
    // Устанавливаем флаг для админского маршрута
    if (typeof window !== 'undefined') {
      // Устанавливаем глобальную переменную, которая блокирует все спиннеры
      (window as any).__disable_admin_spinners__ = true;
      window.localStorage.setItem('is_admin_route', 'true');
    }
    
    // Прямая установка стадии без промежуточных проверок
    setStage(LoadingStage.STATIC_CONTENT);
    
    // Отключаем все индикаторы загрузки через 100мс
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && !isLoginPage) {
        // Форсированно отключаем спиннеры
        setDynamicLoading(false);
        // Устанавливаем стадию COMPLETED
        setStage(LoadingStage.COMPLETED);
        // Отмечаем админку как загруженную
        setAdminLoaded(true);
      }
    }, 100);
    
    // При размонтировании компонента
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('is_admin_route');
      }
    };
  }, [setStage, setDynamicLoading, isLoginPage]);

  // Эффект для автоматического продвижения через стадии
  useEffect(() => {
    // Быстрый переход через все стадии
    const completeLoading = () => {
      // Проверка на стадию COMPLETED
      if (stage !== LoadingStage.COMPLETED && !isLoginPage) {
        // Отключаем все индикаторы динамической загрузки
        setDynamicLoading(false);
        
        // Устанавливаем конечную стадию напрямую
        setStage(LoadingStage.COMPLETED);
        
        // Устанавливаем глобальную переменную
        if (typeof window !== 'undefined') {
          (window as any).__loading_stage__ = LoadingStage.COMPLETED;
        }
      }
    };
    
    // Вызываем немедленно для ускорения работы
    completeLoading();
    
    // И через небольшую задержку для надежности
    const timer = setTimeout(completeLoading, 200);
    
    return () => clearTimeout(timer);
  }, [stage, setStage, setDynamicLoading, isLoginPage]);
  
  // Добавляем таймер для гарантированного завершения загрузки
  useEffect(() => {
    const finalTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && !isLoginPage) {
        // Принудительно отключаем все спиннеры
        if (stage !== LoadingStage.COMPLETED) {
          setStage(LoadingStage.COMPLETED);
        }
        setDynamicLoading(false);
        // Глобальная переменная для блокировки всех спиннеров
        (window as any).__admin_fully_loaded__ = true;
        // Устанавливаем флаг загрузки
        setAdminLoaded(true);
      }
    }, 1000); // Гарантированно через 1 секунду
    
    return () => clearTimeout(finalTimer);
  }, [setStage, setDynamicLoading, stage, isLoginPage]);

  return (
    <AdminAuthProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-100">
          <PageTransitionWrapper disableLoading={isLoginPage || adminLoaded}>
            {children}
          </PageTransitionWrapper>
        </div>
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}