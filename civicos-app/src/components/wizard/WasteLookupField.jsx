import { useEffect, useRef, useState } from "react";
import { CalendarDays, ExternalLink, LoaderCircle, MapPin, Search } from "lucide-react";
import { lookupWasteCollection, OTTAWA_COLLECTION_CALENDAR_URL } from "../../services/api/ottawaWasteApi";
import { formatISODate, titleCase } from "../../lib/formatting";

export const WasteScheduleResult = ({ schedule }) => (
  <div className="waste-result" role="status">
    <div className="waste-result__head">
      <CalendarDays size={22} aria-hidden="true" />
      <div>
        <p className="waste-result__day">{titleCase(schedule.day)}</p>
        <p className="waste-result__next">Next collection: {formatISODate(schedule.nextCollection)}</p>
      </div>
    </div>
    <p className="waste-result__address">
      <MapPin size={13} aria-hidden="true" /> {schedule.address}
    </p>
    <dl className="waste-result__meta">
      <div>
        <dt>Schedule</dt>
        <dd>{schedule.schedule}</dd>
      </div>
      <div>
        <dt>Zone</dt>
        <dd>{schedule.zone}</dd>
      </div>
      <div>
        <dt>Collector</dt>
        <dd>{schedule.contractor}</dd>
      </div>
    </dl>
    <ul className="waste-result__rotation">
      {schedule.rotation.map((item) => (
        <li key={item.stream}>
          <strong>{item.stream}</strong>
          <span>{item.frequency}</span>
        </li>
      ))}
    </ul>
    <p className="waste-result__footnote">
      Holidays can shift collection. For exact blue/black bin weeks, see the{" "}
      <a href={OTTAWA_COLLECTION_CALENDAR_URL} target="_blank" rel="noreferrer">
        City collection calendar <ExternalLink size={11} aria-hidden="true" />
      </a>
      .
    </p>
    <p className="waste-result__attribution">
      Data: City of Ottawa Open Data · Geocoding © OpenStreetMap contributors
    </p>
  </div>
);

/**
 * Address input + live lookup. The resolved schedule object is the field's value.
 * Rendered inside the wizard <form>, so Enter triggers the lookup instead of submitting.
 */
const WasteLookupField = ({ id, value, onChange, describedBy, invalid }) => {
  const [address, setAddress] = useState(value?.address ?? "");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const lookup = async () => {
    if (!address.trim() || status === "loading") return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus("loading");
    setError(null);
    try {
      const schedule = await lookupWasteCollection(address, { signal: controller.signal });
      onChange(schedule);
      setStatus("done");
    } catch (err) {
      if (err.name === "AbortError") return;
      onChange(null);
      setError(err.message || "Lookup failed. Try again.");
      setStatus("error");
    }
  };

  return (
    <div className="waste-lookup">
      <div className="waste-lookup__row">
        <div className="input-group waste-lookup__input">
          <MapPin className="input-group__affix input-group__affix--prefix" size={16} aria-hidden="true" />
          <input
            id={id}
            type="text"
            className="field__input field__input--has-prefix"
            placeholder="e.g. 110 Laurier Ave W"
            autoComplete="street-address"
            value={address}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lookup();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={lookup}
          disabled={!address.trim() || status === "loading"}
        >
          {status === "loading" ? (
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
          ) : (
            <Search size={16} aria-hidden="true" />
          )}
          {status === "loading" ? "Looking up…" : "Find my day"}
        </button>
      </div>
      {error && (
        <p className="waste-lookup__error" role="alert">
          {error}
        </p>
      )}
      {value && <WasteScheduleResult schedule={value} />}
    </div>
  );
};

export default WasteLookupField;
