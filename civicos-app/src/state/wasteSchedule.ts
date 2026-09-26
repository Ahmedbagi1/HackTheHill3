/**
 * Waste collection calendar built from the City of Ottawa collection-day layer
 * (services/api/ottawaWasteApi.js) plus the resident's rotation.
 *
 * Ottawa rules: green bin (and leaf & yard waste in season) every week;
 * garbage every two weeks; blue (containers) and black (paper) recycling carts
 * alternate weekly. The open data gives the weekday and A/B schedule but not
 * which week is which, so the resident tells us once (WasteRotation).
 */

import { useCallback, useEffect, useState } from "react";
import { lookupWasteCollection } from "../services/api/ottawaWasteApi";
import type { WasteCollectionDay, WasteRotation, WasteSchedule, WasteStream } from "../types/dashboard";
import { readJson, writeJson } from "./storage";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface LookupResult {
  address: string;
  lat: number;
  lon: number;
  day: string;
  zone: string;
  schedule: string;
  multiResidential: boolean;
  nextCollection: string;
}

const normalizeAddress = (address: string) => address.trim().toLowerCase().replace(/\s+/g, " ");
const lookupKey = (address: string) => `civicos:waste-lookup:${normalizeAddress(address)}`;
const rotationKey = (address: string) => `civicos:waste-rotation:${normalizeAddress(address)}`;

const parseDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function buildUpcomingDays(
  nextCollection: string,
  rotation: WasteRotation | null,
  multiResidential: boolean,
  count = 4,
): WasteCollectionDay[] {
  const first = parseDate(nextCollection);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i * 7);
    if (multiResidential) {
      return { date: toIsoDate(date), streams: ["green"] as WasteStream[], uncertain: ["garbage", "blue", "black"] as WasteStream[] };
    }
    const streams: WasteStream[] = ["green"];
    const month = date.getMonth(); // Leaf & yard waste runs spring to late fall.
    if (month >= 3 && month <= 10) streams.push("yard");
    if (!rotation) {
      return { date: toIsoDate(date), streams, uncertain: ["garbage", "blue", "black"] as WasteStream[] };
    }
    const weeks = Math.round((date.getTime() - parseDate(rotation.anchorDate).getTime()) / WEEK_MS);
    const even = ((weeks % 2) + 2) % 2 === 0;
    const recycling = even ? rotation.anchorRecycling : rotation.anchorRecycling === "blue" ? "black" : "blue";
    const garbage = even ? rotation.anchorGarbage : !rotation.anchorGarbage;
    if (garbage) streams.push("garbage");
    streams.push(recycling);
    return { date: toIsoDate(date), streams, uncertain: [] };
  });
}

export type WasteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; schedule: WasteSchedule; lat: number; lon: number };

export function useWasteSchedule(address: string | undefined) {
  const [lookup, setLookup] = useState<{ address: string; result: LookupResult | null; error: string | null }>({
    address: "",
    result: null,
    error: null,
  });
  const [rotation, setRotationState] = useState<WasteRotation | null>(() => (address ? readJson(rotationKey(address), null) : null));
  const [rotationFor, setRotationFor] = useState(address);

  // Reload the saved rotation when the address changes (derived-state pattern).
  if (rotationFor !== address) {
    setRotationFor(address);
    setRotationState(address ? readJson(rotationKey(address), null) : null);
  }

  // A fresh cached lookup is read during render; the network is only used when it's missing or stale.
  const cachedLookup = address ? readJson<{ at: number; result: LookupResult } | null>(lookupKey(address), null) : null;
  const [mountedAt] = useState(() => Date.now());
  const cacheFresh = Boolean(cachedLookup && mountedAt - cachedLookup.at < LOOKUP_TTL_MS);

  useEffect(() => {
    if (!address || cacheFresh) return undefined;
    const controller = new AbortController();
    (lookupWasteCollection(address, { signal: controller.signal }) as Promise<LookupResult>)
      .then((result) => {
        writeJson(lookupKey(address), { at: Date.now(), result });
        setLookup({ address, result, error: null });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setLookup({ address, result: null, error: error.message || "Lookup failed." });
      });
    return () => controller.abort();
  }, [address, cacheFresh]);

  const setRotation = useCallback(
    (next: WasteRotation | null) => {
      if (!address) return;
      writeJson(rotationKey(address), next);
      setRotationState(next);
    },
    [address],
  );

  const current =
    address && cacheFresh && cachedLookup
      ? { result: cachedLookup.result, error: null }
      : lookup.address === address
        ? lookup
        : { result: null, error: null };

  let state: WasteState;
  if (!address) state = { status: "idle" };
  else if (!current.result && !current.error) state = { status: "loading" };
  else if (current.error || !current.result) state = { status: "error", error: current.error ?? "Lookup failed." };
  else {
    const r = current.result;
    // The cached "next collection" may be in the past; roll it forward to today or later.
    const today = new Date();
    const todayIso = toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    let next = parseDate(r.nextCollection);
    while (toIsoDate(next) < todayIso) next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 7);
    state = {
      status: "ready",
      lat: r.lat,
      lon: r.lon,
      schedule: {
        address: r.address,
        weekday: r.day,
        zone: r.zone,
        schedule: r.schedule,
        multiResidential: r.multiResidential,
        rotationKnown: Boolean(rotation),
        upcoming: buildUpcomingDays(toIsoDate(next), rotation, r.multiResidential),
      },
    };
  }

  return { state, rotation, setRotation };
}

export const daysUntil = (isoDate: string, now = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDate(isoDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};
