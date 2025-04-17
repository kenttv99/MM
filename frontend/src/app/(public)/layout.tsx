"use client";

import React, { Suspense } from 'react';
import Header from "@/components/Header";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import Breadcrumbs from "@/components/Breadcrumbs";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
    </>
  );
}