// Обновление файла: frontend/src/components/Loading.tsx
import React from "react";
import { motion } from "framer-motion";

interface LoadingProps {
  /**
   * Цвет индикатора загрузки
   * @default 'orange'
   */
  color?: 'orange' | 'blue' | 'green' | 'red' | 'gray';
  
  /**
   * Размер индикатора загрузки
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Тип индикатора загрузки
   * @default 'spinner'
   */
  type?: 'spinner' | 'dots' | 'pulse';
  
  /**
   * Текст, отображаемый под индикатором загрузки
   */
  text?: string;
  
  /**
   * Плавное появление/исчезновение индикатора
   * @default true
   */
  fadeEffect?: boolean;
  
  /**
   * CSS класс для контейнера
   */
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({ 
  color = 'orange', 
  size = 'medium', 
  type = 'spinner',
  text = 'Loading...',
  fadeEffect = true,
  className = ''
}) => {
  // Определение размеров
  const sizeMap = {
    small: { spinner: 'w-8 h-8', dots: 'w-2 h-2', text: 'text-sm' },
    medium: { spinner: 'w-16 h-16', dots: 'w-3 h-3', text: 'text-base' },
    large: { spinner: 'w-24 h-24', dots: 'w-4 h-4', text: 'text-lg' },
  };
  
  // Определение цветов
  const colorMap = {
    orange: { border: 'border-orange-500', bg: 'bg-orange-500', text: 'text-orange-500' },
    blue: { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-500' },
    green: { border: 'border-green-500', bg: 'bg-green-500', text: 'text-green-500' },
    red: { border: 'border-red-500', bg: 'bg-red-500', text: 'text-red-500' },
    gray: { border: 'border-gray-500', bg: 'bg-gray-500', text: 'text-gray-500' },
  };

  const selectedSize = sizeMap[size];
  const selectedColor = colorMap[color];
  
  const containerClasses = `
    flex flex-col items-center justify-center
    ${fadeEffect ? 'animate-fade-in' : ''}
    ${className}
  `;
  
  return (
    <div className={containerClasses}>
      {type === 'spinner' && (
        <div className={`relative ${selectedSize.spinner}`}>
          <div className={`absolute inset-0 rounded-full border-4 border-t-${selectedColor.border} border-r-transparent border-b-transparent border-l-transparent animate-spin`}></div>
          <div className={`absolute inset-1 rounded-full border-4 border-t-transparent border-r-${selectedColor.border} border-b-transparent border-l-transparent animate-spin`} style={{ animationDuration: '1s', animationDirection: 'reverse' }}></div>
          <div className={`absolute inset-2 rounded-full border-4 border-t-transparent border-r-transparent border-b-${selectedColor.border} border-l-transparent animate-spin`} style={{ animationDuration: '1.5s' }}></div>
          <div className={`absolute inset-3 rounded-full border-4 border-t-transparent border-r-transparent border-b-transparent border-l-${selectedColor.border} animate-spin`} style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
        </div>
      )}
      
      {type === 'dots' && (
        <div className="flex space-x-2">
          <motion.div
            className={`${selectedSize.dots} rounded-full ${selectedColor.bg}`}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: 'loop', times: [0, 0.5, 1] }}
          />
          <motion.div
            className={`${selectedSize.dots} rounded-full ${selectedColor.bg}`}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.8, delay: 0.2, repeat: Infinity, repeatType: 'loop', times: [0, 0.5, 1] }}
          />
          <motion.div
            className={`${selectedSize.dots} rounded-full ${selectedColor.bg}`}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.8, delay: 0.4, repeat: Infinity, repeatType: 'loop', times: [0, 0.5, 1] }}
          />
        </div>
      )}
      
      {type === 'pulse' && (
        <motion.div 
          className={`${selectedSize.spinner} ${selectedColor.bg} rounded-full`}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: 'loop' }}
        />
      )}
      
      {text && (
        <span className={`mt-4 ${selectedColor.text} font-semibold ${selectedSize.text}`}>
          {text}
        </span>
      )}
    </div>
  );
};

export default Loading;