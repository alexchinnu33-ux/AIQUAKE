import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  CircleMarker,
  GeoJSON,
  Polyline,
  Marker,
  ImageOverlay,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";

import NavigationBar from "./NavigationBar";
import { API_URL } from "../config";
import { rememberPlan, scenarioUrl, setIncident, useIncident } from "../incidentStore";
import { DarkBasemap } from "./mapLayers";
import "./aq.css";

const QUICK_PLACES = [
  { name: "Caraballeda, Venezuela", lat: 10.6086, lon: -66.8505 },
  { name: "Gaziantep, Turkey", lat: 37.0662, lon: 37.3833 },
  { name: "Antakya, Turkey", lat: 36.2021, lon: 36.1601 },
  { name: "Port-au-Prince, Haiti", lat: 18.5944, lon: -72.3074 },
  { name: "Kathmandu, Nepal", lat: 27.7172, lon: 85.324 },
  { name: "Sendai, Japan", lat: 38.2682, lon: 140.8694 },
  { name: "Palu, Indonesia", lat: -0.9003, lon: 119.8779 },
  { name: "Mexico City, Mexico", lat: 19.4326, lon: -99.1332 },
  { name: "Christchurch, New Zealand", lat: -43.5321, lon: 172.6362 },
  { name: "L'Aquila, Italy", lat: 42.3498, lon: 13.3995 },
];

const DAMAGE_COLORS = {
  "minor-damage": "#facc15",
  "major-damage": "#f97316",
  destroyed: "#ef4444",
};
const TIER_COLORS = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#facc15", LOW: "#22c55e" };
const TEAM_COLORS = ["#3fd7c7", "#a78bfa", "#f472b6", "#60a5fa", "#fbbf24", "#34d399", "#fb7185", "#38bdf8"];
const ALERT_COLORS = { green: "#22c55e", yellow: "#facc15", orange: "#f97316", red: "#ef4444" };
const HAZARD_COLORS = { "Very high": "#ef4444", High: "#f97316", Moderate: "#facc15", Low: "#22c55e" };
const SUPPORT_ICONS = {
  hospital: "🏥", clinic: "⚕️", fire_station: "🚒", police: "🚓",
  helipad: "🚁", assembly_point: "📍", shelter: "⛺",
};

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString());
const pct = (p) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
const magColor = (m) => (m >= 8 ? "#ef4444" : m >= 7 ? "#f97316" : m >= 6 ? "#facc15" : "#3fd7c7");

