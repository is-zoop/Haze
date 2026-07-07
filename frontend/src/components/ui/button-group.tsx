import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonGroupVariants = cva(
  "flex w-fit items-stretch [&>*]:relative [&>*]:focus-visible:z-10 [&_[data-slot=button]]:shadow-none",
  {
    variants: {
      orientation: {
        horizontal:
          "flex-row [&_[data-slot=button]:not(:first-child)]:rounded-l-none [&_[data-slot=button]:not(:first-child)]:border-l-0 [&_[data-slot=button]:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&_[data-slot=button]:not(:first-child)]:rounded-t-none [&_[data-slot=button]:not(:first-child)]:border-t-0 [&_[data-slot=button]:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      data-slot="button-group"
      data-orientation={orientation ?? "horizontal"}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup, buttonGroupVariants }
