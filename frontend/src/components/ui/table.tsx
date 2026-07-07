import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative max-h-full w-full overflow-auto">
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-xs [&_th]:!text-left [&_th]:!text-xs [&_th]:!font-bold [&_td]:!text-xs [&_td]:!font-normal [&_tbody_tr]:!bg-white [&_tbody_td]:!bg-white [&_tbody_td_*]:!text-xs [&_td[data-table-action=true]]:!text-left [&_td[data-table-action=true]>div]:!justify-start [&_[data-slot=badge]]:!text-xs [&_[data-slot=badge]]:!font-semibold",
        className
      )}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("sticky top-0 z-20 bg-slate-50 [&_tr]:border-b", className)}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 min-w-32 bg-slate-50 px-2 text-left align-middle font-bold text-foreground [&:has([role=checkbox])]:pr-0 data-[table-action=true]:sticky data-[table-action=true]:right-0 data-[table-action=true]:z-30 data-[table-action=true]:bg-slate-50 data-[table-action=true]:shadow-[-1px_0_0_0_rgba(15,23,42,0.08)]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "min-w-32 bg-white p-2 align-middle [&:has([role=checkbox])]:pr-0 data-[table-action=true]:sticky data-[table-action=true]:right-0 data-[table-action=true]:z-10 data-[table-action=true]:bg-white data-[table-action=true]:shadow-[-1px_0_0_0_rgba(15,23,42,0.08)]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-xs text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

const TableSecondaryText = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("mt-0.5 block text-xs font-normal text-muted-foreground", className)}
    {...props}
  />
))
TableSecondaryText.displayName = "TableSecondaryText"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableSecondaryText,
}
