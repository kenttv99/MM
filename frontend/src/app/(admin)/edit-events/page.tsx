// frontend/src/app/(admin)/edit-events/page.tsx
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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initialLoad = async () => {
      if (isInitialized) return;

      setPageLoading(true);

      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        navigateTo(router, "/admin-login");
        return;
      }

      const newEventParam = searchParams.get("new");
      const eventIdParam = searchParams.get("event_id"); // Изменено на event_id

      console.log("EditEventsPage params:", { newEventParam, eventIdParam });

      if (newEventParam === "true") {
        setIsNewEvent(true);
        setEventId(null);
      } else if (eventIdParam) {
        setEventId(eventIdParam);
        setIsNewEvent(false);
      } else {
        setIsNewEvent(true);
        setEventId(null);
      }

      setIsInitialized(true);
      setPageLoading(false);
    };

    initialLoad();
  }, [checkAuth, router, searchParams, setPageLoading, isInitialized]);

  if (!isAdminAuth || !isInitialized) {
    return null;
  }

  console.log("Rendering EditEventForm with:", { eventId, isNewEvent });
  return <EditEventForm initialEventId={eventId} isNewEvent={isNewEvent} />;
}