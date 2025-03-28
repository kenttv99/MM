// frontend/src/components/Errors/ErrorPlaceholder.tsx
"use client";

import React from 'react';

const ErrorPlaceholder: React.FC = () => {
  const handleRefresh = () => {
    // Выполняем полное обновление страницы
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Технические неполадки</h1>
        <p className="text-gray-600 mb-6">
          Произошла ошибка при загрузке данных. Пожалуйста, попробуйте обновить страницу.
        </p>
        <button
          onClick={handleRefresh}
          className="btn btn-primary w-full"
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