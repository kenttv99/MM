// frontend/src/components/AdminHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import { FaSignOutAlt, FaBars, FaTimes, FaUser, FaTachometerAlt } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const AdminHeader: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { push } = useRouter();
  const { adminData, logoutAdmin, isAdminAuth, isLoading } = useAdminAuth();

  console.log("AdminHeader adminData:", adminData);

  useEffect(() => {
    if (!isLoading && !isAdminAuth) {
      push("/admin-login");
    }
  }, [isAdminAuth, isLoading, push]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  const adminNavItems = [
    { href: "/admin-profile", label: "Профиль", icon: FaUser },
    { href: "/dashboard", label: "Панель управления", icon: FaTachometerAlt },
  ];

  if (isLoading) {
    return null; // Не отображаем хедер, пока данные загружаются
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 shadow-lg py-3" : "bg-white/90 py-4"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/admin-profile" className="flex items-center">
          <Logo />
          <span className="ml-2 text-orange-500 font-semibold">Админ-панель</span>
        </Link>

        {/* Мобильное меню */}
        <div className="flex items-center md:hidden">
          {isAdminAuth && (
            <Link href="/admin-profile" className="mr-4 text-blue-500 hover:text-blue-600 flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <FaUser className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium truncate max-w-[120px]">
                {adminData?.fio || "Администратор"}
              </span>
            </Link>
          )}
          <button onClick={toggleMobileMenu} className="text-gray-700 hover:text-blue-500">
            {isMobileMenuOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
          </button>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
              <button
                onClick={toggleMobileMenu}
                className="absolute top-4 right-4 text-gray-500 hover:text-blue-500"
              >
                <FaTimes className="h-8 w-8" />
              </button>
              <ul className="flex flex-col items-center space-y-6 text-xl">
                {adminNavItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={item.href}
                      className="text-gray-800 hover:text-blue-500 flex items-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon className="mr-2" />
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => {
                      logoutAdmin();
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-gray-800 hover:text-blue-500 flex items-center"
                  >
                    <FaSignOutAlt className="mr-2" />
                    Выйти
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Десктопная навигация */}
        <div className="hidden md:flex items-center space-x-4">
          {isAdminAuth ? (
            <>
              <nav className="mr-4">
                <ul className="flex space-x-6">
                  {adminNavItems.map((item, index) => (
                    <li key={index}>
                      <Link
                        href={item.href}
                        className="text-gray-600 hover:text-blue-500 flex items-center"
                      >
                        <item.icon className="mr-2" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="flex items-center mr-4 text-gray-600">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                  <FaUser className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {adminData?.fio || "Администратор"}
                </span>
              </div>
              <button
                onClick={logoutAdmin}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 flex items-center"
              >
                <FaSignOutAlt className="mr-2" />
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/admin-login"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;