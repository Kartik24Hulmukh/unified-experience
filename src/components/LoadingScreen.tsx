import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingScreen: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >       
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Glowing loader */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute h-full w-full animate-ping rounded-full border-2 border-primary/20"></div>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        
        {/* Brand Text skeleton equivalent */}
        <div className="flex flex-col items-center space-y-2">
          <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded-md bg-muted/60" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
