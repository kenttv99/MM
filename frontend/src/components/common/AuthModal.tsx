// frontend/src/components/common/AuthModal.tsx
"use client";

import React, { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Types for ModalButton props
interface ModalButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  children: ReactNode;
}

// Button component with animations
export const ModalButton: React.FC<ModalButtonProps> = ({ 
  type = "button", 
  onClick, 
  variant = "primary", 
  disabled = false,
  children 
}) => (
  <motion.button
    whileHover={{ scale: disabled ? 1 : 1.01 }}
    whileTap={{ scale: disabled ? 1 : 0.99 }}
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`
      px-6 py-3 rounded-lg transition-all duration-300
      ${variant === "primary" 
        ? `bg-orange-500 text-white ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600'}` 
        : `bg-gray-100 text-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'} border border-gray-200`}
    `}
  >
    {children}
  </motion.button>
);

// Types for AuthModal props
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  error?: string;
  success?: string;
  children: ReactNode;
}

// Modal wrapper component
const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  error,
  success,
  children 
}) => {
  // Only render when isOpen is true
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" // Изменяем фон на более темный
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 300 
            }}
            className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">{title}</h2>
            
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="text-red-500 mb-6 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm">
                  {error}
                </div>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="text-green-600 mb-6 bg-green-50 p-3 rounded-lg border-l-4 border-green-500 text-sm">
                  {success}
                </div>
              </motion.div>
            )}
            
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;