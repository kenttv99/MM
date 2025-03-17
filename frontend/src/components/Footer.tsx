"use client";

import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-white pt-12 pb-8 border-t border-gray-100 shadow-inner">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8 justify-content-center">

          {/* Первая колонка - Быстрые ссылки */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4">Быстрые ссылки</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-600 hover:text-orange-500 transition-colors duration-300">
                  Главная
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-gray-600 hover:text-orange-500 transition-colors duration-300">
                  Мероприятия
                </Link>
              </li>
              <li>
                <Link href="/media" className="text-gray-600 hover:text-orange-500 transition-colors duration-300">
                  Медиа
                </Link>
              </li>
              <li>
                <Link href="/partner" className="text-gray-600 hover:text-orange-500 transition-colors duration-300">
                  Стать партнером
                </Link>
              </li>
            </ul>
          </div>

          {/* Вторпя колонка - О нас */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4">Moscow Mellows</h3>
            <p className="text-gray-600 mb-4 text-center">
              Vrindavan в центре Москвы.<br/>Присоединяйтесь к нам!
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-pink-600 transition-colors duration-300"
                aria-label="Instagram"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
              <a 
                href="https://t.me" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-blue-500 transition-colors duration-300"
                aria-label="Telegram"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            </div>
          </div>
          
          {/* Третья колонка - Действия */}
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4">Действия</h3>
            <div className="space-y-3">
              <Link 
                href="/registration" 
                className="block w-full px-4 py-2 text-center bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors duration-300"
              >
                Регистрация на мероприятие
              </Link>
              <Link 
                href="/events" 
                className="block w-full px-4 py-2 text-center bg-white border border-orange-500 text-orange-500 font-medium rounded-lg hover:bg-orange-50 transition-colors duration-300"
              >
                Наши мероприятия
              </Link>
            </div>
          </div>
        </div>
        
        {/* Нижняя часть футера с копирайтом */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 text-sm mb-4 md:mb-0">
              © Moscow Mellows {new Date().getFullYear()}. Все права защищены.
            </p>
            <div className="flex space-x-4">
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-orange-500 transition-colors duration-300">
                Политика конфиденциальности
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-orange-500 transition-colors duration-300">
                Условия использования
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;