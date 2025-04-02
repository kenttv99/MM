"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";
import Login from "./Login";
import Registration from "./Registration";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import AuthModal from "./common/AuthModal";
import { NavItem } from "@/types/index";

const AvatarDisplay = ({ avatarUrl, fio, email }: { avatarUrl?: string; fio?: string; email: string }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => setImgError(false), [avatarUrl]);

  const sizeClasses = "w-10 h-10 sm:w-8 sm:h-8 min-w-[40px] min-h-[40px]";

  return avatarUrl && !imgError ? (
    <Image
      src={avatarUrl}
      alt="User Avatar"
      width={40}
      height={40}
      className={`${sizeClasses} rounded-full object-cover hover:opacity-90`}
      onError={() => setImgError(true)}
    />
  ) : (
    <div
      className={`${sizeClasses} bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-xl font-bold hover:bg-orange-200`}
    >
      {(fio || email).charAt(0).toUpperCase()}
    </div>
  );
};

const Header: React.FC = () => {
  const { isAuth, userData, logout, checkAuth } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleAuthChange = () => checkAuth();
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [checkAuth]);

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

  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen((prev) => !prev), []);
  const toggleNotifications = useCallback(() => setIsNotificationsOpen((prev) => !prev), []);
  const openLogin = useCallback(() => {
    setIsRegisterMode(false);
    setIsModalOpen(true);
  }, []);
  const openRegistration = useCallback(() => {
    setIsRegisterMode(true);
    setIsModalOpen(true);
  }, []);
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setIsRegisterMode(false);
  }, []);
  const toggleToLogin = useCallback(() => setIsRegisterMode(false), []); // Добавлено
  const toggleToRegister = useCallback(() => setIsRegisterMode(true), []); // Добавлено
  const handleLogout = useCallback(() => {
    logout();
    setIsNotificationsOpen(false);
    setIsMobileMenuOpen(false);
  }, [logout]);

  const guestNavItems: NavItem[] = [
    { label: "Регистрация", onClick: openRegistration },
    { label: "Войти", onClick: openLogin },
  ];
  const authNavItemsMobile: NavItem[] = [
    { href: "/profile", label: "Профиль" },
    { href: "/notifications", label: "Уведомления" },
    { href: "/partner", label: "Стать партнером" },
    { label: "Выход", onClick: handleLogout },
  ];

  const menuVariants = {
    closed: { x: "100%", opacity: 0, transition: { duration: 0.3 } },
    open: { x: 0, opacity: 1, transition: { duration: 0.3, staggerChildren: 0.1 } },
  };
  const menuItemVariants = { closed: { opacity: 0, y: 20 }, open: { opacity: 1, y: 0 } };
  const notificationVariants = { hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 } };

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
          isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="transition-transform duration-300 hover:scale-105 z-40 shrink-0">
            <Logo />
          </Link>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            {isAuth && userData && (
              <Link href="/profile" className="z-40">
                <AvatarDisplay avatarUrl={userData.avatar_url} fio={userData.fio} email={userData.email} />
              </Link>
            )}
            <button
              onClick={toggleMobileMenu}
              className="text-gray-700 hover:text-orange-500 p-2 min-w-[44px] min-h-[44px] z-40"
              aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            >
              <motion.svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <motion.path
                  d="M4 6h16"
                  animate={isMobileMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.3 }}
                />
                <motion.path
                  d="M4 12h16"
                  animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
                <motion.path
                  d="M4 18h16"
                  animate={isMobileMenuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.svg>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4 flex-wrap">
            {isAuth && userData ? (
              <>
                <Link
                  href="/partner"
                  className="text-orange-500 hover:text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 text-sm sm:text-base min-w-[100px] text-center"
                >
                  Стать партнером
                </Link>
                <div className="relative">
                  <motion.button
                    ref={notificationButtonRef}
                    onClick={toggleNotifications}
                    className="text-orange-500 hover:text-orange-600 p-2 min-w-[44px] min-h-[44px]"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="w-10 h-10 sm:w-8 sm:h-8 bg-orange-100 rounded-full flex items-center justify-center hover:bg-orange-200">
                      <svg className="h-6 w-6 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  </motion.button>
                  <AnimatePresence>
                    {isNotificationsOpen && (
                      <motion.div
                        ref={notificationRef}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={notificationVariants}
                        className="absolute right-0 top-full mt-2 w-64 max-w-[90vw] bg-white rounded-md shadow-lg py-4 border border-gray-200 z-20"
                      >
                        <div className="text-center text-gray-500 text-sm px-2">Нет уведомлений</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Link href="/profile" className="text-orange-500 hover:text-orange-600">
                  <AvatarDisplay avatarUrl={userData.avatar_url} fio={userData.fio} email={userData.email} />
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-orange-500 hover:text-orange-600 p-2 min-w-[44px] min-h-[44px]"
                  title="Выход"
                >
                  <svg className="h-6 w-6 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5 4a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 110 2H5a3 3 0 01-3-3V5a3 3 0 013-3h6a1 1 0 010 2H5zM14.293 6.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L15.586 11H9a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openRegistration}
                  className="px-4 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 text-sm sm:text-base min-w-[100px]"
                >
                  Регистрация
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openLogin}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm sm:text-base min-w-[100px]"
                >
                  Войти
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed inset-0 bg-white/95 z-50 md:hidden flex flex-col overflow-y-auto"
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
              <Link href="/" className="hover:scale-105 transition-transform duration-300" onClick={toggleMobileMenu}>
                <Logo />
              </Link>
              <button
                onClick={toggleMobileMenu}
                className="text-gray-700 hover:text-orange-500 p-2 min-w-[44px] min-h-[44px]"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-grow flex flex-col items-center justify-center space-y-8 p-6">
              {(isAuth ? authNavItemsMobile : guestNavItems).map((item, index) => (
                <motion.div key={index} variants={menuItemVariants} className="w-full text-center">
                  {item.onClick ? (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        item.onClick?.();
                      }}
                      className="w-full py-3 text-gray-800 hover:text-orange-500 transition-colors duration-200 text-xl font-medium min-h-[48px]"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      href={item.href || "#"}
                      className="block w-full py-3 text-gray-800 hover:text-orange-500 transition-colors duration-200 text-xl font-medium min-h-[48px]"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </motion.div>
              ))}
            </nav>
            {isAuth && userData && (
              <div className="p-6 border-t border-gray-200 bg-white flex items-center justify-center gap-4">
                <AvatarDisplay avatarUrl={userData.avatar_url} fio={userData.fio} email={userData.email} />
                <span className="text-gray-600 text-sm truncate max-w-[150px]">
                  {userData.fio || userData.email}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <AuthModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            title={isRegisterMode ? "Регистрация" : "Вход"}
          >
            {isRegisterMode ? (
              <Registration
                isOpen={isModalOpen}
                onClose={handleModalClose}
                toggleMode={toggleToLogin} // Исправлено
              />
            ) : (
              <Login
                isOpen={isModalOpen}
                onClose={handleModalClose}
                toggleMode={toggleToRegister} // Исправлено
              />
            )}
          </AuthModal>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;