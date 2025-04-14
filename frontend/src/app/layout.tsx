// frontend/src/app/layout.tsx
"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { LoadingProvider } from "@/contexts/loading";
import { LoadingStage } from "@/contexts/loading/types";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import React, { useEffect } from "react";
import { setCurrentLoadingStage } from "@/utils/api";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

// This component connects the LoadingContext to the API utility
function LoadingStageConnector({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Create event listener for stage changes
    const handleStageChange = (event: CustomEvent<{ stage: LoadingStage }>) => {
      setCurrentLoadingStage(event.detail.stage);
    };

    // Listen for custom events from LoadingContext with proper typing
    window.addEventListener('loadingStageChange', handleStageChange as EventListener);

    return () => {
      window.removeEventListener('loadingStageChange', handleStageChange as EventListener);
    };
  }, []);

  return <>{children}</>;
}

// Убираем React.memo
const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <LoadingStageConnector>
      {!isAdminRoute ? (
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AuthProvider>
      ) : (
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      )}
    </LoadingStageConnector>
  );
};
// Добавляем displayName для отладки
LayoutContent.displayName = 'LayoutContent';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <LoadingProvider>
          {/* Используем мемоизированный компонент */}
          <LayoutContent>{children}</LayoutContent>
        </LoadingProvider>
      </body>
    </html>
  );
}