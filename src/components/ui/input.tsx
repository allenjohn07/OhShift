import * as React from "react"

import { cn } from "@/lib/utils"

/** Shared field styles — use for raw <select>/<textarea>/<input> so they match <Input>. */
const fieldClass =
  "w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 text-sm transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.03]"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 border-input h-8 w-full min-w-0 rounded-md border bg-background px-2.5 py-1 text-base transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-white/[0.03]",
        "focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldClass }
