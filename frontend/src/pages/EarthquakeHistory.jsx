import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";

import NavigationBar from "./NavigationBar";
import { API_URL } from "../config";
import { useIncident } from "../incidentStore";
import { DarkBasemap } from "./mapLayers";
import "./aq.css";

const THIS_YEAR = new Date().getFullYear();

const PRESETS = [
  { label: "Great quakes M8.5+ (since 1900)", start: 1900, end: THIS_YEAR, mag: 8.5, source: "archive" },
  { label: "Deadliest on record", start: 1900, end: THIS_YEAR, mag: 6, source: "archive", deadly: true },
  { label: "M7.5+ since 2000", start: 2000, end: THIS_YEAR, mag: 7.5, source: "auto" },
  { label: "Last 10 years M7+", start: THIS_YEAR - 10, end: THIS_YEAR, mag: 7, source: "auto" },
];

function magColor(m) {
  if (m >= 9) return "#ef4444";
  if (m >= 8) return "#f97316";
  if (m >= 7) return "#facc15";
  return "#3fd7c7";
}

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString());

function Focus({ event }) {
  const map = useMap();

  useEffect(() => {
    if (event) {
      map.flyTo([event.latitude, event.longitude], Math.max(map.getZoom(), 5), {
        duration: 0.8,
      });
    }
  }, [event, map]);

  return null;
}

