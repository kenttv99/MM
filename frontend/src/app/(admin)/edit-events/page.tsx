// frontend\src\app\(admin)\edit-events\page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useMemo, Suspense, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useEventForm } from "@/hooks/useEventForm";
import { EventFormData } from "@/types/events";
import EditEventForm from "@/components/EditEventForm";

function EditEventsPageContent() {
  const searchParams = useSearchParams();
  const newEventParam = searchParams.get("new");
  const eventIdParam = searchParams.get("event_id");
  const isNewEvent = newEventParam === "true";
  const initialEventId = eventIdParam;

  const router = useRouter();
  const { isAuthenticated } = useAdminAuth();
  const initialized = useRef(false);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const initialValues = useMemo<EventFormData>(() => ({
    title: "",
    description: "",
    start_date: new Date().toISOString().split("T")[0],
    start_time: "12:00",
    end_date: "",
    end_time: "",
    location: "",
    price: 0,
    ticket_type_name: "standart",
    ticket_type_available_quantity: 0,
    published: false,
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    registrations_count: 0,
    ticket_type_sold_quantity: 0,
  }), []);

  const { 
    formData, 
    error, 
    success, 
    imagePreview,
    handleChange, 
    handleFileChange, 
    handleSubmit,
    loadEvent,
    setFieldValue,
    setImagePreview,
    isLoading,
    setError,
    setSuccess
  } = useEventForm({
    initialValues,
    onSuccess: () => router.push("/dashboard?refresh=true"),
    onError: (err) => console.error("Error in useEventForm:", err),
  });

  // Add this function to force reload data from server
  const refreshEventData = useCallback(() => {
    if (!initialEventId) return;
    setIsPageLoading(true);
    loadEvent(initialEventId, true)
      .finally(() => {
        setIsPageLoading(false);
      });
  }, [initialEventId, loadEvent, setIsPageLoading]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!isAuthenticated) {
      router.push("/admin-login");
      return;
    }

    if (!isNewEvent && initialEventId) {
      // Always force refresh to get the latest data from server
      loadEvent(initialEventId, true);
    }
  }, [isAuthenticated, isNewEvent, initialEventId, loadEvent, router]);

  return (
    <EditEventForm
      isNewEvent={isNewEvent}
      formData={formData}
      error={error}
      success={success}
      imagePreview={imagePreview}
      handleChange={handleChange}
      handleFileChange={handleFileChange}
      handleSubmit={handleSubmit}
      setFieldValue={setFieldValue}
      setImagePreview={setImagePreview}
      isLoading={isLoading}
      isPageLoading={isPageLoading}
      setIsPageLoading={setIsPageLoading}
      setError={setError}
      setSuccess={setSuccess}
      refreshEventData={refreshEventData}
    />
  );
}

function EditEventsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditEventsPageContent />
    </Suspense>
  );
}

export default EditEventsPage;