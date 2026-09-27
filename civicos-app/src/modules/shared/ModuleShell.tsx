import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "../../i18n/i18nContext";

interface Props {
  eyebrow: string;
  title: string;
  lede: string;
  icon: ReactNode;
  tone: "housing" | "health" | "family";
  onBack: () => void;
  aside?: ReactNode;
  children: ReactNode;
}

/** Page frame shared by the service modules: back link, title block, optional side rail. */
export default function ModuleShell({ eyebrow, title, lede, icon, tone, onBack, aside, children }: Props) {
  const { t } = useI18n();
  return (
    <main id="main" className={`module module--${tone}`}>
      <button type="button" className="module__back" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true" /> {t("Citizen Hub")}
      </button>
      <header className="module__header">
        <span className="module__icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <p className="module__eyebrow">{t(eyebrow)}</p>
          <h1 className="module__title">{t(title)}</h1>
          <p className="module__lede">{t(lede)}</p>
        </div>
      </header>
      <div className={`module__layout${aside ? " module__layout--aside" : ""}`}>
        <div className="module__main">{children}</div>
        {aside && <aside className="module__aside">{aside}</aside>}
      </div>
    </main>
  );
}
