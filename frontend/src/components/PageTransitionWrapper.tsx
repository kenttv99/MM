// frontend/src/components/PageTransitionWrapper.tsx

"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePageLoad } from "@/contexts/PageLoadContext";
import ErrorPlaceholder from "@/components/Errors/ErrorPlaceholder";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({ children, disableLoading = false }: PageTransitionWrapperProps) {
  const { isPageLoading, hasServerError } = usePageLoad();

  if (hasServerError) {
    return <ErrorPlaceholder />;
  }

  return (
    <AnimatePresence mode="wait">
      {isPageLoading && !disableLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center"
        >
          Загрузка...
        </motion.div>
      ) : (
        <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}