import type { ReactNode } from "react";

export function Panel({
  title, subtitle, action, children, className = "",
}: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card hairline ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            {title && <div className="text-sm font-semibold tracking-tight">{title}</div>}
            {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
