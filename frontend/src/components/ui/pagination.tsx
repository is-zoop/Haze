import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox"

export interface PageSizeOption {
  value: number;
  label: string;
}

export interface PaginationProps extends React.ComponentProps<"nav"> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Optional page size selector props
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: PageSizeOption[];
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  className,
  ...props
}: PaginationProps) {
  // Generate list of page numbers to render
  const getPageNumbers = () => {
    const pages = []
    const range = 2 // Number of pages to show before and after current page
    
    // Always show first page
    pages.push(1)
    
    if (currentPage > range + 2) {
      pages.push("ellipsis-start")
    }
    
    const start = Math.max(2, currentPage - range)
    const end = Math.min(totalPages - 1, currentPage + range)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (currentPage < totalPages - range - 1) {
      pages.push("ellipsis-end")
    }
    
    // Always show last page if and only if there's more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages)
    }
    
    return pages
  }

  const handlePageClick = (page: number, e: React.MouseEvent) => {
    e.preventDefault()
    onPageChange(page)
  }

  const pages = getPageNumbers()

  // Find the label for current page size
  const selectedOptionLabel = pageSizeOptions?.find(opt => opt.value === pageSize)?.label || (pageSize ? `${pageSize} 条/页` : "");

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("flex items-center gap-3 text-xs font-semibold select-none", className)}
      {...props}
    >
      {/* 1. Page Size Selector (rendered inside pagination as a single unit if provided) */}
      {pageSize !== undefined && onPageSizeChange && pageSizeOptions && (
        <Combobox
          value={String(pageSize)}
          onValueChange={(val) => onPageSizeChange(Number(val))}
          items={pageSizeOptions.map(opt => ({ value: String(opt.value), label: opt.label }))}
          className="w-[100px]"
        >
          <ComboboxInput 
            className="h-8 text-xs font-semibold text-slate-700 bg-white border border-slate-200 w-[100px] rounded-lg justify-between cursor-pointer" 
            placeholder={selectedOptionLabel}
          />
          <ComboboxContent className="w-[100px]" align="up">
            <ComboboxList>
              {pageSizeOptions.map(opt => (
                <ComboboxItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}

      {/* 2. Standard page buttons */}
      <ul className="flex flex-row items-center gap-1">
        {/* Previous page button */}
        <li>
          <button
            onClick={(e) => currentPage > 1 && handlePageClick(currentPage - 1, e)}
            disabled={currentPage <= 1}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:pointer-events-none disabled:opacity-50",
              "text-xs font-semibold"
            )}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </li>

        {/* Page buttons */}
        {pages.map((page, index) => {
          if (page === "ellipsis-start" || page === "ellipsis-end") {
            return (
              <li key={`ellipsis-${index}`}>
                <span className="flex h-7 w-7 items-center justify-center text-slate-400">
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              </li>
            )
          }

          const pageNum = page as number
          const isActive = pageNum === currentPage

          return (
            <li key={pageNum}>
              <button
                onClick={(e) => handlePageClick(pageNum, e)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white font-extrabold shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                {pageNum}
              </button>
            </li>
          )
        })}

        {/* Next page button */}
        <li>
          <button
            onClick={(e) => currentPage < totalPages && handlePageClick(currentPage + 1, e)}
            disabled={currentPage >= totalPages}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:pointer-events-none disabled:opacity-50",
              "text-xs font-semibold"
            )}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
