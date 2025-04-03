"use client";

import React from "react";

interface SwitchProps {
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({ name, checked, onChange, label, disabled }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`block w-12 h-6 rounded-full transition-colors duration-200 ${
            checked ? "bg-blue-500" : "bg-gray-300"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        <div
          className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 transform ${
            checked ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </div>
      {label && <span className="ml-2 text-gray-700 text-sm">{label}</span>}
    </label>
  );
};

export default Switch;