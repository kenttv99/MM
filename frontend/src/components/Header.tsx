// frontend/src/components/Header.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./Logo";
import Login from "./Login";
import Registration from "./Registration";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import AuthModal from "./common/AuthModal";
import { NavItem } from "@/types/index";
import Notifications from "./Notifications";

const AvatarDisplay = ({ avatarUrl, fio, email }: { avatarUrl?: string; fio?: string; email: string }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const sizeClasses = "w-10 h-10 min-w-[40px] min-h-[40px]";
  
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
  const { isAuth, userData, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const lastScrollY = useRef<number>(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [isAuth, userData, isMobileMenuOpen]);

  useEffect(() => {
    let isScrolling = false;

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        
        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }

        scrollTimeout.current = setTimeout(() => {
          const currentScrollY = window.scrollY;
          // Only update state if scroll position has changed significantly (more than 20px)
          if (Math.abs(currentScrollY - lastScrollY.current) > 20) {
            setIsScrolled(currentScrollY > 20);
            lastScrollY.current = currentScrollY;
          }
          isScrolling = false;
        }, 100); // Throttle to max once every 100ms
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

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

  const toggleToLogin = useCallback(() => {
    setIsRegisterMode(false);
  }, []);

  const toggleToRegister = useCallback(() => {
    setIsRegisterMode(true);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setIsMobileMenuOpen(false);
  }, [logout]);

  const guestNavItems: NavItem[] = [
    { label: "Регистрация", onClick: openRegistration },
    { label: "Войти", onClick: openLogin },
  ];
  const authNavItemsMobile: NavItem[] = [
    { href: "/profile", label: "Профиль" },
    { href: "/partner", label: "Стать партнером" },
    { label: "Выход", onClick: handleLogout },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-4">
        <Link href="/" className="transition-transform duration-300 hover:scale-105 z-40 shrink-0">
          <Logo />
        </Link>

        <div className="md:hidden flex items-center gap-2">
          <Notifications />
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

        <div className="hidden md:flex items-center gap-4 flex-wrap">
          <Notifications />
          {isAuth && userData ? (
            <>
              <Link
                href="/partner"
                className="text-orange-500 hover:text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 text-sm sm:text-base min-w-[100px] text-center"
              >
                Стать партнером
              </Link>
              <Link href="/profile" className="text-orange-500 hover:text-orange-600">
                <AvatarDisplay
                  avatarUrl={userData?.avatar_url}
                  fio={userData?.fio}
                  email={userData?.email || ""}
                />
              </Link>
              <button
                onClick={handleLogout}
                className="text-orange-500 hover:text-orange-600 p-2 min-w-[44px] min-h-[44px]"
                title="Выход"
              >
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
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

      {isMobileMenuOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.3 }}
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
              <motion.div 
                key={index} 
                className="w-full text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                style={{ opacity: 0 }}
              >
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
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                )}
              </motion.div>
            ))}
          </nav>
          {isAuth && userData && (
            <div className="p-6 border-t border-gray-200 bg-white flex items-center justify-center gap-4">
              <AvatarDisplay
                avatarUrl={userData?.avatar_url}
                fio={userData?.fio}
                email={userData?.email || ""}
              />
              <span className="text-gray-600 text-sm truncate max-w-[150px]">
                {userData?.fio || userData?.email}
              </span>
            </div>
          )}
        </motion.div>
      )}

      {isModalOpen && (
        <AuthModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          title={isRegisterMode ? "Регистрация" : "Вход"}
        >
          {isRegisterMode ? (
            <Registration isOpen={isModalOpen} onClose={handleModalClose} toggleMode={toggleToLogin} />
          ) : (
            <Login isOpen={isModalOpen} onClose={handleModalClose} toggleMode={toggleToRegister} />
          )}
        </AuthModal>
      )}
    </header>
  );
};

export default Header;