// frontend/src/components/Header.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./Logo";
import Login from "./Login";
import Registration from "./Registration";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading, LoadingStage } from "@/contexts/LoadingContextLegacy";
import Image from "next/image";
import AuthModal from "./common/AuthModal";
import { NavItem } from "@/types/index";
import Notifications from "./Notifications";
import { useRouter } from "next/navigation";

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
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const avatarLoadedRef = useRef(false);

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
        preloadAvatar(cachedAvatarUrl, cachedAvatarTimestamp);
      }
      
      setIsInitialLoad(false);
    }
  }, [avatarUrl, isInitialLoad]);

  // Helper function to preload avatar
  const preloadAvatar = (url: string, timestamp?: string | null) => {
    if (!url || url.startsWith('data:')) return;
    
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
  };

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
        preloadAvatar(newUrl, timestamp.toString());
      }
    };
    
    // Add event listener for avatar updates
    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    };
  }, []);

  // Effect to handle userDataChanged events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleUserDataChange = (event: CustomEvent) => {
      const { userData, avatarRemoved } = event.detail;
      
      if (!userData) return;
      
      console.log("AvatarDisplay: Received userDataChanged event", { 
        hasAvatar: !!userData.avatar_url,
        avatarRemoved
      });
      
      // If avatar was removed, clear the current avatar
      if (avatarRemoved) {
        console.log("AvatarDisplay: Avatar removed, clearing display");
        setCurrentAvatarUrl(undefined);
        localStorage.removeItem('cached_avatar_url');
        setImgError(false);
        return;
      }
      
      // If we have a new avatar URL, update the current avatar URL state
      if (userData.avatar_url) {
        console.log("AvatarDisplay: New avatar detected in userData", userData.avatar_url);
        
        // Update the current avatar URL state
        setCurrentAvatarUrl(userData.avatar_url);
        
        // Cache the avatar URL in localStorage
        localStorage.setItem('cached_avatar_url', userData.avatar_url);
        
        // Get cache buster from localStorage or generate new one
        const timestamp = localStorage.getItem('avatar_cache_buster') || Date.now().toString();
        
        // Preload the new avatar
        preloadAvatar(userData.avatar_url, timestamp);
      }
    };
    
    // Add event listener for user data changes
    window.addEventListener('userDataChanged', handleUserDataChange as EventListener);
    
    return () => {
      window.removeEventListener('userDataChanged', handleUserDataChange as EventListener);
    };
  }, []);

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
      // Use plain img tag for data URIs
      <img
        key={`data-uri-${uniqueKey}`}
        src={currentAvatarUrl}
        alt="User Avatar"
        className={`${sizeClasses} rounded-full object-cover hover:opacity-90`}
        onError={() => {
          console.error("Ошибка загрузки data URI аватарки в Header");
          setImgError(true);
        }}
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
        onError={(e) => {
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
  const { isAuth, userData, logout, isLoading: authLoading, isAuthChecked, updateUserData } = useAuth();
  const { currentStage } = useLoading();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const lastScrollY = useRef<number>(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);
  const headerLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [forceShowHeader, setForceShowHeader] = useState(false);
  const loadingRef = useRef<boolean>(authLoading);
  const checkedRef = useRef<boolean>(isAuthChecked);
  const prevStageRef = useRef<LoadingStage | null>(null);
  const shouldShowSkeletonRef = useRef<boolean>(false);
  const hasShownHeaderRef = useRef<boolean>(false);
  const [, forceUpdate] = useState({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Единый эффект для управления отображением хедера
  useEffect(() => {
    // Определяем, нужно ли показывать хедер
    const shouldShowHeader = isAuthChecked || 
      currentStage === LoadingStage.STATIC_CONTENT || 
      currentStage === LoadingStage.DYNAMIC_CONTENT || 
      currentStage === LoadingStage.DATA_LOADING || 
      currentStage === LoadingStage.COMPLETED;

    // Если хедер уже был показан, не возвращаемся к скелетону
    if (hasShownHeaderRef.current) {
      setForceShowHeader(true);
      return;
    }

    // Если нужно показать хедер, обновляем состояние
    if (shouldShowHeader) {
      setForceShowHeader(true);
      hasShownHeaderRef.current = true;
      
      // Очищаем таймаут, если он был установлен
      if (headerLoadingTimeoutRef.current) {
        clearTimeout(headerLoadingTimeoutRef.current);
        headerLoadingTimeoutRef.current = null;
      }
      
      logInfo('Showing header based on auth check or loading stage', { 
        isAuthChecked, 
        currentStage,
        hasShownHeader: hasShownHeaderRef.current
      });
    } else if (authLoading) {
      // Если аутентификация загружается, устанавливаем таймаут для показа хедера
      if (headerLoadingTimeoutRef.current) {
        clearTimeout(headerLoadingTimeoutRef.current);
      }
      
      headerLoadingTimeoutRef.current = setTimeout(() => {
        setForceShowHeader(true);
        hasShownHeaderRef.current = true;
        logInfo('Showing header after timeout', { 
          authLoading, 
          isAuthChecked,
          currentStage
        });
      }, 200);
    }

    return () => {
      if (headerLoadingTimeoutRef.current) {
        clearTimeout(headerLoadingTimeoutRef.current);
      }
    };
  }, [authLoading, isAuthChecked, currentStage]);

  // Слушаем события изменения состояния аутентификации
  useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      logInfo('Received auth state change event', event.detail);
      
      // Обновляем ссылки на текущее состояние
      loadingRef.current = event.detail.isAuthenticated;
      checkedRef.current = true;
      
      // Если пользователь аутентифицирован, показываем хедер
      if (event.detail.isAuthenticated) {
        setForceShowHeader(true);
        hasShownHeaderRef.current = true;
        
        // Очищаем таймаут, если он был установлен
        if (headerLoadingTimeoutRef.current) {
          clearTimeout(headerLoadingTimeoutRef.current);
          headerLoadingTimeoutRef.current = null;
        }
        
        logInfo('Showing header due to authentication', { 
          isAuthenticated: event.detail.isAuthenticated,
          hasShownHeader: hasShownHeaderRef.current
        });
      }
    };

    window.addEventListener('authStateChanged', handleAuthStateChange as EventListener);
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange as EventListener);
    };
  }, []);

  // Эффект для отслеживания первого монтирования
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      logInfo('Header component mounted', { 
        authLoading, 
        isAuthChecked,
        currentStage
      });
      
      // Проверка данных пользователя и аватарки при монтировании
      if (userData) {
        console.log('Header: Проверка данных пользователя при монтировании:', {
          id: userData.id,
          email: userData.email,
          hasAvatar: !!userData.avatar_url,
          avatarUrl: userData.avatar_url
        });
        
        // Используем DOM API вместо конструктора Image()
        if (userData.avatar_url) {
          const testImg = document.createElement('img');
          testImg.onload = () => console.log('Header: Тест загрузки аватарки успешен:', userData.avatar_url);
          testImg.onerror = () => console.error('Header: Тест загрузки аватарки провален:', userData.avatar_url);
          testImg.src = userData.avatar_url;
        }
      }
    }
  }, [authLoading, isAuthChecked, currentStage, userData]);

  // Add event listeners for user data changes and avatar updates
  useEffect(() => {
    // Handle user data change events (particularly avatar updates)
    const handleUserDataChange = (event: CustomEvent) => {
      const { userData: updatedUserData, avatarRemoved } = event.detail;
      if (updatedUserData) {
        logInfo('Header: Received userDataChanged event, updating user data', {
          hasAvatar: !!updatedUserData.avatar_url,
          userId: updatedUserData.id,
          fio: updatedUserData.fio,
          avatarRemoved
        });
        
        // Cache the avatar URL in localStorage if available
        if (updatedUserData.avatar_url && typeof window !== 'undefined') {
          localStorage.setItem('cached_avatar_url', updatedUserData.avatar_url);
        }
        
        // Force immediate UI update
        const forceUIUpdate = () => {
          // Force update of user data in this component by using the Auth context
          if (updateUserData && typeof updateUserData === 'function') {
            // Create a fresh copy to ensure React detects the change
            const freshUserData = {...updatedUserData};
            updateUserData(freshUserData, false);
            
            // Also trigger a React state update to force re-render
            forceUpdate({});
            
            // Force a re-render of the entire header
            setForceShowHeader(prev => !prev);
            setTimeout(() => setForceShowHeader(prev => !prev), 0);
          }
        };
        
        // If avatar was removed, make sure to clear any cached versions
        if (avatarRemoved) {
          logInfo('Header: Avatar removed, clearing cache');
          
          // Clear cached avatar URL from localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cached_avatar_url');
          }
          
          // Force immediate UI update
          forceUIUpdate();
          
          // Force reload any avatar components
          const avatarElements = document.querySelectorAll('img[alt="User Avatar"]');
          avatarElements.forEach(img => {
            // Update src to empty to prevent showing
            (img as HTMLImageElement).src = '';
          });
        }
        // Force reload the avatar image to clear browser cache
        else if (updatedUserData.avatar_url) {
          logInfo('Header: New avatar detected, updating display');
          
          // Get cache buster from localStorage if available or generate new one
          const timestamp = typeof window !== 'undefined' ? 
            localStorage.getItem('avatar_cache_buster') || Date.now().toString() :
            Date.now().toString();
            
          // Store it for future use
          if (typeof window !== 'undefined') {
            localStorage.setItem('avatar_cache_buster', timestamp);
          }
            
          // Force immediate UI update
          forceUIUpdate();
          
          // Pre-load the new avatar with a slight delay to ensure DOM is ready
          setTimeout(() => {
            const cachedBusterUrl = updatedUserData.avatar_url.includes('?') 
              ? `${updatedUserData.avatar_url}&t=${timestamp}` 
              : `${updatedUserData.avatar_url}?t=${timestamp}`;
              
            const testImg = document.createElement('img');
            testImg.onload = () => {
              console.log('Header: Updated avatar loaded successfully:', cachedBusterUrl);
              // Force another update after successful load
              forceUIUpdate();
            };
            testImg.onerror = () => console.error('Header: Failed to load updated avatar:', cachedBusterUrl);
            testImg.src = cachedBusterUrl;
          }, 50);
        } else {
          // No avatar changes, just update normally
          forceUIUpdate();
        }
      }
    };

    // Handle specific avatar update events from Profile page
    const handleAvatarUpdate = (event: CustomEvent) => {
      const { userData: updatedUserData, newAvatarUrl, timestamp } = event.detail;
      
      if (updatedUserData && newAvatarUrl) {
        logInfo('Header: Received avatar-updated event', {
          newAvatarUrl,
          timestamp
        });
        
        // Use a stable timestamp
        const effectiveTimestamp = timestamp || Date.now().toString();
        
        // Cache the new avatar URL in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('cached_avatar_url', newAvatarUrl);
          localStorage.setItem('avatar_cache_buster', effectiveTimestamp);
        }
        
        // Immediately update user data with the new avatar
        if (updateUserData && typeof updateUserData === 'function') {
          // Create a fresh copy to ensure React detects the change
          const freshUserData = {...updatedUserData};
          
          // Force immediate render
          updateUserData(freshUserData, false);
          
          // Force a re-render of the entire header
          setForceShowHeader(prev => !prev);
          setTimeout(() => setForceShowHeader(prev => !prev), 0);
          
          // Also trigger a React state update to force re-render
          forceUpdate({});
          
          // Preload the image with a slight delay
          setTimeout(() => {
            const cachedBusterUrl = newAvatarUrl.includes('?') 
              ? `${newAvatarUrl}&t=${effectiveTimestamp}` 
              : `${newAvatarUrl}?t=${effectiveTimestamp}`;
              
            const img = document.createElement('img');
            img.src = cachedBusterUrl;
            img.onload = () => {
              logInfo('Header: New avatar preloaded successfully');
              // Force another update after successful load
              forceUpdate({});
              
              // Force a re-render of the entire header again
              setForceShowHeader(prev => !prev);
              setTimeout(() => setForceShowHeader(prev => !prev), 0);
            };
          }, 50);
        }
      }
    };

    window.addEventListener('userDataChanged', handleUserDataChange as EventListener);
    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    
    return () => {
      window.removeEventListener('userDataChanged', handleUserDataChange as EventListener);
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    };
  }, [updateUserData]);

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

  const handleLogout = useCallback(async () => {
    logInfo('Header: Logout clicked');
    try {
      // Set logging out state and hide header immediately
      setIsLoggingOut(true);
      setForceShowHeader(false);
      setIsMobileMenuOpen(false);
      setIsModalOpen(false);
      
      // Clear any existing timeouts
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      // Check if we're on a profile page before logout
      const isOnProfilePage = typeof window !== 'undefined' && window.location.pathname.startsWith('/profile');
      
      // Set a safety timeout to ensure redirection happens even if the event doesn't fire
      if (isOnProfilePage) {
        logoutTimeoutRef.current = setTimeout(() => {
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
        
        // Clear the safety timeout since the event fired
        if (logoutTimeoutRef.current) {
          clearTimeout(logoutTimeoutRef.current);
          logoutTimeoutRef.current = null;
        }
        
        // Immediately show the unauthenticated header without delay
        setIsLoggingOut(false);
        setForceShowHeader(true);
        
        // Reset hasShownHeaderRef to ensure proper state for next auth check
        hasShownHeaderRef.current = false;
        
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
      setIsLoggingOut(false);
      setForceShowHeader(true);
      
      // Clear any pending timeouts on error
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
    }
  }, [logout, router]);

  // Cleanup event listeners
  useEffect(() => {
    const cleanup = () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
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
    { href: "/profile", label: "Профиль" },
    { label: "Выход", onClick: handleLogout },
  ];

  // Determine if we should show the skeleton
  const shouldShowSkeleton = (authLoading && !forceShowHeader && !isAuthChecked && !hasShownHeaderRef.current) || 
                            (isLoggingOut && !forceShowHeader);
  
  // Логируем только при изменении решения о показе скелетона
  if (shouldShowSkeletonRef.current !== shouldShowSkeleton) {
    logDebug('Render decision', { 
      shouldShowSkeleton, 
      authLoading, 
      forceShowHeader, 
      isAuthChecked, 
      currentStage,
      hasShownHeader: hasShownHeaderRef.current,
      isLoggingOut
    });
    shouldShowSkeletonRef.current = shouldShowSkeleton;
  }
  
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

export default Header;