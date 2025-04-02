import React from "react";

const Logo: React.FC = () => {
  return (
    <div className="inline-flex items-center min-w-[44px] min-h-[44px]">
      <svg
        viewBox="0 0 40 40"
        className="w-8 h-8 sm:w-10 sm:h-10 fill-current text-orange-500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 20h16M20 12v16" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span
        className="ml-2 text-orange-500 font-semibold hidden sm:inline"
        style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}
      >
        Moscow Mellows
      </span>
    </div>
  );
};

export default Logo;