// frontend/src/app/(public)/page.tsx
import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PublicHomePage() {
  return (
    <>
      <Header />
      
      {/* Главный контент с отступом для фиксированного хедера */}
      <main className="flex-grow flex flex-col justify-center items-center pt-24 pb-16 px-4 min-h-[calc(100vh-120px)]">
        <h1 className="text-4xl font-bold text-center mb-12">Добро пожаловать в Moscow Mellows</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          {/* Карточка регистрации */}
          <Link href="/registration" className="group">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-4">Регистрация</h3>
              <p className="text-gray-700 flex-grow">
                Зарегистрируйтесь на нашей платформе, чтобы получить доступ ко всем возможностям и событиям.
              </p>
              <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
                Зарегистрироваться
                <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
          
          {/* Карточка мероприятий */}
          <Link href="/events" className="group">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-4">Мероприятия</h3>
              <p className="text-gray-700 flex-grow">
                Просмотрите список предстоящих мероприятий и выберите те, которые вам интересны.
              </p>
              <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
                Смотреть мероприятия
                <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
          
          {/* Карточка медиа */}
          <Link href="/media" className="group">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-4">Медиа</h3>
              <p className="text-gray-700 flex-grow">
                Ознакомьтесь с фото и видео материалами с прошедших мероприятий.
              </p>
              <div className="mt-4 text-orange-500 group-hover:text-orange-600 flex items-center">
                Смотреть медиа
                <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </main>
      
      <Footer />
    </>
  );
}