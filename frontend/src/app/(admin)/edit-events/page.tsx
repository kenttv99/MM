// frontend/src/app/(admin)/edit-events/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import EditEventForm from "@/components/EditEventForm";
import { useEffect, useRef, useMemo } from "react";
import { usePageLoad } from "@/contexts/PageLoadContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useEventForm } from "@/hooks/useEventForm";
import { EventFormData } from "@/types/events";
import { useRouter } from "next/navigation";

function EditEventsPage() {
  const searchParams = useSearchParams();
  const newEventParam = searchParams.get("new");
  const eventIdParam = searchParams.get("event_id");

  const isNewEvent = newEventParam === "true";
  const initialEventId = eventIdParam;

  const { wrapAsync, setPageLoading, isPageLoading } = usePageLoad();
  const { isAdminAuth, isCheckingAuth, checkAuth } = useAdminAuth();
  const router = useRouter();
  
  // Prevent duplicate initialization
  const initialized = useRef(false);
  const dataLoaded = useRef(false);
  const redirecting = useRef(false);

  // Initial form values
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
    ticket_type_free_registration: false,
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
    isLoading
  } = useEventForm({
    initialValues,
    onSuccess: () => {
      redirecting.current = true;
      router.push("/dashboard?refresh=true");
    },
    onError: (err) => console.error("Error in useEventForm:", err),
  });

  // Main initialization effect
  useEffect(() => {
    // Prevent running multiple times
    if (initialized.current || redirecting.current) return;
    initialized.current = true;
    
    const init = async () => {
      console.log("EditEventsPage params:", { newEventParam, eventIdParam });
      
      // Wait for auth check to complete
      if (isCheckingAuth) {
        console.log("Waiting for auth check to complete...");
        return;
      }
      
      // Check auth and redirect if needed
      if (!isAdminAuth) {
        try {
          // Try one explicit auth check
          const isAuthenticated = await checkAuth();
          if (!isAuthenticated) {
            console.log("User not authenticated, redirecting to /admin-login");
            redirecting.current = true;
            router.push("/admin-login");
            return;
          }
        } catch (err) {
          console.error("Auth check failed:", err);
          redirecting.current = true;
          router.push("/admin-login");
          return;
        }
      }
      
      // Skip data loading for new events
      if (isNewEvent || !initialEventId) {
        dataLoaded.current = true;
        setPageLoading(false);
        return;
      }
      
      // Only load data if not already loaded
      if (!dataLoaded.current) {
        dataLoaded.current = true;
        setPageLoading(true);
        try {
          console.log("Loading event with ID:", initialEventId);
          await wrapAsync(loadEvent(initialEventId));
        } catch (err) {
          console.error("Failed to load event:", err);
        } finally {
          setPageLoading(false);
        }
      }
    };
    
    init();
  }, [isAdminAuth, isCheckingAuth, checkAuth, isNewEvent, initialEventId, loadEvent, router, setPageLoading, wrapAsync, newEventParam, eventIdParam]);

  // Safety timeout to prevent stuck loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isPageLoading) {
        setPageLoading(false);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [isPageLoading, setPageLoading]);

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
      isLoading={isLoading || isCheckingAuth}
      isPageLoading={isPageLoading}
    />
  );
}

export default EditEventsPage;