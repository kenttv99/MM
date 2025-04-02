"use client"

import React, { useState } from 'react';
import Image from 'next/image';

// Моковые данные для галереи
const mediaItems = [
  {
    id: 1,
    type: 'image',
    url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    title: 'Летний музыкальный фестиваль 2024',
    category: 'Концерты'
  },
  {
    id: 2,
    type: 'image',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    title: 'Мастер-класс по живописи',
    category: 'Мастер-классы'
  },
  {
    id: 3,
    type: 'image',
    url: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    title: 'Театральная постановка "Вишневый сад"',
    category: 'Театр'
  },
  {
    id: 4,
    type: 'image',
    url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    title: 'Рок-концерт в клубе "Атмосфера"',
    category: 'Концерты'
  },
  {
    id: 5,
    type: 'image',
    url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6a3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    title: 'Выставка современного искусства',
    category: 'Выставки'
  },
  {
    id: 6,
    type: 'image',
    url: 'https://images.unsplash.com/photo-1560439514-4e9645039924?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    title: 'Фестиваль уличной еды',
    category: 'Фестивали'
  }
];

const Media = () => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const openModal = (id: number) => {
    setSelectedImage(id);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setSelectedImage(null);
    document.body.style.overflow = "auto";
  };

  const selectedItem = selectedImage !== null ? mediaItems.find(item => item.id === selectedImage) : null;

  return (
    <section className="py-10 sm:py-20 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontSize: "clamp(1.5rem, 4vw, 1.875rem)" }}>
            Медиа <span className="text-blue-600">галерея</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
            Взгляните на яркие моменты с наших прошедших мероприятий. Присоединяйтесь к нам, чтобы стать частью следующих событий!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
              onClick={() => openModal(item.id)}
            >
              <div className="aspect-[4/3] overflow-hidden relative">
                <Image
                  src={item.url}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <div className="text-xs font-medium mb-1 opacity-75">{item.category}</div>
                  <h3 className="font-bold" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>{item.title}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 sm:mt-12">
          <button
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-300 min-w-[200px] min-h-[44px]"
          >
            Смотреть все медиа
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

        {selectedImage !== null && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={closeModal}>
            <div className="relative max-w-[90vw] max-h-[90vh] w-full overflow-auto" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors duration-200 z-10 min-w-[44px] min-h-[44px]"
                aria-label="Закрыть"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {selectedItem && (
                <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
                  <div className="relative w-full h-[80vh]">
                    <Image
                      src={selectedItem.url}
                      alt={selectedItem.title}
                      fill
                      sizes="90vw"
                      className="object-contain"
                    />
                  </div>
                  <div className="p-4 bg-white">
                    <div className="text-sm text-blue-600 font-medium mb-1">{selectedItem.category}</div>
                    <h3 className="text-lg sm:text-xl font-bold mb-1" style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)" }}>{selectedItem.title}</h3>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Media;