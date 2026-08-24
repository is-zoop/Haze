import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  columnCount: number;
  rowCount?: number;
  leadingVisual?: boolean;
  actionColumn?: boolean;
}

export function TableSkeleton({
  columnCount,
  rowCount = 6,
  leadingVisual = false,
  actionColumn = false,
}: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <TableRow key={rowIndex} aria-hidden="true">
          {Array.from({ length: columnCount }).map((_, columnIndex) => {
            const isLeadingVisual = leadingVisual && columnIndex === 0;
            const isAction = actionColumn && columnIndex === columnCount - 1;

            return (
              <TableCell
                key={columnIndex}
                data-table-action={isAction ? "true" : undefined}
                className={isAction ? "text-right" : undefined}
              >
                {isLeadingVisual ? (
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ) : isAction ? (
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ) : (
                  <Skeleton className="h-4 w-3/4" />
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}