import React from 'react';
import Link from 'next/link';
import { PartnerButtonProps } from "@/types/index";

const PartnerButton = ({ onClick }: PartnerButtonProps) => {
  return (
    <Link 
      href="/partner" 
      className="inline-flex items-center px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg 
                shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out"
      onClick={onClick}
    >
      Стать партнером
    </Link>
  );
};

export default PartnerButton;