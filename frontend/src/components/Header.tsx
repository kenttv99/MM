// frontend/src/components/Header.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./Logo";
import Login from "./Login";
import Registration from "./Registration";
import { useAuth } from "@/contexts/AuthContext";
import { useLoadingStage } from "@/contexts/loading";
import Image from "next/image";
import AuthModal from "./common/AuthModal";
import { NavItem } from "@/types/index";
import { useRouter } from "next/navigation";
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
const logInfo = (message: string, data?: unknown) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
    console.log(`Header: ${message}`, data);
  }
};

const logError = (message: string, data?: unknown) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
    console.error(`Header: ⛔ ${message}`, data);
  }
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
  const [key, setKey] = useState(0);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(avatarUrl);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const avatarLoadedRef = useRef(false);
  const lastPreloadedUrlRef = useRef<string | null>(null);

  // Effect to handle initial load and localStorage check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // First, check if we have a direct avatarUrl prop
    if (avatarUrl) {
      console.log("AvatarDisplay: Using avatarUrl prop", avatarUrl);
      setCurrentAvatarUrl(avatarUrl);
      
      // Cache the avatar URL in localStorage
      localStorage.setItem('cached_avatar_url', avatarUrl);
      
      // Preload the avatar
      // eslint-disable-next-line react-hooks/exhaustive-deps
      preloadAvatar(avatarUrl);
      return;
    }
    
    // If no avatarUrl prop, check localStorage
    if (isInitialLoad) {
      const cachedAvatarUrl = localStorage.getItem('cached_avatar_url');
      const cachedAvatarTimestamp = localStorage.getItem('avatar_cache_buster');
      
      console.log("AvatarDisplay: Initial load check", { 
        cachedAvatarUrl, 
        cachedAvatarTimestamp,
        avatarUrl 
      });
      
      if (cachedAvatarUrl) {
        console.log("AvatarDisplay: Using cached avatar URL from localStorage");
        setCurrentAvatarUrl(cachedAvatarUrl);
        
        // Preload the cached avatar
        // eslint-disable-next-line react-hooks/exhaustive-deps
        preloadAvatar(cachedAvatarUrl, cachedAvatarTimestamp);
      }
      
      setIsInitialLoad(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrl, isInitialLoad]);

  // Helper function to preload avatar
  const preloadAvatar = useCallback((url: string, timestamp?: string | null) => {
    if (!url || url.startsWith('data:') || url === lastPreloadedUrlRef.current) return;
    
    lastPreloadedUrlRef.current = url;
    
    // Clear any existing preload timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    
    // Use the provided timestamp or get from localStorage or generate new one
    const cacheBuster = timestamp || 
      (typeof window !== 'undefined' ? localStorage.getItem('avatar_cache_buster') : null) || 
      'stable';
    
    console.log("AvatarDisplay: Preloading avatar", { url, cacheBuster });
    
    // Delay preload slightly to avoid race conditions
    preloadTimeoutRef.current = setTimeout(() => {
      const testImg = document.createElement('img');
      testImg.onload = () => {
        console.log('AvatarDisplay: Avatar preloaded successfully:', url);
        avatarLoadedRef.current = true;
        setForceUpdate(prev => prev + 1);
      };
      testImg.onerror = () => {
        console.error('AvatarDisplay: Failed to preload avatar:', url);
        setImgError(true);
      };
      
      testImg.src = `${url}${url.includes('?') ? '&' : '?'}t=${cacheBuster}`;
    }, 50);
  }, []);

  // Effect to listen for avatar update events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleAvatarUpdate = (event: CustomEvent) => {
      console.log("AvatarDisplay: Received avatar update event", event.detail);
      
      // Force a re-render when avatar is updated
      setKey(prev => prev + 1);
      setForceUpdate(prev => prev + 1);
      
      // If we have a new avatar URL, update the current avatar URL state
      if (event.detail && event.detail.newAvatarUrl) {
        const newUrl = event.detail.newAvatarUrl;
        const timestamp = event.detail.timestamp || Date.now();
        
        console.log("AvatarDisplay: Updating to new avatar", { newUrl, timestamp });
        
        // Update the current avatar URL state
        setCurrentAvatarUrl(newUrl);
        
        // Cache the new avatar URL in localStorage
        localStorage.setItem('cached_avatar_url', newUrl);
        localStorage.setItem('avatar_cache_buster', timestamp.toString());
        
        // Preload the new avatar
        // eslint-disable-next-line react-hooks/exhaustive-deps
        preloadAvatar(newUrl, timestamp.toString());
      }
    };
    
    // Add event listener for avatar updates
    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    };
  }, [preloadAvatar]);

  // Effect to update state when avatarUrl prop changes
  useEffect(() => {
    if (avatarUrl !== currentAvatarUrl) {
      console.log("AvatarDisplay: Prop avatarUrl changed", avatarUrl);
      setCurrentAvatarUrl(avatarUrl);
      setImgError(false);
      if (avatarUrl) {
        const timestamp = typeof window !== 'undefined' ? localStorage.getItem('avatar_cache_buster') : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
        preloadAvatar(avatarUrl, timestamp);
      }
    }
  }, [avatarUrl, currentAvatarUrl, preloadAvatar]);

  const sizeClasses = "w-10 h-10 min-w-[40px] min-h-[40px]";
  
  // Check localStorage for avatar cache buster if available
  const storageAvatarCacheBuster = typeof window !== 'undefined' ? 
    localStorage.getItem('avatar_cache_buster') : null;
  
  // Determine the src with cache busting
  const avatarSrc = currentAvatarUrl 
    ? `${currentAvatarUrl}${currentAvatarUrl.includes('?') ? '&' : '?'}t=${storageAvatarCacheBuster || 'stable'}`
    : '';
  
  // Check if avatar URL is a data URI
  const isDataUri = currentAvatarUrl && currentAvatarUrl.startsWith('data:');
  
  // Use a unique key for each render to force re-render
  const uniqueKey = `avatar-${key}-${forceUpdate}`;
  
  return currentAvatarUrl && !imgError ? (
    isDataUri ? (
      // Use Next.js Image for data URIs too, with unoptimized prop
      <Image
        key={`data-uri-${uniqueKey}`}
        src={currentAvatarUrl}
        alt="User Avatar"
        width={40}
        height={40}
        className={`${sizeClasses} rounded-full object-cover hover:opacity-90`}
        onError={() => {
          console.error("Ошибка загрузки data URI аватарки в Header");
          setImgError(true);
        }}
        unoptimized
      />
    ) : (
      // Use Next.js Image for normal URLs
      <Image
        key={`url-${uniqueKey}`}
        src={avatarSrc}
        alt="User Avatar"
        width={40}
        height={40}
        className={`${sizeClasses} rounded-full object-cover hover:opacity-90`}
        onError={() => {
          console.error("Ошибка загрузки изображения аватарки в Header:", currentAvatarUrl);
          setImgError(true);
        }}
        priority
        unoptimized
      />
    )
  ) : (
    <div
      key={`fallback-${uniqueKey}`}
      className={`${sizeClasses} bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-xl font-bold hover:bg-orange-200`}
    >
      {(fio || email).charAt(0).toUpperCase()}
    </div>
  );
};

