import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src="/logo/ohshift-os-monogram.svg"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    />
  );
}
