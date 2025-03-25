// frontend/src/app/(public)/layout.tsx
"use client";

import Header from "@/components/Header";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16">
        <PageTransitionWrapper>
          {children}
        </PageTransitionWrapper>
      </main>
    </>
  );
}