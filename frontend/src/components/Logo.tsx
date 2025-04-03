// import React from 'react';
// import Image from 'next/image';

// const Logo = () => {
//   return (
//     <div className="flex items-center">
//       <div className="relative w-10 h-10 mr-2">
//         <Image 
//           src="/photo_2025-01-13_11-50-23.jpg" 
//           alt="Moscow Mellows Logo" 
//           fill
//           className="object-cover rounded-full"
//         />
//       </div>
//       <span className="ml-1 text-xl font-bold text-black">
//         Moscow Mellows
//       </span>
//     </div>
//   );
// };

// export default Logo;

import React from "react";
import Image from "next/image";

const Logo: React.FC = () => {
  return (
    <div className="inline-flex items-center min-w-[44px] min-h-[44px]">
      {/* Замените на компонент Image с относительным путем */}
      <Image 
        src="/photo_2025-01-13_11-50-23.jpg" // Укажите путь относительно папки public
        alt="Moscow Mellows Logo"
        width={40}
        height={40}
        className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500"
      />
      <span
        className="ml-2 text-black font-semibold hidden sm:inline"
        style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}
      >
        Moscow Mellows
      </span>
    </div>
  );
};

export default Logo;