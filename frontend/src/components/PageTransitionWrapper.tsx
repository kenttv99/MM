// frontend/src/components/PageTransitionWrapper.tsx
"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoading } from "@/contexts/LoadingContext";
import Loading from "@/components/Loading";
import { usePathname } from "next/navigation";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({ children, disableLoading = false }: PageTransitionWrapperProps) {
  const { isStaticLoading, isDynamicLoading } = useLoading();
  const pathname = usePathname();

  if (isStaticLoading && !disableLoading) {
    return (
      <motion.div
        key={`${pathname}-static-loading`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-white z-50 flex items-center justify-center min-h-[100vh]"
      >
        <Loading type="spinner" color="orange" size="medium" text="Загрузка..." />
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${pathname}-content`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full min-h-[100vh] relative"
      >
        {isDynamicLoading && !disableLoading && (
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