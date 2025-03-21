// frontend/src/app/(public)/layout.tsx
"use client";

import Header from "@/components/Header";

export default function PublicLayout({
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