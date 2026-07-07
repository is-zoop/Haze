import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface ComboboxContextType {
  value?: any;
  onValueChange?: (val: any) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  items: any[];
  itemsMap?: Record<string, string>; // Maps value to label
  placeholder?: string;
}

const ComboboxContext = createContext<ComboboxContextType | null>(null);

export function useComboboxContext() {
  const context = useContext(ComboboxContext);
  if (!context) {
    throw new Error("Combobox subcomponents must be rendered within a Combobox provider");
  }
  return context;
}

interface ComboboxProps {
  items: any[]; // can be Array of strings/numbers, or Array of { value, label }
  value?: any;
  onValueChange?: (value: any) => void;
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
}

export function Combobox({
  items,
  value,
  onValueChange,
  children,
  className,
  placeholder = "请选择...",
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Standardize items array as objects if they are primitive strings
  const normalizedItems = React.useMemo(() => {
    return items.map((item) => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return { value: String(item), label: String(item), raw: item };
      }
      return {
        value: String(item.value),
        label: String(item.label || item.value),
        raw: item,
      };
    });
  }, [items]);

  const itemsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    normalizedItems.forEach((item) => {
      map[item.value] = item.label;
    });
    return map;
  }, [normalizedItems]);

  return (
    <ComboboxContext.Provider
      value={{
        value,
        onValueChange,
        isOpen,
        setIsOpen,
        searchQuery,
        setSearchQuery,
        items: normalizedItems,
        itemsMap,
        placeholder,
      }}
    >
      <div ref={containerRef} className={cn("relative inline-block w-full text-left font-sans", className)}>
        {children}
      </div>
    </ComboboxContext.Provider>
  );
}

interface ComboboxInputProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  placeholder?: string;
  className?: string;
}

export function ComboboxInput({ placeholder, className, children, ...props }: ComboboxInputProps) {
  const { value, itemsMap, isOpen, setIsOpen, placeholder: ctxPlaceholder } = useComboboxContext();
  
  const displayLabel = value !== undefined && value !== null && itemsMap 
    ? itemsMap[String(value)] || String(value) 
    : (placeholder || ctxPlaceholder);

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs outline-hidden hover:bg-slate-50 cursor-pointer focus:border-slate-300 focus:ring-1 focus:ring-slate-200 transition-colors",
        className
      )}
      {...props}
    >
      <span className="truncate flex items-center gap-1.5 min-w-0">
        {children}
        <span className="truncate">{displayLabel}</span>
      </span>
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
    </button>
  );
}

interface ComboboxContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "up" | "down";
}

export function ComboboxContent({ children, className, align = "down" }: ComboboxContentProps) {
  const { isOpen } = useComboboxContext();
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-slate-700 shadow-md focus:outline-hidden",
        align === "up" ? "bottom-full mb-1" : "top-full mt-1",
        className
      )}
    >
      {children}
    </div>
  );
}

interface ComboboxEmptyProps {
  children: React.ReactNode;
  className?: string;
}

export function ComboboxEmpty({ children, className }: ComboboxEmptyProps) {
  const { items } = useComboboxContext();
  if (items.length > 0) return null;

  return (
    <div className={cn("py-6 text-center text-xs text-slate-400 font-medium", className)}>
      {children}
    </div>
  );
}

interface ComboboxListProps {
  children: ((item: any) => React.ReactNode) | React.ReactNode;
  className?: string;
}

export function ComboboxList({ children, className }: ComboboxListProps) {
  const { items } = useComboboxContext();

  return (
    <div className={cn("flex flex-col gap-px", className)}>
      {typeof children === "function" ? (
        items.map((item) => children(item.raw))
      ) : (
        children
      )}
    </div>
  );
}

interface ComboboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: any;
  children: React.ReactNode;
  className?: string;
}

export function ComboboxItem({ value, children, className, onClick, ...props }: ComboboxItemProps) {
  const { value: activeValue, onValueChange, setIsOpen } = useComboboxContext();
  const isSelected = String(activeValue) === String(value);

  const handleSelect = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onValueChange) {
      // Find and pass original raw type (e.g. number for pageSize) if applicable
      onValueChange(value);
    }
    setIsOpen(false);
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div
      onClick={handleSelect}
      className={cn(
        "relative flex w-full select-none items-center justify-between rounded-md px-2.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer outline-hidden hover:bg-slate-50 transition-colors",
        isSelected && "bg-slate-50 text-slate-900 font-extrabold",
        className
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {isSelected && (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-slate-900 shrink-0">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
    </div>
  );
}
