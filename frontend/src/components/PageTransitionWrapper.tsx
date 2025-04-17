// frontend/src/components/PageTransitionWrapper.tsx
"use client";
import React from "react";
// Убираем импорт motion
// import { motion } from "framer-motion"; 
// import { usePathname } from "next/navigation"; // Удаляем неиспользуемый импорт

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  // disableLoading?: boolean; // Удаляем неиспользуемый параметр
}

export default function PageTransitionWrapper({ 
  children
}: PageTransitionWrapperProps) {
  // const pathname = usePathname(); // Удаляем неиспользуемую переменную
  
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