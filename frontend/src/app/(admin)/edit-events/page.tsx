"use client";

import { useContext, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import EditEventForm from "@/components/EditEventForm";
import { PageLoadContext } from "@/contexts/PageLoadContext";

export default function EditEventsPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const isNewEvent = searchParams.get("new") === "true";
  const { setPageLoaded } = useContext(PageLoadContext);

  useEffect(() => {
    // Сигнализируем layout о готовности страницы после полной загрузки EditEventForm
    // Логика загрузки делегирована компоненту EditEventForm
    setPageLoaded(true);
  }, [setPageLoaded]);

  return <EditEventForm initialEventId={eventId} isNewEvent={isNewEvent} />;
}