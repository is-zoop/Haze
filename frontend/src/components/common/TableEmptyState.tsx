const emptyImage = new URL("../../assets/images/empty.png", import.meta.url).href;
import { TableCell, TableRow } from "@/components/ui/table";

interface TableEmptyStateProps {
  colSpan: number;
  title: string;
  description?: string;
  resetLabel?: string;
  onReset?: () => void;
}

export function TableEmptyState({ colSpan, title }: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-[300px] p-0 text-center">
        <div
          className="flex h-full items-center justify-center px-6"
          role="status"
          aria-label={title}
        >
          <img src={emptyImage} alt="" className="h-auto w-96 max-w-full" />
        </div>
      </TableCell>
    </TableRow>
  );
}