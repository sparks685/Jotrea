import { cn } from "@/lib/utils";

/**
 * Shared top-level page wrapper that owns the status-bar safe-area top padding
 * (pt-14) and horizontal padding (px-5). Update once here to keep all main
 * screens consistent.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-5 pt-14 pb-4", className)}>
      {children}
    </div>
  );
}
