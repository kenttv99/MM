import React from 'react';
import { useLoading } from '@/contexts/LoadingContextLegacy';

const GlobalSpinner: React.FC = () => {
  const { isStaticLoading, isDynamicLoading } = useLoading();

  if (!isStaticLoading && !isDynamicLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <div className="relative">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSpinner; 