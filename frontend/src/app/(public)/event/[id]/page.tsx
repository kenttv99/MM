// frontend/src/app/event/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams} from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventRegistration from "@/components/EventRegistration";
import Media from "@/components/Media";
import { notFound } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Login from "@/components/Login";

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
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { isAuth, checkAuth } = useAuth();

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/v1/public/events/${id}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Event not found");
        }
        const data = await res.json();
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchEvent();
    }
  }, [id]);

  // Добавляем слушатель события auth-change
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
        {/* Обложка с затемнением и названием */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative h-[400px] w-full"
        >
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
        </motion.section>

        {/* Основной контент */}
        <div className="container mx-auto px-4 py-12">
          {/* Зона регистрации */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-12"
          >
            {event.status === "registration_open" && event.ticket_type && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 text-center">
                  Регистрация открыта
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
                    className="text-gray-600 mt-4 text-center"
                  >
                    Пожалуйста,{" "}
                    <button
                      onClick={handleLoginRedirect}
                      className="text-blue-500 hover:text-blue-600 font-medium underline transition-colors duration-200"
                    >
                      авторизуйтесь
                    </button>{" "}
                    для регистрации.
                  </motion.p>
                )}
              </div>
            )}

            {event.status === "registration_closed" && (
              <p className="text-gray-500 text-center text-lg">
                Регистрация на мероприятие закрыта.
              </p>
            )}

            {event.status === "completed" && (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 text-center">
                  Мероприятие завершено
                </h2>
                <Media />
              </div>
            )}

            {event.status === "draft" && (
              <p className="text-gray-500 text-center text-lg">
                Мероприятие находится в черновике и недоступно для просмотра.
              </p>
            )}
          </motion.section>

          {/* Описание */}
          {event.description && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Описание</h2>
              <p className="text-gray-600 leading-relaxed">{event.description}</p>
            </motion.section>
          )}
        </div>
      </main>
      <Footer />

      {/* Модальное окно для авторизации */}
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