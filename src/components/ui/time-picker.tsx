import * as React from "react"
import { ClockIcon } from "lucide-react"

import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { formatTimeLabel } from "@/lib/dates"
import { useDisplayPrefs } from "@/lib/display-prefs"
import { cn } from "@/lib/utils"

const STEP_MINUTES = 15

const STEPS = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, i) => {
  const minutes = i * STEP_MINUTES
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
})

/**
 * 15-minute time dropdown — use instead of <input type="time">.
 * Value is "HH:mm" (24h). An off-step value (e.g. a clock-in at 09:07) is kept
 * as an extra option so editing never silently rounds it.
 */
function TimePicker({
  value: valueProp,
  defaultValue = "",
  onChange,
  name,
  id,
  required,
  disabled,
  placeholder = "Time",
  size = "default",
  className,
  "aria-label": ariaLabel,
}: {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  id?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  size?: "sm" | "default"
  className?: string
  "aria-label"?: string
}) {
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  // Re-render labels when the 12h/24h preference changes.
  useDisplayPrefs()
  const options = React.useMemo(
    () =>
      value && !STEPS.includes(value) ? [...STEPS, value].sort() : STEPS,
    [value]
  )

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (valueProp === undefined) setInner(next)
        onChange?.(next)
      }}
      name={name}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn("tabular-nums", size === "sm" && "px-2 text-xs", className)}
      >
        {size !== "sm" && (
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
        )}
        {/* Own label (not <SelectValue>) so 12h/24h formatting stays ours. */}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !value && "text-muted-foreground/70"
          )}
        >
          {value ? formatTimeLabel(value) : placeholder}
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options.map((t) => (
          <SelectItem key={t} value={t} className="tabular-nums">
            {formatTimeLabel(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Date + time pair for a single local timestamp — replaces
 * <input type="datetime-local">. Value is "YYYY-MM-DDTHH:mm".
 */
function DateTimePicker({
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  "aria-label"?: string
  className?: string
}) {
  const [date = "", time = ""] = value.split("T")
  return (
    <div className={cn("flex min-w-0 gap-2", className)}>
      <DatePicker
        value={date}
        onChange={(d) => onChange(`${d}T${time || "09:00"}`)}
        aria-label={ariaLabel ? `${ariaLabel} date` : undefined}
        className="flex-1"
      />
      <TimePicker
        value={time}
        onChange={(t) => onChange(`${date}T${t}`)}
        aria-label={ariaLabel ? `${ariaLabel} time` : undefined}
        className="w-32 shrink-0"
      />
    </div>
  )
}

export { DateTimePicker, TimePicker }
