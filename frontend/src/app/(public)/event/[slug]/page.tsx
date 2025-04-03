"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import EventDetails from "@/components/EventDetails";
import FormattedDescription from "@/components/FormattedDescription";
import { notFound } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Login from "@/components/Login";
import Registration from "@/components/Registration";
import AuthModal from "@/components/common/AuthModal";
import { FaCalendarAlt } from "react-icons/fa";
import { apiFetch } from "@/utils/api";
import { EventData } from "@/types/events";

const generateSlug = (title: string, id: number): string => {
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-"
  };
  const slug = title
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] || char)
    .join("")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}-${id}` : `event-${id}`;
};

const extractIdFromSlug = (slug: string): string => slug.split("-").pop() || "";

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasServerError, setHasServerError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { isAuth, checkAuth } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const eventFetchedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEvent = useCallback(async () => {
    if (eventFetchedRef.current) return;
    setIsLoading(true);
    setHasServerError(false);
    setFetchError(null);
    const eventId = extractIdFromSlug(slug);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const data = await apiFetch<EventData>(`/v1/public/events/${eventId}`, {
        cache: "no-store",
        signal: abortControllerRef.current.signal,
      });
      if (data) {
        const correctSlug = generateSlug(data.title, data.id || parseInt(eventId));
        if (slug !== correctSlug && !hasRedirected) {
          setHasRedirected(true);
          router.replace(`/event/${correctSlug}`, { scroll: false });
        }
        setEvent(data);
        eventFetchedRef.current = true;
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Неизвестная ошибка");
      if ("isServerError" in error && error.isServerError) {
        setHasServerError(true);
      } else if (error.message === "Не удалось подключиться к серверу. Проверьте соединение.") {
        setHasServerError(true);
      } else {
        setFetchError(error.message || "Не удалось загрузить мероприятие");
      }
    } finally {
      setIsLoading(false);
    }
  }, [slug, router, hasRedirected]);

  useEffect(() => {
    if (slug) fetchEvent();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [slug, fetchEvent]);

  useEffect(() => {
    const handleAuthChange = () => checkAuth();
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [checkAuth]);

  const handleBookingClick = useCallback(() => console.log("Booking click triggered"), []);
  const handleLoginClick = useCallback(() => {
    setIsRegisterMode(false);
    setIsModalOpen(true);
  }, []);
  const handleModalClose = useCallback(() => setIsModalOpen(false), []);
  const toggleToLogin = useCallback(() => setIsRegisterMode(false), []);
  const toggleToRegister = useCallback(() => setIsRegisterMode(true), []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (hasServerError) return <ErrorPlaceholder />;
  if (fetchError) return notFound();
  if (!event) return null;

  if (event.status === "draft" || !event.published) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <FaCalendarAlt className="text-orange-500 w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Мероприятие недоступно</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Это мероприятие пока недоступно для просмотра.
            </p>
            <button
              onClick={() => router.push("/events")}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Вернуться к мероприятиям
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const eventDate = format(new Date(event.start_date), "d MMMM yyyy", { locale: ru });
  const eventTime = format(new Date(event.start_date), "HH:mm", { locale: ru });
  const availableQuantity = event.ticket_type?.available_quantity || 0;
  const remainingQuantity = availableQuantity - (event.ticket_type?.sold_quantity || 0);
  const soldQuantity = event.ticket_type?.sold_quantity || 0;
  const displayStatus =
    event.status === "registration_open" && remainingQuantity === 0
      ? "Регистрация закрыта (мест нет)"
      : event.status === "registration_open"
      ? "Регистрация открыта"
      : event.status === "registration_closed"
      ? "Регистрация закрыта"
      : event.status === "completed"
      ? "Мероприятие завершено"
      : "Черновик";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-[400px] w-full px-6 mt-16 mb-8"
        >
          <div className="relative h-full w-full rounded-xl overflow-hidden">
            {event.image_url ? (
              <Image src={event.image_url} alt={event.title} fill className="object-cover" priority />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">Нет изображения</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-4xl font-bold text-white text-center px-4 max-w-[90vw]"
  style={{ fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }}
              >
                {event.title}
              </motion.h1>
            </div>
          </div>
        </motion.section>

        <div className="container mx-auto px-6 py-12">
          {event.ticket_type && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
              <EventDetails
                date={eventDate}
                time={eventTime}
                location={event.location || "Не указано"}
                price={event.price}
                freeRegistration={event.ticket_type.free_registration}
              />
            </motion.section>
          )}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <div
              className={`bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto ${
                displayStatus !== "Регистрация открыта" ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <h2 className="text-2xl font-semibold mb-4 text-center">{displayStatus}</h2>
              <EventRegistration
                eventId={event.id || parseInt(extractIdFromSlug(slug))}
                eventTitle={event.title}
                eventDate={eventDate}
                eventTime={eventTime}
                eventLocation={event.location || "Не указано"}
                ticketType={event.ticket_type?.name || "Стандартный"}
                availableQuantity={availableQuantity}
                soldQuantity={soldQuantity}
                price={event.price}
                freeRegistration={event.ticket_type?.free_registration || false}
                onBookingClick={handleBookingClick}
                onLoginClick={handleLoginClick}
                onBookingSuccess={fetchEvent}
                displayStatus={displayStatus}
              />
              {!isAuth && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mt-6 text-gray-700 bg-orange-50 py-3 px-6 rounded-full"
                >
                  Для бронирования билета{" "}
                  <button
                    onClick={handleLoginClick}
                    className="text-orange-600 font-semibold hover:underline"
                  >
                    войдите в аккаунт
                  </button>
                </motion.p>
              )}
            </div>
          </motion.section>
          {event.description && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-semibold mb-4">Описание</h2>
              <FormattedDescription content={event.description} className="text-gray-600 max-w-full overflow-wrap-break-word" disableFontSize={false} />            
              </motion.section>
          )}
        </div>
      </main>
      <Footer />
      <AnimatePresence>
        {isModalOpen && (
          <AuthModal isOpen={isModalOpen} onClose={handleModalClose} title={isRegisterMode ? "Регистрация" : "Вход"}>
            {isRegisterMode ? (
              <Registration isOpen={isModalOpen} onClose={handleModalClose} toggleMode={toggleToLogin} />
            ) : (
              <Login isOpen={isModalOpen} onClose={handleModalClose} toggleMode={toggleToRegister} />
            )}
          </AuthModal>
        )}
      </AnimatePresence>
    </div>
  );
}