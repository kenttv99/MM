// frontend/src/components/Header.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./Logo";
import Login from "./Login";
import Registration from "./Registration";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import Image from "next/image";
import AuthModal from "./common/AuthModal";
import { NavItem } from "@/types/index";
import Notifications from "./Notifications";

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
const logDebug = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
    console.log(`Header: ${message}`, data);
  }
};

const logInfo = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
    console.log(`Header: ${message}`, data);
  }
};

const logWarn = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
    console.log(`Header: ⚠️ ${message}`, data);
  }
};

const logError = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
    console.error(`Header: ⛔ ${message}`, data);
  }
};

// Глобальное состояние для отслеживания видимости хедера
// Это предотвратит мигание при повторных монтированиях компонента
const globalHeaderState = {
  hasShownHeader: false,
  isInitialized: false,
  lastAuthState: null as boolean | null,
  lastAuthChecked: false,
  lastLoadingStage: null as LoadingStage | null,
  mountCount: 0,
  initialRender: true,
  isLoggingOut: false
};

// Хук для управления состоянием хедера
const useHeaderState = () => {
  const { isAuth, userData, logout, isAuthChecked } = useAuth();
  const { currentStage } = useLoading();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [forceShowHeader, setForceShowHeader] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const mountId = useRef(Math.random().toString(36).substring(7));
  const isAuthRef = useRef(isAuth);
  const userDataRef = useRef(userData);
  const currentStageRef = useRef(currentStage);
  const [initialRenderComplete, setInitialRenderComplete] = useState(false);

  // Track first mount and update global mount count
  useEffect(() => {
    globalHeaderState.mountCount++;
    
    // Mark initial render as complete after a small delay
    const timer = setTimeout(() => {
      setInitialRenderComplete(true);
      globalHeaderState.initialRender = false;
    }, 50);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Update refs when auth state or loading stage changes
  useEffect(() => {
    const hasAuthChanged = isAuthRef.current !== isAuth || userDataRef.current !== userData;
    const hasStageChanged = currentStageRef.current !== currentStage;

    if (hasAuthChanged || hasStageChanged) {
      console.log('Header: State changed', { 
        prevAuth: isAuthRef.current, 
        newAuth: isAuth,
        prevUserData: userDataRef.current,
        newUserData: userData,
        prevStage: currentStageRef.current,
        newStage: currentStage,
        isLoggingOut: isLoggingOut || globalHeaderState.isLoggingOut
      });

      isAuthRef.current = isAuth;
      userDataRef.current = userData;
      currentStageRef.current = currentStage;

      // Force header update when auth state changes or when moving past authentication stage
      if (hasAuthChanged || (hasStageChanged && currentStage !== LoadingStage.AUTHENTICATION)) {
        setForceShowHeader(true);
        
        // Update global header state
        globalHeaderState.lastAuthState = isAuth;
        globalHeaderState.lastAuthChecked = isAuthChecked;
        globalHeaderState.lastLoadingStage = currentStage;
        globalHeaderState.hasShownHeader = true;
        
        // Reset logout state if auth state has changed
        if (hasAuthChanged && !isAuth && (isLoggingOut || globalHeaderState.isLoggingOut)) {
          setIsLoggingOut(false);
          globalHeaderState.isLoggingOut = false;
        }
      }
    }
  }, [isAuth, userData, currentStage, isAuthChecked, isLoggingOut]);

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const handleAuthChange = (event: CustomEvent) => {
      console.log('Header: Received auth state change event', event.detail);
      setForceShowHeader(true);
    };

    window.addEventListener('authStateChanged', handleAuthChange as EventListener);
    return () => window.removeEventListener('authStateChanged', handleAuthChange as EventListener);
  }, []);

  // Determine if skeleton should be shown
  const shouldShowSkeleton = useMemo(() => {
    // Always show skeleton on initial render
    if (!initialRenderComplete || globalHeaderState.initialRender) {
      return true;
    }
    
    // Show skeleton during logout process
    if (isLoggingOut || globalHeaderState.isLoggingOut) {
      return true;
    }
    
    // Otherwise, show skeleton during authentication checks
    const isInitialAuthCheck = !isAuthChecked && currentStage === LoadingStage.AUTHENTICATION;
    const isExplicitAuthStage = currentStage === LoadingStage.AUTHENTICATION && !forceShowHeader;
    
    return isInitialAuthCheck || isExplicitAuthStage;
  }, [isAuthChecked, currentStage, forceShowHeader, initialRenderComplete, isLoggingOut]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
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
  }, []);

  const toggleToLogin = useCallback(() => {
    setIsRegisterMode(false);
  }, []);

  const toggleToRegister = useCallback(() => {
    setIsRegisterMode(true);
  }, []);

  const handleLogout = useCallback(async () => {
    console.log('Header: Logout clicked');
    try {
      // Set logging out state to show skeleton during transition
      setIsLoggingOut(true);
      globalHeaderState.isLoggingOut = true;
      
      // Close mobile menu and modal
      setIsMobileMenuOpen(false);
      setIsModalOpen(false);
      
      // Perform logout
      await logout();
      console.log('Header: Logout successful');
      
      // Force header update
      setForceShowHeader(true);
      
      // Keep showing skeleton until we detect auth state change
      // Only reset logout state if auth is already false (sync logout)
      if (!isAuth) {
        setTimeout(() => {
          setIsLoggingOut(false);
          globalHeaderState.isLoggingOut = false;
        }, 300);
      }
      // For async logout, the auth state effect will handle resetting the logout state
    } catch (error) {
      console.error('Header: Logout failed', error);
      setIsLoggingOut(false);
      globalHeaderState.isLoggingOut = false;
    }
  }, [logout, isAuth]);

  // Add explicit effect to handle auth state changes after logout
  useEffect(() => {
    // Only trigger when auth changes from true to false and we're in logout state
    if (!isAuth && (isLoggingOut || globalHeaderState.isLoggingOut)) {
      console.log('Header: Auth state updated after logout');
      // Give time for the auth state to fully propagate
      setTimeout(() => {
        setIsLoggingOut(false);
        globalHeaderState.isLoggingOut = false;
        setForceShowHeader(true);
      }, 300);
    }
  }, [isAuth, isLoggingOut]);

  return {
    isAuth,
    userData,
    isScrolled,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isModalOpen,
    isRegisterMode,
    shouldShowSkeleton,
    toggleMobileMenu,
    openLogin,
    openRegistration,
    handleModalClose,
    toggleToLogin,
    toggleToRegister,
    handleLogout,
    mountId: mountId.current
  };
};

