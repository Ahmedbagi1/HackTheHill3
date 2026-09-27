import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, ExternalLink, MessageCircle, RotateCcw, Siren, Sparkles, X } from "lucide-react";
import TierBadge from "../../components/common/TierBadge";
import { SERVICES_BY_ID } from "../../data/servicesData";
import { useI18n } from "../../i18n/i18nContext";
import Tx from "../../i18n/Tx";
import { GeminiError, getGeminiStatus, isGeminiDisabled } from "../../services/api/gemini/geminiClient";
import { triageCivicNeed } from "../../services/api/gemini/geminiTriage";
import type { ModuleRoute } from "../../state/useHashRoute";
import { CHAT_CATALOG, CHAT_MODULES, branchFieldOf, isModuleId, keywordMatches } from "./chatCatalog";

type Urgency = "Immediate" | "High" | "Standard";

interface ChatResult {
  guidance: string;
  recommendedServiceIds: string[];
  actionPlan: Array<{ title: string; serviceId: string | null; option: string | null }>;
  urgency: Urgency;
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "answer"; result: ChatResult }
  | { id: string; role: "assistant"; kind: "notice"; text: string; matches: string[]; tone: "fallback" | "error" };

interface CatalogService {
  id: string;
  tier: string;
  title: string;
  icon: typeof MessageCircle;
}

interface Props {
  /** Opens a catalog service's wizard, optionally on a branch (e.g. { applicationType: "T6" }). */
  onStartService: (serviceId: string, prefill: Record<string, unknown> | null) => void;
  onOpenModule: (id: ModuleRoute) => void;
}

const STORAGE_KEY = "civicos:assistant-chat";
const MAX_INPUT = 600;
const EXAMPLES = [
  "My landlord won't fix the heating and shut off the water.",
  "I want to build a deck in my backyard.",
  "I lost my job and my household income is low.",
];

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function readHistory(): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

const SERVICE_LOOKUP = SERVICES_BY_ID as Record<string, CatalogService | undefined>;

const titleOf = (id: string) => (isModuleId(id) ? CHAT_MODULES.find((m) => m.id === id)!.title : SERVICE_LOOKUP[id]?.title ?? id);

/** A recommended service or program with a button that opens it. */
function LaunchCard({ id, option, onLaunch }: { id: string; option: string | null; onLaunch: (id: string, option: string | null) => void }) {
  const { t } = useI18n();
  const module = isModuleId(id);
  const service = module ? null : SERVICE_LOOKUP[id];
  const Icon = service?.icon ?? Sparkles;
  const optionLabel = option ? branchFieldOf(id)?.options?.find((o) => o.value === option)?.label : undefined;
  return (
    <li className="chat-card">
      <span className="chat-card__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="chat-card__body">
        <span className="chat-card__title">{t(titleOf(id))}</span>
        <span className="chat-card__meta">
          <TierBadge tier={service?.tier ?? "Provincial"} />
          {optionLabel && <span className="chat-card__option">{t(optionLabel)}</span>}
        </span>
      </span>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => onLaunch(id, option)}>
        {module ? t("Open program") : t("Start application")}
      </button>
    </li>
  );
}

/**
 * Floating intake assistant. A resident describes what happened; Gemini routes
 * it to CivicOS services across all three levels of government, and each
 * recommendation opens the matching application wizard or program.
 * Without Gemini (no key, static hosting, quota), keyword matching keeps the
 * deep links working. The conversation lasts for the browser session.
 */
