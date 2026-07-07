import React from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: string[];
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs: _breadcrumbs, onBack, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between py-2 border-b border-border/60 bg-white px-5 rounded-xl shadow-3xs mb-1.5">
      <div className="text-left space-y-1">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border border-border"
            >
              &larr; 返回
            </Button>
          )}
          <h2 className="text-page-title text-foreground tracking-tight">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-supporting text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 mt-2 md:mt-0 self-start md:self-center">
          {actions}
        </div>
      )}
    </div>
  );
}