function minutesLabel(min) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${Math.round(min - h * 60)} min`;
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((d) => d.msg).join("; ")
      : body.detail;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return body;
}

function icon(emoji) {
  return L.divIcon({
    className: "",
    html: `<div class="aq-facility">${emoji}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function pin(label, color) {
  return L.divIcon({
    className: "",
    html: `<div class="aq-pin" style="--c:${color}">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function MapClick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

function FlyTo({ lat, lon, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null) map.flyTo([lat, lon], zoom, { duration: 0.8 });
  }, [lat, lon, zoom, map]);
  return null;
}

function Fit({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]]);
  }, [bounds, map]);
  return null;
}

const DARK_TILES = (
  <DarkBasemap />
);

function Stepper({ step, setStep, canGo }) {
  const steps = ["1 Location", "2 Earthquake", "3 Imagery", "4 Report"];
  return (
    <div className="aq-chips" role="tablist" aria-label="Steps">
      {steps.map((label, i) => (
        <button
          key={label}
          role="tab"
          aria-selected={step === i + 1}
          className={`aq-chip ${step === i + 1 ? "on" : ""}`}
          disabled={!canGo(i + 1)}
          onClick={() => setStep(i + 1)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Bars({ items, valueKey, labelKey, color = "#3fd7c7" }) {
  const max = Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((item) => (
        <div key={item[labelKey]} style={{ display: "grid", gridTemplateColumns: "70px 1fr 70px", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span className="aq-note">{item[labelKey]}</span>
          <div style={{ background: "rgba(148,187,204,0.1)", borderRadius: 3, height: 10 }}>
            <div style={{ width: `${(item[valueKey] / max) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
          </div>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(item[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

function SupportCard({ support, loading, error }) {
  return (
    <div className="aq-panel aq-card">
      <h3>Rescue team support nearby</h3>
      {loading && <div className="aq-note">Searching OpenStreetMap for hospitals, fire stations, helipads… (first time for a big city can take up to a minute)</div>}
      {error && <div className="aq-note" style={{ color: "#ffb5ba" }}>{error}</div>}
      {support && Object.keys(support).length === 0 && (
        <div className="aq-note">No mapped emergency facilities found within 12 km.</div>
      )}
      {support &&
        Object.entries(support).map(([kind, group]) => (
          <div key={kind} style={{ marginBottom: 10 }}>
            <div className="aq-team-head">
              <span>{SUPPORT_ICONS[kind]}</span> {group.label}
              <span className="aq-note" style={{ marginLeft: "auto" }}>{group.count} within 12 km</span>
            </div>
            {group.nearest.map((item, i) => (
              <div className="aq-stop" key={`${item.name}-${i}`}>
                <strong style={{ minWidth: 0, fontWeight: 500 }}>{item.name}</strong>
                <span className="t">{item.distance_km} km</span>
                {item.phone && <span className="aq-note">{item.phone}</span>}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function EventDetail({ detail }) {
  if (!detail) return null;
  const pager = detail.pager;
  return (
    <div className="aq-panel aq-card aq-detail">
      <h3>{detail.title || detail.place}</h3>
      <dl>
        <dt>Magnitude</dt>
        <dd>M{detail.magnitude} ({detail.mag_type})</dd>
        <dt>Depth</dt>
        <dd>{detail.depth_km} km</dd>
        <dt>Date (UTC)</dt>
        <dd>{detail.time.replace("T", " ")}</dd>
        <dt>Max intensity</dt>
        <dd>
          {detail.max_intensity_modelled != null ? `MMI ${Number(detail.max_intensity_modelled).toFixed(1)} (ShakeMap)` : "—"}
          {detail.max_intensity_reported != null ? ` · ${detail.max_intensity_reported} from residents` : ""}
        </dd>
        <dt>Felt reports</dt>
        <dd>{fmt(detail.felt_reports)}</dd>
        <dt>Tsunami</dt>
        <dd>{detail.tsunami ? "Warning issued" : "No"}</dd>
        <dt>ShakeMap</dt>
        <dd>{detail.has_shakemap ? "Available — damage can be modelled" : "Not available for this event"}</dd>
        {pager?.alert_level && (
          <>
            <dt>USGS PAGER</dt>
            <dd>
              <span className="aq-badge" style={{ "--c": ALERT_COLORS[pager.alert_level] }}>
                {pager.alert_level.toUpperCase()}
              </span>{" "}
              {pager.fatality_alert && `fatalities: ${pager.fatality_alert}`}
              {pager.economic_alert && ` · losses: ${pager.economic_alert}`}
            </dd>
          </>
        )}
      </dl>
      {pager?.population_by_mmi?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="aq-label" style={{ marginBottom: 6 }}>People exposed by shaking (MMI)</div>
          <Bars items={pager.population_by_mmi.map((p) => ({ ...p, label: `MMI ${p.mmi}` }))} valueKey="people" labelKey="label" color="#f97316" />
        </div>
      )}
      {detail.url && (
        <p className="aq-note" style={{ marginTop: 10 }}>
          <a href={detail.url} target="_blank" rel="noreferrer" style={{ color: "#3fd7c7" }}>USGS event page</a>
        </p>
      )}
    </div>
  );
}

export default function NewIncident() {
  const [step, setStep] = useState(1);
  const activeIncident = useIncident();

  // step 1
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [point, setPoint] = useState(null);
  const [flyZoom, setFlyZoom] = useState(2);

  // step 2
  const [intel, setIntel] = useState(null);
  const [intelBusy, setIntelBusy] = useState(false);
  const [intelError, setIntelError] = useState("");
  const [eventId, setEventId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [support, setSupport] = useState(null);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [minMag, setMinMag] = useState(4.5);
  const [years, setYears] = useState(50);

  // step 3
  const [source, setSource] = useState("model");
  const [pre, setPre] = useState(null);
  const [post, setPost] = useState(null);
  const [box, setBox] = useState({ west: "", south: "", east: "", north: "" });

  // step 4
  const [teams, setTeams] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("night");
  const [plan, setPlan] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [selectedZone, setSelectedZone] = useState(null);
  const [showPhoto, setShowPhoto] = useState(true);

  const postUrl = useMemo(() => (post ? URL.createObjectURL(post) : null), [post]);

  async function search(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    try {
      setSearching(true);
      setResults(await getJson(`${API_URL}/region/geocode?q=${encodeURIComponent(query)}`));
    } catch (err) {
      setResults([]);
      setIntelError(err.message);
    } finally {
      setSearching(false);
    }
  }

  function choose(place) {
    setPoint(place);
    setFlyZoom(10);
    setIntel(null);
    setDetail(null);
    setEventId(null);
    setSupport(null);
    setPlan(null);
    setBox({
      west: (place.lon - 0.01).toFixed(5),
      south: (place.lat - 0.01).toFixed(5),
      east: (place.lon + 0.01).toFixed(5),
      north: (place.lat + 0.01).toFixed(5),
    });
  }

  async function loadIntel(next = {}) {
    if (!point) return;
    const m = next.minMag ?? minMag;
    const y = next.years ?? years;
    try {
      setIntelBusy(true);
      setIntelError("");
      const data = await getJson(
        `${API_URL}/region/intel?lat=${point.lat}&lon=${point.lon}&radius_km=300&years=${y}&min_magnitude=${m}`
      );
      setIntel(data);
      setStep(2);
      if (!support && !supportBusy) loadSupport();
    } catch (err) {
      setIntelError(err.message);
    } finally {
      setIntelBusy(false);
    }
  }

  // emergency support loads in the background once the location is known
  function loadSupport() {
    setSupport(null);
    setSupportError("");
    setSupportBusy(true);
    getJson(`${API_URL}/region/support?lat=${point.lat}&lon=${point.lon}`)
      .then(setSupport)
      .catch((err) => setSupportError(err.message))
      .finally(() => setSupportBusy(false));
  }

  async function pickEvent(id) {
    setEventId(id);
    setDetail(null);
    try {
      setDetail(await getJson(`${API_URL}/region/event/${id}`));
    } catch (err) {
      setIntelError(err.message);
    }
  }

  async function runModelled(t = teams, tod = timeOfDay) {
    const params = new URLSearchParams({
      event_id: eventId, lat: point.lat, lon: point.lon,
      teams: t, time_of_day: tod, top_zones: 12,
    });
    return getJson(`${API_URL}/region/scenario?${params}`);
  }

  function describeIncident(kind) {
    return {
      source: kind,
      eventId: eventId || null,
      title: detail?.title || selectedEvent?.place || "Uploaded imagery",
      place: detail?.place || selectedEvent?.place || point.name,
      magnitude: detail?.magnitude ?? selectedEvent?.magnitude ?? "?",
      depth_km: detail?.depth_km ?? null,
      time: detail?.time ?? null,
      point: { lat: point.lat, lon: point.lon, name: point.name },
    };
  }

  async function generate() {
    setPlanError("");
    setPlan(null);
    setStep(4);
    setPlanBusy(true);
    try {
      if (source === "model") {
        const result = await runModelled();
        setPlan(result);
        const incident = describeIncident("model");
        rememberPlan(scenarioUrl(incident, { teams, timeOfDay, topZones: 12 }), result);
        setIncident(incident);
      } else {
        const values = Object.values(box).map(Number);
        if (!pre || !post || values.some((v) => !Number.isFinite(v))) {
          throw new Error("Add both photos and the geographic bounds of the region.");
        }
        const form = new FormData();
        form.append("pre_image", pre);
        form.append("post_image", post);
        Object.entries(box).forEach(([k, v]) => form.append(k, v));
        form.append("teams", teams);
        form.append("time_of_day", timeOfDay);
        form.append("top_zones", 12);
        const result = await getJson(`${API_URL}/rescue/analyze`, { method: "POST", body: form });
        setPlan(result);
        setIncident(describeIncident("photos"), result);
      }
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanBusy(false);
    }
  }

  async function replan(t, tod) {
    if (source !== "model" || !eventId) return;
    try {
      setPlanBusy(true);
      setPlan(await runModelled(t, tod));
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanBusy(false);
    }
  }

  const canGo = (n) =>
    n === 1 || (n === 2 && !!intel) || (n === 3 && !!intel) || (n === 4 && (!!plan || planBusy));

  const selectedEvent = intel?.events.find((e) => e.id === eventId);
  const canModel = !!detail?.has_shakemap;
  const nearCaraballeda =
    point && Math.hypot(point.lat - 10.6086, (point.lon + 66.8505) * 0.98) < 0.2;

  const zones = plan?.zones || [];
  const routedStops = useMemo(() => {
    const m = {};
    (plan?.routes || []).forEach((route, ti) =>
      route.stops.forEach((s, si) => {
        m[s.zone_id] = { team: route.team, order: si + 1, color: TEAM_COLORS[ti % 8], stop: s };
      })
    );
    return m;
  }, [plan]);
  const zone = zones.find((z) => z.id === selectedZone);

  return (
    <div className="aq-page">
      <NavigationBar />
      <div className="aq-wrap">
        <header className="aq-head">
          <div>
            <div className="aq-eyebrow">AIQUAKE / NEW INCIDENT</div>
            <h1 className="aq-title">Analyse an earthquake anywhere in the world</h1>
            <p className="aq-sub">
              Choose a location, review its earthquake history and risk, pick the
              earthquake, add before/after photos if you have them, and get a
              rescue report with priorities, routes and nearby support.
            </p>
          </div>
        </header>

        <Stepper step={step} setStep={setStep} canGo={canGo} />

        {intelError && <div className="aq-state err" role="alert">{intelError}</div>}

        {activeIncident && step === 1 && (
          <div className="aq-state" style={{ borderColor: "rgba(46,230,208,0.4)" }}>
            <b>Active incident:</b> M{activeIncident.magnitude} {activeIncident.title} ({activeIncident.point?.name?.split(",")[0]}).
            It is shown in every tab.{" "}
            <Link to="/dashboard" style={{ color: "#2ee6d0" }}>Open Mission Control →</Link>
            {" · "}
            <Link to="/rescue" style={{ color: "#2ee6d0" }}>Rescue Planner →</Link>
            {" "}— or analyse a different earthquake below.
          </div>
        )}

        {/* ---------------- STEP 1 ---------------- */}
        {step === 1 && (
          <div className="aq-split">
            <div>
              <div className="aq-map" style={{ height: 520 }}>
                <MapContainer center={[20, 10]} zoom={2} minZoom={2} worldCopyJump style={{ width: "100%", height: "100%" }}>
                  {DARK_TILES}
                  <MapClick
                    onPick={(p) => choose({ ...p, name: `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`, country_code: "" })}
                  />
                  {point && <CircleMarker center={[point.lat, point.lon]} radius={9} pathOptions={{ color: "#3fd7c7", weight: 3, fillOpacity: 0.3 }} />}
                  {point && <FlyTo lat={point.lat} lon={point.lon} zoom={flyZoom} />}
                </MapContainer>
              </div>
              <p className="aq-note" style={{ marginTop: 8 }}>Click anywhere on the map, search a place, or use a quick pick.</p>
            </div>

            <aside className="aq-side">
              <div className="aq-panel aq-card">
                <h3>1. Where?</h3>
                <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="search"
                    placeholder="City, town or region"
                    aria-label="Search a place"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="aq-btn" disabled={searching}>{searching ? "…" : "SEARCH"}</button>
                </form>
                {results.map((r) => (
                  <button key={`${r.lat}${r.lon}`} className="aq-row" style={{ gridTemplateColumns: "1fr" }} onClick={() => choose(r)}>
                    <span><b>{r.name.split(",").slice(0, 2).join(",")}</b><small>{r.name}</small></span>
                  </button>
                ))}
                <div className="aq-label" style={{ margin: "14px 0 8px" }}>Quick picks</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {QUICK_PLACES.map((p) => (
                    <button key={p.name} className="aq-chip" onClick={() => choose({ ...p, country_code: "" })}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {point && (
                <div className="aq-panel aq-card">
                  <h3>Selected location</h3>
                  <div style={{ fontWeight: 600 }}>{point.name}</div>
                  <div className="aq-note">{point.lat.toFixed(4)}, {point.lon.toFixed(4)}</div>
                  <button className="aq-btn" style={{ marginTop: 12, width: "100%" }} onClick={() => loadIntel()} disabled={intelBusy}>
                    {intelBusy ? "LOADING EARTHQUAKE HISTORY…" : "NEXT: EARTHQUAKE DATA →"}
                  </button>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ---------------- STEP 2 ---------------- */}
        {step === 2 && intel && (
          <>
            <section className="aq-kpis">
              <div className="aq-kpi" style={{ "--kpi": HAZARD_COLORS[intel.stats.hazard_level] }}>
                <span>Seismic hazard (past rate)</span>
                <strong>{intel.stats.hazard_level}</strong>
                <small>{intel.stats.events} quakes M{intel.stats.min_magnitude}+ in {intel.stats.years} y within {intel.stats.radius_km} km</small>
              </div>
              <div className="aq-kpi">
                <span>M6+ in next 10 years</span>
                <strong>{intel.stats.probability_10y ? pct(intel.stats.probability_10y["M6+"]) : "—"}</strong>
                <small>statistical estimate, not a prediction</small>
              </div>
              <div className="aq-kpi">
                <span>M7+ in next 10 years</span>
                <strong>{intel.stats.probability_10y ? pct(intel.stats.probability_10y["M7+"]) : "—"}</strong>
                <small>b-value {intel.stats.b_value ?? "n/a"}</small>
              </div>
              <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}>
                <span>Largest nearby</span>
                <strong>{intel.stats.largest ? `M${intel.stats.largest.magnitude}` : "—"}</strong>
                <small>{intel.stats.largest ? `${intel.stats.largest.year} · ${intel.stats.largest.place}` : ""}</small>
              </div>
              {intel.weather && (
                <div className="aq-kpi" style={{ "--kpi": "#60a5fa" }}>
                  <span>Weather now</span>
                  <strong>{intel.weather.temperature_c}°C</strong>
                  <small>wind {intel.weather.wind_kmh} km/h · rain next 48 h {intel.weather.rain_next_48h_mm} mm</small>
                </div>
              )}
            </section>

            <div className="aq-split">
              <div>
                <div className="aq-map" style={{ height: 460 }}>
                  <MapContainer center={[point.lat, point.lon]} zoom={6} style={{ width: "100%", height: "100%" }}>
                    {DARK_TILES}
                    <FlyTo lat={point.lat} lon={point.lon} zoom={6} />
                    <CircleMarker center={[point.lat, point.lon]} radius={8} pathOptions={{ color: "#3fd7c7", weight: 3, fillOpacity: 0.2 }} />
                    {intel.events.map((e) => (
                      <CircleMarker
                        key={e.id}
                        center={[e.latitude, e.longitude]}
                        radius={Math.max(3, (e.magnitude - 4) * 3.2)}
                        pathOptions={{ color: magColor(e.magnitude), weight: eventId === e.id ? 3 : 1, fillColor: magColor(e.magnitude), fillOpacity: 0.45 }}
                        eventHandlers={{ click: () => pickEvent(e.id) }}
                      >
                        <Popup><b>M{e.magnitude}</b> {e.place}<br />{e.time.slice(0, 10)} · {e.distance_km} km away</Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>

                <div className="aq-panel aq-card" style={{ marginTop: 12 }}>
                  <h3>Past earthquakes near here (largest first) — pick the one to analyse</h3>
                  <div className="aq-table-wrap" style={{ maxHeight: 320, overflowY: "auto", marginTop: 0 }}>
                    <table className="aq-table">
                      <thead><tr><th>Date</th><th>Place</th><th className="num">Mag</th><th className="num">Depth</th><th className="num">Distance</th></tr></thead>
                      <tbody>
                        {intel.events.map((e) => (
                          <tr key={e.id} className={eventId === e.id ? "sel" : ""} onClick={() => pickEvent(e.id)}>
                            <td>{e.time.slice(0, 10)}</td>
                            <td>{e.place}</td>
                            <td className="num"><span className="aq-badge" style={{ "--c": magColor(e.magnitude) }}>M{e.magnitude}</span></td>
                            <td className="num">{e.depth_km != null ? `${Math.round(e.depth_km)} km` : "—"}</td>
                            <td className="num">{e.distance_km} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <aside className="aq-side">
                <div className="aq-panel aq-card">
                  <h3>Search settings</h3>
                  <div className="aq-field">
                    <label htmlFor="mm2">Min magnitude <output>{minMag.toFixed(1)}</output></label>
                    <input id="mm2" type="range" min="3.5" max="6.5" step="0.1" value={minMag} onChange={(e) => setMinMag(+e.target.value)} />
                  </div>
                  <div className="aq-field" style={{ marginTop: 10 }}>
                    <label htmlFor="yy">Years back <output>{years}</output></label>
                    <input id="yy" type="range" min="10" max="125" step="5" value={years} onChange={(e) => setYears(+e.target.value)} />
                  </div>
                  <button className="aq-btn ghost" style={{ marginTop: 10 }} onClick={() => loadIntel({ minMag, years })} disabled={intelBusy}>
                    {intelBusy ? "LOADING…" : "UPDATE HISTORY"}
                  </button>
                </div>

                {detail ? <EventDetail detail={detail} /> : (
                  <div className="aq-panel aq-card aq-note">Select an earthquake from the map or the table to see its magnitude, depth, intensity and PAGER impact estimate.</div>
                )}

                <div className="aq-panel aq-card">
                  <h3>Magnitude bands</h3>
                  <Bars items={intel.stats.bands || []} valueKey="count" labelKey="band" />
                </div>

                <SupportCard support={support} loading={supportBusy} error={supportError} />

                <button className="aq-btn" disabled={!eventId} onClick={() => setStep(3)}>
                  {eventId ? "NEXT: BEFORE / AFTER IMAGERY →" : "SELECT AN EARTHQUAKE TO CONTINUE"}
                </button>
              </aside>
            </div>
          </>
        )}

        {/* ---------------- STEP 3 ---------------- */}
        {step === 3 && (
          <div className="aq-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <div className="aq-panel aq-card">
              <h3>3. How should damage be assessed?</h3>

              <label className="aq-row" style={{ gridTemplateColumns: "auto 1fr", cursor: "pointer" }}>
                <input type="radio" name="src" checked={source === "model"} onChange={() => setSource("model")} />
                <span>
                  <b>Modelled from USGS shaking (recommended, works worldwide)</b>
                  <small>
                    Uses the earthquake&apos;s ShakeMap intensity at every mapped building.
                    {selectedEvent && !canModel ? " ⚠ This earthquake has no ShakeMap — choose a different event (usually M5.5+)." : ""}
                  </small>
                </span>
              </label>

              <label className="aq-row" style={{ gridTemplateColumns: "auto 1fr", cursor: "pointer" }}>
                <input type="radio" name="src" checked={source === "photos"} onChange={() => setSource("photos")} />
                <span>
                  <b>From my before / after photos (experimental)</b>
                  <small>
                    Runs Model 2 on a satellite or drone image pair. Model 2 is not validated
                    and may flag damage that is not there.
                  </small>
                </span>
              </label>

              {source === "photos" && (
                <div className="aq-controls" style={{ padding: "14px 0 0", marginBottom: 0 }}>
                  <div className="aq-field">
                    <label htmlFor="pre3">Before the earthquake</label>
                    <input id="pre3" type="file" accept="image/*" onChange={(e) => setPre(e.target.files[0] || null)} />
                  </div>
                  <div className="aq-field">
                    <label htmlFor="post3">After the earthquake</label>
                    <input id="post3" type="file" accept="image/*" onChange={(e) => setPost(e.target.files[0] || null)} />
                  </div>
                  {["west", "south", "east", "north"].map((k) => (
                    <div className="aq-field" style={{ minWidth: 110 }} key={k}>
                      <label htmlFor={`bx-${k}`}>{k} ({k === "west" || k === "east" ? "lon" : "lat"})</label>
                      <input id={`bx-${k}`} type="number" step="any" value={box[k]} onChange={(e) => setBox((b) => ({ ...b, [k]: e.target.value }))} />
                    </div>
                  ))}
                  <p className="aq-note" style={{ flexBasis: "100%", margin: 0 }}>
                    Bounds must be the real coordinates of the image corners (max ~13 km per side).
                    They are pre-filled with a 2 km square around your location.
                  </p>
                </div>
              )}

              <button
                className="aq-btn"
                style={{ marginTop: 16, width: "100%" }}
                disabled={source === "model" && !canModel}
                onClick={generate}
              >
                {source === "model" && !canModel ? "CHOOSE AN EARTHQUAKE WITH A SHAKEMAP" : "GENERATE RESCUE REPORT →"}
              </button>
            </div>

            <div className="aq-panel aq-card aq-note">
              <h3>Chosen earthquake</h3>
              {detail ? (
                <>
                  <b>{detail.title}</b>
                  <br />M{detail.magnitude} · depth {detail.depth_km} km · {detail.time.slice(0, 10)}
                  <br />Location analysed: {point.name}
                </>
              ) : "None selected — go back to step 2."}
              <h3 style={{ marginTop: 16 }}>Honest limits</h3>
              <ul>
                <li>Earthquakes cannot be predicted in time; the risk figures in step 2 are statistics from the past.</li>
                <li>Modelled damage is an estimate from shaking and a generic building-vulnerability table, not an observation.</li>
                <li>Population figures use assumed occupancy ratios.</li>
                <li>Free OpenStreetMap data can be incomplete in some countries.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ---------------- STEP 4 ---------------- */}
        {step === 4 && (
          <>
            {planBusy && (
              <div className="aq-state">
                Building the report… downloading buildings and roads from OpenStreetMap for a new
                city can take 1–2 minutes the first time (cached afterwards).
              </div>
            )}
            {planError && <div className="aq-state err" role="alert">{planError}</div>}

            {plan && (
              <>
                <div className="aq-state" style={{ borderColor: "rgba(250,204,21,0.4)" }}>
                  <b>{source === "model" ? "Modelled scenario" : "Experimental image analysis"}</b>{" "}
                  {source === "model" ? plan.model_note : "Model 2 output is a rough draft and can contain false positives."}
                  {nearCaraballeda && (
                    <> {" "}<Link to="/rescue" style={{ color: "#3fd7c7" }}>For Caraballeda you also have the real assessed damage → open Rescue Planner</Link></>
                  )}
                </div>

                <div className="aq-panel aq-controls">
                  <div className="aq-field">
                    <label htmlFor="t4">Rescue teams <output>{teams}</output></label>
                    <input id="t4" type="range" min="1" max="8" value={teams}
                      onChange={(e) => { const v = +e.target.value; setTeams(v); replan(v, timeOfDay); }} />
                  </div>
                  <div className="aq-field">
                    <span className="aq-label">Time of event</span>
                    <div className="aq-seg" role="group" aria-label="Time of event">
                      {["night", "day"].map((t) => (
                        <button key={t} aria-pressed={timeOfDay === t} onClick={() => { setTimeOfDay(t); replan(teams, t); }}>
                          {t === "night" ? "NIGHT (at home)" : "DAY (away)"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {postUrl && source === "photos" && (
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#829794" }}>
                      <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />
                      Show my after-photo on the map
                    </label>
                  )}
                  <button className="aq-btn ghost" onClick={() => setStep(2)}>CHANGE EARTHQUAKE</button>
                </div>

                <section className="aq-kpis">
                  <div className="aq-kpi"><span>{plan.unit}</span><strong>{fmt(plan.impact.total_buildings)}</strong></div>
                  <div className="aq-kpi" style={{ "--kpi": "#f97316" }}><span>Damaged</span><strong>{fmt(plan.impact.damaged_buildings)}</strong><small>{plan.impact.damaged_share_pct}%</small></div>
                  <div className="aq-kpi"><span>People in area (est.)</span><strong>{fmt(plan.impact.estimated_population)}</strong></div>
                  <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}><span>Trapped (est.)</span><strong>{fmt(plan.impact.estimated_trapped)}</strong></div>
                  <div className="aq-kpi" style={{ "--kpi": "#facc15" }}><span>Displaced (est.)</span><strong>{fmt(plan.impact.estimated_displaced)}</strong></div>
                  {plan.shaking && (
                    <div className="aq-kpi" style={{ "--kpi": "#a78bfa" }}><span>Shaking here (MMI)</span><strong>{plan.shaking.mean_mmi}</strong><small>max {plan.shaking.max_mmi}</small></div>
                  )}
                </section>

                {plan.zones.length === 0 && (
                  <div className="aq-state">
                    No damaged areas in this window: the shaking here was too weak to damage buildings in this
                    model. Try a different earthquake or location closer to the epicentre.
                  </div>
                )}

                <div className="aq-split" style={{ opacity: planBusy ? 0.6 : 1 }}>
                  <div>
                    <div className="aq-map">
                      <MapContainer center={[plan.base.lat, plan.base.lon]} zoom={15} preferCanvas style={{ width: "100%", height: "100%" }}>
                        {DARK_TILES}
                        <Fit bounds={plan.bounds} />
                        {showPhoto && source === "photos" && postUrl && plan.bounds && (
                          <ImageOverlay url={postUrl} bounds={[[plan.bounds.south, plan.bounds.west], [plan.bounds.north, plan.bounds.east]]} opacity={0.7} />
                        )}
                        <GeoJSON
                          key={`dmg-${plan.damage_geojson.features.length}-${timeOfDay}-${teams}`}
                          data={plan.damage_geojson}
                          style={(f) => ({ color: DAMAGE_COLORS[f.properties.damage_class], weight: 1, fillColor: DAMAGE_COLORS[f.properties.damage_class], fillOpacity: 0.65 })}
                        />
                        {zones.map((z) => {
                          const r = routedStops[z.id];
                          return (
                            <CircleMarker key={z.id} center={[z.lat, z.lon]} radius={r ? 14 : 6}
                              pathOptions={{ color: TIER_COLORS[z.tier], weight: selectedZone === z.id ? 3 : 1.5, fillColor: TIER_COLORS[z.tier], fillOpacity: r ? 0.12 : 0.35 }}
                              eventHandlers={{ click: () => setSelectedZone(z.id) }}>
                              <Popup><b>{z.id} · {z.tier}</b><br />~{z.est_trapped} trapped, ~{z.est_displaced} displaced</Popup>
                            </CircleMarker>
                          );
                        })}
                        {plan.routes.map((route, ti) =>
                          route.legs.map((leg, li) => (
                            <Polyline key={`${route.team}-${li}`} positions={leg} pathOptions={{ color: TEAM_COLORS[ti % 8], weight: 4, opacity: 0.9 }} />
                          ))
                        )}
                        {zones.filter((z) => routedStops[z.id]).map((z) => (
                          <Marker key={`p-${z.id}`} position={[z.lat, z.lon]} icon={pin(routedStops[z.id].order, routedStops[z.id].color)}>
                            <Popup><b>{routedStops[z.id].team} · stop {routedStops[z.id].order}</b><br />ETA {minutesLabel(routedStops[z.id].stop.arrival_min)}</Popup>
                          </Marker>
                        ))}
                        {plan.facilities.filter((f) => ["hospital", "clinic", "fire_station", "police"].includes(f.type)).map((f) => (
                          <Marker key={f.id} position={[f.lat, f.lon]} icon={icon(SUPPORT_ICONS[f.type])}>
                            <Popup><b>{f.name}</b><br />{f.type.replace("_", " ")}{f.id === plan.base.id ? " — rescue base" : ""}</Popup>
                          </Marker>
                        ))}
                        {selectedZone && zone && <FlyTo lat={zone.lat} lon={zone.lon} zoom={17} />}
                      </MapContainer>
                    </div>
                    <div className="aq-panel aq-legend">
                      {Object.entries(DAMAGE_COLORS).map(([k, c]) => (<span key={k} style={{ "--c": c }}><i /> {k.replace("-", " ")}</span>))}
                      <span>Numbered pins = team visit order</span>
                      <span>Base: {plan.base.name}</span>
                    </div>
                  </div>

                  <aside className="aq-side">
                    {plan.notes?.length > 0 && <div className="aq-state">{plan.notes.join(" ")}</div>}

                    {zone && (
                      <div className="aq-panel aq-card aq-detail">
                        <h3>Zone {zone.id}</h3>
                        <dl>
                          <dt>Priority</dt><dd><span className="aq-badge" style={{ "--c": TIER_COLORS[zone.tier] }}>{zone.tier}</span> #{zone.rank}</dd>
                          <dt>Damaged</dt><dd>{zone.destroyed} destroyed · {zone.major} major · {zone.minor} minor</dd>
                          <dt>Est. trapped</dt><dd>~{zone.est_trapped}</dd>
                          <dt>Medical</dt><dd>{zone.nearest_medical ? `${zone.nearest_medical.name} · ${zone.nearest_medical.distance_m} m` : "—"}</dd>
                        </dl>
                      </div>
                    )}

                    <div className="aq-panel aq-card">
                      <h3>Team routes</h3>
                      {plan.routes.length === 0 && <div className="aq-note">No routes (no road data or no damage).</div>}
                      {plan.routes.map((route, ti) => (
                        <div key={route.team} style={{ marginBottom: 12 }}>
                          <div className="aq-team-head">
                            <i className="aq-swatch" style={{ "--c": TEAM_COLORS[ti % 8] }} />{route.team}
                            <span className="aq-note" style={{ marginLeft: "auto" }}>{route.total_distance_km} km · {minutesLabel(route.finish_min)}</span>
                          </div>
                          {route.stops.map((s, i) => (
                            <div className="aq-stop" key={s.zone_id}>
                              <strong>{i + 1}.</strong><span>{s.zone_id} · ~{s.est_trapped} trapped</span><span className="t">+{minutesLabel(s.arrival_min)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="aq-panel aq-card">
                      <h3>Rescue priority ranking</h3>
                      {zones.slice(0, 12).map((z) => (
                        <button key={z.id} className={`aq-row ${selectedZone === z.id ? "sel" : ""}`} onClick={() => setSelectedZone(z.id)}>
                          <span className="aq-badge" style={{ "--c": TIER_COLORS[z.tier] }}>{z.tier}</span>
                          <span><b>{z.id} · {z.damaged_buildings} damaged</b><small>~{z.est_trapped} trapped · ~{z.est_displaced} displaced</small></span>
                          <span className="aq-note">#{z.rank}</span>
                        </button>
                      ))}
                    </div>

                    <SupportCard support={support} loading={supportBusy} error={supportError} />

                    {detail && <EventDetail detail={detail} />}
                  </aside>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
