// frontend/src/app/(public)/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaUser, FaCalendarAlt, FaVideo, FaArrowRight } from "react-icons/fa";
import { FeatureCardProps } from "@/types/index";
import { useLoadingFlags } from "@/contexts/loading";
import { useAuth } from "@/contexts/AuthContext";

const FeatureCard: React.FC<FeatureCardProps> = ({ href, icon: Icon, title, description, ctaText }) => (
  <Link href={href} className="group h-full">
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col h-full">
      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4 sm:mb-5 shrink-0">
        <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mb-4 text-orange-600">{title}</h3>
      <p className="text-gray-700 text-base flex-grow">{description}</p>
      <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center text-base font-medium shrink-0">
        {ctaText}
        <FaArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </div>
  </Link>
);

const PublicHomePage: React.FC = () => {
  const { setStaticLoading, isStaticLoading } = useLoadingFlags();
  const { isAuth, isAuthChecked } = useAuth();
  const hasReset = useRef(false);
  const [isContentReady, setIsContentReady] = useState(false);

  // Обработка начальной загрузки для предотвращения мерцания UI
  useEffect(() => {
    if (isAuthChecked && !isContentReady) {
      // Небольшая задержка для плавности
      const timer = setTimeout(() => {
        setIsContentReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthChecked, isContentReady]);

  useEffect(() => {
    // Сбрасываем состояние загрузки только один раз при монтировании
    if (!hasReset.current && isStaticLoading) {
      console.log("PublicHomePage useEffect triggered, setting static loading to false");
      setStaticLoading(false);
      hasReset.current = true;
    }
  }, [isStaticLoading, setStaticLoading]);

  const features: FeatureCardProps[] = [
    {
      href: "/profile",
      icon: FaUser,
      title: "Профиль",
      description: isAuth 
        ? "Вы авторизованы. Билеты отображаются на странице профиля." 
        : "Авторизуйтесь на нашей платформе, чтобы открыть возможность регистрации на мероприятия.",
      ctaText: isAuth ? "Открыть профиль" : "Войти",
    },
    {
      href: "/events",
      icon: FaCalendarAlt,
      title: "Мероприятия",
      description: "Прошедшие и запланированные мероприятия.",
      ctaText: "Смотреть мероприятия",
    },
    {
      href: "/media",
      icon: FaVideo,
      title: "Медиа",
      description: "Фото, видео и аудио с наших мероприятий.",
      ctaText: "Смотреть медиа",
    },
  ];

  return (
    <>
      <main className="flex-grow flex flex-col justify-center items-center pt-24 pb-16 px-4 sm:px-6 min-h-[calc(100vh-120px)]">
        <h1 className="text-3xl sm:text-4xl font-black text-center mb-12">MOSCOW MELLOWS</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-6xl w-full">
          {isAuthChecked && isContentReady ? (
            features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))
          ) : (
            // Скелетоны карточек во время загрузки
            [...Array(3)].map((_, index) => (
              <div key={index} className="bg-white rounded-xl p-4 sm:p-6 shadow-md animate-pulse h-full">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-full mb-4 sm:mb-5"></div>
                <div className="h-6 bg-gray-200 rounded mb-4 w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
                <div className="mt-4 h-5 bg-gray-200 rounded w-2/5"></div>
              </div>
            ))
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default PublicHomePage;