import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType =
  | "published"
  | "draft"
  | "reviewing"
  | "rejected"
  | "offline"
  | "pending"
  | "approved"
  | "deployed"
  | "deploy_failed"
  | "debug_passed"
  | "debug_failed"
  | "processing"
  | "withdrawn"
  | "pass"
  | "fail"
  | "testing"
  | "active"
  | "warning"
  | "maintenance";

interface StatusBadgeProps {
  status: StatusType | string;
  labels: Record<string, string>;
  className?: string;
}

const statusClassNames: Record<string, string> = {
  published: "border-none bg-emerald-50 text-emerald-600 hover:bg-emerald-50 shadow-3xs",
  approved: "border-none bg-emerald-50 text-emerald-700 hover:bg-emerald-50 shadow-3xs",
  draft: "border-none bg-amber-50 text-amber-600 hover:bg-amber-50 shadow-3xs",
  reviewing: "border-none bg-blue-50 text-blue-650 hover:bg-blue-50 shadow-3xs",
  deployed: "border-none bg-teal-50 text-teal-600 hover:bg-teal-50 shadow-3xs",
  deploy_failed: "border-none bg-rose-50 text-rose-700 hover:bg-rose-50 shadow-3xs",
  debug_passed: "border-none bg-emerald-50 text-emerald-600 hover:bg-emerald-50 shadow-3xs",
  debug_failed: "border-none bg-rose-50 text-rose-700 hover:bg-rose-50 shadow-3xs",
  pending: "border-none bg-amber-50 text-amber-700 hover:bg-amber-50 shadow-3xs",
  processing: "border-none bg-amber-50 text-amber-700 hover:bg-amber-50 shadow-3xs",
  rejected: "border-none bg-rose-50 text-rose-700 hover:bg-rose-50 shadow-3xs",
  withdrawn: "border-none bg-slate-50 text-slate-500 hover:bg-slate-50 shadow-3xs",
  offline: "border-none bg-slate-100 text-slate-500 hover:bg-slate-100 shadow-3xs",
  active: "border-none bg-emerald-50 text-emerald-600 hover:bg-emerald-50 shadow-3xs",
  warning: "border-none bg-yellow-50 text-yellow-600 hover:bg-yellow-50 shadow-3xs",
  maintenance: "border-none bg-slate-100 text-slate-500 hover:bg-slate-100 shadow-3xs",
  pass: "border-none bg-emerald-50 text-emerald-650 hover:bg-emerald-50 shadow-3xs",
  fail: "border-none bg-red-50 text-red-600 hover:bg-red-50 shadow-3xs",
  testing: "border-none bg-blue-50 text-blue-650 hover:bg-blue-50 shadow-3xs animate-pulse",
};

export function StatusBadge({ status, labels, className }: StatusBadgeProps) {
  const normalizedStatus = (status || "").toLowerCase();
  const label = labels[normalizedStatus] || labels[status] || status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2.5 py-0.5 text-xs font-semibold",
        statusClassNames[normalizedStatus] || "border-none bg-slate-100 text-slate-600 hover:bg-slate-100",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
