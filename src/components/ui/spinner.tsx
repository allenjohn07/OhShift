import { cn } from "@/lib/utils";

const SPOKES = 12;

/**
 * The app's one loading indicator: Apple-style fading spokes. Size it with
 * `h-*`/`w-*`; it takes the surrounding text colour. Decorative unless given a
 * `label`, which announces it to screen readers.
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("spinner shrink-0", className)}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    >
      {Array.from({ length: SPOKES }, (_, i) => (
        <line
          key={i}
          x1="12"
          y1="2.5"
          x2="12"
          y2="7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${(i * 360) / SPOKES} 12 12)`}
          // Base opacity is what shows with reduced motion (no animation); the
          // negative delay starts each spoke part-way, so the first frame is
          // already a full sweep.
          style={{ opacity: 1 - (i / SPOKES) * 0.85, animationDelay: `${(i / SPOKES - 1).toFixed(3)}s` }}
        />
      ))}
    </svg>
  );
}
