import { cn } from "@/lib/utils";

/** Notion-style on/off switch (brand when on). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  size = "default",
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible name */
  label: string;
  size?: "default" | "sm";
  disabled?: boolean;
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        sm ? "h-5 w-9" : "h-6 w-11",
        checked ? "bg-brand" : "bg-input",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform",
          sm ? "h-4 w-4" : "h-5 w-5",
          checked && (sm ? "translate-x-4" : "translate-x-5"),
        )}
      />
    </button>
  );
}
