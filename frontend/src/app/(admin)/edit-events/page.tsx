"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EditEventForm from "@/components/EditEventForm";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { usePageLoad } from "@/contexts/PageLoadContext";

const navigateTo = (router: ReturnType<typeof useRouter>, path: string, params: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  router.push(url.pathname + url.search);
};

export default function EditEventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAuth, isAdminAuth } = useAdminAuth();
  const { setPageLoading } = usePageLoad();
  const [eventId, setEventId] = useState<string | null>(null);
  const [isNewEvent, setIsNewEvent] = useState(false);

  useEffect(() => {
    const initialLoad = async () => {
      try {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
          navigateTo(router, "/admin-login");
          return;
        }

        const newEventParam = searchParams.get("new");
        const eventIdParam = searchParams.get("eventId");

        if (newEventParam === "true") {
          setIsNewEvent(true);
        } else if (eventIdParam) {
          setEventId(eventIdParam);
        } else {
          navigateTo(router, "/dashboard");
        }
      } catch (err) {
        console.error("EditEventsPage: initial load failed:", err);
      } finally {
        setPageLoading(false);
      }
    };

    initialLoad();
  }, [checkAuth, router, searchParams, setPageLoading]);

  if (!isAdminAuth) return null;

  return <EditEventForm initialEventId={eventId} isNewEvent={isNewEvent} />;
}