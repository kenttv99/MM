// frontend/src/app/(auth)/layout.tsx
"use client";

import Header from "@/components/Header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16">
        {children}
      </main>
    </>
  );
}