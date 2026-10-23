import { useEffect, useState } from "react";
import {
  MapContainer,
  CircleMarker,
  Polyline,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";

import NavigationBar from "./NavigationBar";
import { API_URL } from "../config";
import { useActivePlan } from "../incidentStore";
import { DarkBasemap } from "./mapLayers";
import "./aq.css";

const TIER_COLORS = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#facc15",
  LOW: "#22c55e",
};

const TEAM_COLORS = ["#3fd7c7", "#a78bfa", "#f472b6", "#60a5fa"];

const fmt = (n) => Number(n).toLocaleString();

const baseIcon = L.divIcon({
  className: "",
  html: '<div class="aq-facility">🚒</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function minutesLabel(min) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${Math.round(min - h * 60)} min`;
}

function Step({ n, title, value, detail, to, action }) {
  return (
    <div className="aq-panel aq-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="aq-label">Step {n}</div>
      <h3 style={{ margin: 0, color: "#edf5f3", fontSize: 13, letterSpacing: 0.02 }}>
        {title}
      </h3>
      <strong style={{ fontSize: 22, letterSpacing: "-0.02em" }}>{value}</strong>
      <span className="aq-note" style={{ flex: 1 }}>{detail}</span>
      <Link to={to} className="aq-btn ghost" style={{ textDecoration: "none", textAlign: "center" }}>
        {action} →
      </Link>
    </div>
  );
}

export default function MissionControl() {
  const active = useActivePlan({ teams: 3, topZones: 12 });
  const incident = active.incident;
  const [casePlan, setCasePlan] = useState(null);
  const [info, setInfo] = useState(null);
  const [caseError, setCaseError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/incident/info`).then((r) => r.json()).then(setInfo).catch(() => {});
    if (incident) return;
    fetch(`${API_URL}/rescue/plan?teams=3&top_zones=12`)
      .then((r) => {
        if (!r.ok) throw new Error(`Rescue plan failed (${r.status})`);
        return r.json();
      })
      .then(setCasePlan)
      .catch((err) => setCaseError(`${err.message}. Is the backend running on ${API_URL}?`));
  }, [incident]);

  const plan = incident ? active.plan : casePlan;
  const error = incident ? active.error : caseError;
  const modelled = !!incident;

  const impact = plan?.impact;
  const zones = plan?.zones || [];
  const critical = zones.filter((z) => z.tier === "CRITICAL").length;
  const high = zones.filter((z) => z.tier === "HIGH").length;
  const finish = plan ? Math.max(...plan.routes.map((r) => r.finish_min)) : 0;

  return (
    <div className="aq-page">
      <NavigationBar />

      <div className="aq-wrap">
        <header className="aq-head">
          <div>
            <div className="aq-eyebrow">AIQUAKE / MISSION CONTROL</div>
            <h1 className="aq-title">
              {incident
                ? `M${incident.magnitude} ${incident.title}`
                : info ? `${info.name} — ${info.area}` : "Loading incident…"}
            </h1>
            <p className="aq-sub">
              {incident
                ? `Your active incident, analysed around ${incident.point?.name?.split(",").slice(0, 2).join(",")}. Damage is modelled from the earthquake's measured shaking.`
                : "Demo incident with real assessed damage: building damage becomes people-at-risk estimates, ranked rescue zones and road routes for each team."}
              {!incident && info?.event_date ? ` Event date: ${info.event_date}.` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/new" className="aq-btn" style={{ textDecoration: "none" }}>
              + NEW INCIDENT (ANY LOCATION)
            </Link>
            <Link to="/rescue" className="aq-btn ghost" style={{ textDecoration: "none" }}>
              OPEN RESCUE PLANNER →
            </Link>
          </div>
        </header>

        {error && (
          <div className="aq-state err" role="alert">
            {error}
          </div>
        )}
        {!plan && !error && (
          <div className="aq-state busy">
            Loading incident data… {incident ? "(a new city can take 1–2 minutes the first time)" : ""}
          </div>
        )}

        {plan && (
          <>
            <section className="aq-kpis" aria-label="Incident summary">
              <div className="aq-kpi">
                <span>Buildings assessed</span>
                <strong>{fmt(impact.total_buildings)}</strong>
              </div>
              <div className="aq-kpi" style={{ "--kpi": "#f97316" }}>
                <span>Damaged</span>
                <strong>{fmt(impact.damaged_buildings)}</strong>
                <small>{impact.damaged_share_pct}% of buildings</small>
              </div>
              <div className="aq-kpi">
                <span>People in area (est.)</span>
                <strong>{fmt(impact.estimated_population)}</strong>
              </div>
              <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}>
                <span>Trapped (est.)</span>
                <strong>{fmt(impact.estimated_trapped)}</strong>
                <small>need search &amp; rescue</small>
              </div>
              <div className="aq-kpi" style={{ "--kpi": "#facc15" }}>
                <span>Displaced (est.)</span>
                <strong>{fmt(impact.estimated_displaced)}</strong>
                <small>need shelter</small>
              </div>
              {modelled ? (
                <div className="aq-kpi" style={{ "--kpi": "#a78bfa" }}>
                  <span>Shaking here (MMI)</span>
                  <strong>{plan.shaking?.mean_mmi ?? "—"}</strong>
                  <small>max {plan.shaking?.max_mmi ?? "—"} (USGS ShakeMap)</small>
                </div>
              ) : (
                <div className="aq-kpi" style={{ "--kpi": "#3fd7c7" }}>
                  <span>Field reports</span>
                  <strong>{info?.field_reports ?? 0}</strong>
                  <small>photos analysed by AI</small>
                </div>
              )}
            </section>

            <section
              aria-label="Pipeline"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <Step
                n="1"
                title="Damage data"
                value={`${fmt(impact.total_buildings)} buildings`}
                detail={modelled
                  ? "Mapped buildings, each with a damage class modelled from the earthquake's shaking."
                  : "Real building footprints with an AI damage class each (none / minor / major / destroyed)."}
                to="/gis"
                action="View damage map"
              />
              <Step
                n="2"
                title="Field photos → AI"
                value={info?.model1_accuracy ? `${(info.model1_accuracy * 100).toFixed(0)}% accurate` : "Model 1"}
                detail={modelled
                  ? "Field-photo updates are available in the Caraballeda demo; here damage comes from measured shaking."
                  : "Upload a photo of a building; the classifier decides Collapsed / Damaged / Intact and updates the plan."}
                to="/rescue"
                action="Add a field photo"
              />
              <Step
                n="3"
                title="Impact estimate"
                value={`~${fmt(impact.estimated_trapped)} trapped`}
                detail={`${fmt(impact.estimated_displaced)} displaced of ~${fmt(impact.estimated_population)} people (night occupancy).`}
                to="/rescue"
                action="See method"
              />
              <Step
                n="4"
                title="Rescue priorities"
                value={`${critical} critical`}
                detail={`${high} high-priority and ${zones.length} damaged zones in total, ranked by people at risk.`}
                to="/rescue"
                action="See ranking"
              />
              <Step
                n="5"
                title="Team routes"
                value={`${plan.routes.length} teams`}
                detail={`Road routes from ${plan.base.name}; all ${plan.routed_zone_count} top zones covered within ~${minutesLabel(finish)}.`}
                to="/rescue"
                action="Open routes"
              />
            </section>

            <div className="aq-split">
              <div>
                <div className="aq-map" style={{ height: 460 }}>
                  <MapContainer
                    key={`${plan.base.lat}-${plan.base.lon}`}
                    center={[plan.base.lat, plan.base.lon]}
                    zoom={14}
                    scrollWheelZoom={false}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <DarkBasemap />
                    {zones.map((z) => (
                      <CircleMarker
                        key={z.id}
                        center={[z.lat, z.lon]}
                        radius={z.tier === "LOW" ? 4 : 8}
                        pathOptions={{
                          color: TIER_COLORS[z.tier],
                          fillColor: TIER_COLORS[z.tier],
                          fillOpacity: 0.45,
                          weight: 1,
                        }}
                      />
                    ))}
                    {plan.routes.map((route, ti) =>
                      route.legs.map((leg, li) => (
                        <Polyline
                          key={`${route.team}-${li}`}
                          positions={leg}
                          pathOptions={{
                            color: TEAM_COLORS[ti % TEAM_COLORS.length],
                            weight: 3,
                            opacity: 0.9,
                          }}
                        />
                      ))
                    )}
                    <Marker position={[plan.base.lat, plan.base.lon]} icon={baseIcon} />
                  </MapContainer>
                </div>
                <div className="aq-panel aq-legend">
                  {Object.entries(TIER_COLORS).map(([tier, color]) => (
                    <span key={tier} style={{ "--c": color }}>
                      <i /> {tier}
                    </span>
                  ))}
                  <span>🚒 rescue base</span>
                  <span>Coloured lines = team routes</span>
                </div>
              </div>

              <aside className="aq-side">
                <div className="aq-panel aq-card">
                  <h3>Top 5 rescue priorities</h3>
                  {zones.slice(0, 5).map((z) => (
                    <Link
                      key={z.id}
                      to="/rescue"
                      className="aq-row"
                      style={{ textDecoration: "none" }}
                    >
                      <span className="aq-badge" style={{ "--c": TIER_COLORS[z.tier] }}>
                        {z.tier}
                      </span>
                      <span>
                        <b>
                          {z.id} · {z.destroyed} destroyed, {z.major} major
                        </b>
                        <small>
                          ~{z.est_trapped} trapped
                          {z.nearest_medical
                            ? ` · ${z.nearest_medical.name} ${z.nearest_medical.distance_m} m away`
                            : ""}
                        </small>
                      </span>
                      <span className="aq-note">#{z.rank}</span>
                    </Link>
                  ))}
                </div>

                <div className="aq-panel aq-card aq-note">
                  <h3>What is real, what is estimated</h3>
                  <ul>
                    <li>
                      {modelled ? (
                        <>
                          <b>Modelled:</b> damage = USGS ShakeMap shaking + a generic
                          vulnerability table; buildings, roads and facilities are from OpenStreetMap.
                        </>
                      ) : (
                        <>
                          <b>Real:</b> building footprints and damage assessment
                          ({info?.damage_source || "HOTOSM fAIr"}), OpenStreetMap roads
                          and facilities.
                        </>
                      )}
                    </li>
                    <li>
                      <b>Estimated:</b> people, trapped and displaced counts use
                      assumed occupancy ratios (see the Rescue Planner method).
                    </li>
                    <li>
                      <b>Measured:</b> the photo classifier scores{" "}
                      {info?.model1_accuracy ? `${(info.model1_accuracy * 100).toFixed(1)}%` : "—"}{" "}
                      on unseen test images (Model page).
                    </li>
                    <li>
                      <b>Experimental:</b> the satellite-pair model (Model 2) is
                      not validated.
                    </li>
                    <li>{modelled ? plan.model_note : info?.damage_note}</li>
                  </ul>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
