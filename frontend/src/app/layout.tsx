// frontend/src/app/layout.tsx
"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { LoadingProvider, LoadingStage } from "@/contexts/LoadingContextLegacy";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect } from "react";
import { setCurrentLoadingStage } from "@/utils/api";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <LoadingProvider>
          <LoadingStageConnector>
            <AuthProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </AuthProvider>
          </LoadingStageConnector>
        </LoadingProvider>
      </body>
    </html>
  );
}