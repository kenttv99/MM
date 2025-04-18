"use client";

import React from 'react';
// import Header from '@/components/Header'; // Header теперь рендерится в layout, импорт не нужен
import Footer from '@/components/Footer';
import Link from 'next/link';
// import { useLoading } from "@/contexts/loading/LoadingContextLegacy"; // Старый импорт
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext'; // Новый импорт

const PartnerPageContent = () => {
  // const { setStaticLoading } = useLoading(); // Старый хук
  const { setStaticLoading } = useLoadingFlags(); // Новый хук

  React.useEffect(() => {
    setStaticLoading(false); // Статическая страница
  }, [setStaticLoading]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-grow flex flex-col justify-center items-center pt-24 pb-16 px-4 min-h-[calc(100vh-120px)]">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md overflow-hidden p-8 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Страница партнеров</h1>
          <p className="text-gray-600 mb-6">
            Эта страница находится в разработке. Скоро здесь появится информация о наших партнерах и возможностях сотрудничества.
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
    </div>
  );
};

export default PartnerPageContent;