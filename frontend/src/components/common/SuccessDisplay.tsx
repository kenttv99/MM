// frontend/src/components/common/SuccessDisplay.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SuccessDisplayProps } from "@/types/index";


const SuccessDisplay: React.FC<SuccessDisplayProps> = ({ message, className = '' }) => {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className={`text-green-600 bg-green-50 p-3 rounded-lg border-l-4 border-green-500 text-sm ${className}`}>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessDisplay;