// frontend/src/components/common/AuthModal.tsx
import React, { useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthModalProps, ModalButtonProps } from "@/types/index";
import { FaTimes } from "react-icons/fa";
import ClientErrorBoundary from "../Errors/ClientErrorBoundary";

const ModalButton: React.FC<ModalButtonProps> = ({
  type = "button",
  onClick,
  variant = "primary",
  disabled = false,
  children,
  className = "",
}) => {
  const baseStyles = "px-3 py-1.5 rounded-lg font-medium transition-colors duration-300 text-sm";
  const variantStyles =
    variant === "primary"
      ? "bg-orange-500 text-white hover:bg-orange-600"
      : "bg-gray-200 text-gray-700 hover:bg-gray-300";
  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
};

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  error, 
  success, 
  children,
  preventClose = false
}) => {
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  useLayoutEffect(() => {
    const originalPaddingRight = document.body.style.paddingRight;
    if (isOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollBarWidth}px`;
      document.body.classList.add('body-scroll-locked');
    } else {
      document.body.classList.remove('body-scroll-locked');
      document.body.style.paddingRight = originalPaddingRight;
    }
    return () => {
      document.body.classList.remove('body-scroll-locked');
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  const handleClose = () => {
    // Если стоит флаг preventClose, не закрываем модальное окно
    if (preventClose) {
      console.log('Modal close prevented due to preventClose flag');
      return;
    }
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на контент
          >
            <button
              onClick={handleClose}
              className={`absolute top-4 right-4 text-gray-500 hover:text-gray-700 ${preventClose ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={preventClose}
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">{title}</h2>
            <ClientErrorBoundary>
              {error && (
                <div className="mb-3 p-1.5 sm:p-2 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-xs">
                  <p className="whitespace-pre-wrap break-words">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-3 p-1.5 sm:p-2 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md text-xs">
                  <p className="whitespace-pre-wrap break-words">{success}</p>
                </div>
              )}
              {children}
            </ClientErrorBoundary>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
export { ModalButton };