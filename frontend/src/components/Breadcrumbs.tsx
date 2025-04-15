"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaChevronRight } from "react-icons/fa";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";

const fetchEventData = async (eventId: string): Promise<EventData | null> => {
  if (!eventId) return null;
  try {
    const response = await apiFetch<EventData>(`/v1/public/events/${eventId}`, {
      method: "GET",
      bypassLoadingStageCheck: true
    });

    if (response && response.id && response.title) {
      try {
        localStorage.setItem(`event-title-${eventId}`, response.title);
        if (response.url_slug) {
          let startDateStr = "";
          try {
            const startDate = new Date(response.start_date);
            if (!isNaN(startDate.getTime())) {
              const year = startDate.getFullYear();
              const month = String(startDate.getMonth() + 1).padStart(2, '0');
              const day = String(startDate.getDate()).padStart(2, '0');
              startDateStr = `${year}-${month}-${day}`;
            } 
          } catch {}
          const slugWithDate = `${response.url_slug}${startDateStr ? `-${startDateStr}` : ''}`;
          localStorage.setItem(`event-slug-${eventId}`, slugWithDate);
        }
      } catch (error) {
        console.error("Breadcrumbs: Error caching event data in localStorage:", error);
      }
      return response;
    }
    return null;
  } catch (error) {
    console.error("Breadcrumbs: Error in fetchEventData wrapper:", error);
    return null;
  }
};

const Breadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [breadcrumbs, setBreadcrumbs] = useState<{ href: string; label: string; isLast: boolean }[]>([]);
  const [eventDataCache, setEventDataCache] = useState<Record<string, EventData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const currentEventIdRef = useRef<string | null>(null);

  const generateBreadcrumbs = useCallback((eventId: string | null) => {
    if (pathname === "/") return [];

    const pathSegments = pathname.split("/").filter((segment) => segment);
    const crumbs = [{ href: "/", label: "Главная", isLast: false }];

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;
      let label = "";
      let href = currentPath;

      if (segment === "events" && pathSegments[index + 1]) {
         label = "Мероприятия";
         href = "/events";
         crumbs.push({ href, label, isLast: false });
         return;
      } else if (segment === "events") {
         label = "Мероприятия";
         href = "/events";
         crumbs.push({ href, label, isLast: true });
         return;
      } else if (pathSegments[index - 1] === "events" && eventId) {
        let eventTitle = eventDataCache[eventId]?.title;
        if (!eventTitle) {
            try {
                eventTitle = localStorage.getItem(`event-title-${eventId}`) || "Загрузка...";
            } catch { eventTitle = "Загрузка..."; }
        }
        href = `${pathname}?id=${eventId}`;
        crumbs.push({ href, label: eventTitle, isLast: true });
        return;
      } else if (index === 0) {
        switch (segment) {
          case "profile": label = "Профиль"; break;
          case "admin-login": label = "Вход для администраторов"; break;
          case "admin-profile": label = "Профиль администратора"; break;
          case "dashboard": label = "Панель управления"; break;
          case "edit-events": label = "Редактирование мероприятия"; break;
          case "edit-user": label = "Редактирование пользователя"; break;
          default: label = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
        crumbs.push({ href, label, isLast });
      }
    });

    return crumbs;
  }, [pathname, eventDataCache]);

  useEffect(() => {
    const eventId = searchParams.get('id');
    const isEventPage = pathname.startsWith('/events/') && pathname.split('/').length > 2;

    const hasIdChanged = eventId !== currentEventIdRef.current;

    currentEventIdRef.current = eventId;

    if (!isEventPage || !eventId) {
        setBreadcrumbs(generateBreadcrumbs(null));
        return;
    }

    if (!hasIdChanged && eventDataCache[eventId]) {
        setBreadcrumbs(generateBreadcrumbs(eventId));
        return;
    }

    const fetchNeeded = hasIdChanged || !eventDataCache[eventId];

    setBreadcrumbs(generateBreadcrumbs(eventId));

    if (fetchNeeded && !isLoading) {
        const fetchEventDetails = async (idToFetch: string) => {
            setIsLoading(true);
            console.log("Breadcrumbs: Fetching details for ID:", idToFetch);
            const data = await fetchEventData(idToFetch);
            setIsLoading(false);

            if (data) {
                 console.log("Breadcrumbs: Fetched data successfully for ID:", idToFetch);
                 setEventDataCache(prev => {
                     const newCache = { ...prev, [idToFetch]: data };
                     setBreadcrumbs(generateBreadcrumbs(idToFetch)); 
                     return newCache;
                 });
            } else {
                 console.warn("Breadcrumbs: Failed to fetch data for ID:", idToFetch);
            }
        };

        fetchEventDetails(eventId).catch(error => {
            console.error("Breadcrumbs: Error in fetchEventDetails effect:", error);
            setIsLoading(false);
        });
    }

  }, [pathname, searchParams, isLoading, generateBreadcrumbs, eventDataCache]);

  if (breadcrumbs.length <= 1) return null;

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