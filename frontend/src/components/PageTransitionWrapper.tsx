// frontend/src/components/PageTransitionWrapper.tsx
"use client";

import { motion } from "framer-motion";

interface PageTransitionWrapperProps {
  children: React.ReactNode;
  disableLoading?: boolean;
}

const PageTransitionWrapper: React.FC<PageTransitionWrapperProps> = ({
  children,
  disableLoading = false,
}) => {
  if (disableLoading) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransitionWrapper;