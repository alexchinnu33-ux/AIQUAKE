import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { API_URL } from "../config";
import { DarkBasemap } from "./mapLayers";
import "./aq.css";
import "./landing.css";

const SAT = (bbox, w, h) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;

const CASE_BOX = { west: -66.87, south: 10.6, east: -66.83, north: 10.625 };
const CASE_W = 900;
const CASE_H = 560;
const CASE_IMG = SAT(`${CASE_BOX.west},${CASE_BOX.south},${CASE_BOX.east},${CASE_BOX.north}`, CASE_W, CASE_H);

const TIER_COLORS = { CRITICAL: "#ff4d5a", HIGH: "#ff8a3d", MEDIUM: "#ffd23f", LOW: "#34d399" };
const CLASS_COLORS = { Collapsed: "#ff4d5a", Damaged: "#ff8a3d", Intact: "#34d399" };

const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const magColor = (m) => (m >= 7 ? "#ff4d5a" : m >= 6 ? "#ff8a3d" : m >= 5 ? "#ffd23f" : "#2ee6d0");

/* ---------- small helpers ---------- */

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!("IntersectionObserver" in window)) {
      node.classList.add("in");
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("in");
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", delay = 0, ...rest }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`lp-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </div>
  );
}

function Count({ to, decimals = 0, suffix = "", duration = 1400 }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || to == null) return undefined;
    let frame;
    const run = () => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setValue(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) {
      run();
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        run();
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {to == null ? "—" : value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const move = (e) => {
    const node = ref.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    node.style.transform = `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-3px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div ref={ref} className={className} onMouseMove={move} onMouseLeave={leave}>
      {children}
    </div>
  );
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 5, { duration: 1.2 });
  }, [target, map]);
  return null;
}

const quakeIcon = (color, size) =>
  L.divIcon({
    className: "",
    html: `<div class="aq-quake" style="--c:${color};width:${size}px;height:${size}px"><i></i><i></i></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

/* ---------- how-it-works steps ---------- */

const STEPS = [
  {
    title: "Pick any place on Earth",
    short: "Search a city or click the map",
    text: "Start anywhere — a city search or a click on the world map. AIQuake reverse-geocodes the place and prepares the area.",
    points: ["Worldwide place search", "Quick picks for famous earthquakes", "Works for any town with OpenStreetMap data"],
    art: (
      <svg viewBox="0 0 240 240">
        <circle cx="120" cy="120" r="92" fill="none" stroke="#2ee6d0" strokeOpacity=".5" strokeWidth="1.5" />
        <ellipse cx="120" cy="120" rx="44" ry="92" fill="none" stroke="#2ee6d0" strokeOpacity=".35" />
        <ellipse cx="120" cy="120" rx="92" ry="36" fill="none" stroke="#2ee6d0" strokeOpacity=".35" />
        <path className="draw" d="M30 120h180M120 28v184" stroke="#2ee6d0" strokeOpacity=".3" fill="none" />
        <circle className="ping" cx="150" cy="96" r="10" fill="#ff4d5a" opacity=".6" />
        <circle cx="150" cy="96" r="6" fill="#ff4d5a" />
      </svg>
    ),
  },
  {
    title: "Understand the seismic risk",
    short: "History, statistics, USGS data",
    text: "Every earthquake near the place for up to 125 years, a statistical hazard level and the chance of a big one in the next decade — plus the USGS shaking and impact estimate of the quake you pick.",
    points: ["Past earthquakes by year and magnitude", "Gutenberg-Richter risk statistics", "USGS ShakeMap + PAGER exposure"],
    art: (
      <svg viewBox="0 0 240 240">
        {[40, 70, 52, 110, 150, 90, 130, 60].map((h, i) => (
          <rect key={i} className="grow" style={{ animationDelay: `${i * 80}ms` }} x={22 + i * 26} y={200 - h} width="16" height={h} rx="3" fill="#2ee6d0" opacity={0.35 + (h / 150) * 0.6} />
        ))}
        <path className="draw" d="M22 150 C60 90 90 160 130 100 S190 60 220 70" stroke="#ffb020" strokeWidth="2.5" fill="none" />
      </svg>
    ),
  },
  {
    title: "Assess the damage",
    short: "Shaking + AI → damage per building",
    text: "Measured shaking at every building becomes an expected damage class. Add before/after photos or on-the-ground photos and the AI classifier updates the picture.",
    points: ["Damage for every mapped building", "Field-photo AI (Collapsed / Damaged / Intact)", "Clearly labelled modelled vs measured"],
    art: (
      <svg viewBox="0 0 240 240">
        {Array.from({ length: 36 }).map((_, i) => {
          const r = Math.floor(i / 6);
          const c = i % 6;
          const hot = [8, 9, 14, 15, 16, 21].includes(i);
          const warm = [7, 10, 13, 17, 20, 22, 3, 27].includes(i);
          return (
            <rect key={i} x={20 + c * 34} y={20 + r * 34} width="28" height="28" rx="5"
              fill={hot ? "#ff4d5a" : warm ? "#ff8a3d" : "#34d399"} opacity={hot ? 0.95 : warm ? 0.7 : 0.25}
              className="grow" style={{ animationDelay: `${i * 25}ms` }} />
          );
        })}
      </svg>
    ),
  },
  {
    title: "Rank who needs help first",
    short: "People at risk, ranked zones",
    text: "Occupancy and damage give an estimate of people trapped and displaced. Neighbourhoods are ranked from CRITICAL to LOW so teams go where lives are most at risk.",
    points: ["Estimated trapped and displaced people", "CRITICAL / HIGH / MEDIUM / LOW tiers", "Night vs daytime occupancy"],
    art: (
      <svg viewBox="0 0 240 240">
        <circle cx="120" cy="120" r="96" fill="none" stroke="#34d399" strokeOpacity=".35" />
        <circle cx="120" cy="120" r="66" fill="none" stroke="#ffd23f" strokeOpacity=".45" />
        <circle cx="120" cy="120" r="36" fill="none" stroke="#ff4d5a" strokeOpacity=".7" />
        <circle className="ping" cx="120" cy="120" r="14" fill="#ff4d5a" opacity=".6" />
        <circle cx="120" cy="120" r="10" fill="#ff4d5a" />
        <circle cx="164" cy="92" r="8" fill="#ff8a3d" />
        <circle cx="84" cy="160" r="7" fill="#ffd23f" />
        <circle cx="178" cy="164" r="6" fill="#34d399" />
        <circle cx="62" cy="86" r="6" fill="#34d399" />
      </svg>
    ),
  },
  {
    title: "Send teams by the best roads",
    short: "Routes, ETAs, hospitals, helipads",
    text: "Road routes from the rescue base to each priority zone, assigned team by team, with arrival times, debris-risk roads and the nearest hospital, fire station and helipad.",
    points: ["Multi-team routing on real roads", "Slower roads near collapsed buildings", "Nearby medical and logistics support"],
    art: (
      <svg viewBox="0 0 240 240">
        <path className="draw" d="M30 190 C70 190 80 130 120 130 S170 150 190 90 S210 50 214 44" stroke="#2ee6d0" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path className="draw" style={{ animationDelay: ".5s" }} d="M30 190 C60 160 100 200 140 180 S190 190 210 170" stroke="#a78bfa" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="30" cy="190" r="9" fill="#ffb020" />
        <circle cx="214" cy="44" r="7" fill="#ff4d5a" />
        <circle cx="210" cy="170" r="7" fill="#ff8a3d" />
        <circle cx="120" cy="130" r="6" fill="#ffd23f" />
      </svg>
    ),
  },
];

const FEATURES = [
  ["🌍", "Worldwide earthquake history", "Up to 125 years of USGS earthquakes around any place, with magnitude, depth, distance and yearly trends."],
  ["📊", "Statistical risk, honestly framed", "Hazard level and the chance of M6+ / M7+ in the next 10 years from past rates. Never claims to predict a quake."],
  ["📡", "USGS shaking & PAGER", "Measured intensity grids and population-exposure estimates for each significant earthquake."],
  ["🏚️", "Building-level damage", "Shaking and building footprints give modelled damage; real assessed damage is used where it exists."],
  ["🧭", "Rescue priorities & routes", "Ranked zones, trapped and displaced estimates, multi-team routes with arrival times on real roads."],
  ["📷", "Field-photo AI", "Upload a building photo; the classifier labels it and the whole rescue plan recomputes instantly."],
];

/* ---------- page ---------- */

export default function Landing() {
  const loggedIn = !!(localStorage.getItem("token") || sessionStorage.getItem("token"));

  const [scrolled, setScrolled] = useState(false);
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState(false);
  const [focusEvent, setFocusEvent] = useState(null);
  const [plan, setPlan] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  const [label, setLabel] = useState("Collapsed");
  const [shuffle, setShuffle] = useState(0);
  const [showAi, setShowAi] = useState(true);
  const [tip, setTip] = useState(null);

  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/region/live`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setLive).catch(() => setLiveError(true));
    fetch(`${API_URL}/rescue/plan?teams=3&top_zones=12`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setPlan).catch(() => {});
    fetch(`${API_URL}/model/metrics`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setMetrics(d.model1)).catch(() => {});
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 6000);
    return () => clearTimeout(id);
  }, [step, paused]);

  const onHeroMove = (e) => {
    const node = heroRef.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    node.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const zonesOnImage = useMemo(() => {
    if (!plan) return [];
    const top = merc(CASE_BOX.north);
    const bottom = merc(CASE_BOX.south);
    return plan.zones
      .filter((z) => z.lon >= CASE_BOX.west && z.lon <= CASE_BOX.east && z.lat >= CASE_BOX.south && z.lat <= CASE_BOX.north)
      .map((z) => ({
        ...z,
        x: ((z.lon - CASE_BOX.west) / (CASE_BOX.east - CASE_BOX.west)) * CASE_W,
        y: ((top - merc(z.lat)) / (top - bottom)) * CASE_H,
      }));
  }, [plan]);

  const impact = plan?.impact;
  const recent = live?.events?.slice(0, 3) || [];
  const current = STEPS[step];
  const photoIndexes = [0, 1, 2, 3].map((i) => (shuffle * 4 + i) * 37 + 5);

  return (
    <div className="aq-page lp">
      {/* ---------------- top bar ---------------- */}
      <header className={`lp-top ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-top-in">
          <a className="lp-brand" href="#top" aria-label="AIQuake">
            <span className="m">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12h4l2.5-7 4 14 3-9 2 2h4.5" />
              </svg>
            </span>
            AI<em>QUAKE</em>
          </a>
          <nav className="lp-links" aria-label="Sections">
            <a href="#live">Live</a>
            <a href="#how">How it works</a>
            <a href="#ai">AI</a>
            <a href="#case">Case study</a>
            <a href="#features">Features</a>
          </nav>
          <div className="lp-top-cta">
            {loggedIn ? (
              <Link to="/new" className="aq-btn solid">OPEN THE APP →</Link>
            ) : (
              <>
                <Link to="/login" className="aq-btn ghost">LOG IN</Link>
                <Link to="/register" className="aq-btn solid">GET STARTED</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        {/* ---------------- hero ---------------- */}
        <section className="lp-hero" id="live" ref={heroRef} onMouseMove={onHeroMove}>
          <div className="lp-wrap lp-hero-grid">
            <div>
              <span className="lp-pill"><i /> LIVE EARTHQUAKE INTELLIGENCE</span>
              <h1 className="lp-h1">
                From earthquake to <span className="grad">rescue route</span> in minutes.
              </h1>
              <p className="lp-lead">
                AIQuake studies any earthquake on Earth: its history and risk, the shaking it caused, the buildings
                likely damaged, the people who need help first — and the roads rescue teams should take.
              </p>
              <div className="lp-cta">
                <Link to={loggedIn ? "/new" : "/login"} className="aq-btn solid">
                  {loggedIn ? "OPEN THE APP" : "LOG IN TO START"} →
                </Link>
                <a href="#how" className="aq-btn">SEE HOW IT WORKS</a>
              </div>
              <div className="lp-mini">
                <div><strong><Count to={live?.last_24h} /></strong><span>quakes M4.5+ in 24 h</span></div>
                <div><strong><Count to={live?.last_7d} /></strong><span>this week</span></div>
                <div><strong>{live?.strongest_7d ? `M${live.strongest_7d.magnitude}` : "—"}</strong><span>strongest this week</span></div>
              </div>
            </div>

            <div className="aq-panel lp-live" aria-label="Live earthquake map">
              <div className="lp-live-head">
                <i /> LIVE · LAST 24 HOURS
                <span>{live ? `${live.last_24h} quakes · USGS` : liveError ? "feed unavailable" : "loading…"}</span>
              </div>
              <div className="lp-live-map">
                <MapContainer center={[18, 15]} zoom={1.5} zoomSnap={0.25} minZoom={1} worldCopyJump scrollWheelZoom={false} style={{ width: "100%", height: "100%" }}>
                  <DarkBasemap />
                  {(live?.events || []).map((e) => (
                    <Marker key={e.id} position={[e.latitude, e.longitude]} icon={quakeIcon(magColor(e.magnitude), Math.max(10, (e.magnitude - 3) * 6))}>
                      <Popup>
                        <b>M{e.magnitude}</b> {e.place}
                        <br />{e.time.replace("T", " ")} UTC · depth {Math.round(e.depth_km)} km
                      </Popup>
                    </Marker>
                  ))}
                  <FlyTo target={focusEvent} />
                </MapContainer>
              </div>
              <div className="lp-ticker">
                {recent.length === 0 && <div className="lp-tick"><small>{liveError ? "Live feed unavailable right now." : "Loading the latest earthquakes…"}</small></div>}
                {recent.map((e) => (
                  <button key={e.id} className="lp-tick" style={{ "--c": magColor(e.magnitude) }} onClick={() => setFocusEvent(e)}>
                    <b>M{e.magnitude}</b>
                    <small>{e.place}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- stats ---------------- */}
        <section className="lp-stats">
          <div className="lp-wrap lp-stats-grid">
            {[
              [impact?.total_buildings, "", "buildings assessed in the Caraballeda case study", 0],
              [metrics ? metrics.accuracy * 100 : null, "%", "photo-classifier accuracy on unseen test images", 1],
              [125, " yrs", "of USGS earthquake history searchable for any place", 0],
              [3, " feeds", "free open data sources — no API keys needed", 0],
            ].map(([to, suffix, text, decimals], i) => (
              <Reveal key={text} delay={i * 90} className="aq-panel lp-stat">
                <strong><em><Count to={to} suffix={suffix} decimals={decimals} /></em></strong>
                <span>{text}</span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- how it works ---------------- */}
        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-kicker">How it works</div>
              <h2 className="lp-h2">Five steps from a location to a rescue plan</h2>
              <p className="lp-p">Click a step, or let it play. Everything you generate becomes the active incident across the whole app.</p>
            </Reveal>

            <div
              className={`lp-how ${paused ? "paused" : ""}`}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="lp-steps" role="tablist" aria-label="Steps">
                {STEPS.map((s, i) => (
                  <button key={s.title} role="tab" aria-selected={step === i} className={`lp-step ${step === i ? "on" : ""}`} onClick={() => setStep(i)}>
                    <span className="n">{i + 1}</span>
                    <span><b>{s.title}</b><small>{s.short}</small></span>
                    <span className="bar" />
                  </button>
                ))}
              </div>

              <div className="aq-panel lp-stage" key={step}>
                <div style={{ animation: "aq-rise .5s ease both" }}>
                  <div className="aq-label" style={{ marginBottom: 10 }}>Step {step + 1} of {STEPS.length}</div>
                  <h3>{current.title}</h3>
                  <p>{current.text}</p>
                  <ul>{current.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
                <div className="lp-art">{current.art}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- AI ---------------- */}
        <section className="lp-sec" id="ai">
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-kicker">The AI</div>
              <h2 className="lp-h2">A classifier that reads building photos</h2>
              <p className="lp-p">Trained on thousands of real drone photos from earthquake zones. Pick a class to see what the model learns from — the scores on the right are measured on images it never saw.</p>
            </Reveal>

            <div className="lp-ai">
              <Reveal className="aq-panel lp-photos">
                <div className="lp-photos-head">
                  {Object.keys(CLASS_COLORS).map((c) => (
                    <button key={c} className={`aq-chip ${label === c ? "on" : ""}`} onClick={() => setLabel(c)}>{c}</button>
                  ))}
                  <button className="aq-btn ghost" style={{ marginLeft: "auto" }} onClick={() => setShuffle((n) => n + 1)}>⟳ SHUFFLE</button>
                </div>
                <div className="lp-photo-grid">
                  {photoIndexes.map((index) => (
                    <figure key={`${label}-${index}`} className="lp-photo" style={{ "--c": CLASS_COLORS[label], margin: 0 }}>
                      <img src={`${API_URL}/incident/sample-photo?label=${label}&index=${index}`} alt={`${label} building example`} loading="lazy"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                      <span>{label.toUpperCase()}</span>
                    </figure>
                  ))}
                </div>
                <p className="aq-note" style={{ marginTop: 12 }}>Real training-set photos. Shown as examples of each class, not as predictions.</p>
              </Reveal>

              <Reveal delay={120} className="aq-panel lp-score">
                <div className="aq-label" style={{ marginBottom: 16 }}>Measured on {metrics ? metrics.test_images.toLocaleString() : "…"} unseen test images</div>
                {(metrics?.classes || []).map((c) => (
                  <div className="lp-score-row" key={c}>
                    <header><b>{c}</b><span>recall {(metrics.per_class[c].recall * 100).toFixed(1)}% · precision {(metrics.per_class[c].precision * 100).toFixed(1)}%</span></header>
                    <div className="lp-meter"><div style={{ width: `${metrics.per_class[c].recall * 100}%` }} /></div>
                  </div>
                ))}
                {!metrics && <div className="aq-note">Start the backend to see live model scores.</div>}
                {metrics && (
                  <p className="aq-note" style={{ marginTop: 6 }}>
                    Overall accuracy <b style={{ color: "#2ee6d0" }}>{(metrics.accuracy * 100).toFixed(1)}%</b>. The model misses roughly
                    one in five collapsed buildings, so AIQuake always shows confidence and asks for field verification.
                  </p>
                )}
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- case study ---------------- */}
        <section className="lp-sec" id="case">
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-kicker">Case study · 2026 Venezuela earthquake</div>
              <h2 className="lp-h2">Caraballeda, seen from space — and triaged</h2>
              <p className="lp-p">Real satellite imagery with the real AI damage assessment of {impact ? impact.total_buildings.toLocaleString() : "5,366"} buildings. Dots are rescue zones ranked by estimated people at risk. Hover one.</p>
            </Reveal>

            <div className="lp-case">
              <Reveal className="lp-sat" onMouseLeave={() => setTip(null)}>
                <img src={CASE_IMG} alt="Satellite image of Caraballeda, Venezuela" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                <svg viewBox={`0 0 ${CASE_W} ${CASE_H}`} preserveAspectRatio="none" aria-label="Rescue zones">
                  {showAi && zonesOnImage.map((z, i) => (
                    <g key={z.id} style={{ animation: `aq-rise .6s ease ${i * 40}ms both` }}>
                      <circle cx={z.x} cy={z.y} r={Math.max(7, Math.sqrt(z.est_trapped) * 3.2) + 6} fill={TIER_COLORS[z.tier]} opacity=".18" />
                      <circle className="lp-dot" cx={z.x} cy={z.y} r={Math.max(5, Math.sqrt(z.est_trapped) * 2.2)} fill={TIER_COLORS[z.tier]} stroke="#04090c" strokeWidth="1.5"
                        onMouseEnter={() => setTip(z)} onFocus={() => setTip(z)} tabIndex={0} />
                    </g>
                  ))}
                </svg>
                <div className="lp-scan" />
                {tip && (
                  <div className="lp-sat-tip" style={{ left: `${(tip.x / CASE_W) * 100}%`, top: `${(tip.y / CASE_H) * 100}%` }}>
                    <b style={{ color: TIER_COLORS[tip.tier] }}>{tip.id} · {tip.tier}</b><br />
                    {tip.damaged_buildings} damaged buildings<br />~{tip.est_trapped} people trapped (est.)
                  </div>
                )}
                <div className="lp-sat-bar">
                  <button className="aq-btn" onClick={() => setShowAi((v) => !v)}>{showAi ? "HIDE" : "SHOW"} AI DAMAGE LAYER</button>
                </div>
              </Reveal>

              <div className="lp-case-side">
                <Reveal delay={80} className="lp-mini-kpi">
                  <div className="aq-kpi" style={{ "--kpi": "#ff8a3d" }}><span>Damaged buildings</span><strong><Count to={impact?.damaged_buildings} /></strong></div>
                  <div className="aq-kpi" style={{ "--kpi": "#ff4d5a" }}><span>Trapped (est.)</span><strong><Count to={impact?.estimated_trapped} /></strong></div>
                  <div className="aq-kpi" style={{ "--kpi": "#ffd23f" }}><span>Displaced (est.)</span><strong><Count to={impact?.estimated_displaced} /></strong></div>
                  <div className="aq-kpi"><span>Rescue teams</span><strong><Count to={plan?.routes.length} /></strong></div>
                </Reveal>
                <Reveal delay={160} className="aq-panel aq-card aq-note">
                  <h3>What you get after login</h3>
                  <ul>
                    <li>Ranked zones with nearest hospitals</li>
                    <li>Road routes per team with arrival times</li>
                    <li>Add a field photo and watch the plan change</li>
                    <li>Run the same analysis for any other earthquake</li>
                  </ul>
                </Reveal>
                <Link to={loggedIn ? "/new" : "/login"} className="aq-btn solid">{loggedIn ? "OPEN THE APP" : "LOG IN TO EXPLORE"} →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- features ---------------- */}
        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-kicker">Capabilities</div>
              <h2 className="lp-h2">Everything a response team needs on one screen</h2>
            </Reveal>
            <div className="lp-feats">
              {FEATURES.map(([icon, title, text], i) => (
                <Reveal key={title} delay={(i % 3) * 90}>
                  <TiltCard className="aq-panel lp-feat">
                    <div className="ic" aria-hidden="true">{icon}</div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- limits ---------------- */}
        <section className="lp-sec" style={{ paddingTop: 20 }}>
          <div className="lp-wrap">
            <Reveal>
              <div className="lp-kicker">Honest by design</div>
              <h2 className="lp-h2">What AIQuake does not claim</h2>
            </Reveal>
            <div className="lp-limits">
              {[
                ["Earthquakes are not predicted", "Risk figures summarise how often quakes happened nearby in the past. Nobody can say when the next one will strike."],
                ["Modelled damage is an estimate", "Outside the case study, damage comes from measured shaking and a generic vulnerability table — not from inspection."],
                ["People counts are planning numbers", "Trapped and displaced figures use assumed occupancy ratios and are not casualty counts."],
                ["Field verification still matters", "Open map data can be incomplete, and the photo classifier is wrong about one collapsed building in five."],
              ].map(([title, text], i) => (
                <Reveal key={title} delay={i * 70} className="aq-panel lp-limit">
                  <div className="ic">!</div>
                  <div><b>{title}</b><span>{text}</span></div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- final CTA ---------------- */}
        <section className="lp-final">
          <div className="lp-wrap">
            <Reveal className="box">
              <h2>Ready to analyse an earthquake?</h2>
              <p>Log in, pick a place, choose the earthquake, and get a rescue report with priorities, routes and nearby support.</p>
              <div className="lp-cta" style={{ justifyContent: "center" }}>
                {loggedIn ? (
                  <Link to="/new" className="aq-btn solid">OPEN THE APP →</Link>
                ) : (
                  <>
                    <Link to="/login" className="aq-btn solid">LOG IN →</Link>
                    <Link to="/register" className="aq-btn">CREATE AN ACCOUNT</Link>
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span>AIQuake · capstone project · earthquake damage assessment &amp; rescue planning</span>
          <span>Data: USGS Earthquake Catalog / ShakeMap / PAGER · OpenStreetMap · Open-Meteo · HOTOSM · Esri World Imagery</span>
        </div>
      </footer>
    </div>
  );
}
