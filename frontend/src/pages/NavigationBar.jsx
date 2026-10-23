import "./aq.css";
import { useLocation, useNavigate } from "react-router-dom";

import { clearIncident, useIncident } from "../incidentStore";

const NAV_ITEMS = [
  ["/new", "NEW INCIDENT"],
  ["/dashboard", "MISSION CONTROL"],
  ["/gis", "DAMAGE MAP"],
  ["/rescue", "RESCUE PLANNER"],
  ["/history", "HISTORY"],
  ["/model", "MODEL"],
  ["/classifier", "PHOTO AI"],
];

function IncidentBar({ incident, go }) {
  if (!incident) {
    return (
      <div className="aq-incbar demo" role="status">
        <span className="aq-incbar-tag">DEMO INCIDENT</span>
        <span className="aq-incbar-main">
          Caraballeda, Venezuela — real assessed damage (2026 earthquake)
        </span>
        <button className="aq-incbar-btn" onClick={() => go("/new")}>
          ANALYSE A NEW EARTHQUAKE →
        </button>
      </div>
    );
  }

  const place = (incident.point?.name || "").split(",").slice(0, 2).join(",");

  return (
    <div className="aq-incbar live" role="status">
      <span className="aq-incbar-tag">
        <i /> ACTIVE INCIDENT
      </span>
      <span className="aq-incbar-main">
        <b>M{incident.magnitude}</b> {incident.title || incident.place}
        <em> · analysing {place}</em>
        {incident.source === "photos" ? <em> · from photos (experimental)</em> : null}
      </span>
      <button className="aq-incbar-btn" onClick={() => go("/new")}>NEW</button>
      <button className="aq-incbar-btn ghost" onClick={clearIncident} aria-label="Clear active incident">
        ✕ CLEAR
      </button>
    </div>
  );
}

