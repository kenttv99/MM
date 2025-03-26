// frontend/src/components/Breadcrumbs.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FaChevronRight } from "react-icons/fa";
import React, { useEffect, useState } from "react";

const extractIdFromSlug = (slug: string): string => {
  const parts = slug.split("-");
  return parts[parts.length - 1];
};

const Breadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter((segment) => segment);
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true once the component mounts (client-side)
  useEffect(() => {
    setIsClient(true);
  }, []);

  const getBreadcrumb = (segment: string, index: number) => {
    const isEventSlug = pathSegments[index - 1] === "event";
    let href = "";
    let label = "";

    if (index === 0 && !isEventSlug) {
      switch (segment) {
        case "events":
          href = "/events";
          label = "Мероприятия";
          break;
        case "event":
          href = "/events";
          label = "Мероприятия";
          break;
        case "profile":
          href = "/profile";
          label = "Профиль";
          break;
        case "admin-login":
          href = "/admin-login";
          label = "Вход для администраторов";
          break;
        case "admin-profile":
          href = "/admin-profile";
          label = "Профиль администратора";
          break;
        case "dashboard":
          href = "/dashboard";
          label = "Панель управления";
          break;
        case "edit-events":
          href = "/edit-events";
          label = "Редактирование мероприятия";
          break;
        case "edit-user":
          href = "/edit-user";
          label = "Редактирование пользователя";
          break;
        default:
          href = `/${segment}`;
          label = segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    } else if (isEventSlug) {
      const eventId = extractIdFromSlug(segment);
      let cachedTitle = `Мероприятие ${eventId}`;
      let cachedSlug = segment;
      
      // Only try to access localStorage on the client-side
      if (isClient && typeof window !== 'undefined') {
        try {
          const storedTitle = localStorage.getItem(`event-title-${eventId}`);
          const storedSlug = localStorage.getItem(`event-slug-${eventId}`);
          
          if (storedTitle) cachedTitle = storedTitle;
          if (storedSlug) cachedSlug = storedSlug;
        } catch (error) {
          console.error("Error accessing localStorage:", error);
        }
      }
      
      href = `/event/${cachedSlug}`;
      label = cachedTitle;
    }

    return { href, label, isLast: index === pathSegments.length - 1 };
  };

  const breadcrumbs = pathSegments.map((segment, index) => getBreadcrumb(segment, index));

  if (pathname !== "/") {
    breadcrumbs.unshift({ href: "/", label: "Главная страница", isLast: false });
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 py-4 container mx-auto px-5">
      {breadcrumbs.map((crumb) => (
        <React.Fragment key={crumb.href}>
          {crumb.isLast ? (
            <span className="font-medium text-orange-800">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-orange-700 transition-colors">
              {crumb.label}
            </Link>
          )}
          {!crumb.isLast && <FaChevronRight className="w-2 h-2 text-gray-600" />}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;