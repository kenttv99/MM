// frontend/src/components/PageTransitionWrapper.tsx
"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoadingFlags } from "@/contexts/loading";
import Loading from "@/components/Loading";
import { usePathname } from "next/navigation";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({ 
  children, 
  disableLoading = false,
}: PageTransitionWrapperProps) {
  const { isDynamicLoading, setDynamicLoading } = useLoadingFlags();
  const [showDynamicLoading, setShowDynamicLoading] = useState(false);
  const pathname = usePathname();
  
  useEffect(() => {
    setDynamicLoading(!disableLoading);
  }, [disableLoading, setDynamicLoading]);
  
  useEffect(() => {
    setShowDynamicLoading(isDynamicLoading && !disableLoading);
  }, [isDynamicLoading, disableLoading]);
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${pathname}-content`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full min-h-[100vh] relative"
      >
        {showDynamicLoading && (
          <motion.div
            key={`${pathname}-dynamic-loading`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center"
          >
            <Loading type="spinner" color="orange" size="medium" text="Загрузка данных..." />
          </motion.div>
        )}
        {children}
      </motion.div>
    </AnimatePresence>
  );
}