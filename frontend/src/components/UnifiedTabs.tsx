import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  card?: {
    title?: string;
    description?: string;
    className?: string;
    contentClassName?: string;
  };
}

interface UnifiedTabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
  useCardWrapper?: boolean; // If true, wraps tab content in Card
}

export function UnifiedTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
  listClassName,
  triggerClassName,
  contentClassName,
  useCardWrapper = false,
}: UnifiedTabsProps) {
  return (
    <Tabs
      defaultValue={defaultValue || tabs[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      <TabsList className={listClassName}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={triggerClassName}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => {
        if (!tab.content && !tab.card) return null;
        return (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={contentClassName}
          >
            {useCardWrapper || tab.card ? (
              <Card className={tab.card?.className}>
                {(tab.card?.title || tab.card?.description) && (
                  <CardHeader>
                    {tab.card?.title && <CardTitle>{tab.card.title}</CardTitle>}
                    {tab.card?.description && (
                      <CardDescription>{tab.card.description}</CardDescription>
                    )}
                  </CardHeader>
                )}
                <CardContent className={tab.card?.contentClassName || "text-sm text-slate-600"}>
                  {tab.content}
                </CardContent>
              </Card>
            ) : (
              tab.content
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
