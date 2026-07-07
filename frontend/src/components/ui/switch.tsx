import React from "react";

export interface SwitchProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, checked, onCheckedChange, disabled = false, className = "" }, ref) => {
    return (
      <button
        id={id}
        ref={ref}
        type="button"
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
          checked ? "bg-indigo-600" : "bg-neutral-200"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out ${
            checked ? "translate-x-3.0" : "translate-x-0"
          }`}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";
