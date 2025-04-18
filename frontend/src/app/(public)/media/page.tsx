"use client";

import React from 'react';
// import Header from '@/components/Header'; // Header рендерится в layout, импорт не нужен
import Footer from '@/components/Footer';
import Link from 'next/link';
// import { useLoading } from "@/contexts/LoadingContextLegacy"; // Старый импорт
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext'; // Новый импорт

const MediaPageContent = () => {
  // const { setStaticLoading } = useLoading(); // Старый хук
  const { setStaticLoading } = useLoadingFlags(); // Новый хук

  React.useEffect(() => {
    setStaticLoading(false); // Статическая страница
  }, [setStaticLoading]);

  return (
    <>
      <main className="flex-grow flex flex-col justify-center items-center pt-24 pb-16 px-4 min-h-[calc(100vh-120px)]">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md overflow-hidden p-8 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Медиа – Moscow Mellows</h1>
          <p className="text-gray-600 mb-6">
            Медиа-страница Moscow Mellows. Здесь вы найдете фото, видео и аудио материалы с наших мероприятий.
          </p>
          <Link 
            href="/" 
            className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-300"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Вернуться на главную
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default MediaPageContent;