export default function NavigationBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const incident = useIncident();

  const email =
    localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail") || "";

  const handleLogout = () => {
    ["token", "userEmail", "userRole"].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    clearIncident();
    navigate("/", { replace: true });
  };

  const go = (path) => navigate(path);

  return (
    <>
      <nav className="aq-nav" aria-label="Main navigation">
        <button className="aq-nav-brand" onClick={() => go("/new")} aria-label="AIQuake home">
          <span className="aq-nav-mark">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12h4l2.5-7 4 14 3-9 2 2h4.5" />
            </svg>
          </span>
          <span className="aq-nav-name">
            AI<span>QUAKE</span>
            <small>EARTHQUAKE RESPONSE</small>
          </span>
        </button>

        <div className="aq-nav-links">
          {NAV_ITEMS.map(([path, label]) => (
            <button
              key={path}
              className={location.pathname === path ? "aq-nav-link active" : "aq-nav-link"}
              onClick={() => go(path)}
              aria-current={location.pathname === path ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="aq-nav-actions">
          {email && <span className="aq-nav-user" title={email}>{email}</span>}
          <button className="aq-nav-logout" onClick={handleLogout}>LOG OUT</button>
        </div>
      </nav>

      <IncidentBar incident={incident} go={go} />

      <style>{`
        .aq-nav {
          position: sticky;
          top: 10px;
          z-index: 1000;
          width: min(1400px, calc(100% - 32px));
          margin: 12px auto 0;
          min-height: 60px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
          padding: 9px 14px;
          border: 1px solid rgba(120,190,200,.16);
          border-radius: 14px;
          background: rgba(6,16,21,.82);
          box-shadow: 0 18px 50px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          text-align: left;
        }

        .aq-nav button { appearance: none; border: 0; cursor: pointer; }

        .aq-nav-brand {
          font-family: Inter, system-ui, sans-serif;
          display: flex; align-items: center; gap: 11px; padding: 0;
          background: transparent; color: #eaf6f4; text-align: left;
        }

        .aq-nav-mark {
          width: 36px; height: 36px; display: grid; place-items: center;
          border-radius: 10px; color: #031512;
          background: linear-gradient(135deg,#2ee6d0,#14b8a6);
          box-shadow: 0 0 22px rgba(46,230,208,.4);
          transition: transform .3s ease;
        }
        .aq-nav-brand:hover .aq-nav-mark { transform: rotate(-8deg) scale(1.06); }

        .aq-nav-name {
          display: block; font: 700 15px/1 "Space Grotesk", Inter, sans-serif; letter-spacing: .12em;
        }
        .aq-nav-name span { color: #2ee6d0; }
        .aq-nav-name small {
          display: block; margin-top: 4px; color: #56706f;
          font: 500 8px/1 "JetBrains Mono", Consolas, monospace; letter-spacing: .18em;
        }

        .aq-nav-links {
          display: flex; align-items: center; justify-content: center; gap: 2px;
          overflow-x: auto; scrollbar-width: none;
        }
        .aq-nav-links::-webkit-scrollbar { display: none; }

        .aq-nav-link {
          position: relative; padding: 11px 12px; color: #7e9a99; background: transparent;
          border-radius: 8px; white-space: nowrap;
          font: 600 10px/1 "JetBrains Mono", Consolas, monospace; letter-spacing: .1em;
          transition: color .18s ease, background .18s ease;
        }
        .aq-nav-link::after {
          content: ""; position: absolute; left: 12px; right: 12px; bottom: 5px; height: 2px;
          border-radius: 2px; background: #2ee6d0; box-shadow: 0 0 10px #2ee6d0;
          transform: scaleX(0); transform-origin: left; transition: transform .25s ease;
        }
        .aq-nav-link:hover { color: #eaf6f4; background: rgba(46,230,208,.06); }
        .aq-nav-link:hover::after { transform: scaleX(.5); }
        .aq-nav-link.active { color: #2ee6d0; background: rgba(46,230,208,.1); }
        .aq-nav-link.active::after { transform: scaleX(1); }
        .aq-nav-link:focus-visible, .aq-nav-brand:focus-visible, .aq-nav-logout:focus-visible {
          outline: 2px solid #2ee6d0; outline-offset: 2px;
        }

        .aq-nav-actions { display: flex; align-items: center; gap: 12px; }
        .aq-nav-user {
          max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: #86a3a3; font: 500 10px/1 "JetBrains Mono", Consolas, monospace;
          padding: 8px 10px; border: 1px solid rgba(120,190,200,.14); border-radius: 999px;
        }
        .aq-nav-logout {
          padding: 9px 12px; border: 1px solid rgba(255,77,90,.4) !important; border-radius: 8px;
          background: rgba(255,77,90,.06); color: #ff7a84;
          font: 700 10px/1 "JetBrains Mono", Consolas, monospace; letter-spacing: .09em;
          transition: background .18s ease;
        }
        .aq-nav-logout:hover { background: rgba(255,77,90,.16); }

        .aq-incbar {
          width: min(1400px, calc(100% - 32px));
          margin: 10px auto 0;
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          padding: 9px 14px; border-radius: 10px; font-size: 12.5px; color: #c4dad8;
          border: 1px solid rgba(120,190,200,.14); background: rgba(9,22,28,.7);
          text-align: left;
          animation: aq-rise .5s ease both;
        }
        .aq-incbar.live {
          border-color: rgba(46,230,208,.4);
          background: linear-gradient(90deg, rgba(46,230,208,.14), rgba(9,22,28,.7) 70%);
        }
        .aq-incbar-tag {
          display: inline-flex; align-items: center; gap: 8px; color: #2ee6d0;
          font: 700 10px/1 "JetBrains Mono", Consolas, monospace; letter-spacing: .14em;
        }
        .aq-incbar.demo .aq-incbar-tag { color: #ffb020; }
        .aq-incbar-tag i {
          width: 8px; height: 8px; border-radius: 50%; background: #2ee6d0;
          animation: aq-pulse 1.8s ease-out infinite;
        }
        .aq-incbar-main { flex: 1; min-width: 200px; }
        .aq-incbar-main b { color: #fff; }
        .aq-incbar-main em { color: #86a3a3; font-style: normal; }
        .aq-incbar-btn {
          appearance: none; cursor: pointer; padding: 7px 11px; border-radius: 7px;
          border: 1px solid rgba(46,230,208,.4); background: rgba(46,230,208,.1); color: #2ee6d0;
          font: 700 10px/1 "JetBrains Mono", Consolas, monospace; letter-spacing: .08em;
          transition: background .18s ease;
        }
        .aq-incbar-btn:hover { background: rgba(46,230,208,.22); }
        .aq-incbar-btn.ghost { border-color: rgba(120,190,200,.2); background: transparent; color: #86a3a3; }

        @media (max-width: 980px) {
          .aq-nav { grid-template-columns: 1fr auto; }
          .aq-nav-links {
            grid-column: 1 / -1; grid-row: 2; justify-content: flex-start;
            border-top: 1px solid rgba(120,190,200,.1); padding-top: 8px;
          }
          .aq-nav-user { display: none; }
        }
        @media (max-width: 420px) {
          .aq-nav { width: calc(100% - 20px); padding: 8px; }
          .aq-nav-name small { display: none; }
        }
      `}</style>
    </>
  );
}
