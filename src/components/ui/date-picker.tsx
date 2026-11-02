import * as React from "react"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseDateInput, toLocalDateInput } from "@/lib/dates"
import { cn } from "@/lib/utils"

/** Monday-first, matching the schedule week. */
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
const longFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
})
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
const ariaFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "full" })

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1)
  // Keep the day where possible (Jan 31 → Feb 28).
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(date.getDate(), last))
  return d
}

/** Monday-first grid of whole weeks covering the month. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []
  for (let d = start; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) {
    days.push(d)
  }
  return days
}

function Calendar({
  value,
  onSelect,
  min,
  max,
}: {
  value: string
  onSelect: (value: string) => void
  min?: string
  max?: string
}) {
  const today = toLocalDateInput(new Date())
  const clamp = (iso: string) =>
    min && iso < min ? min : max && iso > max ? max : iso
  const [focused, setFocused] = React.useState(() => clamp(value || today))
  const focusedDate = parseDateInput(focused) ?? new Date()
  const [view, setView] = React.useState(() => ({
    year: focusedDate.getFullYear(),
    month: focusedDate.getMonth(),
  }))
  const gridRef = React.useRef<HTMLDivElement>(null)
  // Set on keyboard moves so focus follows into a newly rendered month.
  const shouldFocus = React.useRef(false)

  React.useEffect(() => {
    if (!shouldFocus.current) return
    shouldFocus.current = false
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
      ?.focus()
  }, [focused, view])

  const isDisabled = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max)

  function moveFocus(next: Date) {
    const iso = toLocalDateInput(next)
    if (isDisabled(iso)) return
    shouldFocus.current = true
    setFocused(iso)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const steps: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusedDate, -1),
      ArrowRight: () => addDays(focusedDate, 1),
      ArrowUp: () => addDays(focusedDate, -7),
      ArrowDown: () => addDays(focusedDate, 7),
      PageUp: () => addMonths(focusedDate, -1),
      PageDown: () => addMonths(focusedDate, 1),
      Home: () => addDays(focusedDate, -((focusedDate.getDay() + 6) % 7)),
      End: () => addDays(focusedDate, 6 - ((focusedDate.getDay() + 6) % 7)),
    }
    const step = steps[e.key]
    if (!step) return
    e.preventDefault()
    moveFocus(step())
  }

  const days = monthGrid(view.year, view.month)
  const showMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  return (
    <div className="w-[16.5rem] select-none">
      <div className="flex h-8 items-center justify-between pl-2">
        <span className="text-sm font-medium" aria-live="polite">
          {monthFmt.format(new Date(view.year, view.month, 1))}
        </span>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => showMonth(-1)}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => showMonth(1)}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="flex h-7 items-center justify-center">
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-y-0.5"
      >
        {days.map((day) => {
          const iso = toLocalDateInput(day)
          const outside = day.getMonth() !== view.month
          const selected = iso === value
          const disabled = isDisabled(iso)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-date={iso}
              tabIndex={iso === focused ? 0 : -1}
              disabled={disabled}
              aria-selected={selected}
              aria-label={ariaFmt.format(day)}
              onClick={() => onSelect(iso)}
              onFocus={() => setFocused(iso)}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-brand font-medium text-brand-foreground"
                  : "hover:bg-accent",
                !selected && outside && "text-muted-foreground/60",
                !selected && iso === today && "font-semibold text-brand",
                disabled && "pointer-events-none opacity-30",
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex justify-end border-t border-border pt-2">
        <button
          type="button"
          disabled={isDisabled(today)}
          onClick={() => onSelect(today)}
          className="h-7 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          Today
        </button>
      </div>
    </div>
  )
}

/**
 * Calendar popover date picker — use instead of <input type="date">.
 * Value is "YYYY-MM-DD" (local). Works controlled (`value` + `onChange`) or
 * uncontrolled (`defaultValue` + `name` for FormData).
 */
function DatePicker({
  value: valueProp,
  defaultValue = "",
  onChange,
  name,
  id,
  required,
  disabled,
  min,
  max,
  placeholder = "Pick a date",
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
  min?: string
  max?: string
  placeholder?: string
  /** "sm" = compact h-8 trigger with a short label, for dense rows */
  size?: "sm" | "default"
  className?: string
  "aria-label"?: string
}) {
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  const [open, setOpen] = React.useState(false)
  const date = parseDateInput(value)

  function select(next: string) {
    if (valueProp === undefined) setInner(next)
    onChange?.(next)
    setOpen(false)
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-background text-left whitespace-nowrap transition-[border-color,box-shadow] outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-brand/60 dark:bg-white/[0.03]",
              size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-2.5 text-sm",
            )}
          >
            {size !== "sm" && (
              <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate tabular-nums",
                !date && "text-muted-foreground/70",
              )}
            >
              {date ? (size === "sm" ? shortFmt : longFmt).format(date) : placeholder}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto"
          onOpenAutoFocus={(e) => {
            // Focus the selected (or today's) day instead of the first button.
            e.preventDefault()
            ;(e.currentTarget as HTMLElement)
              .querySelector<HTMLButtonElement>('[data-date][tabindex="0"]')
              ?.focus()
          }}
        >
          <Calendar value={value} onSelect={select} min={min} max={max} />
        </PopoverContent>
      </Popover>
      {/* Carries the value into FormData and triggers native "required" validation. */}
      <input
        tabIndex={-1}
        aria-hidden
        name={name}
        required={required}
        value={value}
        onChange={() => {}}
        onFocus={() => setOpen(true)}
        className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
      />
    </div>
  )
}

export { Calendar, DatePicker }
