// frontend/src/app/(public)/event/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import FormattedDescription from "@/components/FormattedDescription"; // Import the new component
import { notFound } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Login from "@/components/Login";
import { apiFetch } from "@/utils/api";

interface EventData {
  id: number;
  title: string;
  description?: string;
  status: "draft" | "registration_open" | "registration_closed" | "completed";
  ticket_type?: {
    name: string;
    price: number;
    available_quantity: number;
    free_registration: boolean;
  };
  image_url?: string;
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { isAuth, checkAuth } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      const eventId = extractIdFromSlug(slug);
      try {
        const res = await apiFetch(`/v1/public/events/${eventId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Event not found or not published");
        }
        const data: EventData = await res.json();
        if (!data.published) {
          throw new Error("Event is not published");
        }
        setEvent(data);

        // Проверяем, нужно ли перенаправить на правильный slug
        const correctSlug = generateSlug(data.title, data.id);
        if (slug !== correctSlug && !hasRedirected) {
          setHasRedirected(true);
          router.replace(`/event/${correctSlug}`, { scroll: false });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка");
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchEvent();
    }
  }, [slug, router, hasRedirected]);

  useEffect(() => {
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, [checkAuth]);

  const handleLoginRedirect = () => {
    setIsLoginModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !event) {
    return notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative h-[400px] w-full px-4 sm:px-6 lg:px-8 mt-16 mb-8"
        >
          <div className="relative h-full w-full rounded-xl overflow-hidden">
            {event.image_url ? (
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
                priority
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
                className="text-4xl md:text-5xl font-bold text-white text-center px-4"
              >
                {event.title}
              </motion.h1>
            </div>
          </div>
        </motion.section>

        <div className="container mx-auto px-4 py-12">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-12"
          >
            {event.ticket_type && (
              <div className={`bg-white p-6 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto ${event.status !== "registration_open" ? "opacity-50 pointer-events-none" : ""}`}>
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 text-center">
                  {event.status === "registration_open" ? "Регистрация открыта" : 
                   event.status === "registration_closed" ? "Регистрация закрыта" :
                   event.status === "completed" ? "Мероприятие завершено" : "Черновик"}
                </h2>
                <EventRegistration
                  eventId={event.id}
                  availableQuantity={event.ticket_type.available_quantity}
                  price={event.ticket_type.price}
                  freeRegistration={event.ticket_type.free_registration}
                />
                {!isAuth && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                    className="text-center mt-6 text-gray-700 font-medium bg-orange-50 py-3 px-6 rounded-full shadow-sm border border-orange-100 max-w-md mx-auto"
                  >
                    Для регистрации на мероприятие{" "}
                    <button
                      onClick={handleLoginRedirect}
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
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Описание</h2>
              
              {/* Заменяем обычный параграф на компонент FormattedDescription */}
              <FormattedDescription 
                content={event.description} 
                className="text-gray-600 leading-relaxed"
              />
            </motion.section>
          )}
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {isLoginModalOpen && (
          <Login
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}