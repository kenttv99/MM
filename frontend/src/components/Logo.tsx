import React from 'react';
import Image from 'next/image';

const Logo = () => {
  return (
    <div className="flex items-center">
      <div className="relative w-10 h-10 mr-2">
        <Image 
          src="/photo_2025-01-13_11-50-23.jpg" 
          alt="Moscow Mellows Logo" 
          fill
          className="object-cover rounded-full"
        />
      </div>
      <span className="ml-1 text-xl font-bold text-black">
        Moscow Mellows
      </span>
    </div>
  );
};

export default Logo;