import React from "react";

const Loading = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 overflow-hidden">
      <div className="animate-spin-slow rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-500"></div>
    </div>
  );
};

export default Loading;