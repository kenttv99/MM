// frontend/src/components/PageTransitionWrapper.tsx
"use client"; // Добавляем, так как используем хуки

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoading } from "@/contexts/LoadingContext"; // Новый импорт
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";
import Loading from "@/components/Loading";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({ children, disableLoading = false }: PageTransitionWrapperProps) {
  const { isLoading } = useLoading(); // 
  const [hasServerError] = useState(false); 

  if (hasServerError) {
    return <ErrorPlaceholder />;
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading && !disableLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center min-h-[100vh] max-w-[100vw]"
        >
          <Loading type="spinner" color="orange" size="medium" />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-[100vh]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}