export default function EarthquakeHistory() {
  const active = useIncident();
  const [region, setRegion] = useState(null);
  const [regionError, setRegionError] = useState("");

  const lat = active?.point?.lat;
  const lon = active?.point?.lon;
  useEffect(() => {
    if (lat == null) return undefined;
    const controller = new AbortController();
    fetch(`${API_URL}/region/intel?lat=${lat}&lon=${lon}&radius_km=300&years=50&min_magnitude=4.5`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.detail || "Regional history unavailable");
        setRegion(body);
        setRegionError("");
      })
      .catch((err) => err.name !== "AbortError" && setRegionError(err.message));
    return () => controller.abort();
  }, [lat, lon]);

  const [startYear, setStartYear] = useState(2000);
  const [endYear, setEndYear] = useState(THIS_YEAR);
  const [minMag, setMinMag] = useState(7.5);
  const [source, setSource] = useState("auto");
  const [deadlyOnly, setDeadlyOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState({ key: "magnitude", dir: -1 });
  const [query, setQuery] = useState({
    start: 2000, end: THIS_YEAR, mag: 7.5, source: "auto",
  });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          start_year: query.start,
          end_year: query.end,
          min_magnitude: query.mag,
          source: query.source,
        });
        const response = await fetch(`${API_URL}/earthquakes/history?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        setData(await response.json());
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load earthquake history.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [query]);

  function apply(next = {}) {
    setQuery({
      start: startYear,
      end: endYear,
      mag: minMag,
      source,
      ...next,
    });
  }

  function applyPreset(p) {
    setStartYear(p.start);
    setEndYear(p.end);
    setMinMag(p.mag);
    setSource(p.source);
    setDeadlyOnly(!!p.deadly);
    setSearch("");
    setQuery({ start: p.start, end: p.end, mag: p.mag, source: p.source });
  }

  const events = useMemo(() => {
    let list = data?.events || [];
    if (deadlyOnly) list = list.filter((e) => e.deaths);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((e) =>
        `${e.name} ${e.place}`.toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => {
      const av = a[sort.key] ?? -1;
      const bv = b[sort.key] ?? -1;
      if (typeof av === "string") return av.localeCompare(bv) * sort.dir;
      return (av - bv) * sort.dir;
    });
  }, [data, deadlyOnly, search, sort]);

  const selected = events.find((e) => e.id === selectedId) || null;

  const perYear = useMemo(() => {
    const counts = {};
    events.forEach((e) => (counts[e.year] = (counts[e.year] || 0) + 1));
    const years = Object.keys(counts).map(Number);
    if (!years.length) return { bars: [], max: 0 };
    const min = Math.min(...years);
    const max = Math.max(...years);
    const bars = [];
    for (let y = min; y <= max; y++) bars.push({ year: y, count: counts[y] || 0 });
    return { bars, max: Math.max(...bars.map((b) => b.count)) };
  }, [events]);

  const strongest = events.reduce(
    (best, e) => ((e.magnitude ?? 0) > (best?.magnitude ?? 0) ? e : best),
    null
  );
  const totalDeaths = events.reduce((sum, e) => sum + (e.deaths || 0), 0);
  const deadliest = events.reduce(
    (best, e) => ((e.deaths ?? 0) > (best?.deaths ?? 0) ? e : best),
    null
  );
  const tsunamis = events.filter((e) => e.tsunami).length;

  function sortBy(key) {
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }));
  }

  const arrow = (key) =>
    sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : "";

  return (
    <div className="aq-page">
      <NavigationBar />

      <div className="aq-wrap">
        <header className="aq-head">
          <div>
            <div className="aq-eyebrow">AIQUAKE / HISTORICAL RECORD</div>
            <h1 className="aq-title">Earthquake History</h1>
            <p className="aq-sub">
              Explore previous earthquakes by year and magnitude, from the live
              USGS catalogue and a curated archive of the most destructive
              events. Past events show where risk concentrates and why fast
              damage assessment matters.
            </p>
          </div>
          <Link to="/rescue" className="aq-btn" style={{ textDecoration: "none" }}>
            SEE LATEST CASE: CARABALLEDA →
          </Link>
        </header>

        {active && (
          <section className="aq-panel aq-card" style={{ marginBottom: 16 }} aria-label="Active incident region">
            <h3>Around your active incident — {active.point?.name?.split(",").slice(0, 2).join(",")}</h3>
            {regionError && <div className="aq-note" style={{ color: "#ffc3c7" }}>{regionError}</div>}
            {!region && !regionError && <div className="aq-state busy" style={{ margin: 0 }}>Loading regional earthquake history…</div>}
            {region && (
              <>
                <div className="aq-kpis" style={{ marginBottom: 12 }}>
                  <div className="aq-kpi"><span>Hazard (past rate)</span><strong>{region.stats.hazard_level}</strong><small>{region.stats.events} quakes M{region.stats.min_magnitude}+ in {region.stats.years} y</small></div>
                  <div className="aq-kpi"><span>M6+ in next 10 y</span><strong>{region.stats.probability_10y ? `${(region.stats.probability_10y["M6+"] * 100).toFixed(0)}%` : "—"}</strong><small>statistical, not a prediction</small></div>
                  <div className="aq-kpi"><span>M7+ in next 10 y</span><strong>{region.stats.probability_10y ? `${(region.stats.probability_10y["M7+"] * 100).toFixed(1)}%` : "—"}</strong></div>
                  <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}><span>Largest nearby</span><strong>{region.stats.largest ? `M${region.stats.largest.magnitude}` : "—"}</strong><small>{region.stats.largest ? `${region.stats.largest.year}` : ""}</small></div>
                </div>
                <div className="aq-note">Largest earthquakes within 300 km:</div>
                {region.events.slice(0, 5).map((e) => (
                  <div className="aq-stop" key={e.id}>
                    <strong>M{e.magnitude}</strong>
                    <span>{e.place} · {e.time.slice(0, 10)}</span>
                    <span className="t">{e.distance_km} km</span>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        <div className="aq-chips" aria-label="Quick filters">
          {PRESETS.map((p) => (
            <button key={p.label} className="aq-chip" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        <form
          className="aq-panel aq-controls"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <div className="aq-field" style={{ minWidth: 100 }}>
            <label htmlFor="sy">From year</label>
            <input
              id="sy"
              type="number"
              min="1900"
              max={THIS_YEAR}
              value={startYear}
              onChange={(e) => setStartYear(+e.target.value)}
            />
          </div>
          <div className="aq-field" style={{ minWidth: 100 }}>
            <label htmlFor="ey">To year</label>
            <input
              id="ey"
              type="number"
              min="1900"
              max={THIS_YEAR}
              value={endYear}
              onChange={(e) => setEndYear(+e.target.value)}
            />
          </div>
          <div className="aq-field">
            <label htmlFor="mm">
              Min magnitude <output>{minMag.toFixed(1)}</output>
            </label>
            <input
              id="mm"
              type="range"
              min="5"
              max="9"
              step="0.1"
              value={minMag}
              onChange={(e) => setMinMag(+e.target.value)}
            />
          </div>
          <div className="aq-field">
            <span className="aq-label">Data source</span>
            <div className="aq-seg" role="group" aria-label="Data source">
              {[
                ["auto", "AUTO"],
                ["live", "USGS LIVE"],
                ["archive", "ARCHIVE"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={source === value}
                  onClick={() => setSource(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="aq-field">
            <label htmlFor="q">Search place / name</label>
            <input
              id="q"
              type="search"
              placeholder="e.g. Japan, Haiti"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#829794" }}>
            <input
              type="checkbox"
              checked={deadlyOnly}
              onChange={(e) => setDeadlyOnly(e.target.checked)}
            />
            With recorded deaths only
          </label>
          <button className="aq-btn" type="submit" disabled={loading}>
            {loading ? "LOADING…" : "APPLY"}
          </button>
        </form>

        {error && (
          <div className="aq-state err" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {data?.note && <div className="aq-state">{data.note}</div>}

        <section className="aq-kpis" aria-label="Summary">
          <div className="aq-kpi">
            <span>Earthquakes</span>
            <strong>{fmt(events.length)}</strong>
            <small>{data?.source || "…"}</small>
          </div>
          <div className="aq-kpi" style={{ "--kpi": "#ef4444" }}>
            <span>Strongest</span>
            <strong>{strongest ? `M${strongest.magnitude}` : "—"}</strong>
            <small>{strongest ? `${strongest.name} (${strongest.year})` : ""}</small>
          </div>
          <div className="aq-kpi" style={{ "--kpi": "#f97316" }}>
            <span>Deadliest</span>
            <strong>{deadliest?.deaths ? fmt(deadliest.deaths) : "—"}</strong>
            <small>{deadliest?.deaths ? `${deadliest.name} (${deadliest.year})` : "no fatality data in range"}</small>
          </div>
          <div className="aq-kpi" style={{ "--kpi": "#facc15" }}>
            <span>Recorded deaths</span>
            <strong>{fmt(totalDeaths)}</strong>
            <small>approx., curated events only</small>
          </div>
          <div className="aq-kpi" style={{ "--kpi": "#60a5fa" }}>
            <span>Tsunami-linked</span>
            <strong>{tsunamis}</strong>
            <small>events flagged</small>
          </div>
        </section>

        <div className="aq-split" style={{ opacity: loading ? 0.6 : 1 }}>
          <div>
            <div className="aq-map">
              <MapContainer
                center={[20, 10]}
                zoom={2}
                minZoom={2}
                worldCopyJump
                scrollWheelZoom
                style={{ width: "100%", height: "100%" }}
              >
                <DarkBasemap />
                {events.map((e) => (
                  <CircleMarker
                    key={e.id}
                    center={[e.latitude, e.longitude]}
                    radius={Math.max(3, (e.magnitude - 4) * 3.2)}
                    pathOptions={{
                      color: magColor(e.magnitude),
                      weight: selectedId === e.id ? 3 : 1,
                      fillColor: magColor(e.magnitude),
                      fillOpacity: 0.45,
                    }}
                    eventHandlers={{ click: () => setSelectedId(e.id) }}
                  >
                    <Popup>
                      <b>{e.name}</b>
                      <br />
                      M{e.magnitude} · {e.date}
                      {e.deaths ? (
                        <>
                          <br />~{fmt(e.deaths)} deaths
                        </>
                      ) : null}
                    </Popup>
                  </CircleMarker>
                ))}
                <Focus event={selected} />
              </MapContainer>
            </div>

            <div className="aq-panel aq-legend">
              {[
                ["M9+", "#ef4444"],
                ["M8–8.9", "#f97316"],
                ["M7–7.9", "#facc15"],
                ["below M7", "#3fd7c7"],
              ].map(([label, color]) => (
                <span key={label} style={{ "--c": color }}>
                  <i /> {label}
                </span>
              ))}
              <span>Circle size = magnitude</span>
            </div>
          </div>

          <aside className="aq-side" aria-label="Details">
            <div className="aq-panel aq-card">
              <h3>Events per year</h3>
              {perYear.bars.length ? (
                <>
                  <div className="aq-bars" role="img" aria-label="Bar chart of earthquakes per year">
                    {perYear.bars.map((b) => (
                      <div
                        key={b.year}
                        className="aq-bar"
                        title={`${b.year}: ${b.count} earthquake${b.count === 1 ? "" : "s"}`}
                        style={{ height: `${Math.max(2, (b.count / perYear.max) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <div className="aq-bar-axis">
                    <span>{perYear.bars[0].year}</span>
                    <span>max {perYear.max}/yr</span>
                    <span>{perYear.bars[perYear.bars.length - 1].year}</span>
                  </div>
                </>
              ) : (
                <div className="aq-note">No events match these filters.</div>
              )}
            </div>

            {selected && (
              <div className="aq-panel aq-card aq-detail">
                <h3>{selected.name}</h3>
                <dl>
                  <dt>Magnitude</dt>
                  <dd>M{selected.magnitude}</dd>
                  <dt>Date</dt>
                  <dd>{selected.date}</dd>
                  <dt>Place</dt>
                  <dd>{selected.place || "—"}</dd>
                  <dt>Depth</dt>
                  <dd>{selected.depth_km != null ? `${selected.depth_km} km` : "—"}</dd>
                  <dt>Deaths</dt>
                  <dd>{selected.deaths ? `~${fmt(selected.deaths)}` : "not recorded"}</dd>
                  <dt>Tsunami</dt>
                  <dd>{selected.tsunami ? "Yes" : "No"}</dd>
                  {selected.url && (
                    <>
                      <dt>Source</dt>
                      <dd>
                        <a href={selected.url} target="_blank" rel="noreferrer" style={{ color: "#3fd7c7" }}>
                          USGS event page
                        </a>
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )}

            <div className="aq-panel aq-card aq-note">
              Fatality figures are rounded, widely cited estimates and vary by
              source. Live USGS events carry no fatality data unless they match
              a curated entry.
            </div>
          </aside>
        </div>

        <div className="aq-panel aq-table-wrap">
          <table className="aq-table">
            <thead>
              <tr>
                <th onClick={() => sortBy("date")}>Date{arrow("date")}</th>
                <th onClick={() => sortBy("name")}>Event{arrow("name")}</th>
                <th className="num" onClick={() => sortBy("magnitude")}>
                  Mag{arrow("magnitude")}
                </th>
                <th className="num" onClick={() => sortBy("depth_km")}>
                  Depth{arrow("depth_km")}
                </th>
                <th className="num" onClick={() => sortBy("deaths")}>
                  Deaths{arrow("deaths")}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 250).map((e) => (
                <tr
                  key={e.id}
                  className={selectedId === e.id ? "sel" : ""}
                  onClick={() => setSelectedId(e.id)}
                >
                  <td>{e.date}</td>
                  <td>
                    <b>{e.name}</b>
                    {e.place && e.place !== e.name && (
                      <div className="aq-note">{e.place}</div>
                    )}
                  </td>
                  <td className="num">
                    <span className="aq-badge" style={{ "--c": magColor(e.magnitude) }}>
                      M{e.magnitude}
                    </span>
                  </td>
                  <td className="num">{e.depth_km != null ? `${Math.round(e.depth_km)} km` : "—"}</td>
                  <td className="num">{e.deaths ? `~${fmt(e.deaths)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
