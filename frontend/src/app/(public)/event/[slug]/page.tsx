"use client";

import { useState, useEffect, useCallback, useContext } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, CustomError } from "@/utils/api";
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
import { PageLoadContext } from "@/contexts/PageLoadContext";

interface EventData {
  id: number;
  title: string;
  description?: string;
  status: "draft" | "registration_open" | "registration_closed" | "completed";
  start_date: string;
  end_date?: string;
  location?: string;
  image_url?: string;
  ticket_type?: {
    name: string;
    price: number;
    available_quantity: number;
    free_registration: boolean;
    remaining_quantity?: number;
    sold_quantity?: number;
  };
  published: boolean;
}

const generateSlug = (title: string, id: number): string => {
  if (!title || title.trim() === "") {
    return `event-${id}`;
  }
  const translitMap: { [key: string]: string } = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e",
    ю: "yu", я: "ya", " ": "-"
  };
  const slugifiedTitle = title
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] || char)
    .join("")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slugifiedTitle ? `${slugifiedTitle}-${id}` : `event-${id}`;
};

const extractIdFromSlug = (slug: string): string => {
  const parts = slug.split("-");
  return parts[parts.length - 1];
};

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasServerError, setHasServerError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { isAuth, checkAuth } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const { setPageLoaded } = useContext(PageLoadContext);

  // Define all useCallback hooks first, regardless of conditions
  const handleBookingClick = useCallback(() => {
    console.log("Booking click triggered in page.tsx");
  }, []);

  const handleLoginClick = useCallback(() => {
    console.log("Login click triggered, setting isModalOpen to true");
    setIsRegisterMode(false);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    console.log("Closing modal");
    setIsModalOpen(false);
    setIsRegisterMode(false);
  }, []);

  const toggleToLogin = useCallback(() => {
    setIsRegisterMode(false);
  }, []);

  const toggleToRegister = useCallback(() => {
    setIsRegisterMode(true);
  }, []);

  const fetchEvent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHasServerError(false);
    const eventId = extractIdFromSlug(slug);

    try {
      const res = await apiFetch(`/v1/public/events/${eventId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 404) {
          setEvent({
            id: parseInt(eventId),
            title: "Недоступное мероприятие",
            status: "draft",
            start_date: new Date().toISOString(),
            published: false,
          });
          setPageLoaded(true); // Устанавливаем, что загрузка завершена
          return;
        }

        const errorText = await res.text();
        let errorMessage = "Произошла ошибка";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Оставляем общее сообщение
        }
        if (res.status >= 500) {
          setHasServerError(true);
          setPageLoaded(true); // Устанавливаем, что загрузка завершена
          return;
        } else if (res.status === 429) {
          errorMessage = "Частые запросы. Попробуйте немного позже.";
        }
        setError(errorMessage);
        setPageLoaded(true); // Устанавливаем, что загрузка завершена
        return;
      }

      const data: EventData = await res.json();
      setEvent(data);

      const correctSlug = generateSlug(data.title, data.id);
      if (slug !== correctSlug && !hasRedirected) {
        setHasRedirected(true);
        router.replace(`/event/${correctSlug}`, { scroll: false });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const customErr = err as CustomError;
        if (customErr.code === "ECONNREFUSED" || customErr.isServerError) {
          setHasServerError(true);
        } else {
          setError(err.message || "Произошла ошибка");
        }
      } else {
        setHasServerError(true);
      }
    } finally {
      setIsLoading(false);
      setPageLoaded(true); // Устанавливаем, что загрузка завершена
    }
  }, [slug, router, hasRedirected, setPageLoaded]);

  useEffect(() => {
    if (slug) fetchEvent();
  }, [slug, fetchEvent]);

  useEffect(() => {
    const handleAuthChange = () => checkAuth();
    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [checkAuth]);

  if (hasServerError) return <ErrorPlaceholder />;
  if (error) return notFound();
  if (isLoading || !event) return null;

  if (event.status === "draft" || !event.published) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <FaCalendarAlt className="text-orange-500 w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Мероприятие недоступно</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Это мероприятие пока недоступно для просмотра.
            </p>
            <button
              onClick={() => router.push("/events")}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-300 min-h-[44px]"
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
  const remainingQuantity = event.ticket_type?.remaining_quantity || 0;
  const soldQuantity = availableQuantity - remainingQuantity;
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
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative h-[300px] sm:h-[400px] w-full px-4 sm:px-6 lg:px-8 mt-16 mb-6 sm:mb-8"
        >
          <div className="relative h-full w-full rounded-xl overflow-hidden">
            {event.image_url ? (
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-lg">Нет изображения</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-2xl sm:text-4xl md:text-5xl font-bold text-white text-center px-4 max-w-3xl"
              >
                {event.title}
              </motion.h1>
            </div>
          </div>
        </motion.section>

        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {event.ticket_type && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-8 sm:mb-12"
            >
              <EventDetails
                date={eventDate}
                time={eventTime}
                location={event.location || "Не указано"}
                price={event.ticket_type.price}
                freeRegistration={event.ticket_type.free_registration}
              />
            </motion.section>
          )}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-8 sm:mb-12"
          >
            {event.ticket_type && (
              <div
                className={`bg-white p-5 sm:p-6 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto ${
                  displayStatus !== "Регистрация открыта" ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800 text-center">
                  {displayStatus}
                </h2>
                <EventRegistration
                  eventId={event.id}
                  eventTitle={event.title}
                  eventDate={eventDate}
                  eventTime={eventTime}
                  eventLocation={event.location || "Не указано"}
                  ticketType={event.ticket_type.name || "Стандартный"}
                  availableQuantity={availableQuantity}
                  soldQuantity={soldQuantity}
                  price={event.ticket_type.price}
                  freeRegistration={event.ticket_type.free_registration}
                  onBookingClick={handleBookingClick}
                  onLoginClick={handleLoginClick}
                  onBookingSuccess={fetchEvent}
                  displayStatus={displayStatus}
                />
                {!isAuth && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                    className="text-center mt-6 text-gray-700 font-medium bg-orange-50 py-3 px-4 sm:px-6 rounded-full shadow-sm border border-orange-100 max-w-md mx-auto text-sm sm:text-base"
                  >
                    Для бронирования билета{" "}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoginClick();
                      }}
                      className="text-orange-600 font-semibold hover:text-orange-700 underline transition-colors duration-200"
                    >
                      войдите в аккаунт
                    </button>
                  </motion.p>
                )}
              </div>
            )}
          </motion.section>

          {event.description && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800">Описание</h2>
              <FormattedDescription
                content={event.description}
                className="text-gray-600 leading-relaxed text-base"
              />
            </motion.section>
          )}
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {isModalOpen && (
          <AuthModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            title={isRegisterMode ? "Регистрация" : "Вход"}
          >
            {isRegisterMode ? (
              <Registration
                isOpen={isModalOpen}
                onClose={handleModalClose}
                toggleMode={toggleToLogin}
              />
            ) : (
              <Login
                isOpen={isModalOpen}
                onClose={handleModalClose}
                toggleMode={toggleToRegister}
              />
            )}
          </AuthModal>
        )}
      </AnimatePresence>
    </div>
  );
}