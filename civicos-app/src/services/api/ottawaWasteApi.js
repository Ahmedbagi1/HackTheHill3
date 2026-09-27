/**
 * Live City of Ottawa waste collection lookup.
 *
 *   1. Geocode the address with Nominatim (./geocoding.js)
 *   2. Point-in-polygon query against the City's open data layer
 *      "Solid Waste Collection Calendar - Collection Days"
 *
 * Layer fields: GCD (collection weekday), C_ZONE (Central/East/West),
 * SCHEDULE (A, B, A-Apt, B-Apt), CONTRACTOR.
 */

import { tr } from "../../i18n/i18n";
import { geocodeOttawaAddress, GeocodingError } from "./geocoding";

const COLLECTION_DAYS_LAYER =
  "https://maps.ottawa.ca/arcgis/rest/services/SolidWasteCollectionCalendar/MapServer/0/query";

export const OTTAWA_COLLECTION_CALENDAR_URL = "https://ottawa.ca/en/garbage-and-recycling";

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export class WasteLookupError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WasteLookupError";
    this.code = code; // "NOT_FOUND" | "OUTSIDE_SERVICE_AREA" | "NETWORK" | "UPSTREAM"
  }
}

/**
 * Lookup errors are stored as their English message. English keeps that
 * specific message; other languages get a localized general explanation.
 */
export const wasteLookupErrorMessage = (message, lang = "en") =>
  tr(lang)(
    message || "We couldn't find a collection schedule for that address.",
    "Impossible de trouver l'horaire de collecte pour cette adresse. Vérifiez l'adresse ou réessayez sous peu.",
  );

export async function queryCollectionZone({ lat, lon }, { signal } = {}) {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GCD,C_ZONE,SCHEDULE,CONTRACTOR",
    returnGeometry: "false",
    f: "json",
  });

  let response;
  try {
    response = await fetch(`${COLLECTION_DAYS_LAYER}?${params}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new WasteLookupError("Couldn't reach the City of Ottawa map service.", "NETWORK");
  }

  const payload = await response.json().catch(() => null);
  // ArcGIS reports errors with HTTP 200 and an `error` object.
  if (!response.ok || !payload || payload.error) {
    throw new WasteLookupError("The City of Ottawa map service returned an error. Try again shortly.", "UPSTREAM");
  }

  return payload.features?.[0]?.attributes ?? null;
}

/** Next date (today included) that falls on the given weekday, as YYYY-MM-DD. */
export const nextCollectionDate = (weekday, from = new Date()) => {
  const target = WEEKDAYS.indexOf(weekday);
  if (target < 0) return null;
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + ((target - date.getDay() + 7) % 7));
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildRotation = (multiResidential) =>
  multiResidential
    ? [
        { stream: "Garbage & green bin", frequency: "On your building's container schedule" },
        { stream: "Recycling", frequency: "Blue and black carts; ask your property manager" },
      ]
    : [
        { stream: "Green bin", frequency: "Every week" },
        { stream: "Leaf & yard waste", frequency: "Every week (seasonal)" },
        { stream: "Garbage", frequency: "Every two weeks" },
        { stream: "Recycling", frequency: "Alternating weeks: blue bin (glass, metal, plastic) and black bin (paper, cardboard)" },
      ];

/**
 * Full lookup: address string -> collection schedule.
 * @returns {Promise<{address, displayName, lat, lon, day, zone, schedule,
 *   scheduleCode, multiResidential, contractor, nextCollection, rotation}>}
 */
export async function lookupWasteCollection(address, { signal } = {}) {
  let place;
  try {
    place = await geocodeOttawaAddress(address, { signal });
  } catch (error) {
    if (error instanceof GeocodingError) throw new WasteLookupError(error.message, error.code);
    throw error;
  }

  const zone = await queryCollectionZone(place, { signal });
  if (!zone?.GCD) {
    throw new WasteLookupError(
      "That address is outside the City of Ottawa's curbside collection area.",
      "OUTSIDE_SERVICE_AREA",
    );
  }

  const scheduleCode = zone.SCHEDULE ?? "";
  const multiResidential = /apt/i.test(scheduleCode);

  return {
    address: place.label,
    displayName: place.displayName,
    lat: place.lat,
    lon: place.lon,
    day: zone.GCD,
    zone: zone.C_ZONE,
    schedule: scheduleCode.replace(/-?apt/i, "") || "—",
    scheduleCode,
    multiResidential,
    contractor: zone.CONTRACTOR,
    nextCollection: nextCollectionDate(zone.GCD),
    rotation: buildRotation(multiResidential),
  };
}
