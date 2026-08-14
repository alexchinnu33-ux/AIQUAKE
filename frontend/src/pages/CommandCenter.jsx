
import NavigationBar from "./NavigationBar";
import { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidencePercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  // Supports either 0–1 or 0–100 confidence values.
  const percent = number <= 1 ? number * 100 : number;

  return Math.max(0, Math.min(100, percent));
}

function normalizePrediction(value) {
  return String(value || "UNKNOWN")
    .trim()
    .toUpperCase();
}

function getSeverityClass(prediction) {
  const value = normalizePrediction(prediction);

  if (
    value.includes("COLLAP") ||
    value.includes("DESTROY") ||
    value.includes("SEVERE")
  ) {
    return "critical";
  }

  if (
    value.includes("DAMAG") ||
    value.includes("MODERATE")
  ) {
    return "warning";
  }

  if (
    value.includes("INTACT") ||
    value.includes("MINOR") ||
    value.includes("SAFE")
  ) {
    return "safe";
  }

  return "neutral";
}

export default function CommandCenter() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Authentication token not found.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }

        throw new Error(`Unable to load history (${response.status}).`);
      }

      const data = await response.json();

      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load command center data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const stats = useMemo(() => {
    const total = history.length;

    let critical = 0;
    let damaged = 0;
    let intact = 0;

    let confidenceTotal = 0;
    let confidenceCount = 0;

    history.forEach((item) => {
      const prediction = normalizePrediction(item.prediction);

      if (
        prediction.includes("COLLAP") ||
        prediction.includes("DESTROY") ||
        prediction.includes("SEVERE")
      ) {
        critical += 1;
      } else if (
        prediction.includes("DAMAG") ||
        prediction.includes("MODERATE")
      ) {
        damaged += 1;
      } else if (
        prediction.includes("INTACT") ||
        prediction.includes("MINOR") ||
        prediction.includes("SAFE")
      ) {
        intact += 1;
      }

      const confidence = confidencePercent(item.confidence);

      if (Number.isFinite(confidence)) {
        confidenceTotal += confidence;
        confidenceCount += 1;
      }
    });

    return {
      total,
      critical,
      damaged,
      intact,
      averageConfidence:
        confidenceCount > 0
          ? confidenceTotal / confidenceCount
          : 0,
    };
  }, [history]);

  const maxCategory = Math.max(
    stats.critical,
    stats.damaged,
    stats.intact,
    1
  );

  return (
    <div className="command-root">

      <NavigationBar />
      <style>{`
        :root {
          --cc-bg: #050d0d;
          --cc-panel: rgba(8, 19, 18, 0.88);
          --cc-panel-2: rgba(11, 25, 23, 0.9);
          --cc-line: rgba(76, 131, 124, 0.22);
          --cc-line-strong: rgba(63, 215, 199, 0.38);
          --cc-text: #edf5f3;
          --cc-muted: #829794;
          --cc-faint: #536865;
          --cc-accent: #3fd7c7;
          --cc-red: #ff626b;
          --cc-orange: #ffb15a;
          --cc-green: #65dfaa;
        }

        * {
          box-sizing: border-box;
        }

        .command-root {
          min-height: 100vh;
          background:
            linear-gradient(rgba(63,215,199,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(63,215,199,.035) 1px, transparent 1px),
            var(--cc-bg);
          background-size: 42px 42px;
          color: var(--cc-text);
          padding: 28px;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .command-shell {
          width: min(1250px, 100%);
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mark {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid var(--cc-line-strong);
          color: var(--cc-accent);
          background: rgba(63,215,199,.05);
          border-radius: 5px;
          font-family: monospace;
        }

        .eyebrow {
          color: var(--cc-accent);
          font: 9px/1.2 monospace;
          letter-spacing: .16em;
        }

        .title {
          margin: 5px 0 0;
          font-size: clamp(24px, 4vw, 38px);
          letter-spacing: -.03em;
        }

        .sync-button {
          border: 1px solid var(--cc-line-strong);
          background: rgba(63,215,199,.05);
          color: var(--cc-accent);
          border-radius: 4px;
          padding: 10px 14px;
          font: 9px monospace;
          letter-spacing: .1em;
          cursor: pointer;
        }

        .sync-button:hover {
          background: rgba(63,215,199,.1);
        }

        .status-line {
          margin-bottom: 18px;
          padding: 9px 12px;
          border: 1px solid var(--cc-line);
          border-radius: 4px;
          color: var(--cc-muted);
          background: rgba(8,19,18,.55);
          font: 9px monospace;
          letter-spacing: .06em;
        }

        .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 8px;
          border-radius: 50%;
          background: var(--cc-accent);
          box-shadow: 0 0 12px rgba(63,215,199,.7);
        }

        .error {
          border-color: rgba(255,98,107,.35);
          color: #ff9ca2;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 10px;
        }

        .stat-card {
          min-height: 130px;
          padding: 18px;
          border: 1px solid var(--cc-line);
          border-radius: 5px;
          background: var(--cc-panel);
        }

        .stat-label {
          color: var(--cc-muted);
          font: 9px monospace;
          letter-spacing: .12em;
        }

        .stat-value {
          margin-top: 20px;
          font-size: 34px;
          font-weight: 700;
          letter-spacing: -.04em;
        }

        .stat-sub {
          margin-top: 6px;
          color: var(--cc-faint);
          font: 8px monospace;
        }

        .critical-text { color: var(--cc-red); }
        .warning-text { color: var(--cc-orange); }
        .safe-text { color: var(--cc-green); }
        .accent-text { color: var(--cc-accent); }

        .main-grid {
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: 10px;
          margin-bottom: 10px;
        }

        .panel {
          border: 1px solid var(--cc-line);
          border-radius: 5px;
          background: var(--cc-panel);
          padding: 20px;
        }

        .panel-kicker {
          color: var(--cc-accent);
          font: 9px monospace;
          letter-spacing: .14em;
        }

        .panel-title {
          margin: 7px 0 22px;
          font-size: 17px;
        }

        .bar-row {
          margin-bottom: 18px;
        }

        .bar-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 7px;
          color: var(--cc-muted);
          font: 9px monospace;
          letter-spacing: .04em;
        }

        .bar-track {
          height: 9px;
          overflow: hidden;
          border: 1px solid var(--cc-line);
          background: rgba(0,0,0,.18);
          border-radius: 2px;
        }

        .bar {
          height: 100%;
          min-width: 2px;
          transition: width .35s ease;
        }

        .bar-critical { background: var(--cc-red); }
        .bar-warning { background: var(--cc-orange); }
        .bar-safe { background: var(--cc-green); }

        .confidence-wrap {
          display: grid;
          grid-template-columns: 150px 1fr;
          align-items: center;
          gap: 22px;
        }

        .confidence-number {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: -.05em;
          color: var(--cc-accent);
        }

        .confidence-ring {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background:
            conic-gradient(
              var(--cc-accent) ${stats.averageConfidence}%,
              rgba(63,215,199,.08) 0
            );
        }

        .confidence-ring::after {
          content: "";
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: var(--cc-bg);
        }

        .history-panel {
          padding: 0;
          overflow: hidden;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid var(--cc-line);
        }

        .history-scroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 650px;
        }

        th, td {
          padding: 14px 20px;
          text-align: left;
          border-bottom: 1px solid rgba(76,131,124,.12);
        }

        th {
          color: var(--cc-faint);
          font: 8px monospace;
          letter-spacing: .12em;
        }

        td {
          color: var(--cc-muted);
          font-size: 11px;
        }

        .result-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid currentColor;
          border-radius: 3px;
          padding: 5px 7px;
          font: 8px monospace;
          letter-spacing: .08em;
        }

        .result-pill::before {
          content: "";
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .critical { color: var(--cc-red); }
        .warning { color: var(--cc-orange); }
        .safe { color: var(--cc-green); }
        .neutral { color: var(--cc-muted); }

        .empty {
          padding: 48px 20px;
          text-align: center;
          color: var(--cc-faint);
          font: 9px monospace;
          letter-spacing: .1em;
        }

        .loading {
          animation: pulse 1.1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: .35; }
          50% { opacity: 1; }
        }

        @media (max-width: 850px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .command-root {
            padding: 16px;
          }

          .topbar {
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .confidence-wrap {
            grid-template-columns: 1fr;
          }

          .confidence-ring {
            margin: 0 auto;
          }
        }
      `}</style>

      <div className="command-shell">

        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">+</div>

            <div>
              <div className="eyebrow">
                GROUNDTRUTH / AIQUAKE
              </div>

              <h1 className="title">
                Command Center
              </h1>
            </div>
          </div>

          <button
            className="sync-button"
            onClick={loadHistory}
            disabled={loading}
          >
            {loading ? "SYNCING..." : "↻ SYNC DATA"}
          </button>
        </header>

        <div className={`status-line ${error ? "error" : ""}`}>
          <span className="status-dot" />
          {error
            ? error
            : loading
              ? "CONNECTING TO ASSESSMENT NETWORK..."
              : `LIVE ASSESSMENT NETWORK · ${stats.total} RECORDED ASSESSMENTS`}
        </div>

        <section className="stats-grid">

          <div className="stat-card">
            <div className="stat-label">
              TOTAL ASSESSMENTS
            </div>

            <div className="stat-value">
              {stats.total}
            </div>

            <div className="stat-sub">
              ALL RECORDED PREDICTIONS
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              CRITICAL
            </div>

            <div className="stat-value critical-text">
              {stats.critical}
            </div>

            <div className="stat-sub">
              COLLAPSED / SEVERE
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              DAMAGED
            </div>

            <div className="stat-value warning-text">
              {stats.damaged}
            </div>

            <div className="stat-sub">
              DAMAGE DETECTED
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              INTACT
            </div>

            <div className="stat-value safe-text">
              {stats.intact}
            </div>

            <div className="stat-sub">
              NO MAJOR DAMAGE
            </div>
          </div>

        </section>

        <section className="main-grid">

          <div className="panel">

            <div className="panel-kicker">
              01 / DAMAGE DISTRIBUTION
            </div>

            <h2 className="panel-title">
              Assessment classification
            </h2>

            <div className="bar-row">
              <div className="bar-meta">
                <span>CRITICAL</span>
                <span>{stats.critical}</span>
              </div>

              <div className="bar-track">
                <div
                  className="bar bar-critical"
                  style={{
                    width: `${(stats.critical / maxCategory) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="bar-row">
              <div className="bar-meta">
                <span>DAMAGED</span>
                <span>{stats.damaged}</span>
              </div>

              <div className="bar-track">
                <div
                  className="bar bar-warning"
                  style={{
                    width: `${(stats.damaged / maxCategory) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="bar-row">
              <div className="bar-meta">
                <span>INTACT</span>
                <span>{stats.intact}</span>
              </div>

              <div className="bar-track">
                <div
                  className="bar bar-safe"
                  style={{
                    width: `${(stats.intact / maxCategory) * 100}%`,
                  }}
                />
              </div>
            </div>

          </div>

          <div className="panel">

            <div className="panel-kicker">
              02 / MODEL PERFORMANCE
            </div>

            <h2 className="panel-title">
              Average confidence
            </h2>

            <div className="confidence-wrap">

              <div>
                <div className="confidence-number">
                  {stats.averageConfidence.toFixed(1)}%
                </div>

                <div className="stat-sub">
                  ACROSS AVAILABLE ASSESSMENTS
                </div>
              </div>

              <div
                className="confidence-ring"
                aria-label={`Average confidence ${stats.averageConfidence.toFixed(1)} percent`}
              />
            </div>

          </div>

        </section>

        <section className="panel history-panel">

          <div className="history-header">
            <div>
              <div className="panel-kicker">
                03 / RECENT ASSESSMENTS
              </div>

              <h2 className="panel-title" style={{ marginBottom: 0 }}>
                Operations log
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="empty loading">
              LOADING ASSESSMENT DATA...
            </div>
          ) : history.length === 0 ? (
            <div className="empty">
              NO ASSESSMENTS RECORDED YET
            </div>
          ) : (
            <div className="history-scroll">
              <table>
                <thead>
                  <tr>
                    <th>RESULT</th>
                    <th>CONFIDENCE</th>
                    <th>IMAGE</th>
                    <th>TIMESTAMP</th>
                    <th>ID</th>
                  </tr>
                </thead>

                <tbody>
                  {history.slice(0, 12).map((item) => {
                    const prediction = normalizePrediction(
                      item.prediction
                    );

                    const confidence = confidencePercent(
                      item.confidence
                    );

                    const severity = getSeverityClass(
                      prediction
                    );

                    return (
                      <tr key={item.id}>
                        <td>
                          <span
                            className={`result-pill ${severity}`}
                          >
                            {prediction}
                          </span>
                        </td>

                        <td>
                          <span className="accent-text">
                            {confidence.toFixed(1)}%
                          </span>
                        </td>

                        <td>
                          {item.image_name || "—"}
                        </td>

                        <td>
                          {formatDate(item.created_at)}
                        </td>

                        <td>
                          #{item.id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </section>

      </div>
    </div>
  );
}
