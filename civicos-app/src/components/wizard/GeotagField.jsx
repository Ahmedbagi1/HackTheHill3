import { useState } from "react";
import { LoaderCircle, LocateFixed, MapPinned, X } from "lucide-react";
import { reverseGeocode } from "../../services/api/geocoding";
import { formatGeotag } from "../../lib/formatting";
import { useI18n } from "../../i18n/i18nContext";

const GEOLOCATION_ERRORS = {
  1: "Location permission was denied. Enter the address below instead.",
  2: "Your location isn't available right now.",
  3: "Finding your location took too long. Try again.",
};

const getPosition = () =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }),
  );

/** Captures device coordinates (plus a reverse-geocoded label) as the field value. */
const GeotagField = ({ id, value, onChange, describedBy }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const locate = async () => {
    setStatus("loading");
    setError(null);
    try {
      const { coords } = await getPosition();
      const location = {
        lat: coords.latitude,
        lon: coords.longitude,
        accuracy: Math.round(coords.accuracy),
        label: null,
      };
      onChange(location);
      // The label is a nice-to-have; keep the pin even if reverse geocoding fails.
      const label = await reverseGeocode(location.lat, location.lon).catch(() => null);
      if (label) onChange({ ...location, label });
      setStatus("done");
    } catch (err) {
      setError(GEOLOCATION_ERRORS[err.code] ?? "Couldn't get your location.");
      setStatus("error");
    }
  };

  if (!supported) {
    return <p className="field__hint">{t("Location isn't available in this browser; describe the location below.")}</p>;
  }

  return (
    <div className="geotag" id={id} aria-describedby={describedBy}>
      {value ? (
        <div className="geotag__result">
          <MapPinned size={18} aria-hidden="true" />
          <div>
            <p className="geotag__label">{value.label ?? t("Location pinned")}</p>
            <p className="geotag__coords">
              {formatGeotag({ ...value, label: null })} · ±{value.accuracy} m ·{" "}
              <a
                href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lon}#map=18/${value.lat}/${value.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("View map")}
              </a>
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Remove location")} onClick={() => onChange(null)}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--secondary" onClick={locate} disabled={status === "loading"}>
          {status === "loading" ? (
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
          ) : (
            <LocateFixed size={16} aria-hidden="true" />
          )}
          {status === "loading" ? t("Locating…") : t("Use my current location")}
        </button>
      )}
      {error && (
        <p className="field__error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
};

export default GeotagField;
