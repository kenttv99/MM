// frontend/src/components/common/ErrorDisplay.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorDisplayProps } from "@/types/index";

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, className = '' }) => {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className={`text-red-500 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm ${className}`}>
            {error}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ErrorDisplay;