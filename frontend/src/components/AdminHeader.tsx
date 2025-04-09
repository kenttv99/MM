"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FaSignOutAlt, FaBars, FaTimes, FaUser, FaTachometerAlt } from "react-icons/fa";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import Logo from "./Logo";

// Динамический импорт Link для предотвращения ошибок гидратации
const Link = dynamic(() => import('next/link'), { ssr: false });

const AdminHeader: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { adminData, logoutAdmin, isAdminAuth } = useAdminAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // useEffect для клиентского монтирования
  useEffect(() => {
    setIsMounted(true);
    setIsClient(true);
    
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    // Проверяем хранилище напрямую, чтобы избежать задержек обновления контекста
    const adminToken = localStorage.getItem("admin_token");
    const isAdminPage = window.location.pathname.startsWith('/admin');
    
    // Устанавливаем флаг, который используется в AuthContext для пропуска проверок
    if (isAdminPage && adminToken) {
      localStorage.setItem('is_admin_route', 'true');
    }
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  const adminNavItems = [
    { href: "/admin-profile", label: "Профиль", icon: FaUser },
    { href: "/dashboard", label: "Панель управления", icon: FaTachometerAlt },
  ];

  // Предотвращаем рендеринг на сервере
  if (!isClient) {
    return (
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 bg-white/90 py-4`}
      >
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap gap-4">
          <div className="flex items-center flex-shrink-0">
            <Logo />
          </div>
          <div className="w-[100px] h-[44px]"></div>
        </div>
      </header>
    );
  }

  // Обходим ошибки гидратации, используя прямые проверки локального хранилища
  const hasAdminToken = typeof window !== 'undefined' && !!localStorage.getItem("admin_token");
  const showAuthView = isClient && (!hasAdminToken || !isAdminAuth);

  if (showAuthView) {
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

  // Рендерим версию для авторизованного пользователя
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap">
        <Link href="/admin-profile" className="flex items-center flex-shrink-0">
          <Logo />
          <span className="ml-2 text-[var(--primary)] font-semibold text-sm hidden sm:inline md:hidden lg:inline">
            Админ-панель
          </span>
        </Link>

        {/* Mobile menu - только для маленьких экранов (до md) */}
        <div className="flex items-center md:hidden">
          {/* Аватар с переходом на профиль - только для маленьких экранов */}
          <Link 
            href="/admin-profile"
            className="mr-2 flex items-center justify-center"
            aria-label="Профиль администратора"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <FaUser className="h-4 w-4 text-blue-500" />
            </div>
          </Link>
          
          {/* Бургер меню только для XS и SM экранов */}
          <button
            onClick={toggleMobileMenu}
            className="text-gray-700 hover:text-blue-500 p-2 min-w-[44px] min-h-[44px]"
            aria-label="Открыть меню"
          >
            {isMobileMenuOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
          </button>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center min-w-[300px] overflow-y-auto">
              <button
                onClick={toggleMobileMenu}
                className="absolute top-4 right-4 text-gray-500 hover:text-blue-500 min-w-[44px] min-h-[44px]"
                aria-label="Закрыть меню"
              >
                <FaTimes className="h-8 w-8" />
              </button>
              
              {/* Профиль администратора в мобильном меню */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <FaUser className="h-6 w-6 text-blue-500" />
                </div>
                <span className="text-base font-medium">
                  {adminData?.fio || "Администратор"}
                </span>
                <span className="text-sm text-gray-500 mb-2">
                  {adminData?.email}
                </span>
              </div>
              
              <ul className="flex flex-col items-center space-y-6 text-xl mb-8">
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
              </ul>
              
              <button
                onClick={() => {
                  logoutAdmin();
                  setIsMobileMenuOpen(false);
                }}
                className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300 flex items-center"
              >
                <FaSignOutAlt className="mr-2" />
                Выйти
              </button>
            </div>
          )}
        </div>

        {/* Desktop nav - для экранов от 1024px */}
        <div className="hidden lg:flex items-center space-x-4">
          <nav>
            <ul className="flex items-center gap-6">
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
          
          {/* Профиль и выход в одном компоненте */}
          <div className="flex items-center group relative">
            <div className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <FaUser className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-sm font-medium mr-1">
                {adminData?.fio || "Администратор"}
              </span>
              
              {/* Выпадающее меню с кнопкой выхода */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-white shadow-lg rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="p-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-800">
                    {adminData?.fio || "Администратор"}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {adminData?.email}
                  </span>
                </div>
                <div className="p-2">
                  <button
                    onClick={logoutAdmin}
                    className="w-full flex items-center px-3 py-2 text-sm text-left text-gray-700 hover:bg-red-50 hover:text-red-600 rounded"
                  >
                    <FaSignOutAlt className="mr-2" />
                    Выйти
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Специальный вид для средних экранов (между мобильными и десктопом) */}
        <div className="hidden md:flex lg:hidden items-center">
          <Link 
            href="/admin-profile"
            className="flex items-center justify-center mr-2 p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Профиль администратора"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <FaUser className="h-4 w-4 text-blue-500" />
            </div>
          </Link>

          <Link 
            href="/dashboard"
            className="flex items-center justify-center mr-2 p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Панель управления"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <FaTachometerAlt className="h-4 w-4 text-gray-600" />
            </div>
          </Link>

          <button
            onClick={logoutAdmin}
            className="p-2 hover:bg-red-50 rounded-lg"
            aria-label="Выйти"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center">
              <FaSignOutAlt className="h-4 w-4 text-red-500" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;