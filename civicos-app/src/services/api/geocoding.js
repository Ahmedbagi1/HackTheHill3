/**
 * OpenStreetMap Nominatim client, scoped to the City of Ottawa.
 *
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * - at most 1 request per second (enforced below)
 * - browsers send a Referer automatically, which identifies the app
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

// left, top, right, bottom — roughly the City of Ottawa boundary.
const OTTAWA_VIEWBOX = "-76.36,45.54,-75.24,44.96";
const MIN_INTERVAL_MS = 1100;

export class GeocodingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "GeocodingError";
    this.code = code; // "NOT_FOUND" | "NETWORK" | "UPSTREAM"
  }
}

let nextSlot = 0;

/** Serialises requests so we never exceed Nominatim's rate limit. */
const waitForSlot = (signal) => {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (!wait) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
};

const nominatimFetch = async (path, params, signal) => {
  await waitForSlot(signal);
  const url = `${NOMINATIM_URL}${path}?${new URLSearchParams(params)}`;

  let response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new GeocodingError("Couldn't reach the address service. Check your connection.", "NETWORK");
  }
  if (!response.ok) {
    throw new GeocodingError(`Address service error (${response.status}). Try again shortly.`, "UPSTREAM");
  }
  return response.json();
};

/** Short "123 Main St" style label from Nominatim address details. */
const shortLabel = (result) => {
  const a = result.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.village;
  return [street, area].filter(Boolean).join(", ") || result.display_name;
};

export async function geocodeOttawaAddress(query, { signal } = {}) {
  const trimmed = query.trim();
  if (!trimmed) throw new GeocodingError("Enter a street address.", "NOT_FOUND");

  const q = /ottawa/i.test(trimmed) ? trimmed : `${trimmed}, Ottawa, Ontario`;
  const results = await nominatimFetch(
    "/search",
    {
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
      countrycodes: "ca",
      viewbox: OTTAWA_VIEWBOX,
      bounded: "1",
    },
    signal,
  );

  if (!Array.isArray(results) || results.length === 0) {
    throw new GeocodingError(
      "We couldn't find that address in Ottawa. Include the street number and name.",
      "NOT_FOUND",
    );
  }

  const [best] = results;
  return {
    lat: Number(best.lat),
    lon: Number(best.lon),
    label: shortLabel(best),
    displayName: best.display_name,
  };
}

export async function reverseGeocode(lat, lon, { signal } = {}) {
  const result = await nominatimFetch(
    "/reverse",
    { lat: String(lat), lon: String(lon), format: "jsonv2", addressdetails: "1", zoom: "18" },
    signal,
  );
  return result?.error ? null : shortLabel(result);
}
