import { ArrowUpRight, Baby, HeartPulse, House, PiggyBank } from "lucide-react";
import type { Route } from "../../state/useHashRoute";

interface Props {
  enabled: boolean;
  onOpenModule: (route: Exclude<Route, "dashboard">) => void;
  onOpenFinder: () => void;
}

const SHORTCUTS = [
  {
    route: "housing" as const,
    Icon: House,
    title: "Subsidized housing",
    text: "Check eligibility against Ottawa's 2026 income limits",
    tone: "housing",
  },
  {
    route: "doctor" as const,
    Icon: HeartPulse,
    title: "Find a family doctor",
    text: "Match by distance, language and care needs",
    tone: "health",
  },
  {
    route: "autism" as const,
    Icon: Baby,
    title: "Autism support",
    text: "Ontario Autism Program pathways and funding",
    tone: "family",
  },
];

export default function ProgramShortcuts({ enabled, onOpenModule, onOpenFinder }: Props) {
  return (
    <section className="shortcuts" aria-label="Programs">
      {SHORTCUTS.map(({ route, Icon, title, text, tone }) => (
        <button key={route} type="button" className={`shortcut shortcut--${tone}`} onClick={() => onOpenModule(route)} disabled={!enabled}>
          <span className="shortcut__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="shortcut__title">{title}</span>
          <span className="shortcut__text">{enabled ? text : "Available in Ontario"}</span>
          <ArrowUpRight size={16} className="shortcut__arrow" aria-hidden="true" />
        </button>
      ))}
      <button type="button" className="shortcut shortcut--money" onClick={onOpenFinder}>
        <span className="shortcut__icon" aria-hidden="true">
          <PiggyBank size={18} />
        </span>
        <span className="shortcut__title">Money you might be missing</span>
        <span className="shortcut__text">Five questions, every benefit calculator</span>
        <ArrowUpRight size={16} className="shortcut__arrow" aria-hidden="true" />
      </button>
    </section>
  );
}
