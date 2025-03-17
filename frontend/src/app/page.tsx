"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser, FaCalendarAlt, FaVideo, FaArrowRight } from "react-icons/fa";

export default function PublicHomePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }} /* Обновлено */
          className="fixed inset-0 flex items-center justify-center z-50 overflow-hidden"
        >
          <Loading />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: "easeInOut" }} /* Обновлено */
        >
          <Header />

          {/* Главный контент с отступом для фиксированного хедера */}
          <main className="flex-grow flex flex-col justify-center items-center pt-24 pb-16 px-4 min-h-[calc(100vh-120px)]">
            <h1 className="text-4xl font-bold text-center mb-12">MOSCOW MELLOWS</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
              {/* Карточка регистрации */}
              <Link href="/registration" className="group">
                <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
                    <FaUser className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Регистрация</h3>
                  <p className="text-gray-700 flex-grow">
                    Создайте личный кабинет на нашей платформе, чтобы открыть возможность регистрации на мероприятия.
                  </p>
                  <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
                    Зарегистрироваться
                    <FaArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </Link>

              {/* Карточка мероприятий */}
              <Link href="/events" className="group">
                <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
                    <FaCalendarAlt className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Мероприятия</h3>
                  <p className="text-gray-700 flex-grow">
                    Прошедшие и запланированные мероприятия.
                  </p>
                  <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
                    Смотреть мероприятия
                    <FaArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </Link>

              {/* Карточка медиа */}
              <Link href="/media" className="group">
                <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
                    <FaVideo className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-4">Медиа</h3>
                  <p className="text-gray-700 flex-grow">
                    Фото, видео и аудио с наших мероприятий.
                  </p>
                  <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
                    Смотреть медиа
                    <FaArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </Link>
            </div>
          </main>

          <Footer />
        </motion.div>
      )}
    </AnimatePresence>
  );
}