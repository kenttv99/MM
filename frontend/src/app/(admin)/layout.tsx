// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { Geist, Geist_Mono } from "next/font/google";

// Настраиваем шрифты
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Проверка, является ли текущий путь страницей входа
  const isLoginPage = pathname === "/admin-login";

  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AdminAuthProvider>
          <main className={`min-h-screen ${isLoginPage ? "" : "pt-16"}`}>
            {children}
          </main>
        </AdminAuthProvider>
      </body>
    </html>
  );
}