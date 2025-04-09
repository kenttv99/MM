// frontend/src/components/PageTransitionWrapper.tsx
"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import Loading from "@/components/Loading";
import { usePathname } from "next/navigation";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({ children, disableLoading = false }: PageTransitionWrapperProps) {
  const { isStaticLoading, isDynamicLoading, currentStage } = useLoading();
  const [showStaticLoading, setShowStaticLoading] = useState(false);
  const [showDynamicLoading, setShowDynamicLoading] = useState(false);
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  
  // Эффект, который полностью отключает глобальный спиннер на админском маршруте
  useEffect(() => {
    // КРИТИЧЕСКАЯ ПРОВЕРКА: Полностью отключаем глобальный спиннер для админских маршрутов 
    if (isAdminRoute) {
      // Это самое важное - принудительно отключаем все спиннеры на админских маршрутах
      setShowStaticLoading(false);
      
      // Динамические спиннеры показываем только на ранних стадиях загрузки
      // для админских маршрутов, но не на STATIC_CONTENT и выше
      const shouldShowDynamicSpinner = isDynamicLoading && 
        currentStage !== LoadingStage.STATIC_CONTENT && 
        currentStage !== LoadingStage.DYNAMIC_CONTENT && 
        currentStage !== LoadingStage.DATA_LOADING && 
        currentStage !== LoadingStage.COMPLETED;
      
      setShowDynamicLoading(shouldShowDynamicSpinner);
      
      // Принудительно добавляем глобальную переменную, которая блокирует спиннеры
      if (typeof window !== 'undefined') {
        (window as any).__disable_admin_spinners__ = true;
      }
    } else {
      // Обычная логика для не-админских маршрутов
      const shouldShowSpinner = isStaticLoading && 
        (currentStage === LoadingStage.AUTHENTICATION || 
         currentStage === LoadingStage.INITIAL);
      
      setShowStaticLoading(shouldShowSpinner);
      setShowDynamicLoading(isDynamicLoading);
    }
  }, [isStaticLoading, isDynamicLoading, currentStage, isAdminRoute]);
  
  // Альтернативная проверка для админского маршрута
  if (isAdminRoute && typeof window !== 'undefined') {
    // Форсированная проверка на админский маршрут
    const adminToken = localStorage.getItem('admin_token');
    const adminData = localStorage.getItem('admin_data');
    
    // Если есть токен и данные админа, никогда не показываем глобальный спиннер
    if (adminToken && adminData) {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${pathname}-content`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="w-full min-h-[100vh] relative"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      );
    }
  }

  // Глобальный полноэкранный спиннер только для начальных стадий загрузки
  if (showStaticLoading && !disableLoading && !isAdminRoute) {
    return (
      <motion.div
        key={`${pathname}-static-loading`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-white z-50 flex items-center justify-center min-h-[100vh]"
      >
        <Loading type="spinner" color="orange" size="medium" text="Загрузка..." />
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${pathname}-content`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full min-h-[100vh] relative"
      >
        {showDynamicLoading && !disableLoading && !isAdminRoute && (
          <motion.div
            key={`${pathname}-dynamic-loading`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center"
          >
            <Loading type="spinner" color="orange" size="medium" text="Загрузка данных..." />
          </motion.div>
        )}
        {children}
      </motion.div>
    </AnimatePresence>
  );
}