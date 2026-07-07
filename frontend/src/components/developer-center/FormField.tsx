import React from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  required,
  error,
  description,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      </div>
      {children}
      {error ? (
        <span className="text-xs font-medium text-rose-500">{error}</span>
      ) : description ? (
        <span className="text-xs text-muted-foreground/85 leading-normal">{description}</span>
      ) : null}
    </div>
  );
}
