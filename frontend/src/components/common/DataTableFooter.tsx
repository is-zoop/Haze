import { Pagination } from "@/components/ui/pagination";

interface DataTableFooterProps {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: { value: number; label: string }[];
  totalLabel?: string;
  itemsLabel?: string;
  langCode?: string;
}

export function DataTableFooter({
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  totalLabel,
  itemsLabel,
  langCode = "ZH",
}: DataTableFooterProps) {
  // Localized defaults
  let finalTotalLabel = totalLabel || "共";
  let finalItemsLabel = itemsLabel || "项";
  let defaultPageSizes = pageSizeOptions || [
    { value: 10, label: "10 项/页" },
    { value: 20, label: "20 项/页" },
    { value: 50, label: "50 项/页" },
    { value: 100, label: "100 项/页" },
  ];

  if (langCode === "EN") {
    finalTotalLabel = totalLabel || "Total";
    finalItemsLabel = itemsLabel || "items";
    if (!pageSizeOptions) {
      defaultPageSizes = [
        { value: 10, label: "10 / page" },
        { value: 20, label: "20 / page" },
        { value: 50, label: "50 / page" },
        { value: 100, label: "100 / page" },
      ];
    }
  } else if (langCode === "JA") {
    finalTotalLabel = totalLabel || "合計";
    finalItemsLabel = itemsLabel || "件";
    if (!pageSizeOptions) {
      defaultPageSizes = [
        { value: 10, label: "10 件/ページ" },
        { value: 20, label: "20 件/ページ" },
        { value: 50, label: "50 件/ページ" },
        { value: 100, label: "100 件/ページ" },
      ];
    }
  } else if (langCode === "ES") {
    finalTotalLabel = totalLabel || "Total";
    finalItemsLabel = itemsLabel || "ítems";
    if (!pageSizeOptions) {
      defaultPageSizes = [
        { value: 10, label: "10 / pág." },
        { value: 20, label: "20 / pág." },
        { value: 50, label: "50 / pág." },
        { value: 100, label: "100 / pág." },
      ];
    }
  }

  return (
    <div className="h-12 px-4 flex flex-row items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
        <span>{finalTotalLabel} {totalItems} {finalItemsLabel}</span>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={defaultPageSizes}
        className="w-auto"
      />
    </div>
  );
}
