// frontend/src/app/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaUser, FaCalendarAlt, FaVideo, FaArrowRight } from "react-icons/fa";
import { IconType } from "react-icons";

interface FeatureCardProps {
  href: string;
  icon: IconType;
  title: string;
  description: string;
  ctaText: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ href, icon: Icon, title, description, ctaText }) => (
  <Link href={href} className="group">
    <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-orange-500" />
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-gray-700 flex-grow">{description}</p>
      <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
        {ctaText}
        <FaArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </div>
  </Link>
);

const PublicHomePage: React.FC = () => {
  const features: FeatureCardProps[] = [
    {
      href: "/registration",
      icon: FaUser,
      title: "Регистрация",
      description: "Создайте личный кабинет на нашей платформе, чтобы открыть возможность регистрации на мероприятия.",
      ctaText: "Зарегистрироваться",
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
      <main className="flex-grow flex flex-col justify-center items-center pt-24 pb-16 px-4 min-h-[calc(100vh-120px)]">
        <h1 className="text-4xl font-bold text-center mb-12">MOSCOW MELLOWS</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
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