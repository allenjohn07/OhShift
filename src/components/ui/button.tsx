import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { IconTooltip } from "@/components/icon-tooltip"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Flat logo purple — the one primary style.
        default: "btn-brand",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
        // Notion-style white button with a hairline border.
        outline:
          "border border-input bg-background text-foreground hover:bg-accent dark:bg-transparent dark:hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent dark:hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[13px] has-[>svg]:px-2",
        lg: "h-9 px-4 has-[>svg]:px-3.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  tooltip,
  tooltipSide = "bottom",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Hover/focus tip — required for icon buttons; falls back to aria-label */
    tooltip?: string
    tooltipSide?: "right" | "bottom" | "top"
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const isIcon =
    size === "icon" || size === "icon-xs" || size === "icon-sm" || size === "icon-lg"
  // Tooltips are reserved for icon-only buttons — a button with visible
  // label text doesn't need its own text repeated back in a tooltip.
  const tip = isIcon
    ? (tooltip ??
      (typeof props["aria-label"] === "string" ? props["aria-label"] : undefined) ??
      (typeof props.title === "string" ? props.title : undefined))
    : undefined

  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )

  if (!tip) return button

  const fullWidth =
    typeof className === "string" && /\bw-full\b/.test(className)

  return (
    <IconTooltip
      label={tip}
      side={tooltipSide}
      className={cn(fullWidth && "flex w-full min-w-0")}
    >
      {button}
    </IconTooltip>
  )
}

export { Button, buttonVariants }
