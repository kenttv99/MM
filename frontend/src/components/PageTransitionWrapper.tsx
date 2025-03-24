// frontend/src/components/PageTransitionWrapper.tsx
"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Loading from "./Loading";

interface PageTransitionWrapperProps {
  children: ReactNode;
  disableLoading?: boolean;
}

const PageTransitionWrapper: React.FC<PageTransitionWrapperProps> = ({
  children,
  disableLoading = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResources = async () => {
      try {
        // Здесь можно добавить реальную логику загрузки ресурсов, если нужно
        await new Promise((resolve) => setTimeout(resolve, 500)); // Минимальная задержка
      } finally {
        setIsLoading(false);
      }
    };

    if (!disableLoading) {
      loadResources();
    } else {
      setIsLoading(false);
    }
  }, [disableLoading]);

  return (
    <>
      {isLoading && !disableLoading ? (
        <Loading />
      ) : (
        <motion.div
          initial={{ opacity: 0 }} // Только opacity, без y
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      )}
    </>
  );
};

export default PageTransitionWrapper;