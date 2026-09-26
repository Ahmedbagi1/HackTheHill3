import { useState } from "react";
import { BellRing, CalendarDays, ExternalLink, LoaderCircle, MapPin, Pencil, Recycle } from "lucide-react";
import { SectionCard } from "../../components/ui/primitives";
import { daysUntil, type WasteState } from "../../state/wasteSchedule";
import { longLocalDate } from "../../lib/time";
import type { WasteRotation, WasteStream } from "../../types/dashboard";

const STREAMS: Record<WasteStream, { label: string; hint: string }> = {
  green: { label: "Green bin", hint: "Food & organics" },
  garbage: { label: "Garbage", hint: "Every two weeks" },
  blue: { label: "Blue bin", hint: "Glass, metal, plastic" },
  black: { label: "Black bin", hint: "Paper & cardboard" },
  yard: { label: "Leaf & yard", hint: "In season" },
};

const StreamChip = ({ stream, muted = false }: { stream: WasteStream; muted?: boolean }) => (
  <span className={`stream stream--${stream}${muted ? " stream--muted" : ""}`}>
    <span className="stream__dot" aria-hidden="true" />
    {STREAMS[stream].label}
  </span>
);

const dayLabel = (days: number) => (days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`);

interface Props {
  coverage: boolean;
  address: string | undefined;
  onSaveAddress: (address: string) => void;
  state: WasteState;
  rotation: WasteRotation | null;
  onSetRotation: (rotation: WasteRotation | null) => void;
}

function RotationSetup({ nextDate, onSave }: { nextDate: string; onSave: (rotation: WasteRotation) => void }) {
  const [recycling, setRecycling] = useState<"blue" | "black" | null>(null);
  const [garbage, setGarbage] = useState<boolean | null>(null);
  return (
    <div className="rotation">
      <p className="rotation__title">Set up your bin rotation</p>
      <p className="rotation__text">Check your City calendar once and we'll track every week for you. On {longLocalDate(nextDate)}:</p>
      <div className="rotation__row" role="group" aria-label="Recycling cart that day">
        <span>Recycling</span>
        <button type="button" className={`chip${recycling === "blue" ? " chip--active" : ""}`} aria-pressed={recycling === "blue"} onClick={() => setRecycling("blue")}>
          Blue bin
        </button>
        <button type="button" className={`chip${recycling === "black" ? " chip--active" : ""}`} aria-pressed={recycling === "black"} onClick={() => setRecycling("black")}>
          Black bin
        </button>
      </div>
      <div className="rotation__row" role="group" aria-label="Garbage that day">
        <span>Garbage</span>
        <button type="button" className={`chip${garbage === true ? " chip--active" : ""}`} aria-pressed={garbage === true} onClick={() => setGarbage(true)}>
          Yes
        </button>
        <button type="button" className={`chip${garbage === false ? " chip--active" : ""}`} aria-pressed={garbage === false} onClick={() => setGarbage(false)}>
          No
        </button>
      </div>
      <button
        type="button"
        className="btn btn--primary btn--sm btn--block"
        disabled={recycling === null || garbage === null}
        onClick={() => recycling && garbage !== null && onSave({ anchorDate: nextDate, anchorRecycling: recycling, anchorGarbage: garbage })}
      >
        Save rotation
      </button>
      <a className="rotation__link" href="https://ottawa.ca/en/garbage-and-recycling" target="_blank" rel="noreferrer">
        Open the City collection calendar <ExternalLink size={11} aria-hidden="true" />
      </a>
    </div>
  );
}

export default function WasteRail({ coverage, address, onSaveAddress, state, rotation, onSetRotation }: Props) {
  const [editing, setEditing] = useState(!address);
  const [draft, setDraft] = useState(address ?? "");

  const save = () => {
    if (!draft.trim()) return;
    onSaveAddress(draft.trim());
    setEditing(false);
  };

  return (
    <SectionCard id="waste" title="Garbage & recycling" icon={<Recycle size={16} />} className="waste">
      {!coverage ? (
        <p className="muted-block">Collection schedules are available for City of Ottawa addresses.</p>
      ) : editing || !address ? (
        <form
          className="address-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor="waste-address" className="field__label">
            Your Ottawa address
          </label>
          <div className="address-form__row">
            <div className="input-group">
              <MapPin size={15} className="input-group__affix input-group__affix--prefix" aria-hidden="true" />
              <input
                id="waste-address"
                className="field__input field__input--has-prefix"
                placeholder="e.g. 110 Laurier Ave W"
                autoComplete="street-address"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary btn--sm" disabled={!draft.trim()}>
              Save
            </button>
          </div>
          <p className="field__hint">Used for your collection day and nearby disruptions. Stored on this device.</p>
        </form>
      ) : state.status === "loading" ? (
        <p className="muted-block">
          <LoaderCircle size={14} className="spin" aria-hidden="true" /> Looking up {address}…
        </p>
      ) : state.status === "error" ? (
        <div className="muted-block">
          <p>{state.error}</p>
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            Change address
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
                  {days === 0 ? "Collection is today. Bins out by 7 a.m." : "Tomorrow is collection day. Put bins out tonight after 6 p.m."}
                </p>
              )}
              <div className="next-pickup">
                <div className="next-pickup__when">
                  <span className="next-pickup__label">{dayLabel(days)}</span>
                  <span className="next-pickup__date">{longLocalDate(next.date)}</span>
                </div>
                <div className="next-pickup__streams">
                  {next.streams.map((s) => (
                    <StreamChip key={s} stream={s} />
                  ))}
                  {next.uncertain.length > 0 && !schedule.multiResidential && <span className="stream stream--unknown">+ garbage or recycling</span>}
                </div>
              </div>

              {schedule.multiResidential ? (
                <p className="muted-block">Your building has shared containers on a {schedule.weekday.toLowerCase()} schedule. Ask your property manager which carts go out each week.</p>
              ) : !rotation ? (
                <RotationSetup nextDate={next.date} onSave={onSetRotation} />
              ) : (
                <ul className="pickups" aria-label="Upcoming collections">
                  {later.map((day) => (
                    <li key={day.date} className="pickup">
                      <span className="pickup__date">
                        <CalendarDays size={13} aria-hidden="true" /> {longLocalDate(day.date).replace(/^[A-Za-z]+, /, "")}
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
                  <dt>Address</dt>
                  <dd>{schedule.address}</dd>
                </div>
                <div>
                  <dt>Day · Schedule</dt>
                  <dd>
                    {schedule.weekday.charAt(0) + schedule.weekday.slice(1).toLowerCase()} · {schedule.schedule}
                  </dd>
                </div>
              </dl>
              <div className="waste-actions">
                <button type="button" className="link-btn" onClick={() => setEditing(true)}>
                  <Pencil size={12} aria-hidden="true" /> Change address
                </button>
                {rotation && (
                  <button type="button" className="link-btn link-btn--muted" onClick={() => onSetRotation(null)}>
                    Reset rotation
                  </button>
                )}
              </div>
              <p className="fineprint">City of Ottawa open data. Holidays can shift collection by a day.</p>
            </>
          );
        })()
      ) : null}
    </SectionCard>
  );
}
