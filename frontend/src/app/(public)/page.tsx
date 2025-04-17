// frontend/src/app/(public)/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaUser, FaCalendarAlt, FaVideo, FaArrowRight } from "react-icons/fa";
import { FeatureCardProps } from "@/types/index";
import { useLoadingFlags } from "@/contexts/loading";
import { useAuth } from "@/contexts/AuthContext";

// Расширяем тип FeatureCardProps
interface ExtendedFeatureCardProps extends FeatureCardProps {
  badgeCount?: number;
}

// Определяем типы для билетов
interface EventData {
  id: number;
  status: string;
  published: boolean;
}

interface TicketData {
  id: number;
  status: string;
  event: EventData;
}

const FeatureCard: React.FC<ExtendedFeatureCardProps> = ({ href, icon: Icon, title, description, ctaText, badgeCount }) => (
  <Link href={href} className="group h-full">
    <style jsx>{`
      .badge-container {
        position: absolute;
        top: -8px;
        right: -8px;
        z-index: 10;
      }
      
      .badge {
        background-color: #f97316;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        transform: rotate(12deg);
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        position: relative;
      }
      
      @media (min-width: 640px) {
        .badge {
          width: 28px;
          height: 28px;
          font-size: 14px;
        }
      }
      
      .badge::before,
      .badge::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 50%;
        background-color: rgba(249, 115, 22, 0.7);
        z-index: -1;
      }
      
      .badge::before {
        animation: ripple 2s infinite ease-out;
      }
      
      .badge::after {
        animation: ripple 2s infinite ease-out 0.5s;
      }
      
      @keyframes ripple {
        0% {
          transform: scale(1);
          opacity: 0.6;
        }
        100% {
          transform: scale(2.5);
          opacity: 0;
        }
      }
    `}</style>
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 flex flex-col h-full relative">
      {badgeCount !== undefined && badgeCount > 0 && (
        <div className="badge-container">
          <div className="badge">
            {badgeCount}
          </div>
        </div>
      )}
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

// Добавляю компонент типографической печати заголовка
const Typewriter: React.FC<{ text: string; typingSpeed?: number; deletingSpeed?: number; pauseTime?: number }> = ({ text, typingSpeed = 200, deletingSpeed = 100, pauseTime = 1000 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Эффект мигания курсора
  useEffect(() => {
    // Постоянное мигание курсора
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  // Эффект типирования и удаления текста
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (!isDeleting && displayedText === text) {
      // Пауза перед удалением
      timer = setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && displayedText === '') {
      // Короткая пауза перед повторным набором после удаления
      timer = setTimeout(() => setIsDeleting(false), 1000);
    } else {
      // Набор или удаление символа
      timer = setTimeout(() => {
        const newText = isDeleting
          ? text.substring(0, displayedText.length - 1)
          : text.substring(0, displayedText.length + 1);
        setDisplayedText(newText);
      }, isDeleting ? deletingSpeed : typingSpeed);
    }
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, text, typingSpeed, deletingSpeed, pauseTime]);

  return (
    <h1 className="text-2xl sm:text-3xl font-black text-center mb-8 sm:mb-12 px-4 sm:px-0 leading-tight">
      {displayedText}
      <span
        style={{
          opacity: cursorVisible ? 1 : 0,
          color: "#f97316",
          fontSize: "0.75em",
          marginLeft: 0,
          display: "inline-block",
          transform: "scaleY(1) translateY(-0.15em)",
        }}
      >|
      </span>
    </h1>
  );
};

const PublicHomePage: React.FC = () => {
  const { setStaticLoading, isStaticLoading } = useLoadingFlags();
  const { isAuth, isAuthChecked } = useAuth();
  const hasReset = useRef(false);
  const [isContentReady, setIsContentReady] = useState(false);
  const [approvedTicketsCount, setApprovedTicketsCount] = useState(0);

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

  // Получение количества подтвержденных билетов
  useEffect(() => {
    const fetchApprovedTicketsCount = async () => {
      if (!isAuth) {
        setApprovedTicketsCount(0);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('/user_edits/my-tickets?status=approved', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Если ответ - массив, используем его напрямую
          const tickets = Array.isArray(data) ? data : 
                       // Если ответ - объект с полем data, items или tickets, используем его
                       (data.data || data.items || data.tickets || []);
                       
          // Фильтруем билеты по тем же правилам, что и в UserEventTickets
          const approvedTickets = tickets.filter((ticket: TicketData) => 
            ticket.status === "approved" && 
            ticket.event.status !== 'completed' &&
            ticket.event.published === true &&
            ticket.event.status !== 'draft'
          );
          
          setApprovedTicketsCount(approvedTickets.length);
        }
      } catch (error) {
        console.error("Ошибка при получении билетов:", error);
      }
    };
    
    if (isAuthChecked && isAuth) {
      fetchApprovedTicketsCount();
    }
  }, [isAuth, isAuthChecked]);

  useEffect(() => {
    // Сбрасываем состояние загрузки только один раз при монтировании
    if (!hasReset.current && isStaticLoading) {
      console.log("PublicHomePage useEffect triggered, setting static loading to false");
      setStaticLoading(false);
      hasReset.current = true;
    }
  }, [isStaticLoading, setStaticLoading]);

  const features: ExtendedFeatureCardProps[] = [
    {
      href: "/profile",
      icon: FaUser,
      title: "Профиль",
      description: isAuth 
        ? "Вы авторизованы. Билеты отображаются на странице профиля." 
        : "Авторизуйтесь на нашей платформе, чтобы открыть возможность регистрации на мероприятия.",
      ctaText: isAuth ? "Открыть профиль" : "Войти",
      badgeCount: isAuth ? approvedTicketsCount : undefined
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
        {isAuthChecked && isContentReady ? (
          <Typewriter text="MOSCOW MELLOWS" typingSpeed={150} deletingSpeed={100} pauseTime={3000} />
        ) : (
          <div className="h-12 w-64 bg-orange-200 rounded mb-12 animate-pulse mx-auto"></div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-6xl w-full">
          {isAuthChecked && isContentReady ? (
            features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))
          ) : (
            // Скелетоны карточек во время загрузки
            [...Array(3)].map((_, index) => (
              <div key={index} className="bg-orange-100 rounded-xl p-4 sm:p-6 shadow-md animate-pulse h-full">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-200 rounded-full mb-4 sm:mb-5"></div>
                <div className="h-6 bg-orange-200 rounded mb-4 w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-orange-200 rounded w-full"></div>
                  <div className="h-4 bg-orange-200 rounded w-5/6"></div>
                  <div className="h-4 bg-orange-200 rounded w-4/6"></div>
                </div>
                <div className="mt-4 h-5 bg-orange-200 rounded w-2/5"></div>
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