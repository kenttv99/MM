"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { FaSignOutAlt, FaBars, FaTimes, FaUser, FaTachometerAlt } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const AdminHeader: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { adminData, logoutAdmin, isAdminAuth } = useAdminAuth();

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

  if (!isAdminAuth) {
    return (
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
          isScrolled ? "bg-white/95 shadow-lg py-3" : "bg-white/90 py-4"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap gap-4">
          <Link href="/admin-login" className="flex items-center flex-shrink-0">
            <Logo />
            <span className="ml-2 text-[var(--primary)] font-semibold text-sm hidden sm:inline">
              Админ-панель
            </span>
          </Link>
          <Link
            href="/admin-login"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 min-w-[100px] min-h-[44px] text-sm sm:text-base"
          >
            Войти
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap gap-4">
        <Link href="/admin-profile" className="flex items-center flex-shrink-0">
          <Logo />
          <span className="ml-2 text-[var(--primary)] font-semibold text-sm hidden sm:inline">
            Админ-панель
          </span>
        </Link>

        {/* Mobile menu */}
        <div className="flex items-center md:hidden gap-2">
          {isAdminAuth && (
            <Link href="/admin-profile" className="mr-2 text-blue-500 hover:text-blue-600 flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center min-w-[40px] min-h-[40px]">
                <FaUser className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium truncate max-w-[120px] ml-2" style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)" }}>
                {adminData?.fio || "Администратор"}
              </span>
            </Link>
          )}
          <button
            onClick={toggleMobileMenu}
            className="text-gray-700 hover:text-blue-500 p-2 min-w-[44px] min-h-[44px]"
          >
            {isMobileMenuOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
          </button>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center min-w-[300px] overflow-y-auto">
              <button
                onClick={toggleMobileMenu}
                className="absolute top-4 right-4 text-gray-500 hover:text-blue-500 min-w-[44px] min-h-[44px]"
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

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4 flex-wrap">
          <nav className="mr-4">
            <ul className="flex gap-6 flex-wrap">
              {adminNavItems.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    className="text-gray-600 hover:text-blue-500 flex items-center text-sm sm:text-base"
                  >
                    <item.icon className="mr-2" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center mr-4 text-gray-600">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2 min-w-[40px] min-h-[40px]">
              <FaUser className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium truncate max-w-[120px]" style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)" }}>
              {adminData?.fio || "Администратор"}
            </span>
          </div>
          <button
            onClick={logoutAdmin}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 flex items-center min-w-[100px] min-h-[44px] text-sm sm:text-base"
          >
            <FaSignOutAlt className="mr-2" />
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;