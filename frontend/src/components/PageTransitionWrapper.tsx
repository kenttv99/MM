// src/components/PageTransitionWrapper.tsx
"use client";

import React, { useEffect, useRef } from "react";
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
  const hasInitialized = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reset loading state after component mount
  useEffect(() => {
    // Mark as initialized
    hasInitialized.current = true;
    
    // If disableLoading is true, immediately set loading to false
    if (disableLoading) {
      setPageLoading(false);
    }
    
    // Safety timeout to ensure loading state resets
    timeoutRef.current = setTimeout(() => {
      if (isPageLoading) {
        console.warn("PageTransitionWrapper: Safety timeout triggered to reset loading state");
        setPageLoading(false);
      }
    }, 5000);
    
    // Cleanup timeout on unmount and make sure loading is reset
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setPageLoading(false);
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