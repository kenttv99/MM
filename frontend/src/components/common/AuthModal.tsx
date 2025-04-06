// frontend/src/components/common/AuthModal.tsx
import React from "react";
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
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors duration-300";
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

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, title, error, success, children }) => {
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg p-6 w-full max-w-md relative"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <ClientErrorBoundary>
              {error && (
                <div className="mb-4 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-xs">
                  <p className="font-medium">Ошибка</p>
                  <p>{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 p-2 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md text-xs">
                  <p className="font-medium">Успешно</p>
                  <p>{success}</p>
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