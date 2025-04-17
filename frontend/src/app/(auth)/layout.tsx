"use client";

import React, { Suspense } from 'react';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import Breadcrumbs from "@/components/Breadcrumbs";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuth, isAuthChecked, isLoading } = useAuth();
  const router = useRouter();
  
  // Add protection for the entire auth group
  useEffect(() => {
    // Wait until auth is checked before redirecting
    if (isAuthChecked && !isLoading && !isAuth) {
      console.log('AuthLayout: User not authenticated, redirecting to home page');
      router.push('/');
    }
  }, [isAuth, isAuthChecked, isLoading, router]);
  
  return (
    <>
      <Header />
      <ErrorBoundary>
        <main className="min-h-screen pt-16">
          <Suspense fallback={null}>
            <Breadcrumbs />
          </Suspense>
          <PageTransitionWrapper>{children}</PageTransitionWrapper>
        </main>
      </ErrorBoundary>
      <Footer />
    </>
  );
}