// frontend/src/components/PageTransitionWrapper.tsx
"use client";
import React from "react";
// Убираем импорт motion
// import { motion } from "framer-motion"; 
import { usePathname } from "next/navigation";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

export default function PageTransitionWrapper({ 
  children, 
  disableLoading = false,
}: PageTransitionWrapperProps) {
  const pathname = usePathname(); // Оставляем, если вдруг нужен для чего-то еще
  
  // Просто рендерим children без обертки motion.div
  return (
    <>
      {children}
    </>
    /* Старый код:
    <motion.div
      key={`${pathname}-content`} 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full min-h-[100vh] relative"
    >
      {children}
    </motion.div>
    */
  );
}