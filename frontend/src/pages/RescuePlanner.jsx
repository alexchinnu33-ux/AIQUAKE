import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  GeoJSON,
  CircleMarker,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import NavigationBar from "./NavigationBar";
import { API_URL } from "../config";
import { rememberPlan, scenarioUrl, useIncident } from "../incidentStore";
import { DarkBasemap } from "./mapLayers";
import "./aq.css";

const TIER_COLORS = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#facc15",
  LOW: "#22c55e",
};

const DAMAGE_COLORS = {
  "no-damage": "#22c55e",
  "minor-damage": "#facc15",
  "major-damage": "#f97316",
  destroyed: "#ef4444",
};

const TEAM_COLORS = [
  "#3fd7c7", "#a78bfa", "#f472b6", "#60a5fa",
  "#fbbf24", "#34d399", "#fb7185", "#38bdf8",
];

const FACILITY_ICONS = {
  hospital: "🏥",
  clinic: "⚕️",
  fire_station: "🚒",
  police: "🚓",
  report: "📷",
};

const fmt = (n) => Number(n).toLocaleString();

function minutesLabel(min) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${Math.round(min - h * 60)} min`;
}

function FlyTo({ target }) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), {
        duration: 0.8,
      });
    }
  }, [target, map]);

  return null;
}

function ClickCatcher({ onPick }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }),
  });
  return null;
}

function FitBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]);
    }
  }, [bounds, map]);

  return null;
}

function pinIcon(label, color) {
  return L.divIcon({
    className: "",
    html: `<div class="aq-pin" style="--c:${color}">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function facilityIcon(type) {
  return L.divIcon({
    className: "",
    html: `<div class="aq-facility">${FACILITY_ICONS[type] || "📍"}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RescuePlanner() {
  const [teams, setTeams] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("night");
  const [topZones, setTopZones] = useState(12);
  const [baseId, setBaseId] = useState("");

  const active = useIncident();
  const [planVersion, setPlanVersion] = useState(0);
  const [reports, setReports] = useState([]);
  const [point, setPoint] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [reportMsg, setReportMsg] = useState(null);
  const [casePlan, setCasePlan] = useState(null);
  const [custom, setCustom] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [preFile, setPreFile] = useState(null);
  const [postFile, setPostFile] = useState(null);
  const [box, setBox] = useState({ west: "", south: "", east: "", north: "" });
  const [buildings, setBuildings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [showAllBuildings, setShowAllBuildings] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // ---- plan (re-computed when the controls change) ----
  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          teams,
          time_of_day: timeOfDay,
          top_zones: topZones,
        });
        if (baseId) params.set("base_id", baseId);

        const url = active
          ? scenarioUrl(active, { teams, timeOfDay, topZones })
          : `${API_URL}/rescue/plan?${params}`;

        const response = await fetch(url, { signal: controller.signal });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.detail || `Rescue planner request failed (${response.status})`);
        }
        if (active) rememberPlan(url, body);
        setCasePlan(body);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to compute the rescue plan.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [teams, timeOfDay, topZones, baseId, planVersion, active]);

  // ---- building footprints (once) ----
  useEffect(() => {
    if (active) return;
    fetch(`${API_URL}/gis/buildings`)
      .then((r) => r.json())
      .then((data) => data.features && setBuildings(data))
      .catch(() => {});

    fetch(`${API_URL}/incident/reports`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setReports(data))
      .catch(() => {});
  }, [planVersion, active]);

  const isCase = !custom && !active;
  const overlay = custom || (active ? casePlan : null);
  const plan = custom || casePlan;
  const zones = plan?.zones || [];
  const selected = zones.find((z) => z.id === selectedId) || null;

  const routedStops = useMemo(() => {
    const map = {};
    (plan?.routes || []).forEach((route, ti) => {
      route.stops.forEach((stop, si) => {
        map[stop.zone_id] = {
          team: route.team,
          color: TEAM_COLORS[ti % TEAM_COLORS.length],
          order: si + 1,
          stop,
        };
      });
    });
    return map;
  }, [plan]);

  const visibleBuildings = useMemo(() => {
    if (!buildings) return null;
    if (showAllBuildings) return buildings;
    return {
      ...buildings,
      features: buildings.features.filter(
        (f) => f.properties.damage_class >= 1
      ),
    };
  }, [buildings, showAllBuildings]);

  const buildingStyle = (feature) => ({
    color: DAMAGE_COLORS[feature.properties.damage] || "#94a3b8",
    weight: 1,
    fillOpacity: feature.properties.damage_class >= 1 ? 0.7 : 0.25,
  });

  const impact = plan?.impact;
  const regionMode = plan?.unit === "damage regions";

  const authToken =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  async function submitReport(file, name) {
    if (!point) {
      setReportMsg({ error: true, text: "Click a building on the map first." });
      return;
    }

    const form = new FormData();
    form.append("photo", file, name);
    form.append("lat", point.lat);
    form.append("lon", point.lon);

    try {
      setReportBusy(true);
      setReportMsg(null);
      const response = await fetch(`${API_URL}/incident/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Report failed.");

      setReportMsg({
        error: false,
        text: data.applied
          ? `Model 1 says ${data.prediction} (${data.confidence}%). Building ${data.building_id} changed from ${data.previous_damage} to ${data.mapped_damage}; the plan was recomputed.`
          : `Model 1 says ${data.prediction} but only ${data.confidence}% sure (needs 60%), so the plan was not changed.`,
      });
      setPoint(null);
      setPlanVersion((v) => v + 1);
    } catch (err) {
      setReportMsg({ error: true, text: err.message });
    } finally {
      setReportBusy(false);
    }
  }

  async function trySamplePhoto(label) {
    const index = sampleCount * 7 + 3;
    setSampleCount((n) => n + 1);
    const response = await fetch(
      `${API_URL}/incident/sample-photo?label=${label}&index=${index}`
    );
    const blob = await response.blob();
    submitReport(blob, `sample_${label}_${index}.jpg`);
  }

  async function resetReports() {
    await fetch(`${API_URL}/incident/reports`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    setReportMsg(null);
    setPlanVersion((v) => v + 1);
  }

  async function runAnalysis() {
    setUploadError("");
    const values = Object.values(box).map(Number);
    if (!preFile || !postFile) {
      setUploadError("Choose both the pre-event and post-event image.");
      return;
    }
    if (
      Object.values(box).some((v) => v === "") ||
      values.some((v) => !Number.isFinite(v))
    ) {
      setUploadError("Enter the geographic bounds of the post-event image.");
      return;
    }

    const form = new FormData();
    form.append("pre_image", preFile);
    form.append("post_image", postFile);
    Object.entries(box).forEach(([k, v]) => form.append(k, v));
    form.append("teams", teams);
    form.append("time_of_day", timeOfDay);
    form.append("top_zones", topZones);

    try {
      setAnalyzing(true);
      const response = await fetch(`${API_URL}/rescue/analyze`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg).join("; ")
          : data.detail;
        throw new Error(detail || "Analysis failed.");
      }
      setCustom(data);
      setSelectedId(null);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }
  const bases = (plan?.facilities || []).filter(
    (f) => f.type === "fire_station"
  );

  function exportJson() {
    download(
      "aiquake_rescue_plan.json",
      JSON.stringify({ ...plan, facilities: undefined }, null, 2),
      "application/json"
    );
  }

  function exportCsv() {
    const header = [
      "rank", "zone", "tier", "damaged_buildings", "destroyed", "major",
      "minor", "est_trapped", "est_displaced", "team", "visit_order",
      "arrival_min", "latitude", "longitude",
    ];
    const rows = zones.map((z) => {
      const r = routedStops[z.id];
      return [
        z.rank, z.id, z.tier, z.damaged_buildings, z.destroyed, z.major,
        z.minor, z.est_trapped, z.est_displaced,
        r?.team || "", r?.order || "", r?.stop.arrival_min ?? "",
        z.lat.toFixed(6), z.lon.toFixed(6),
      ].join(",");
    });
    download(
      "aiquake_rescue_priorities.csv",
      [header.join(","), ...rows].join("\n"),
      "text/csv"
    );
  }

  return (
    <div className="aq-page">
      <NavigationBar />

      <div className="aq-wrap">
        <header className="aq-head">
          <div>
            <div className="aq-eyebrow">AIQUAKE / RESCUE OPERATIONS</div>
            <h1 className="aq-title">Rescue Planner</h1>
            <p className="aq-sub">
              AI building-damage results are turned into ranked rescue zones,
              an estimate of people affected, and road routes for each team
              starting from the emergency base
              {plan ? ` (${plan.case})` : ""}.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="aq-btn ghost" onClick={exportCsv} disabled={!plan}>
              EXPORT CSV
            </button>
            <button className="aq-btn" onClick={exportJson} disabled={!plan}>
              EXPORT PLAN
            </button>
          </div>
        </header>

        <section
          className="aq-panel aq-card"
          aria-label="Analyze new imagery"
          style={{ marginBottom: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                {custom
                  ? "Showing: your uploaded imagery"
                  : active
                    ? `Showing: your active incident — M${active.magnitude} ${active.title}`
                    : "Showing: Caraballeda demo (real assessed damage)"}
              </h3>
              <p className="aq-note" style={{ margin: "6px 0 0" }}>
                Experimental: run Model 2 on a pre/post satellite pair for any
                area. Model 2 is not validated and can flag damage that is not
                there, so treat its output as a rough draft.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {custom && (
                <button className="aq-btn ghost" onClick={() => setCustom(null)}>
                  BACK TO CASE STUDY
                </button>
              )}
              <button
                className="aq-btn"
                aria-expanded={uploadOpen}
                onClick={() => setUploadOpen((v) => !v)}
              >
                {uploadOpen ? "CLOSE" : "EXPERIMENTAL: SATELLITE PAIR"}
              </button>
            </div>
          </div>

          {uploadOpen && (
            <div
              className="aq-controls"
              style={{ padding: "14px 0 0", marginBottom: 0 }}
            >
              <div className="aq-field">
                <label htmlFor="pre">Pre-event image</label>
                <input
                  id="pre"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPreFile(e.target.files[0] || null)}
                />
              </div>
              <div className="aq-field">
                <label htmlFor="post">Post-event image</label>
                <input
                  id="post"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPostFile(e.target.files[0] || null)}
                />
              </div>
              {["west", "south", "east", "north"].map((k) => (
                <div className="aq-field" style={{ minWidth: 110 }} key={k}>
                  <label htmlFor={`b-${k}`}>
                    {k} ({k === "west" || k === "east" ? "lon" : "lat"})
                  </label>
                  <input
                    id={`b-${k}`}
                    type="number"
                    step="any"
                    value={box[k]}
                    onChange={(e) =>
                      setBox((b) => ({ ...b, [k]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <button
                className="aq-btn"
                onClick={runAnalysis}
                disabled={analyzing}
              >
                {analyzing ? "ANALYZING… (up to a minute)" : "RUN ANALYSIS"}
              </button>
              <p className="aq-note" style={{ flexBasis: "100%", margin: 0 }}>
                Bounds must be the real west/south/east/north coordinates of the
                post-event image (max ~13 km per side). Routes use
                OpenStreetMap roads, which needs an internet connection the
                first time an area is used. The team count, time of day and
                zone settings below are applied.
              </p>
              {uploadError && (
                <div
                  className="aq-state err"
                  role="alert"
                  style={{ flexBasis: "100%", margin: 0 }}
                >
                  {uploadError}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="aq-panel aq-controls" aria-label="Planning controls">
          <div className="aq-field">
            <label htmlFor="teams">
              Rescue teams <output>{teams}</output>
            </label>
            <input
              id="teams"
              type="range"
              min="1"
              max="8"
              value={teams}
              onChange={(e) => setTeams(+e.target.value)}
            />
          </div>

          <div className="aq-field">
            <label htmlFor="zones">
              Zones to route <output>{topZones}</output>
            </label>
            <input
              id="zones"
              type="range"
              min="4"
              max="40"
              value={topZones}
              onChange={(e) => setTopZones(+e.target.value)}
            />
          </div>

          <div className="aq-field">
            <span className="aq-label">Time of event</span>
            <div className="aq-seg" role="group" aria-label="Time of event">
              {["night", "day"].map((t) => (
                <button
                  key={t}
                  aria-pressed={timeOfDay === t}
                  onClick={() => setTimeOfDay(t)}
                >
                  {t === "night" ? "NIGHT (at home)" : "DAY (away)"}
                </button>
              ))}
            </div>
          </div>

          {!active && (<div className="aq-field">
            <label htmlFor="base">Emergency base</label>
            <select
              id="base"
              value={baseId || plan?.base?.id || ""}
              onChange={(e) => setBaseId(e.target.value)}
            >
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>)}

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 13,
              color: "#829794",
              visibility: isCase ? "visible" : "hidden",
            }}
          >
            <input
              type="checkbox"
              checked={showAllBuildings}
              onChange={(e) => setShowAllBuildings(e.target.checked)}
            />
            Show undamaged buildings
          </label>
        </section>

        {error && (
          <div className="aq-state err" role="alert">
            <strong>Planner error:</strong> {error}
          </div>
        )}

        {!plan && loading && (
          <div className="aq-state busy">
            Computing priorities and routes…
            {active ? " (a new city can take 1–2 minutes the first time)" : ""}
          </div>
        )}
        {active && plan?.model_note && (
          <div className="aq-state" style={{ borderColor: "rgba(255,176,32,0.4)" }}>
            <b>Modelled scenario.</b> {plan.model_note}
          </div>
        )}

        {impact && (
          <section className="aq-kpis" aria-label="Impact summary">
            <div className="aq-kpi">
              <span>{regionMode ? "Damage regions" : "Buildings assessed"}</span>
              <strong>{fmt(impact.total_buildings)}</strong>
              <small>AI damage model output</small>
            </div>
            <div className="aq-kpi" style={{ "--kpi": "#f97316" }}>
              <span>Damaged</span>
              <strong>{fmt(impact.damaged_buildings)}</strong>
              <small>
                {regionMode
                  ? "regions detected"
                  : `${impact.damaged_share_pct}% of buildings`}
              </small>
            </div>
            <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}>
              <span>Major + destroyed</span>
              <strong>
                {fmt(
                  impact.damage_counts["major-damage"] +
                    impact.damage_counts.destroyed
                )}
              </strong>
              <small>{fmt(impact.damage_counts.destroyed)} destroyed</small>
            </div>
            <div className="aq-kpi">
              <span>Est. people in area</span>
              <strong>{fmt(impact.estimated_population)}</strong>
              <small>{impact.time_of_day} occupancy</small>
            </div>
            <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}>
              <span>Est. trapped</span>
              <strong>{fmt(impact.estimated_trapped)}</strong>
              <small>needs search &amp; rescue</small>
            </div>
            <div className="aq-kpi" style={{ "--kpi": "#facc15" }}>
              <span>Est. displaced</span>
              <strong>{fmt(impact.estimated_displaced)}</strong>
              <small>need shelter</small>
            </div>
          </section>
        )}

        {plan && (
          <div className="aq-split" style={{ opacity: loading ? 0.6 : 1 }}>
            <div>
              <div className="aq-map">
                <MapContainer
                  key={`${plan.base.lat}-${plan.base.lon}`}
                  center={[plan.base.lat, plan.base.lon]}
                  zoom={14}
                  preferCanvas
                  scrollWheelZoom
                  style={{ width: "100%", height: "100%" }}
                >
                  <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Dark">
                      <DarkBasemap />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satellite">
                      <TileLayer
                        attribution="Imagery &copy; Esri"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Streets">
                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                    </LayersControl.BaseLayer>
                  </LayersControl>

                  {overlay?.damage_geojson && (
                    <GeoJSON
                      key={`custom-${overlay.damage_geojson.features.length}-${overlay.impact.estimated_population}`}
                      data={overlay.damage_geojson}
                      style={(f) => ({
                        color: DAMAGE_COLORS[f.properties.damage_class],
                        weight: 1,
                        fillOpacity: 0.5,
                      })}
                    />
                  )}

                  {isCase && visibleBuildings && (
                    <GeoJSON
                      key={showAllBuildings ? "all" : "damaged"}
                      data={visibleBuildings}
                      style={buildingStyle}
                    />
                  )}

                  {zones.map((zone) => {
                    const routed = routedStops[zone.id];
                    return (
                      <CircleMarker
                        key={zone.id}
                        center={[zone.lat, zone.lon]}
                        radius={routed ? 14 : 6}
                        pathOptions={{
                          color: TIER_COLORS[zone.tier],
                          weight: selectedId === zone.id ? 3 : 1.5,
                          fillColor: TIER_COLORS[zone.tier],
                          fillOpacity: routed ? 0.14 : 0.35,
                        }}
                        eventHandlers={{ click: () => setSelectedId(zone.id) }}
                      >
                        <Popup>
                          <b>
                            {zone.id} · {zone.tier}
                          </b>
                          <br />
                          {zone.damaged_buildings} damaged buildings
                          <br />
                          ~{zone.est_trapped} trapped, ~{zone.est_displaced} displaced
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {plan.routes.map((route, ti) =>
                    route.legs.map((leg, li) => (
                      <Polyline
                        key={`${route.team}-${li}`}
                        positions={leg}
                        pathOptions={{
                          color: TEAM_COLORS[ti % TEAM_COLORS.length],
                          weight: 4,
                          opacity: 0.9,
                        }}
                      />
                    ))
                  )}

                  {zones
                    .filter((z) => routedStops[z.id])
                    .map((zone) => {
                      const r = routedStops[zone.id];
                      return (
                        <Marker
                          key={`pin-${zone.id}`}
                          position={[zone.lat, zone.lon]}
                          icon={pinIcon(r.order, r.color)}
                          eventHandlers={{ click: () => setSelectedId(zone.id) }}
                        >
                          <Popup>
                            <b>
                              {r.team} · stop {r.order}
                            </b>
                            <br />
                            {zone.id} ({zone.tier}) — arrives in{" "}
                            {minutesLabel(r.stop.arrival_min)}
                          </Popup>
                        </Marker>
                      );
                    })}

                  {plan.facilities
                    .filter((f) => FACILITY_ICONS[f.type])
                    .map((f) => (
                      <Marker
                        key={f.id}
                        position={[f.lat, f.lon]}
                        icon={facilityIcon(f.type)}
                      >
                        <Popup>
                          <b>{f.name}</b>
                          <br />
                          {f.type.replace("_", " ")}
                          {f.id === plan.base.id ? " — rescue base" : ""}
                        </Popup>
                      </Marker>
                    ))}

                  {isCase && <ClickCatcher onPick={setPoint} />}
                  {point && isCase && (
                    <CircleMarker
                      center={[point.lat, point.lon]}
                      radius={9}
                      pathOptions={{ color: "#3fd7c7", weight: 2, fillOpacity: 0.2 }}
                    />
                  )}
                  {isCase &&
                    reports.map((r) => (
                      <Marker
                        key={`rep-${r.id}`}
                        position={[r.lat, r.lon]}
                        icon={facilityIcon("report")}
                      >
                        <Popup>
                          <b>Field report #{r.id}</b>
                          <br />
                          Model 1: {r.prediction} ({r.confidence}%)
                          <br />
                          {r.applied
                            ? `Building set to ${r.mapped_damage}`
                            : "Low confidence, not applied"}
                        </Popup>
                      </Marker>
                    ))}
                  <FlyTo target={selected} />
                  {overlay && <FitBounds bounds={overlay.bounds} />}
                </MapContainer>
              </div>

              <div className="aq-panel aq-legend">
                {Object.entries(TIER_COLORS).map(([tier, color]) => (
                  <span key={tier} style={{ "--c": color }}>
                    <i /> {tier}
                  </span>
                ))}
                <span>🏥 hospital/clinic</span>
                <span>🚒 fire station</span>
                <span>Numbered pins = visit order</span>
              </div>
            </div>

            <aside className="aq-side" aria-label="Plan details">
              {isCase && (
                <div className="aq-panel aq-card">
                  <h3>Field photo report (Model 1)</h3>
                  <p className="aq-note" style={{ margin: "0 0 10px" }}>
                    1. Click a building on the map. 2. Add a photo of it. The
                    AI classifies it and the rescue plan updates.
                  </p>
                  <div className="aq-note" style={{ marginBottom: 8 }}>
                    {point
                      ? `Selected: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`
                      : "No location selected yet."}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={reportBusy}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) submitReport(f, f.name);
                      e.target.value = "";
                    }}
                  />
                  <div className="aq-note" style={{ margin: "10px 0 6px" }}>
                    or try a real sample photo:
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Collapsed", "Damaged", "Intact"].map((label) => (
                      <button
                        key={label}
                        className="aq-chip"
                        disabled={reportBusy}
                        onClick={() => trySamplePhoto(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {reportBusy && <div className="aq-note" style={{ marginTop: 8 }}>Analyzing photo…</div>}
                  {reportMsg && (
                    <div
                      className={reportMsg.error ? "aq-state err" : "aq-state"}
                      role={reportMsg.error ? "alert" : "status"}
                      style={{ margin: "10px 0 0", padding: 10, fontSize: 12.5 }}
                    >
                      {reportMsg.text}
                    </div>
                  )}
                  {reports.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <span className="aq-note">
                        {reports.length} field report{reports.length === 1 ? "" : "s"} applied
                      </span>{" "}
                      <button className="aq-btn ghost" onClick={resetReports}>
                        RESET
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selected && (
                <div className="aq-panel aq-card aq-detail">
                  <h3>Zone {selected.id}</h3>
                  <dl>
                    <dt>Priority</dt>
                    <dd>
                      <span
                        className="aq-badge"
                        style={{ "--c": TIER_COLORS[selected.tier] }}
                      >
                        {selected.tier}
                      </span>{" "}
                      #{selected.rank}
                    </dd>
                    <dt>Damaged</dt>
                    <dd>
                      {selected.destroyed} destroyed · {selected.major} major ·{" "}
                      {selected.minor} minor
                    </dd>
                    <dt>Est. trapped</dt>
                    <dd>~{selected.est_trapped}</dd>
                    <dt>Est. displaced</dt>
                    <dd>~{selected.est_displaced}</dd>
                    <dt>Assigned</dt>
                    <dd>
                      {routedStops[selected.id]
                        ? `${routedStops[selected.id].team}, stop ${routedStops[selected.id].order}, ETA ${minutesLabel(routedStops[selected.id].stop.arrival_min)}`
                        : "Not in routed set — raise “Zones to route”"}
                    </dd>
                    <dt>Medical</dt>
                    <dd>
                      {selected.nearest_medical
                        ? `${selected.nearest_medical.name} · ${selected.nearest_medical.distance_m} m (${selected.nearest_medical.eta_min} min)`
                        : "—"}
                    </dd>
                  </dl>
                </div>
              )}

              <div className="aq-panel aq-card">
                <h3>Team routes</h3>
                {plan.routes.map((route, ti) => (
                  <div key={route.team} style={{ marginBottom: 12 }}>
                    <div className="aq-team-head">
                      <i
                        className="aq-swatch"
                        style={{ "--c": TEAM_COLORS[ti % TEAM_COLORS.length] }}
                      />
                      {route.team}
                      <span className="aq-note" style={{ marginLeft: "auto" }}>
                        {route.total_distance_km} km · done in{" "}
                        {minutesLabel(route.finish_min)}
                      </span>
                    </div>
                    {route.stops.map((stop, i) => (
                      <div className="aq-stop" key={stop.zone_id}>
                        <strong>{i + 1}.</strong>
                        <span>
                          {stop.zone_id} · ~{stop.est_trapped} trapped
                        </span>
                        <span className="t">
                          +{minutesLabel(stop.arrival_min)}
                        </span>
                      </div>
                    ))}
                    {route.debris_segments > 0 && (
                      <div className="aq-note">
                        ⚠ {route.debris_segments} road segment(s) near collapsed
                        buildings — expect delays.
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="aq-panel aq-card">
                <h3>Rescue priority ranking</h3>
                {zones.slice(0, 15).map((zone) => (
                  <button
                    key={zone.id}
                    className={`aq-row ${selectedId === zone.id ? "sel" : ""}`}
                    onClick={() => setSelectedId(zone.id)}
                  >
                    <span
                      className="aq-badge"
                      style={{ "--c": TIER_COLORS[zone.tier] }}
                    >
                      {zone.tier}
                    </span>
                    <span>
                      <b>
                        {zone.id} · {zone.damaged_buildings} damaged
                      </b>
                      <small>
                        ~{zone.est_trapped} trapped · ~{zone.est_displaced}{" "}
                        displaced
                      </small>
                    </span>
                    <span className="aq-note">#{zone.rank}</span>
                  </button>
                ))}
              </div>

              <div className="aq-panel aq-card aq-note">
                <button
                  className="aq-btn ghost"
                  onClick={() => setShowAssumptions((v) => !v)}
                  aria-expanded={showAssumptions}
                >
                  {showAssumptions ? "HIDE" : "SHOW"} METHOD &amp; ASSUMPTIONS
                </button>
                {showAssumptions && (
                  <ul>
                    <li>
                      People per building = footprint × {plan.assumptions.floors}{" "}
                      floors ÷ {plan.assumptions.m2_per_person} m² per person.
                    </li>
                    <li>
                      Trapped: {plan.assumptions.trapped_fraction["destroyed"] * 100}%
                      of occupants in destroyed and{" "}
                      {plan.assumptions.trapped_fraction["major-damage"] * 100}% in
                      major-damage buildings.
                    </li>
                    <li>Priority = 3 × trapped + 0.5 × displaced per ~220 m cell.</li>
                    <li>{plan.assumptions.routing_note}</li>
                    <li>
                      Estimates support planning only and must be confirmed by
                      field assessment.
                    </li>
                  </ul>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
