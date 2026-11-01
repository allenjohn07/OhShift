import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Styled dropdown (Radix Select) — use instead of native <select> so menus
 * match the rest of the UI. For simple cases prefer `<SimpleSelect>`.
 */
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-sm whitespace-nowrap transition-[border-color,box-shadow] outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground/70 dark:bg-white/[0.03] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&>span]:truncate",
        size === "sm" ? "h-8" : "h-9",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={4}
        className={cn(
          "relative z-[100] max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-popover data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          position === "popper" &&
            "w-full min-w-(--radix-select-trigger-width)",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-3.5 items-center justify-center text-brand">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

type Option = { value: string; label: string }

/**
 * One-liner select for plain option lists.
 * Radix can't use "" as an item value, so an empty value is mapped to `emptyLabel`.
 */
function SimpleSelect({
  value,
  onValueChange,
  options,
  emptyLabel,
  placeholder,
  size,
  className,
  disabled,
  "aria-label": ariaLabel,
  id,
}: {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  /** Label for the "" (none/all) choice, shown first */
  emptyLabel?: string
  placeholder?: string
  size?: "sm" | "default"
  className?: string
  disabled?: boolean
  "aria-label"?: string
  id?: string
}) {
  const EMPTY = "__empty__"
  return (
    <Select
      value={value === "" && emptyLabel ? EMPTY : value || undefined}
      onValueChange={(v) => onValueChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && <SelectItem value={EMPTY}>{emptyLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleSelect,
}
