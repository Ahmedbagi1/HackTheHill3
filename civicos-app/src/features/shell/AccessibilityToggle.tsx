import { useEffect, useState } from "react";
import { ALargeSmall } from "lucide-react";
import { useI18n } from "../../i18n/i18nContext";

const STORAGE_KEY = "civicos:large-text";

const readSaved = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

/** Larger text for the whole interface, remembered on this device. */
export default function AccessibilityToggle() {
  const { t } = useI18n();
  const [large, setLarge] = useState(readSaved);

  useEffect(() => {
    document.documentElement.dataset.textSize = large ? "large" : "normal";
    try {
      window.localStorage.setItem(STORAGE_KEY, large ? "1" : "0");
    } catch {
      // Preference just won't persist.
    }
  }, [large]);

  return (
    <button type="button" className="a11y-toggle" role="switch" aria-checked={large} onClick={() => setLarge((v) => !v)}>
      <ALargeSmall size={16} aria-hidden="true" />
      <span className="a11y-toggle__label">{t("Larger text")}</span>
      <span className="a11y-toggle__track" aria-hidden="true">
        <span className="a11y-toggle__thumb" />
      </span>
    </button>
  );
}
