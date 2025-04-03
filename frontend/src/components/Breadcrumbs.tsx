"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FaChevronRight} from "react-icons/fa";
import React, { useEffect, useState, useCallback } from "react";

const extractIdFromSlug = (slug: string): string => {
  const parts = slug.split("-");
  return parts[parts.length - 1];
};

const Breadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState<{ href: string; label: string; isLast: boolean }[]>([]);

  const generateBreadcrumbs = useCallback(() => {
    const pathSegments = pathname.split("/").filter((segment) => segment);
    const crumbs = pathSegments.map((segment, index) => {
      const isEventSlug = pathSegments[index - 1] === "event";
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
      } else if (isEventSlug) {
        const eventId = extractIdFromSlug(segment);
        let cachedTitle = `Мероприятие ${eventId}`;
        let cachedSlug = segment;
        try {
          const storedTitle = localStorage.getItem(`event-title-${eventId}`);
          const storedSlug = localStorage.getItem(`event-slug-${eventId}`);
          if (storedTitle) cachedTitle = storedTitle;
          if (storedSlug) cachedSlug = storedSlug;
        } catch (error) {
          console.error("Error accessing localStorage:", error);
        }
        href = `/event/${cachedSlug}`;
        label = cachedTitle;
      }
      return { href, label, isLast: index === pathSegments.length - 1 };
    });
    if (pathname !== "/") crumbs.unshift({ href: "/", label: "Главная", isLast: false });
    return crumbs;
  }, [pathname]);

  useEffect(() => {
    const crumbs = generateBreadcrumbs();
    setBreadcrumbs(crumbs);
  }, [pathname, generateBreadcrumbs]);

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
                  {/* {index === 0 ? (
                    <FaHome className="text-gray-600 hover:text-orange-700 w-3 h-3 mr-1" />
                  ) : null} */}
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