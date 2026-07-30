import { cn } from "@/lib/utils";

/**
 * Shared top-level page wrapper that owns the status-bar safe-area top padding
 * and horizontal padding (px-5). Uses CSS env(safe-area-inset-top) so the
 * content stays clear of the status bar on devices with tall notches or
 * Dynamic Island, with a 1rem base offset below it.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("px-5 pb-4", className)}
      style={{ paddingTop: "1rem" }}
    >
      {children}
    </div>
  );
}