const HeaderSkeleton = () => (
  <div className="h-[64px] sm:h-[72px] fixed top-0 left-0 right-0 z-30 bg-white/90 flex items-center">
    <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
      <div className="w-[100px] h-[32px] bg-orange-100 rounded animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-orange-100 rounded-full animate-pulse" />
        <div className="w-8 h-8 bg-orange-100 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

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
  const {
    isAuth,
    userData,
    isScrolled,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isModalOpen,
    isRegisterMode,
    shouldShowSkeleton,
    toggleMobileMenu,
    openLogin,
    openRegistration,
    handleModalClose,
    toggleToLogin,
    toggleToRegister,
    handleLogout,
    mountId
  } = useHeaderState();

  const guestNavItems: NavItem[] = [
    { label: "Регистрация", onClick: openRegistration },
    { label: "Войти", onClick: openLogin },
  ];
  const authNavItemsMobile: NavItem[] = [
    { href: "/profile", label: "Профиль" },
    { label: "Выход", onClick: handleLogout },
  ];
  
  if (shouldShowSkeleton) {
    return <HeaderSkeleton />;
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"
      }`}
    >
      <div className="w-full flex items-center">
        <div className="w-full flex items-center justify-between px-8 sm:px-10">
          <Link href="/" className="transition-transform duration-300 hover:scale-105 z-40">
            <Logo />
          </Link>

          <div className="hidden md:flex items-center gap-3">
            <Notifications />
            {isAuth && userData ? (
              <>
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
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openRegistration}
                  className="px-4 py-1.5 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 text-sm sm:text-base min-w-[100px] min-h-[30px]"
                >
                  Регистрация
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openLogin}
                  className="px-4 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm sm:text-base min-w-[100px] min-h-[30px]"
                >
                  Войти
                </motion.button>
              </div>
            )}
          </div>
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

// Используем React.memo для предотвращения ненужных ререндеров
export default memo(Header);