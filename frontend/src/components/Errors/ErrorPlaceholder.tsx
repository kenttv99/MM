"use client";

import React from "react";
import { motion } from "framer-motion";

const ErrorPlaceholder: React.FC = () => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] bg-gray-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center max-w-lg"
      >
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4"
          style={{ fontSize: "clamp(1.5rem, 4vw, 1.875rem)" }}
        >
          Ошибка загрузки
        </h1>
        <p
          className="text-gray-600 mb-6 overflow-wrap-break-word"
          style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}
        >
          Произошла ошибка при загрузке страницы. Попробуйте обновить страницу или свяжитесь с поддержкой, если проблема сохраняется.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-300 min-w-[120px] min-h-[44px]"
        >
          Обновить
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ErrorPlaceholder;