// frontend/src/components/common/InputField.tsx
import React, { useState } from "react"; 
import { InputFieldProps } from "@/types/index";


const InputField: React.FC<InputFieldProps> = ({
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
  required = true,
  name,
  disabled = false,
  onBlur, // Добавляем в деструктуризацию
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mb-2 h-[50px] sm:h-[55px]">
      <div className="absolute inset-0">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          name={name}
          disabled={disabled}
          className={`
            w-full h-full p-3 pr-10
            bg-white text-gray-900 
            placeholder:text-gray-400 
            rounded-lg outline-none
            border text-sm
            ${disabled ? 'bg-gray-50 opacity-70 cursor-not-allowed' : ''}
          `}
          style={{
            borderColor: isFocused ? "#f97316" : "#e5e7eb",
            borderWidth: "1px",
            transition: "border-color 0.5s ease-out",
            // Box-shadow создает эффект увеличения нижней границы без изменения размеров элемента
            boxShadow: isFocused 
              ? "inset 0 -2px 0 #f97316" 
              : "inset 0 0 0 transparent",
            transitionProperty: "border-color, box-shadow",
            transitionDuration: "0.5s",
            transitionTimingFunction: "ease-out"
          }}
          required={required}
          onFocus={() => !disabled && setIsFocused(true)}
          onBlur={(e) => { // Обновляем обработчик
            setIsFocused(false);
            if (onBlur) onBlur(e); // Вызываем переданный onBlur, если он есть
          }}
        />
        
        {/* Иконка с плавной анимацией цвета */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <Icon 
            className="transition-colors duration-500"
            style={{
              color: isFocused ? "#f97316" : (disabled ? "#d1d5db" : "#9ca3af") // orange-500 : gray-400 or gray-300 if disabled
            }}
            size={16}
          />
        </div>
      </div>
    </div>
  );
};

export default InputField;