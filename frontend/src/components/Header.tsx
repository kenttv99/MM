// frontend/src/components/Header.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";
import Registration from "./Registration";
import Login from "./Login";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href?: string;
  label: string;
  onClick?: () => void;
}

const Header: React.FC = () => {
  const { isAuth, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotificationsOpen &&
        notificationRef.current &&
        notificationButtonRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationsOpen]);

  const startNotificationCloseTimer = () => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => setIsNotificationsOpen(false), 1000);
  };

  const stopNotificationCloseTimer = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
  };

  const handleLogout = () => {
    logout();
    setIsNotificationsOpen(false); // Закрываем уведомления
    setIsMobileMenuOpen(false); // Закрываем мобильное меню
    router.push("/");
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const toggleNotifications = () => setIsNotificationsOpen((prev) => !prev);

  const guestNavItems: NavItem[] = [
    { label: "Регистрация", onClick: () => setIsRegistrationOpen(true) },
    { label: "Войти", onClick: () => setIsLoginOpen(true) },
  ];

  const authNavItemsMobile: NavItem[] = [
    { href: "/profile", label: "Профиль" },
    { href: "/notifications", label: "Уведомления" },
    { href: "/partner", label: "Стать партнером" },
    { label: "Выход", onClick: handleLogout },
  ];

  const menuVariants = {
    closed: { opacity: 0, y: -20 },
    open: { opacity: 1, y: 0 },
  };

  const notificationVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
  };

  useEffect(() => {
    const handleAuthChange = () => {
      setIsLoginOpen(false);
      setIsRegistrationOpen(false);
    };
    
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 backdrop-blur-sm shadow-lg py-3" : "bg-white/90 py-4"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="transition-transform duration-300 hover:scale-105">
          <Logo />
        </Link>

        {/* Мобильное меню */}
        <div className="flex items-center md:hidden">
          {isAuth && (
            <Link href="/profile" className="mr-4 text-orange-500 hover:text-orange-600">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          )}
          <button onClick={toggleMobileMenu} className="text-gray-700 hover:text-orange-500">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button 
                  onClick={toggleMobileMenu}
                  className="absolute top-4 right-4 text-gray-500 hover:text-orange-500"
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <motion.ul
                  className="flex flex-col items-center space-y-6 text-xl"
                  variants={menuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                >
                  {(isAuth ? authNavItemsMobile : guestNavItems).map((item, index) => (
                    <motion.li key={index} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      {item.onClick ? (
                        <button onClick={item.onClick} className="text-gray-800 hover:text-orange-500">
                          {item.label}
                        </button>
                      ) : (
                        <Link 
                          href={item.href || "#"} 
                          className="text-gray-800 hover:text-orange-500"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      )}
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Десктопная навигация */}
        <div className="hidden md:flex items-center space-x-4">
          {isAuth ? (
            <>
              <Link href="/partner" className="text-orange-500 hover:text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50">
                Стать партнером
              </Link>
              <div className="relative">
                <button 
                  ref={notificationButtonRef}
                  onClick={toggleNotifications} 
                  className="text-orange-500 hover:text-orange-600"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center hover:bg-orange-200">
                    <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                </button>
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div
                      ref={notificationRef}
                      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-md shadow-lg py-4 border border-gray-200 z-20"
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      variants={notificationVariants}
                      onMouseEnter={stopNotificationCloseTimer}
                      onMouseLeave={startNotificationCloseTimer}
                    >
                      <div className="text-center text-gray-500 text-sm">Нет уведомлений</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <Link href="/profile" className="text-orange-500 hover:text-orange-600">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center hover:bg-orange-200">
                  <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
              
              <button 
                onClick={handleLogout} 
                className="text-orange-500 hover:text-orange-600 ml-2"
                title="Выход"
              >
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 110 2H5a3 3 0 01-3-3V5a3 3 0 013-3h6a1 1 0 010 2H5zM14.293 6.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L15.586 11H9a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsRegistrationOpen(true)}
                className="px-4 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50"
              >
                Регистрация
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsLoginOpen(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Войти
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <Registration 
        isOpen={isRegistrationOpen} 
        onClose={() => setIsRegistrationOpen(false)} 
        setLoginOpen={setIsLoginOpen} 
      />
      <Login 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
      />
    </header>
  );
};

export default Header;