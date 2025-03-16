"use client"

import React from 'react';
import Image from 'next/image';

const Registration = () => {
  return (
    <section className="w-full py-16 bg-gradient-to-br from-blue-50 to-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500">
              Присоединяйтесь к нашим мероприятиям
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Moscow Mellows предлагает уникальные возможности для участия в культурных 
              и образовательных мероприятиях. Расширьте свой кругозор и найдите 
              единомышленников в нашем сообществе.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 mb-6">
              <input 
                type="email" 
                placeholder="Ваш email" 
                className="flex-grow px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                aria-label="Email адрес"
              />
              <button 
                type="submit" 
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-0.5"
              >
                Подписаться
              </button>
            </form>
            <p className="text-sm text-gray-500">
              Подпишитесь на нашу рассылку, чтобы первыми узнавать о новых событиях.
            </p>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-[1.02] transition-transform duration-500 ease-in-out">
              <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                СКОРО
              </div>
              <div className="relative w-full h-[240px] sm:h-[320px]">
                <Image 
                  src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                  alt="Мероприятие"
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="p-6">
                <div className="flex items-center mb-2">
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2.5 py-0.5 rounded-full">Концерт</span>
                  <span className="ml-2 text-sm text-gray-500">27 Апреля, 2025</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Весенний музыкальный фестиваль</h3>
                <p className="text-gray-600 mb-4 line-clamp-2">
                  Уникальная возможность насладиться живой музыкой в исполнении талантливых музыкантов. 
                  Не пропустите главное событие весны!
                </p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">1500 ₽</span>
                  <button className="text-blue-600 hover:text-blue-800 transition-colors duration-300 font-medium">
                    Подробнее →
                  </button>
                </div>
              </div>
            </div>
            {/* Декоративные элементы */}
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-blue-100 rounded-full -z-10 blur-xl"></div>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-100 rounded-full -z-10 blur-xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Registration;