// frontend\src\app\(public)\page.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaUser, FaCalendarAlt, FaVideo, FaArrowRight } from "react-icons/fa";
import { FeatureCardProps } from "@/types/index";
import { useLoading } from "@/contexts/LoadingContext";

const FeatureCard: React.FC<FeatureCardProps> = ({ href, icon: Icon, title, description, ctaText }) => (
  <Link href={href} className="group h-full">
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col h-full">
      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4 sm:mb-5 shrink-0">
        <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold mb-4">{title}</h3>
      <p className="text-gray-700 text-base flex-grow">{description}</p>
      <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center text-base shrink-0">
        {ctaText}
        <FaArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </div>
  </Link>
);

const PublicHomePage: React.FC = () => {
  const { setLoading } = useLoading();

  useEffect(() => {
    setLoading(false); // Статическая страница, загружается сразу
  }, [setLoading]);

  const features: FeatureCardProps[] = [
    {
      href: "/profile",
      icon: FaUser,
      title: "Профиль",
      description: "Авторизуйтесь на нашей платформе, чтобы открыть возможность регистрации на мероприятия.",
      ctaText: "Войти",
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
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-12">MOSCOW MELLOWS</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-6xl w-full">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default PublicHomePage;