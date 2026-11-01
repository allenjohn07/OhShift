import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Round initials avatar in the person's Notion tag color. */
export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "h-5 w-5 text-[9px]",
        size === "md" && "h-8 w-8 text-[11px]",
        size === "lg" && "h-10 w-10 text-xs",
        getEmployeeColor(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
