"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const PartnerButton: React.FC = () => {
  return (
    <Link href="/partner" passHref>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-300 shadow-md min-w-[120px] min-h-[44px] overflow-hidden text-ellipsis whitespace-nowrap"
      >
        <span style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>Стать партнером</span>
      </motion.button>
    </Link>
  );
};

export default PartnerButton;