export default function CivicChatDock({ onStartService, onOpenModule }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(readHistory);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // Storage unavailable: the conversation lasts until the page reloads.
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    getGeminiStatus().then((status: { enabled: boolean }) => setAiEnabled(status.enabled));
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const send = async (text: string) => {
    const message = text.trim().slice(0, MAX_INPUT);
    if (!message || pending) return;
    const history = messages.filter((m): m is Extract<ChatMessage, { role: "user" }> => m.role === "user").map((m) => m.text).slice(-5);
    setMessages((prev) => [...prev, { id: newId(), role: "user", text: message }]);
    setDraft("");
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const fallback = (tone: "fallback" | "error", notice: string) =>
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", kind: "notice", tone, text: notice, matches: keywordMatches(message) }]);

    try {
      if (aiEnabled === false) {
        fallback("fallback", "AI assistance is unavailable here, so these matches come from keywords in your message.");
        return;
      }
      const ask = () => triageCivicNeed(message, CHAT_CATALOG, locale, { signal: controller.signal, history }) as Promise<ChatResult>;
      // One quiet retry for a transient upstream failure (Gemini occasionally times out).
      const result = await ask().catch((error: unknown) => {
        if (error instanceof GeminiError && error.code === "UPSTREAM" && !controller.signal.aborted) return ask();
        throw error;
      });
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", kind: "answer", result }]);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (isGeminiDisabled(error)) {
        setAiEnabled(false);
        fallback("fallback", "AI assistance is unavailable here, so these matches come from keywords in your message.");
      } else {
        console.error("[assistant] Gemini triage failed.", error);
        fallback("error", error instanceof GeminiError ? error.message : "Something went wrong. Please try again.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  const onInputKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setPending(false);
    setMessages([]);
    inputRef.current?.focus();
  };

  const launch = (id: string, option: string | null = null) => {
    if (isModuleId(id)) {
      onOpenModule(id);
    } else {
      if (!SERVICE_LOOKUP[id]) return;
      const branch = option ? branchFieldOf(id) : undefined;
      onStartService(id, branch ? { [branch.name]: option } : null);
    }
    setOpen(false);
  };

  const renderAnswer = (result: ChatResult) => {
    const optionFor = (id: string) => result.actionPlan.find((step) => step.serviceId === id && step.option)?.option ?? null;
    return (
      <>
        {result.urgency !== "Standard" && (
          <p className={`chat-urgency chat-urgency--${result.urgency.toLowerCase()}`}>
            {result.urgency === "Immediate" ? (
              <>
                <Siren size={14} aria-hidden="true" /> {t("Urgent: if anyone is in danger, call 9-1-1 now.")}
              </>
            ) : (
              t("High priority: act soon to protect your income, housing or documents.")
            )}
          </p>
        )}
        <p className="chat-guidance">{result.guidance}</p>
        {result.actionPlan.length > 0 && (
          <>
            <p className="chat-subhead">{t("Your next steps")}</p>
            <ol className="chat-steps">
              {result.actionPlan.map((step, index) => (
                <li key={`${index}-${step.title}`}>
                  <span>{step.title}</span>
                  {step.serviceId && (
                    <button type="button" className="link-btn chat-steps__go" onClick={() => launch(step.serviceId!, step.option)}>
                      {isModuleId(step.serviceId) ? t("Open") : t("Start")}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
        {result.recommendedServiceIds.length > 0 && (
          <>
            <p className="chat-subhead">{t("Recommended for you")}</p>
            <ul className="chat-cards">
              {result.recommendedServiceIds.map((id) => (
                <LaunchCard key={id} id={id} option={optionFor(id)} onLaunch={launch} />
              ))}
            </ul>
          </>
        )}
      </>
    );
  };

  return (
    <div className={`chat-dock${open ? " is-open" : ""}`}>
      {open && (
        <section
          id="civic-chat"
          className="chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="civic-chat-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="chat-panel__header">
            <span className="chat-panel__mark" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div className="chat-panel__heading">
              <h2 id="civic-chat-title" className="chat-panel__title">
                {t("Ask CivicOS")}
              </h2>
              <p className="chat-panel__subtitle">
                {aiEnabled === false ? t("Keyword matching (AI unavailable)") : t("Describe what happened. We'll find the right service.")}
              </p>
            </div>
            {messages.length > 0 && (
              <button type="button" className="icon-btn" aria-label={t("Start a new conversation")} title={t("Start a new conversation")} onClick={reset}>
                <RotateCcw size={16} />
              </button>
            )}
            <button type="button" className="icon-btn" aria-label={t("Minimize assistant")} onClick={close}>
              <ChevronDown size={18} />
            </button>
          </header>

          <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-busy={pending}>
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>{t("Tell me what's going on in your own words. I'll point you to federal, provincial or City of Ottawa services and open the right application.")}</p>
                <p className="chat-subhead">{t("Try one of these")}</p>
                <div className="chat-examples">
                  {EXAMPLES.map((example) => (
                    <button key={example} type="button" className="chat-example" onClick={() => void send(t(example))}>
                      {t(example)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="chat-msg chat-msg--user">
                  <p className="chat-bubble">{message.text}</p>
                </div>
              ) : (
                <div key={message.id} className="chat-msg chat-msg--assistant">
                  <div className={`chat-bubble${message.kind === "notice" && message.tone === "error" ? " chat-bubble--error" : ""}`}>
                    {message.kind === "answer" ? (
                      renderAnswer(message.result)
                    ) : (
                      <>
                        <Tx as="p" className="chat-guidance" text={message.text} />
                        {message.matches.length > 0 ? (
                          <ul className="chat-cards">
                            {message.matches.map((id) => (
                              <LaunchCard key={id} id={id} option={null} onLaunch={launch} />
                            ))}
                          </ul>
                        ) : (
                          <p className="chat-guidance">{t("No matching service found. Try describing it differently, or browse all services.")}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ),
            )}
            {pending && (
              <div className="chat-msg chat-msg--assistant">
                <div className="chat-bubble chat-typing" role="status" aria-label={t("CivicOS is thinking")}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={submit}>
            <label className="sr-only" htmlFor="civic-chat-input">
              {t("Describe your situation")}
            </label>
            <textarea
              id="civic-chat-input"
              ref={inputRef}
              rows={1}
              maxLength={MAX_INPUT}
              value={draft}
              placeholder={t("e.g. My landlord won't fix the heat")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onInputKey}
            />
            <button type="submit" className="chat-input__send" aria-label={t("Send")} disabled={!draft.trim() || pending}>
              <ArrowUp size={18} />
            </button>
          </form>
          <p className="chat-disclaimer">
            {t("Messages are sent to Google Gemini. Don't include ID numbers. AI can make mistakes: check the official site before you apply.")}{" "}
            <a href="https://www.canada.ca/en/services.html" target="_blank" rel="noreferrer">
              {t("Government services")} <ExternalLink size={10} aria-hidden="true" />
            </a>
          </p>
        </section>
      )}

      <button
        ref={triggerRef}
        type="button"
        className="chat-trigger"
        aria-expanded={open}
        aria-controls={open ? "civic-chat" : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <X size={20} aria-hidden="true" /> : <MessageCircle size={20} aria-hidden="true" />}
        <span className="chat-trigger__label">{open ? t("Close") : t("Ask CivicOS")}</span>
      </button>
    </div>
  );
}
