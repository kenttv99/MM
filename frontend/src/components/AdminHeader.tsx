"use client";

import { useState, useEffect, memo, useRef } from "react";
import dynamic from "next/dynamic";
import { FaSignOutAlt, FaBars, FaTimes, FaUser, FaTachometerAlt } from "react-icons/fa";
import Logo from "./Logo";
import { usePathname } from "next/navigation";





// Добавляем уровни логирования для оптимизации вывода
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

// Устанавливаем уровень логирования (можно менять при разработке/продакшене)
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.WARN 
  : LOG_LEVEL.INFO;

// Вспомогательные функции для логирования с разными уровнями
const logDebug = (message: string, data?: unknown) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
    console.log(`AdminHeader: ${message}`, data);
  }
};

const logInfo = (message: string, data?: unknown) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
    console.log(`AdminHeader: ${message}`, data);
  }
};

// Интерфейс AdminProfile (дублируется, лучше вынести в types)
interface AdminProfile {
  id: number;
  email: string;
  fio: string;
}

// Интерфейс для пропсов
interface AdminHeaderProps {
  isAuthenticated: boolean;
  adminData: AdminProfile | null;
  logout: () => void;
}

// Динамический импорт Link для предотвращения ошибок гидратации
const Link = dynamic(() => import('next/link'), { ssr: false });

