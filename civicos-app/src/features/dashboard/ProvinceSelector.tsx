import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { PROVINCES, PROVINCES_BY_CODE, provinceFromName } from "../../data/provinces";
import { useCivicData } from "../../state/civicDataStore";
import type { ProvinceCode } from "../../types/dashboard";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

async function detectProvince(): Promise<ProvinceCode> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 600000 }),
  );
  const params = new URLSearchParams({
    lat: String(position.coords.latitude),
    lon: String(position.coords.longitude),
    format: "jsonv2",
    zoom: "5",
  });
  const response = await fetch(`${NOMINATIM_REVERSE}?${params}`, { headers: { Accept: "application/json" } });
  const result = (await response.json()) as { address?: { state?: string; country_code?: string } };
  if (result.address?.country_code !== "ca") throw new Error("You appear to be outside Canada.");
  const code = provinceFromName(result.address?.state);
  if (!code) throw new Error("Couldn't determine your province.");
  return code;
}

export default function ProvinceSelector() {
  const { location, setLocation } = useCivicData();
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const province = PROVINCES_BY_CODE[location.province];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: ProvinceCode) => {
    setLocation({ province: code, source: "manual" });
    setOpen(false);
  };

  const detect = async () => {
    setDetecting(true);
    setError(null);
    try {
      setLocation({ province: await detectProvince(), source: "detected" });
      setOpen(false);
    } catch (err) {
      const geoError = err as GeolocationPositionError & Error;
      setError(geoError.code === 1 ? "Location permission was denied." : geoError.message || "Detection failed.");
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="province" ref={rootRef}>
      <button
        type="button"
        className="province__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MapPin size={14} aria-hidden="true" />
        <span className="province__name">{province.name}</span>
        {location.source === "detected" && <span className="province__source">Detected</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="popover province__menu">
          <button type="button" className="province__detect" onClick={detect} disabled={detecting}>
            {detecting ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <LocateFixed size={15} aria-hidden="true" />}
            {detecting ? "Detecting…" : "Detect my province"}
          </button>
          {error && <p className="province__error" role="alert">{error}</p>}
          <ul role="listbox" aria-label="Province or territory" className="province__list">
            {PROVINCES.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.code === location.province}
                  className="province__option"
                  onClick={() => choose(p.code)}
                >
                  <span>{p.name}</span>
                  {!p.fullCoverage && <span className="province__coverage">Federal only</span>}
                  {p.code === location.province && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
