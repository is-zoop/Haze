import * as React from "react";
import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn("h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring", className)} {...props} />,
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