// Принимаем пропсы, убираем useAdminAuth
const AdminHeader: React.FC<AdminHeaderProps> = memo(({
  isAuthenticated,
  adminData,
  logout,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();
  
  // Refs для предотвращения ненужных перерисовок
  const isScrolledRef = useRef(false);
  const isMobileMenuOpenRef = useRef(false);
  const lastScrollY = useRef<number>(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // useEffect для клиентского монтирования и оптимизации прокрутки
  useEffect(() => {
    if (isMounted) return; // Выполняем только при первом монтировании
    
    setIsMounted(true);
    setIsClient(true);
    logInfo('AdminHeader component mounted');
    
    // Оптимизированный обработчик прокрутки
    const handleScroll = () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      scrollTimeout.current = setTimeout(() => {
        const currentScrollY = window.scrollY;
        // Обновляем состояние только если позиция прокрутки изменилась значительно (более 20px)
        if (Math.abs(currentScrollY - lastScrollY.current) > 20) {
          const newScrolled = currentScrollY > 20;
          if (newScrolled !== isScrolledRef.current) {
            isScrolledRef.current = newScrolled;
            setIsScrolled(newScrolled);
            logDebug('Scroll state updated', { newScrolled });
          }
          lastScrollY.current = currentScrollY;
        }
      }, 100); // Ограничиваем до макс. 1 раз в 100мс
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Логика с is_admin_route (можно оставить или убрать validateTokenLocally)
    const isAdminPage = window.location.pathname.startsWith('/admin');
    const isLoginPage = window.location.pathname.includes('/admin-login');
    // const isValidToken = validateTokenLocally(); // Используем пропс, если нужно
    if (isLoginPage) {
      localStorage.removeItem('is_admin_route');
    } else if (isAdminPage /* && isValidToken */) { // Можно убрать проверку токена здесь
      localStorage.setItem('is_admin_route', 'true');
    }
    
    // Добавляем класс к хедеру для идентификации
    const header = document.querySelector('header');
    if (header) {
      header.classList.add('header-wrapper');
    }
    
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMounted, pathname]); // Убираем validateTokenLocally из зависимостей

  // Эффект для логирования состояния при смене пути
  useEffect(() => {
    logInfo("Pathname changed", { pathname, isAuthenticated, hasAdminData: !!adminData });
  }, [pathname, isAuthenticated, adminData]);

  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpenRef.current;
    isMobileMenuOpenRef.current = newState;
    setIsMobileMenuOpen(newState);
  };

  const adminNavItems = [
    { href: "/admin-profile", label: "Профиль", icon: FaUser },
    { href: "/dashboard", label: "Панель управления", icon: FaTachometerAlt },
  ];

  const isLoginPage = isClient && pathname?.includes('/admin-login');
  
  // 2. Страница логина
  if (isLoginPage) {
    return (
      <header className={`fixed top-0 left-0 right-0 z-30 header-wrapper ${
        isScrolled ? "bg-white/95 shadow-lg py-3" : "bg-white/90 py-4"
      }`}>
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap gap-4">
          <Link href="/admin-login" className="flex items-center flex-shrink-0">
            <Logo />
            <span className="ml-2 text-[var(--primary)] font-semibold text-sm hidden sm:inline">
              Админ-панель
            </span>
          </Link>
        </div>
      </header>
    );
  }

  // 3. Авторизованное состояние (данные должны быть)
  if (isAuthenticated && adminData) {
    return (
      <header className={`fixed top-0 left-0 right-0 z-30 header-wrapper ${
          isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"
        }`}>
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap">
          <Link href="/admin-profile" className="flex items-center flex-shrink-0">
            <Logo />
            <span className="ml-2 text-[var(--primary)] font-semibold text-sm hidden sm:inline md:hidden lg:inline">Админ-панель</span>
          </Link>
          {/* Mobile menu */} 
          <div className="flex items-center md:hidden">
            <Link href="/admin-profile" className="mr-2 flex items-center justify-center" aria-label="Профиль администратора">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><FaUser className="h-4 w-4 text-blue-500" /></div>
            </Link>
            <button onClick={toggleMobileMenu} className="text-gray-700 hover:text-blue-500 p-2 min-w-[44px] min-h-[44px]" aria-label="Открыть меню">
              {isMobileMenuOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
            </button>
            {isMobileMenuOpen && (
              <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center min-w-[300px] overflow-y-auto">
                <button onClick={toggleMobileMenu} className="absolute top-4 right-4 text-gray-500 hover:text-blue-500 min-w-[44px] min-h-[44px]" aria-label="Закрыть меню"><FaTimes className="h-8 w-8" /></button>
                <div className="flex flex-col items-center mb-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2"><FaUser className="h-6 w-6 text-blue-500" /></div>
                  <span className="text-base font-medium">{adminData.fio}</span>
                  <span className="text-sm text-gray-500 mb-2">{adminData.email}</span>
                </div>
                <ul className="flex flex-col items-center space-y-6 text-xl mb-8">
                  {adminNavItems.map((item, index) => (<li key={index}><Link href={item.href} className="text-gray-800 hover:text-blue-500 flex items-center" onClick={() => setIsMobileMenuOpen(false)}><item.icon className="mr-2" />{item.label}</Link></li>))}
                </ul>
                <button onClick={logout} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center"><FaSignOutAlt className="mr-2" />Выйти</button>
              </div>)}
          </div>
          {/* Desktop nav */} 
          <div className="hidden lg:flex items-center space-x-4">
            <nav>
              <ul className="flex items-center gap-6">
                {adminNavItems.map((item, index) => (<li key={index}><Link href={item.href} className={`text-gray-600 hover:text-blue-500 flex items-center text-sm sm:text-base ${pathname === item.href ? 'text-blue-500 font-medium' : ''}`} prefetch={false}><item.icon className="mr-2" />{item.label}</Link></li>))}
              </ul>
            </nav>
            <div className="flex items-center group relative">
              <div className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2"><FaUser className="h-4 w-4 text-blue-500" /></div>
                <span className="text-sm font-medium mr-1">{adminData.fio}</span>
                <div className="absolute right-0 top-full w-48 bg-white shadow-lg rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 transition-opacity duration-150">
                  <div className="p-3 border-b border-gray-100"><span className="text-sm font-medium text-gray-800">{adminData.fio}</span><span className="block text-xs text-gray-500">{adminData.email}</span></div>
                  <div className="p-2"><button onClick={logout} className="w-full flex items-center px-3 py-2 text-sm text-left text-gray-700 hover:bg-red-50 hover:text-red-600 rounded"><FaSignOutAlt className="mr-2" />Выйти</button></div>
                </div>
              </div>
            </div>
          </div>
          {/* Mid-screen nav */} 
          <div className="hidden md:flex lg:hidden items-center">
            <Link href="/admin-profile" className={`flex items-center justify-center mr-2 p-2 hover:bg-gray-100 rounded-lg ${pathname === '/admin-profile' ? 'bg-gray-100' : ''}`} aria-label="Профиль администратора" prefetch={false}><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><FaUser className="h-4 w-4 text-blue-500" /></div></Link>
            <Link href="/dashboard" className={`flex items-center justify-center mr-2 p-2 hover:bg-gray-100 rounded-lg ${pathname === '/dashboard' ? 'bg-gray-100' : ''}`} aria-label="Панель управления" prefetch={false}><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><FaTachometerAlt className="h-4 w-4 text-blue-500" /></div></Link>
            <button onClick={logout} className="flex items-center justify-center p-2 hover:bg-red-50 rounded-lg" aria-label="Выйти"><div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"><FaSignOutAlt className="h-4 w-4 text-red-500" /></div></button>
          </div>
        </div>
      </header>
    );
  }
  
  // 4. Неавторизованное состояние (по умолчанию)
  return (
    <header className={`fixed top-0 left-0 right-0 z-30 header-wrapper ${
        isScrolled ? "bg-white/95 shadow-lg py-3" : "bg-white/90 py-4"
      }`}>
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-nowrap gap-4">
        <Link href="/admin-login" className="flex items-center flex-shrink-0">
          <Logo />
          <span className="ml-2 text-[var(--primary)] font-semibold text-sm hidden sm:inline">Админ-панель</span>
        </Link>
        <Link href="/admin-login" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 min-w-[100px] min-h-[44px] text-sm sm:text-base flex items-center justify-center">
          Войти
        </Link>
      </div>
    </header>
  );

});

AdminHeader.displayName = 'AdminHeader';
export default AdminHeader;