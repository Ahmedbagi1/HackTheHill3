import { useState } from "react";
import { BellRing, CalendarDays, ExternalLink, LoaderCircle, MapPin, Pencil, Recycle } from "lucide-react";
import { SectionCard } from "../../components/ui/primitives";
import { useI18n } from "../../i18n/I18nContext";
import type { Translate } from "../../i18n/i18n";
import { collectionDay } from "../../lib/formatting";
import { OTTAWA_COLLECTION_CALENDAR_URL, wasteLookupErrorMessage } from "../../services/api/ottawaWasteApi";
import { daysUntil, type WasteState } from "../../state/wasteSchedule";
import type { WasteRotation, WasteStream } from "../../types/dashboard";

const streamLabel = (stream: WasteStream, t: Translate) => {
  switch (stream) {
    case "green":
      return t("Green bin", "Bac vert");
    case "garbage":
      return t("Garbage", "Ordures");
    case "blue":
      return t("Blue bin", "Bac bleu");
    case "black":
      return t("Black bin", "Bac noir");
    default:
      return t("Leaf & yard", "Feuilles et jardin");
  }
};

function StreamChip({ stream, muted = false }: { stream: WasteStream; muted?: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`stream stream--${stream}${muted ? " stream--muted" : ""}`}>
      <span className="stream__dot" aria-hidden="true" />
      {streamLabel(stream, t)}
    </span>
  );
}

interface Props {
  coverage: boolean;
  address: string | undefined;
  onSaveAddress: (address: string) => void;
  state: WasteState;
  rotation: WasteRotation | null;
  onSetRotation: (rotation: WasteRotation | null) => void;
}

function RotationSetup({ nextDate, onSave }: { nextDate: string; onSave: (rotation: WasteRotation) => void }) {
  const { t, fmt } = useI18n();
  const [recycling, setRecycling] = useState<"blue" | "black" | null>(null);
  const [garbage, setGarbage] = useState<boolean | null>(null);
  const day = fmt.weekdayDate(nextDate);
  return (
    <div className="rotation">
      <p className="rotation__title">{t("Set up your bin rotation", "Configurez la rotation de vos bacs")}</p>
      <p className="rotation__text">
        {t(
          `Check your City calendar once and we'll track every week for you. On ${day}:`,
          `Consultez une fois le calendrier de la Ville et nous suivrons chaque semaine pour vous. Le ${day} :`,
        )}
      </p>
      <div className="rotation__row" role="group" aria-label={t("Recycling cart that day", "Bac de recyclage ce jour-là")}>
        <span>{t("Recycling", "Recyclage")}</span>
        <button type="button" className={`chip${recycling === "blue" ? " chip--active" : ""}`} aria-pressed={recycling === "blue"} onClick={() => setRecycling("blue")}>
          {t("Blue bin", "Bac bleu")}
        </button>
        <button type="button" className={`chip${recycling === "black" ? " chip--active" : ""}`} aria-pressed={recycling === "black"} onClick={() => setRecycling("black")}>
          {t("Black bin", "Bac noir")}
        </button>
      </div>
      <div className="rotation__row" role="group" aria-label={t("Garbage that day", "Ordures ce jour-là")}>
        <span>{t("Garbage", "Ordures")}</span>
        <button type="button" className={`chip${garbage === true ? " chip--active" : ""}`} aria-pressed={garbage === true} onClick={() => setGarbage(true)}>
          {t("Yes", "Oui")}
        </button>
        <button type="button" className={`chip${garbage === false ? " chip--active" : ""}`} aria-pressed={garbage === false} onClick={() => setGarbage(false)}>
          {t("No", "Non")}
        </button>
      </div>
      <button
        type="button"
        className="btn btn--primary btn--sm btn--block"
        disabled={recycling === null || garbage === null}
        onClick={() => recycling && garbage !== null && onSave({ anchorDate: nextDate, anchorRecycling: recycling, anchorGarbage: garbage })}
      >
        {t("Save rotation", "Enregistrer la rotation")}
      </button>
      <a className="rotation__link" href={OTTAWA_COLLECTION_CALENDAR_URL} target="_blank" rel="noreferrer">
        {t("Open the City collection calendar", "Ouvrir le calendrier de collecte de la Ville")} <ExternalLink size={11} aria-hidden="true" />
      </a>
    </div>
  );
}

