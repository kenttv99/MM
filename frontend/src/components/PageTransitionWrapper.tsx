// frontend/src/components/PageTransitionWrapper.tsx
"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePageLoad } from "@/contexts/PageLoadContext";
import Loading from "@/components/Loading";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({
  children,
  disableLoading = false,
}: PageTransitionWrapperProps) {
  const { isPageLoading, setPageLoading } = usePageLoad();
  
  // Reset loading state after component mount
  useEffect(() => {
    // If disableLoading is true, immediately set loading to false
    if (disableLoading) {
      setPageLoading(false);
    }
    
    // Add a safety timeout to ensure loading state resets
    const safetyTimeout = setTimeout(() => {
      if (isPageLoading) {
        console.warn("PageTransitionWrapper: Safety timeout triggered to reset loading state");
        setPageLoading(false);
      }
    }, 5000);
    
    // Cleanup timeout on unmount
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [disableLoading, setPageLoading, isPageLoading]);

  return (
    <AnimatePresence mode="wait">
      {isPageLoading && !disableLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-white dark:bg-black bg-opacity-70 dark:bg-opacity-70 z-50 flex items-center justify-center"
        >
          <Loading type="spinner" color="orange" size="large" text="Загрузка..." fadeEffect />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
          onAnimationComplete={() => {
            // Ensure loading is off once content is displayed
            if (isPageLoading) {
              setPageLoading(false);
            }
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}