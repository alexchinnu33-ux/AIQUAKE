// Shared "active incident": the earthquake analysed in New Incident.
// Every page reads it, so the whole app shows the same incident.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { API_URL } from "./config";

const KEY = "aq_incident";
const EVENT = "aq-incident-change";

const plans = new Map();          // url -> plan (memory only, avoids refetching per tab)
let photoPlan = null;             // experimental photo-based plan (memory only)

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(callback) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useIncident() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  // memoised on the raw string so the object identity is stable between renders
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);
}

export function setIncident(incident, plan = null) {
  photoPlan = incident?.source === "photos" ? plan : null;
  try {
    if (incident) localStorage.setItem(KEY, JSON.stringify(incident));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the incident then only lives until reload */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearIncident() {
  plans.clear();
  setIncident(null);
}

export function rememberPlan(url, plan) {
  plans.set(url, plan);
}

export function scenarioUrl(incident, { teams = 3, timeOfDay = "night", topZones = 12 } = {}) {
  const params = new URLSearchParams({
    event_id: incident.eventId,
    lat: incident.point.lat,
    lon: incident.point.lon,
    teams,
    time_of_day: timeOfDay,
    top_zones: topZones,
  });
  return `${API_URL}/region/scenario?${params}`;
}

/**
 * Plan for the active incident (null when no incident is active, so callers
 * fall back to the Caraballeda demo).
 */
export function useActivePlan(options = {}) {
  const incident = useIncident();
  const { teams = 3, timeOfDay = "night", topZones = 12 } = options;
  const [, rerender] = useState(0);
  const [failure, setFailure] = useState({ key: "", message: "" });

  const isPhotos = incident?.source === "photos";
  const key = !incident
    ? ""
    : isPhotos
      ? "photos"
      : scenarioUrl(incident, { teams, timeOfDay, topZones });

  const plan = !incident ? null : isPhotos ? photoPlan : plans.get(key) || null;

  useEffect(() => {
    if (!key || isPhotos || plans.has(key)) return undefined;
    const controller = new AbortController();
    fetch(key, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.detail || `Request failed (${r.status})`);
        plans.set(key, body);
        rerender((n) => n + 1);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setFailure({ key, message: err.message });
      });
    return () => controller.abort();
  }, [key, isPhotos]);

  if (!incident) return { incident: null, plan: null, loading: false, error: "" };

  let error = failure.key === key ? failure.message : "";
  if (isPhotos && !photoPlan) {
    error = "The photo-based report is not kept after a reload. Run New Incident again.";
  }
  return { incident, plan, loading: !plan && !error, error };
}
