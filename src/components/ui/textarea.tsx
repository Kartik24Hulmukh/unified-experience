import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onFocus={(e) => {
        // Scroll into view on mobile to prevent keyboard occlusion
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        }
        onFocus?.(e);
      }}
      {...props}
    />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