export default function WasteRail({ coverage, address, onSaveAddress, state, rotation, onSetRotation }: Props) {
  const { lang, t, fmt } = useI18n();
  const [editing, setEditing] = useState(!address);
  const [draft, setDraft] = useState(address ?? "");

  const save = () => {
    if (!draft.trim()) return;
    onSaveAddress(draft.trim());
    setEditing(false);
  };

  const dayLabel = (days: number) =>
    days === 0 ? t("Today", "Aujourd'hui") : days === 1 ? t("Tomorrow", "Demain") : t(`In ${days} days`, `Dans ${days} jours`);

  return (
    <SectionCard id="waste" title={t("Garbage & recycling", "Déchets et recyclage")} icon={<Recycle size={16} />} className="waste">
      {!coverage ? (
        <p className="muted-block">
          {t("Collection schedules are available for City of Ottawa addresses.", "Les calendriers de collecte sont offerts pour les adresses de la Ville d'Ottawa.")}
        </p>
      ) : editing || !address ? (
        <form
          className="address-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor="waste-address" className="field__label">
            {t("Your Ottawa address", "Votre adresse à Ottawa")}
          </label>
          <div className="address-form__row">
            <div className="input-group">
              <MapPin size={15} className="input-group__affix input-group__affix--prefix" aria-hidden="true" />
              <input
                id="waste-address"
                className="field__input field__input--has-prefix"
                placeholder={t("e.g. 110 Laurier Ave W", "p. ex. 110, avenue Laurier Ouest")}
                autoComplete="street-address"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary btn--sm" disabled={!draft.trim()}>
              {t("Save", "Enregistrer")}
            </button>
          </div>
          <p className="field__hint">
            {t(
              "Used for your collection day and nearby disruptions. Stored on this device.",
              "Sert à trouver votre jour de collecte et les perturbations à proximité. Conservée sur cet appareil.",
            )}
          </p>
        </form>
      ) : state.status === "loading" ? (
        <p className="muted-block">
          <LoaderCircle size={14} className="spin" aria-hidden="true" /> {t(`Looking up ${address}…`, `Recherche de ${address}…`)}
        </p>
      ) : state.status === "error" ? (
        <div className="muted-block">
          <p>{wasteLookupErrorMessage(state.error, lang)}</p>
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            {t("Change address", "Changer d'adresse")}
          </button>
        </div>
      ) : state.status === "ready" ? (
        (() => {
          const { schedule } = state;
          const [next, ...later] = schedule.upcoming;
          const days = daysUntil(next.date);
          return (
            <>
              {days <= 1 && (
                <p className={`collect-alert${days === 0 ? " collect-alert--today" : ""}`} role="status">
                  <BellRing size={15} aria-hidden="true" />
                  {days === 0
                    ? t("Collection is today. Bins out by 7 a.m.", "La collecte a lieu aujourd'hui. Sortez vos bacs avant 7 h.")
                    : t(
                        "Tomorrow is collection day. Put bins out tonight after 6 p.m.",
                        "La collecte a lieu demain. Sortez vos bacs ce soir après 18 h.",
                      )}
                </p>
              )}
              <div className="next-pickup">
                <div className="next-pickup__when">
                  <span className="next-pickup__label">{dayLabel(days)}</span>
                  <span className="next-pickup__date">{fmt.weekdayDate(next.date)}</span>
                </div>
                <div className="next-pickup__streams">
                  {next.streams.map((s) => (
                    <StreamChip key={s} stream={s} />
                  ))}
                  {next.uncertain.length > 0 && !schedule.multiResidential && (
                    <span className="stream stream--unknown">{t("+ garbage or recycling", "+ ordures ou recyclage")}</span>
                  )}
                </div>
              </div>

              {schedule.multiResidential ? (
                <p className="muted-block">
                  {t(
                    `Your building has shared containers on a ${fmt.weekday(schedule.weekday)} schedule. Ask your property manager which carts go out each week.`,
                    `Votre immeuble a des conteneurs communs, ramassés le ${fmt.weekday(schedule.weekday)}. Demandez à votre gestionnaire immobilier quels bacs sont sortis chaque semaine.`,
                  )}
                </p>
              ) : !rotation ? (
                <RotationSetup nextDate={next.date} onSave={onSetRotation} />
              ) : (
                <ul className="pickups" aria-label={t("Upcoming collections", "Prochaines collectes")}>
                  {later.map((day) => (
                    <li key={day.date} className="pickup">
                      <span className="pickup__date">
                        <CalendarDays size={13} aria-hidden="true" /> {fmt.monthDay(day.date)}
                      </span>
                      <span className="pickup__streams">
                        {day.streams.filter((s) => s !== "yard").map((s) => (
                          <StreamChip key={s} stream={s} muted />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <dl className="waste-meta">
                <div>
                  <dt>{t("Address", "Adresse")}</dt>
                  <dd>{schedule.address}</dd>
                </div>
                <div>
                  <dt>{t("Day · Schedule", "Jour · Horaire")}</dt>
                  <dd>
                    {collectionDay(schedule.weekday, lang)} · {schedule.schedule}
                  </dd>
                </div>
              </dl>
              <div className="waste-actions">
                <button type="button" className="link-btn" onClick={() => setEditing(true)}>
                  <Pencil size={12} aria-hidden="true" /> {t("Change address", "Changer d'adresse")}
                </button>
                {rotation && (
                  <button type="button" className="link-btn link-btn--muted" onClick={() => onSetRotation(null)}>
                    {t("Reset rotation", "Réinitialiser la rotation")}
                  </button>
                )}
              </div>
              <p className="fineprint">
                {t(
                  "City of Ottawa open data. Holidays can shift collection by a day.",
                  "Données ouvertes de la Ville d'Ottawa. Les jours fériés peuvent décaler la collecte d'un jour.",
                )}
              </p>
            </>
          );
        })()
      ) : null}
    </SectionCard>
  );
}
