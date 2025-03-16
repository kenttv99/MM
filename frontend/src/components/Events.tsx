"use client"

import React, { useState } from 'react';
import Image from 'next/image';

// Моковые данные для событий
const eventCategories = ["Все", "Концерты", "Выставки", "Мастер-классы", "Фестивали"];

const eventsList = [
  {
    id: 1,
    title: "Джазовый вечер в центре города",
    category: "Концерты",
    date: "15 Мая, 2025",
    time: "19:00",
    location: "Джаз-клуб 'Мелодия'",
    price: "1200 ₽",
    image: "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 2,
    title: "Выставка современного искусства",
    category: "Выставки",
    date: "20 Мая, 2025",
    time: "10:00 - 20:00",
    location: "Галерея 'Арт-Москва'",
    price: "800 ₽",
    image: "https://images.unsplash.com/photo-1594122230689-45899d9e6f69?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 3,
    title: "Кулинарный мастер-класс: итальянская кухня",
    category: "Мастер-классы",
    date: "22 Мая, 2025",
    time: "14:00",
    location: "Кулинарная студия 'Гурман'",
    price: "3500 ₽",
    image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 4,
    title: "Фестиваль уличной еды",
    category: "Фестивали",
    date: "28-30 Мая, 2025",
    time: "12:00 - 22:00",
    location: "Парк Горького",
    price: "Вход свободный",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
  },
];

const Events = () => {
  const [activeCategory, setActiveCategory] = useState("Все");
  const [isHovered, setIsHovered] = useState<number | null>(null);

  const filteredEvents = activeCategory === "Все" 
    ? eventsList 
    : eventsList.filter(event => event.category === activeCategory);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Предстоящие <span className="text-blue-600">мероприятия</span></h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Откройте для себя разнообразные мероприятия, которые помогут вам насладиться городской жизнью и расширить круг общения.
          </p>
        </div>
        
        {/* Категории событий */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {eventCategories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium ${
                activeCategory === category
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Список событий */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredEvents.map((event) => (
            <div 
              key={event.id}
              className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1"
              onMouseEnter={() => setIsHovered(event.id)}
              onMouseLeave={() => setIsHovered(null)}
            >
              <div className="relative overflow-hidden h-48">
                <div className="relative w-full h-full">
                  <Image 
                    src={event.image} 
                    alt={event.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className={`object-cover transition-transform duration-700 ease-in-out ${
                      isHovered === event.id ? "scale-110" : "scale-100"
                    }`}
                  />
                </div>
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 m-2 rounded-full z-10">
                  {event.category}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center mb-2 text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {event.date} • {event.time}
                </div>
                <h3 className="text-lg font-bold mb-2 line-clamp-2">{event.title}</h3>
                <div className="flex items-center mb-3 text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.location}
                </div>
                <div className="flex justify-between items-center">
                  <div className="font-bold">{event.price}</div>
                  <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors duration-300">
                    Подробнее
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Кнопка "Показать больше" */}
        <div className="text-center mt-12">
          <button className="inline-flex items-center px-6 py-3 bg-white border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors duration-300">
            Все мероприятия
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default Events;