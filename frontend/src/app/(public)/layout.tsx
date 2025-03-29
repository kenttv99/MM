"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import Breadcrumbs from "@/components/Breadcrumbs";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { PageLoadContext } from "@/contexts/PageLoadContext";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Function to set page as loaded
  const setPageLoaded = (loaded: boolean) => {
    setIsPageLoading(!loaded);
    
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  };

  // Set a fallback timeout only once on initial mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isPageLoading) {
        console.log("Page load timeout triggered - forcing loading to complete");
        setIsPageLoading(false);
      }
    }, 2000); // 5 second timeout as a safety mechanism
    
    setLoadingTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageLoadContext.Provider value={{ setPageLoaded }}>
      <Header />
      <ErrorBoundary>
        <main className="min-h-screen pt-16">
          {isPageLoading ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              <Breadcrumbs />
              <PageTransitionWrapper>{children}</PageTransitionWrapper>
            </>
          )}
        </main>
      </ErrorBoundary>
    </PageLoadContext.Provider>
  );
}