// frontend/src/app/(public)/layout.tsx
"use client";

import Header from "@/components/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Make sure there are no conditions preventing Header from rendering
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16">
        {children}
      </main>
    </>
  );
}