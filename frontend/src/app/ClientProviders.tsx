"use client";

import React, { useEffect } from "react";
import type { ReactNode } from "react";
import { LoadingProvider } from "@/contexts/loading";
import { LoadingStage } from "@/contexts/loading/types";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { setCurrentLoadingStage } from "@/utils/api";
import { usePathname } from "next/navigation";

// Компонент для слушателя смены стадии загрузки
function LoadingStageConnector({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleStageChange = (event: CustomEvent<{ stage: LoadingStage }>) => {
      setCurrentLoadingStage(event.detail.stage);
    };
    window.addEventListener('loadingStageChange', handleStageChange as EventListener);
    return () => {
      window.removeEventListener('loadingStageChange', handleStageChange as EventListener);
    };
  }, []);

  return <>{children}</>;
}

// Контент, оборачивающий детей в нужные провайдеры
const ClientContent = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <LoadingStageConnector>
      {isAdminRoute ? (
        <AdminAuthProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AdminAuthProvider>
      ) : (
        <AuthProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthProvider>
      )}
    </LoadingStageConnector>
  );
};

// Главный провайдер, объединяющий загрузочный провайдер
export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LoadingProvider>
      <ClientContent>{children}</ClientContent>
    </LoadingProvider>
  );
} 