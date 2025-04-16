"use client";

import React from "react";
import Link from "next/link";
import { FaArrowLeft, FaRedo, FaSadTear } from "react-icons/fa";
import Header from "./Header";
import { clear404Cache } from "@/utils/api";

interface NotFound404Props {
  title?: string;
  message?: string;
  backUrl?: string;
  backLabel?: string;
  showRetryButton?: boolean;
  useHistoryBack?: boolean;
  onRetry?: () => void;
}

const NotFound404: React.FC<NotFound404Props> = ({
  title = "Страница не найдена",
  message = "К сожалению, страница или мероприятие, которое вы ищете, не существует или было удалено.",
  backUrl = "/events",
  backLabel = "Перейти к мероприятиям",
  showRetryButton = false,
  useHistoryBack = false,
  onRetry = () => {
    // Очищаем потенциальные данные кэшированных 404 ошибок
    sessionStorage.removeItem('last_404_endpoint');
    sessionStorage.removeItem('last_404_timestamp');
    
    // Очищаем глобальный кэш 404 ошибок
    clear404Cache();
    
    // Если указано использовать history.back(), возвращаемся назад без перезагрузки
    if (useHistoryBack) {
      window.history.back();
    } else {
      // Иначе перезагружаем текущую страницу
      window.location.reload();
    }
  }
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
        <div className="text-center max-w-md w-full">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center">
              <FaSadTear className="text-white text-4xl" />
            </div>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
            {title}
          </h1>
          
          <p className="text-gray-600 mb-8">
            {message}
          </p>
          
          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            {showRetryButton && (
              <button
                onClick={onRetry}
                className="flex items-center justify-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-md w-full transition-colors hover:bg-blue-600"
              >
                <FaRedo />
                Повторить запрос
              </button>
            )}
            
            <Link href={backUrl} className="block w-full">
              <button
                className="flex items-center justify-center gap-2 bg-orange-500 text-white py-2 px-4 rounded-md w-full transition-colors hover:bg-orange-600"
              >
                <FaArrowLeft />
                {backLabel}
              </button>
            </Link>
          </div>
        </div>
        
        <div className="mt-8 text-gray-500 text-sm text-center">
          <p>Если вы считаете, что произошла ошибка, пожалуйста, свяжитесь с нами.</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound404;