const Header: React.FC = () => {
  const { isAuth, userData, logout, isAuthChecked } = useAuth();
  const { currentStage } = useLoadingStage();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const lastScrollY = useRef<number>(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Заменяем useEffect на useLayoutEffect для управления классом и padding
  useLayoutEffect(() => {
    const originalPaddingRight = document.body.style.paddingRight; // Сохраняем исходный padding
    if (isMobileMenuOpen) {
      // Вычисляем ширину скроллбара
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      // Устанавливаем padding
      document.body.style.paddingRight = `${scrollBarWidth}px`;
      // Добавляем класс для блокировки overflow
      document.body.classList.add('body-scroll-locked');
    } else {
      // Удаляем класс
      document.body.classList.remove('body-scroll-locked');
      // Восстанавливаем исходный padding
      document.body.style.paddingRight = originalPaddingRight;
    }

    // Функция очистки
    return () => {
      document.body.classList.remove('body-scroll-locked');
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isMobileMenuOpen]);

  // Отслеживание монтирования и первичной загрузки
  useEffect(() => {
    if (isInitialMount.current && isAuthChecked) {
      isInitialMount.current = false;
      logInfo('Header component mounted post-auth check', { 
        isAuthChecked,
        currentStage,
        isAuth
      });
      // Предзагрузка аватара, если пользователь авторизован
      if (isAuth && userData?.avatar_url) {
        console.log('Header: Предзагрузка аватарки:', userData.avatar_url);
        const img = document.createElement('img');
        const timestamp = localStorage.getItem('avatar_cache_buster');
        img.onload = () => console.log('Header: Аватарка успешно предзагружена:', userData.avatar_url);
        img.onerror = () => console.error('Header: Ошибка предзагрузки аватарки:', userData.avatar_url);
        img.src = `${userData.avatar_url}${userData.avatar_url.includes('?') ? '&' : '?'}t=${timestamp || 'stable'}`;
      }
    }
  }, [isAuthChecked, isAuth, currentStage, userData]);

  // Эффект для отслеживания прокрутки
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
    setIsRegisterModalOpen(false);
    setIsLoginModalOpen(true);
  }, []);

  const openRegistration = useCallback(() => {
    setIsRegisterModalOpen(true);
    setIsLoginModalOpen(false);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(false);
  }, []);

  const toggleToLogin = useCallback(() => {
    setIsRegisterModalOpen(false);
    setIsLoginModalOpen(true);
  }, []);

  const toggleToRegister = useCallback(() => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(true);
  }, []);

  const handleLogout = useCallback(async () => {
    logInfo('Header: Logout clicked');
    try {
      // Set logging out state and hide header immediately
      setIsMobileMenuOpen(false);
      setIsLoginModalOpen(false);
      setIsRegisterModalOpen(false);
      
      // Clear any existing timeouts
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      // Check if we're on a profile page before logout
      const isOnProfilePage = typeof window !== 'undefined' && window.location.pathname.startsWith('/profile');
      
      // Set a safety timeout to ensure redirection happens even if the event doesn't fire
      if (isOnProfilePage) {
        transitionTimeoutRef.current = setTimeout(() => {
          logInfo('Header: Safety timeout triggered for profile page redirect');
          // If we have Next.js router, use it, otherwise use window.location
          if (router) {
            router.push('/');
          } else {
            window.location.href = '/';
          }
          // Also remove the admin route flag if it was incorrectly set
          if (typeof window !== 'undefined' && localStorage.getItem('is_admin_route') === 'true') {
            localStorage.removeItem('is_admin_route');
          }
        }, 1000); // Redirect after 1 second as a fallback
      }
      
      // Add listeners for logout events
      const handleLogoutComplete = () => {
        logInfo('Header: Logout complete event received');
        
        // Immediately show the unauthenticated header without delay
        logInfo('Header: Showing unauthenticated header after logout');
        
        // Redirect to home page if user was on profile page
        if (isOnProfilePage) {
          logInfo('Header: Redirecting to home page after logout from profile');
          // Use router if available, otherwise use window.location
          if (router) {
            setTimeout(() => {
              router.push('/');
            }, 50);
          } else {
            // Use immediate redirection with a slight delay to ensure React state updates have completed
            setTimeout(() => {
              window.location.href = '/';
            }, 50);
          }
          
          // Also remove the admin route flag if it was incorrectly set
          if (typeof window !== 'undefined' && localStorage.getItem('is_admin_route') === 'true') {
            localStorage.removeItem('is_admin_route');
          }
        }
        
        // Clean up event listeners
        window.removeEventListener('auth-logout-complete', handleLogoutComplete);
        window.removeEventListener('admin-logout-complete', handleLogoutComplete);
      };

      window.addEventListener('auth-logout-complete', handleLogoutComplete);
      window.addEventListener('admin-logout-complete', handleLogoutComplete);
      
      // Perform logout
      await logout();
      logInfo('Header: Logout initiated, showing skeleton');
      
    } catch (error) {
      logError('Header: Logout failed', error);
      
      // Clear any pending timeouts on error
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    }
  }, [logout, router]);

  // Cleanup event listeners
  useEffect(() => {
    const cleanup = () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };

    return cleanup;
  }, []);

  const guestNavItems: NavItem[] = [
    { label: "Регистрация", onClick: openRegistration },
    { label: "Войти", onClick: openLogin },
  ];
  const authNavItemsMobile: NavItem[] = [
    { label: "Мероприятия", href: "/events" },
    { href: "/profile", label: "Профиль • Билеты" },
    { label: "Выход", onClick: handleLogout },
  ];

  // Определяем isLoading ТОЛЬКО на основе isAuthChecked
  const isLoading = !isAuthChecked;

  // Лог перед рендером скелетона (оставляем currentStage для отладки)
  if (isLoading) {
    logInfo("RENDERING SKELETON", { isLoading, isAuthChecked, currentStage });
    return <HeaderSkeleton />;
  }

  // Основной рендер хедера
  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${isScrolled ? "bg-white/95 shadow-lg py-2 sm:py-3" : "bg-white/90 py-3 sm:py-4"}`}
      >
        <div className="w-full flex items-center">
          <div className="w-full flex items-center justify-between px-8 sm:px-10">
            <Link href="/" className="transition-transform duration-300 hover:scale-105 z-40">
              <Logo />
            </Link>

            <div className="hidden md:flex items-center gap-3">
              {isAuth && <Notifications />}
              {isAuth && userData ? (
                <>
                  <Link href="/profile" className="text-orange-500 hover:text-orange-600">
                    <AvatarDisplay
                      avatarUrl={userData.avatar_url}
                      fio={userData.fio}
                      email={userData.email || ""}
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

            {/* Кнопка-бургер для мобильных */}
            <div className="md:hidden flex items-center">
              <button
                onClick={toggleMobileMenu}
                className="text-gray-700 hover:text-orange-500 p-2 min-w-[44px] min-h-[44px]"
                aria-label="Открыть меню"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
            </div>
            
          </div>
        </div>
      </header>

      {/* Мобильное меню */}
      {isMobileMenuOpen && (
         <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-white/95 z-50 md:hidden flex flex-col"
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
                avatarUrl={userData.avatar_url}
                fio={userData.fio}
                email={userData.email || ""}
              />
              <span className="text-gray-600 text-sm truncate max-w-[150px]">
                {userData.fio || userData.email}
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Модальные окна */}
      {isLoginModalOpen && (
        <AuthModal
          isOpen={isLoginModalOpen}
          onClose={handleModalClose}
          title="Вход"
        >
          <Login isOpen={isLoginModalOpen} onClose={handleModalClose} toggleMode={toggleToRegister} />
        </AuthModal>
      )}

      {isRegisterModalOpen && (
        <AuthModal
          isOpen={isRegisterModalOpen}
          onClose={handleModalClose}
          title="Регистрация"
        >
          <Registration isOpen={isRegisterModalOpen} onClose={handleModalClose} toggleMode={toggleToLogin} />
        </AuthModal>
      )}
    </>
  );
};

export default Header;