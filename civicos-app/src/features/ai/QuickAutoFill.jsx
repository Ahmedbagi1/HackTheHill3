import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Zap } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { isGeminiDisabled } from "../../services/api/gemini/geminiClient";
import { extractFormDataFromTextOrDoc, MAX_AUTOFILL_CHARS } from "../../services/api/gemini/geminiFormFiller";

/**
 * Collapsible "Quick Auto-Fill" drawer for the application wizard. The citizen
 * pastes free text; Gemini maps it onto the form and `onApply` merges the
 * validated values. Government ID numbers are never sent or filled.
 *
 * @param {{ fields: Array<object>, onApply: (values: Record<string, unknown>, filled: string[]) => void }} props
 */
const QuickAutoFill = ({ fields, onApply }) => {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [state, setState] = useState({ status: "idle" });
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const submit = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });
    try {
      const { values, filled } = await extractFormDataFromTextOrDoc(text, fields, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (filled.length) onApply(values, filled);
      setState({ status: "done", count: filled.length });
    } catch (error) {
      if (controller.signal.aborted || error.name === "AbortError") return;
      setState({ status: "error", disabled: isGeminiDisabled(error), message: error.message });
    }
  };

  const busy = state.status === "loading";

  return (
    <details className="autofill">
      <summary className="autofill__summary">
        <Zap size={15} aria-hidden="true" />
        {t("Quick Auto-Fill", "Remplissage rapide")}
        <span className="autofill__tag">{t("AI", "IA")}</span>
      </summary>
      <div className="autofill__body">
        <label htmlFor="autofill-text" className="autofill__label">
          {t(
            "Paste a note, or text from a lease, pay stub or bill. We'll fill in what matches.",
            "Collez une note, ou le texte d'un bail, d'un talon de paie ou d'une facture. Nous remplirons ce qui correspond.",
          )}
        </label>
        <textarea
          id="autofill-text"
          className="field__input autofill__input"
          rows={4}
          maxLength={MAX_AUTOFILL_CHARS}
          value={text}
          placeholder={t(
            "My name is Jane Doe, I live at 123 Elgin St, Ottawa K2P 1L4. My VIN is 2C4RDGBG5ER123456.",
            "Je m'appelle Jane Doe, j'habite au 123, rue Elgin, Ottawa K2P 1L4. Mon NIV est 2C4RDGBG5ER123456.",
          )}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <p className="autofill__privacy">
          {t(
            "Your text is sent to Google Gemini to read it. Don't paste your SIN, health card, passport or licence numbers; we never fill those automatically.",
            "Votre texte est transmis à Google Gemini pour être lu. Ne collez pas votre NAS ni vos numéros de carte santé, de passeport ou de permis; ces champs ne sont jamais remplis automatiquement.",
          )}
        </p>
        <div className="autofill__actions">
          <button type="button" className="btn btn--ai btn--sm" onClick={submit} disabled={busy || !text.trim()}>
            {busy ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />}
            {busy ? t("Reading your text…", "Lecture du texte…") : t("Auto-fill form", "Remplir le formulaire")}
          </button>
          <p className="autofill__status" role="status" aria-live="polite">
            {state.status === "done" &&
              (state.count > 0 ? (
                <span className="autofill__ok">
                  <CircleCheck size={14} aria-hidden="true" />
                  {t(
                    `Filled ${state.count} field${state.count === 1 ? "" : "s"}. Check the highlighted answers before continuing.`,
                    `${state.count} champ${state.count === 1 ? "" : "s"} rempli${state.count === 1 ? "" : "s"}. Vérifiez les réponses surlignées avant de continuer.`,
                  )}
                </span>
              ) : (
                t("Nothing in that text matched this form.", "Rien dans ce texte ne correspond à ce formulaire.")
              ))}
            {state.status === "error" && (
              <span className="autofill__error">
                <CircleAlert size={14} aria-hidden="true" />
                {state.disabled
                  ? t(
                      "AI auto-fill isn't available here. Please fill in the form manually.",
                      "Le remplissage par IA n'est pas offert ici. Veuillez remplir le formulaire manuellement.",
                    )
                  : t(
                      `Auto-fill is unavailable right now (${state.message}). Please fill in the form manually.`,
                      `Le remplissage automatique est indisponible (${state.message}). Veuillez remplir le formulaire manuellement.`,
                    )}
              </span>
            )}
          </p>
        </div>
      </div>
    </details>
  );
};

export default QuickAutoFill;
