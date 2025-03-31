// frontend/src/app/(admin)/edit-events/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import EditEventForm from "@/components/EditEventForm";
import { useEffect, useRef, useMemo, useState } from "react";
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

  // Auth and navigation hooks
  const { wrapAsync, setPageLoading } = usePageLoad();
  const { isAdminAuth, isCheckingAuth, checkAuth } = useAdminAuth();
  const router = useRouter();
  
  // Local state to control initialization flow
  const [authVerified, setAuthVerified] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);
  
  // Track fetch status to prevent duplicates
  const isFetching = useRef(false);
  const hasRedirected = useRef(false);

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
    onSuccess: () => router.push("/dashboard?refresh=true"),
    onError: (err) => console.error("Error in useEventForm:", err),
  });

  // Step 1: Verify authentication status first
  useEffect(() => {
    const verifyAuth = async () => {
      // Skip if already verified or redirected
      if (authVerified || hasRedirected.current) return;

      // If auth check is in progress, wait for it
      if (isCheckingAuth) {
        console.log("Waiting for auth check to complete...");
        return;
      }

      // We have a definitive auth state
      if (isAdminAuth) {
        // Auth is confirmed, mark as verified
        setAuthVerified(true);
      } else {
        // Not authenticated, perform one explicit check
        try {
          const isAuth = await checkAuth();
          if (isAuth) {
            setAuthVerified(true);
          } else {
            // Confirmed not authenticated, redirect
            console.log("User not authenticated, redirecting to /admin-login");
            hasRedirected.current = true;
            router.push("/admin-login");
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          hasRedirected.current = true;
          router.push("/admin-login");
        }
      }
    };

    verifyAuth();
  }, [isAdminAuth, isCheckingAuth, checkAuth, router, authVerified]);

  // Step 2: Load data only after auth is verified
  useEffect(() => {
    // Only run if authenticated and not already initialized
    if (!authVerified || dataInitialized || hasRedirected.current || isFetching.current) {
      return;
    }

    const initializeData = async () => {
      console.log("EditEventsPage params:", { newEventParam, eventIdParam });

      // New event doesn't need data loading
      if (isNewEvent || !initialEventId) {
        setDataInitialized(true);
        return;
      }

      // Prevent duplicate fetches
      isFetching.current = true;
      setPageLoading(true);

      try {
        console.log("Loading event with ID:", initialEventId);
        await wrapAsync(loadEvent(initialEventId));
        setDataInitialized(true);
      } catch (error) {
        console.error("Failed to load event:", error);
      } finally {
        setPageLoading(false);
        isFetching.current = false;
      }
    };

    initializeData();
  }, [
    authVerified,
    dataInitialized,
    isNewEvent,
    initialEventId,
    loadEvent,
    wrapAsync,
    setPageLoading,
    newEventParam,
    eventIdParam
  ]);

  // Safety timeout to prevent stuck loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPageLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [setPageLoading]);

  // If redirecting, show minimal UI
  if (hasRedirected.current) {
    return <div>Redirecting...</div>;
  }

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
      isLoading={isLoading || isCheckingAuth || !authVerified}
      isPageLoading={false}
    />
  );
}

export default EditEventsPage;