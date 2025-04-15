"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FaChevronRight } from "react-icons/fa";
import React, { useEffect, useState, useCallback } from "react";

const extractIdFromSlug = (slug: string): string => {
  if (!slug) return "";
  
  // Попытка извлечь ID из конца слага (например, some-event-123)
  const parts = slug.split("-");
  const lastPart = parts[parts.length - 1];
  
  // Если последняя часть - число, считаем её ID
  if (lastPart && /^\d+$/.test(lastPart)) {
    return lastPart;
  }
  
  // Если предпоследняя часть - год (4 цифры), а последняя - ID
  // (формат: some-event-2023-123)
  if (parts.length >= 2) {
    const preLast = parts[parts.length - 2];
    if (preLast && /^\d{4}$/.test(preLast) && /^\d+$/.test(lastPart)) {
      return lastPart;
    }
  }
  
  // Иначе используем весь слаг (возможно, это кастомный слаг)
  return slug;
};

// Функция для получения данных о мероприятии по ID
const fetchEventData = async (eventId: string) => {
  try {
    const response = await fetch(`/api/events/${eventId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch event data: ${response.status}`);
    }
    const data = await response.json();
    
    if (data.success && data.data) {
      // Кэшируем название мероприятия в localStorage
      try {
        localStorage.setItem(`event-title-${eventId}`, data.data.title);
        if (data.data.url_slug) {
          localStorage.setItem(`event-slug-${eventId}`, data.data.url_slug);
        }
      } catch (error) {
        console.error("Error caching event data in localStorage:", error);
      }
      
      return data.data.title;
    }
    return null;
  } catch (error) {
    console.error("Error fetching event data:", error);
    return null;
  }
};

const Breadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState<{ href: string; label: string; isLast: boolean }[]>([]);
  const [eventData, setEventData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const generateBreadcrumbs = useCallback(() => {
    if (pathname === "/") return []; // Не отображаем на главной

    const pathSegments = pathname.split("/").filter((segment) => segment);
    const crumbs = [{ href: "/", label: "Главная", isLast: false }];

    pathSegments.forEach((segment, index) => {
      const isEventSlug = pathSegments[index - 1] === "events" || pathSegments[index - 1] === "event";
      let href = "";
      let label = "";
      if (index === 0 && !isEventSlug) {
        switch (segment) {
          case "events": href = "/events"; label = "Мероприятия"; break;
          case "event": href = "/events"; label = "Мероприятия"; break;
          case "profile": href = "/profile"; label = "Профиль"; break;
          case "admin-login": href = "/admin-login"; label = "Вход для администраторов"; break;
          case "admin-profile": href = "/admin-profile"; label = "Профиль администратора"; break;
          case "dashboard": href = "/dashboard"; label = "Панель управления"; break;
          case "edit-events": href = "/edit-events"; label = "Редактирование мероприятия"; break;
          case "edit-user": href = "/edit-user"; label = "Редактирование пользователя"; break;
          default: href = `/${segment}`; label = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
        crumbs.push({ href, label, isLast: pathSegments.length - 1 === index });
      } else if (isEventSlug) {
        const eventId = extractIdFromSlug(segment);
        let cachedTitle = eventData[eventId] || `Мероприятие ${eventId}`;
        let cachedSlug = segment;
        
        // Проверяем localStorage на наличие кэшированного названия мероприятия
        try {
          const storedTitle = localStorage.getItem(`event-title-${eventId}`);
          const storedSlug = localStorage.getItem(`event-slug-${eventId}`);
          
          if (storedTitle) {
            console.log(`Breadcrumbs: Found cached title for event ${eventId}: ${storedTitle}`);
            cachedTitle = storedTitle;
          } else {
            console.log(`Breadcrumbs: No cached title found for event ${eventId}, using default`);
          }
          
          if (storedSlug) {
            cachedSlug = storedSlug;
          }
        } catch (error) {
          console.error("Breadcrumbs: Error accessing localStorage:", error);
        }
        
        // Определяем правильный путь в зависимости от сегмента пути (events или event)
        const baseRoute = pathSegments[index - 1] === "events" ? "events" : "event";
        crumbs.push({ 
          href: `/${baseRoute}/${cachedSlug}`, 
          label: cachedTitle, 
          isLast: true 
        });
      }
    });

    return crumbs;
  }, [pathname, eventData]);

  // Эффект для определения, нужно ли загружать данные мероприятия
  useEffect(() => {
    const fetchEventDetails = async () => {
      const pathSegments = pathname.split("/").filter((segment) => segment);
      const eventSlugIndex = pathSegments.findIndex(
        (segment, idx) => idx > 0 && (pathSegments[idx - 1] === "events" || pathSegments[idx - 1] === "event")
      );
      
      if (eventSlugIndex !== -1) {
        const eventSlug = pathSegments[eventSlugIndex];
        const eventId = extractIdFromSlug(eventSlug);
        
        if (eventId) {
          // Проверяем, есть ли уже это мероприятие в состоянии или в localStorage
          const hasInState = eventData[eventId];
          const hasInStorage = localStorage.getItem(`event-title-${eventId}`);
          
          if (!hasInState && !hasInStorage && !isLoading) {
            setIsLoading(true);
            const title = await fetchEventData(eventId);
            setIsLoading(false);
            
            if (title) {
              setEventData(prev => ({
                ...prev,
                [eventId]: title
              }));
            }
          }
        }
      }
    };
    
    fetchEventDetails().catch(error => {
      console.error("Error fetching event details:", error);
      setIsLoading(false);
    });
  }, [pathname, eventData, isLoading]);

  useEffect(() => {
    const crumbs = generateBreadcrumbs();
    setBreadcrumbs(crumbs);
  }, [pathname, generateBreadcrumbs, eventData]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-gray-600 py-2 sm:py-4 container mx-auto px-4 sm:px-5 overflow-x-auto scrollbar-hide">
      <div className="flex flex-wrap items-center gap-2 max-w-full">
        {breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.href}>
            {crumb.isLast ? (
              <span
                className="font-medium text-orange-800 truncate max-w-[150px] sm:max-w-[200px] md:max-w-none"
                style={{ fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)" }}
                title={crumb.label}
              >
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="hover:text-orange-700 transition-colors flex items-center"
                  title={crumb.label}
                >
                  <span
                    className="truncate max-w-[80px] sm:max-w-[120px] md:max-w-none"
                    style={{ fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)" }}
                  >
                    {crumb.label}
                  </span>
                </Link>
                <FaChevronRight className="w-2 h-2 text-gray-400 flex-shrink-0" />
              </>
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
};

export default Breadcrumbs;