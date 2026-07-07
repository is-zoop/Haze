import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  resetLabel?: string;
  onReset?: () => void;
}

export function EmptyState({
  title = "没有找到匹配的数据",
  description = "尝试减少筛选条件，或换一个更宽泛的关键词重新检索。",
  resetLabel = "清空筛选",
  onReset,
}: EmptyStateProps) {
  return (
    <div className="p-8 w-full">
      <Card className="rounded-xl border-dashed bg-white shadow-none border-slate-200">
        <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center bg-transparent">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-50 text-slate-400 border border-slate-100">
            <AlertCircle className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-bold text-foreground">
            {title}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            {description}
          </p>
          {onReset && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 font-semibold border-slate-200 cursor-pointer rounded-lg hover:bg-neutral-50 hover:text-foreground"
              onClick={onReset}
            >
              {resetLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
