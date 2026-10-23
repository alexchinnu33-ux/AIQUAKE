import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  GeoJSON,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import NavigationBar from "./NavigationBar";
import { API_URL } from "../config";
import { useActivePlan } from "../incidentStore";
import { DarkBasemap } from "./mapLayers";
import "./aq.css";

const DAMAGE_COLORS = {
  "no-damage": "#22c55e",
  "minor-damage": "#facc15",
  "major-damage": "#f97316",
  destroyed: "#ef4444",
};

const DAMAGE_LABELS = {
  "no-damage": "No damage",
  "minor-damage": "Minor damage",
  "major-damage": "Major damage",
  destroyed: "Destroyed",
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

function formatConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${(number <= 1 ? number * 100 : number).toFixed(1)}%`;
}

export default function GISMap() {
  const active = useActivePlan({ topZones: 12 });
  const incident = active.incident;
  const [caseData, setCaseData] = useState(null);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseError, setCaseError] = useState("");
  const [visible, setVisible] = useState({
    "no-damage": false,
    "minor-damage": true,
    "major-damage": true,
    destroyed: true,
  });

  useEffect(() => {
    if (incident) return;
    async function loadBuildings() {
      try {
        const response = await fetch(`${API_URL}/gis/buildings`);
        if (!response.ok) {
          throw new Error(`GIS API request failed: ${response.status}`);
        }
        const data = await response.json();
        if (!data.features) {
          throw new Error(data.error || "Building data unavailable.");
        }
        setCaseData(data);
      } catch (err) {
        setCaseError(err.message || "Unable to load GIS building data.");
      } finally {
        setCaseLoading(false);
      }
    }

    loadBuildings();
  }, [incident]);

  // modelled incident: damaged buildings come from the scenario plan
  const plan = active.plan;
  const worldData = useMemo(() => {
    if (!plan) return null;
    return {
      ...plan.damage_geojson,
      features: plan.damage_geojson.features.map((f, i) => ({
        ...f,
        properties: { ...f.properties, damage: f.properties.damage_class, building_id: `M${i + 1}` },
      })),
    };
  }, [plan]);

  const geoData = incident ? worldData : caseData;
  const loading = incident ? active.loading : caseLoading;
  const error = incident ? active.error : caseError;

  const counts = useMemo(() => {
    const result = Object.fromEntries(
      Object.keys(DAMAGE_LABELS).map((k) => [k, 0])
    );
    if (incident && plan) {
      return { ...result, ...plan.impact.damage_counts };
    }
    geoData?.features.forEach((f) => {
      if (result[f.properties.damage] !== undefined) {
        result[f.properties.damage] += 1;
      }
    });
    return result;
  }, [geoData, incident, plan]);

  const total = incident ? plan?.impact.total_buildings || 0 : geoData?.features.length || 0;
  const damaged = total - counts["no-damage"];

  const filtered = useMemo(() => {
    if (!geoData) return null;
    return {
      ...geoData,
      features: geoData.features.filter((f) => visible[f.properties.damage]),
    };
  }, [geoData, visible]);

  const filterKey = Object.values(visible).join("");

  const style = (feature) => {
    const color = DAMAGE_COLORS[feature.properties.damage] || "#94a3b8";
    return { color, weight: 1, fillColor: color, fillOpacity: 0.6 };
  };

  function onEach(feature, layer) {
    const p = feature.properties;
    layer.bindPopup(`
      <b>Building ${escapeHtml(p.building_id ?? p.id ?? "?")}</b><br/>
      Damage: ${escapeHtml(DAMAGE_LABELS[p.damage] || "Unknown")}<br/>
      Model confidence: ${formatConfidence(p.confidence)}
    `);
    layer.on({
      mouseover: (e) => e.target.setStyle({ weight: 3, fillOpacity: 0.85 }),
      mouseout: (e) => e.target.setStyle(style(feature)),
    });
  }

  return (
    <div className="aq-page">
      <NavigationBar />

      <div className="aq-wrap">
        <header className="aq-head">
          <div>
            <div className="aq-eyebrow">AIQUAKE / GIS</div>
            <h1 className="aq-title">Damage Map</h1>
            <p className="aq-sub">
              {incident
                ? `Modelled building damage around ${incident.point?.name?.split(",").slice(0, 2).join(",")} from the shaking of M${incident.magnitude} ${incident.title}. Undamaged buildings are not drawn.`
                : "Building-level damage classification for Caraballeda, Venezuela (real assessed damage). Toggle damage classes to focus on the buildings that matter."}
            </p>
          </div>
        </header>

        {loading && <div className="aq-state busy">Loading building damage data…</div>}
        {error && (
          <div className="aq-state err" role="alert">
            <strong>GIS error:</strong> {error}
          </div>
        )}

        {geoData && (
          <>
            <section className="aq-kpis" aria-label="Damage summary">
              <div className="aq-kpi">
                <span>Total buildings</span>
                <strong>{total.toLocaleString()}</strong>
              </div>
              <div className="aq-kpi" style={{ "--kpi": "#f97316" }}>
                <span>Damaged</span>
                <strong>{damaged.toLocaleString()}</strong>
                <small>{((100 * damaged) / total).toFixed(1)}% of buildings</small>
              </div>
              {Object.entries(DAMAGE_LABELS).map(([key, label]) => (
                <div className="aq-kpi" key={key} style={{ "--kpi": DAMAGE_COLORS[key] }}>
                  <span>{label}</span>
                  <strong>{counts[key].toLocaleString()}</strong>
                </div>
              ))}
            </section>

            <div className="aq-chips" role="group" aria-label="Damage classes shown">
              {Object.entries(DAMAGE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`aq-chip ${visible[key] ? "on" : ""}`}
                  aria-pressed={visible[key]}
                  onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: DAMAGE_COLORS[key],
                      marginRight: 7,
                    }}
                  />
                  {label}
                </button>
              ))}
            </div>

            <div className="aq-map">
              <MapContainer
                key={incident ? `${incident.point?.lat}-${incident.point?.lon}` : "case"}
                center={incident && plan ? [plan.base.lat, plan.base.lon] : [10.608, -66.847]}
                zoom={incident ? 15 : 14}
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

                <GeoJSON
                  key={`${filterKey}-${incident ? total : "case"}`}
                  data={filtered}
                  style={style}
                  onEachFeature={onEach}
                />
              </MapContainer>
            </div>

            <p className="aq-note" style={{ marginTop: 12 }}>
              Damage classes come from an AI building-damage model applied to
              post-event satellite imagery and are candidates for field
              verification, not confirmed assessments.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
