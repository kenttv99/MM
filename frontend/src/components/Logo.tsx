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
      <Image 
        src="/photo_2025-01-13_11-50-23.jpg"
        alt="Moscow Mellows Logo"
        width={48}
        height={48}
        className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500"
      />
      <span
        className="ml-2 text-black font-semibold hidden sm:inline"
        style={{ fontSize: "clamp(1rem, 2vw, 1.125rem)" }}
      >
        Moscow Mellows
      </span>
    </div>
  );
};

export default Logo;