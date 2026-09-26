import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { Severity } from "../../types/dashboard";

const SEVERITY_META: Record<Severity, { label: string; Icon: typeof Info }> = {
  critical: { label: "Critical", Icon: OctagonAlert },
  moderate: { label: "Moderate", Icon: TriangleAlert },
  advisory: { label: "Advisory", Icon: Info },
};

/** Severity is always shown with an icon and a word, never colour alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, Icon } = SEVERITY_META[severity];
  return (
    <span className={`sev sev--${severity}`}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

export type PillTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export function SectionCard({
  id,
  title,
  icon,
  actions,
  children,
  className = "",
}: {
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section className={`surface ${className}`} aria-labelledby={headingId} id={id}>
      <header className="surface__header">
        <h2 className="surface__title" id={headingId}>
          {icon && <span className="surface__icon" aria-hidden="true">{icon}</span>}
          {title}
        </h2>
        {actions && <div className="surface__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const Icon = tone === "success" ? CircleCheck : tone === "info" ? Info : CircleAlert;
  return (
    <div className={`notice notice--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function DemoTag() {
  return (
    <span className="demo-tag" title="Illustrative data for demonstration">
      Demo
    </span>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
