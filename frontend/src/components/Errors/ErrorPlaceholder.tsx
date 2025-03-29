// frontend/src/components/Errors/ErrorPlaceholder.tsx
"use client";

import React from 'react';

const ErrorPlaceholder: React.FC = () => {
  const handleRefresh = () => {
    // Выполняем полное обновление страницы
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4 sm:px-6">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Технические неполадки</h1>
        <p className="text-gray-600 mb-6 text-base">
          Произошла ошибка при загрузке данных. Пожалуйста, попробуйте обновить страницу.
        </p>
        <button
          onClick={handleRefresh}
          className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-300 shadow-md hover:shadow-lg text-base min-h-[44px]"
        >
          Обновить страницу
        </button>
        {/* Место для будущих контактов */}
        <p className="text-gray-500 text-sm mt-4">
          Если проблема сохраняется, свяжитесь с нами (контакты скоро будут добавлены).
        </p>
      </div>
    </div>
  );
};

export default ErrorPlaceholder;