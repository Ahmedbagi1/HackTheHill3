import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useLanguage, LANGUAGE_OPTIONS } from "../../context/LanguageContext";
import { LOCALES, type Lang } from "../../i18n/i18n";

/**
 * Header language picker. Each option is labelled in its own language and
 * script, tagged with `lang` so screen readers switch pronunciation.
 */
export default function LanguageSelector() {
  const { currentLang, language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    // Move focus to the current choice so arrow keys start from it.
    listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const choose = (code: Lang) => {
    setLanguage(code);
    close(true);
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const options = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => options[(i + options.length) % options.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(options.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="lang" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lang__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t("language.label")}: ${language.label} (${language.englishName})`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Languages size={15} aria-hidden="true" />
        {/* Every label sits in one grid cell, so the button is always as wide as the longest and never shifts. */}
        <span className="lang__labels" aria-hidden="true">
          {LANGUAGE_OPTIONS.map((option) => (
            <span key={option.code} lang={LOCALES[option.code]} className={option.code === currentLang ? "is-current" : undefined}>
              {option.label}
            </span>
          ))}
        </span>
        <span className="lang__code" aria-hidden="true">
          {currentLang.toUpperCase()}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="popover lang__menu">
          <ul id={listId} role="listbox" aria-label={t("language.label")} className="lang__list" onKeyDown={onListKeyDown}>
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.code === currentLang;
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className="lang__option"
                    onClick={() => choose(option.code)}
                  >
                    <span className="lang__native" lang={LOCALES[option.code]}>
                      {option.label}
                    </span>
                    {option.label !== option.englishName && <span className="lang__english">{option.englishName}</span>}
                    {selected && <Check size={14} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
