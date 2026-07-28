import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
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
