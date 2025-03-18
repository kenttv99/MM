// frontend/src/components/Loading.tsx
import React from "react";

const Loading = () => {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-20" style={{ overflow: 'hidden' }}>
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          {/* Multiple circles with staggered animations */}
          <div className="absolute inset-0 rounded-full border-4 border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <div className="absolute inset-1 rounded-full border-4 border-t-transparent border-r-orange-400 border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-2 rounded-full border-4 border-t-transparent border-r-transparent border-b-orange-300 border-l-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-transparent border-b-transparent border-l-orange-200 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
        </div>
        <span className="mt-4 text-orange-500 font-semibold">Loading...</span>
      </div>
    </div>
  );
};

export default Loading;