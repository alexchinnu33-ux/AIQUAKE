
import NavigationBar from "./NavigationBar";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";

function Dashboard() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);

  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);

  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [historySort, setHistorySort] = useState("NEWEST");

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("SYSTEM READY");

  const [clockLine, setClockLine] = useState("00:00:00 UTC");
  const [coordLine, setCoordLine] = useState("17.3850° N, 78.4867° E");

  const gridRef = useRef(null);
  const fileInputRef = useRef(null);
  const submitBtnRef = useRef(null);

  const userEmail =
    localStorage.getItem("userEmail") ||
    sessionStorage.getItem("userEmail") ||
    "UNKNOWN OPERATOR";

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  const pad = (number) =>
    number.toString().padStart(2, "0");

  // ==========================================
  // LIVE SYSTEM READOUT
  // ==========================================

  useEffect(() => {
    const tick = () => {
      const now = new Date();

      const time =
        `${pad(now.getUTCHours())}:` +
        `${pad(now.getUTCMinutes())}:` +
        `${pad(now.getUTCSeconds())} UTC`;

      setClockLine(time);

      const lat =
        (17.385 + (Math.random() - 0.5) * 0.002)
          .toFixed(4);

      const lng =
        (78.4867 + (Math.random() - 0.5) * 0.002)
          .toFixed(4);

      setCoordLine(
        `${lat}° N, ${lng}° E`
      );
    };

    tick();

    const interval =
      setInterval(tick, 1000);

    return () =>
      clearInterval(interval);
  }, []);

  // ==========================================
  // GRID PARALLAX
  // ==========================================

  useEffect(() => {
    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (reduceMotion) return;

    const handleMove = (event) => {
      if (!gridRef.current) return;

      const x =
        event.clientX /
          window.innerWidth -
        0.5;

      const y =
        event.clientY /
          window.innerHeight -
        0.5;

      gridRef.current.style.transform =
        `translate(${x * -8}px, ${y * -8}px) scale(1.02)`;
    };

    const handleLeave = () => {
      if (!gridRef.current) return;

      gridRef.current.style.transform =
        "translate(0,0) scale(1)";
    };

    document.addEventListener(
      "mousemove",
      handleMove
    );

    document.addEventListener(
      "mouseleave",
      handleLeave
    );

    return () => {
      document.removeEventListener(
        "mousemove",
        handleMove
      );

      document.removeEventListener(
        "mouseleave",
        handleLeave
      );
    };
  }, []);

  // ==========================================
  // AUTH
  // ==========================================

  const handleUnauthorized = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userRole");

    navigate("/login", {
      replace: true,
    });
  };

  // ==========================================
  // LOAD HISTORY
  // ==========================================

  const loadHistory = async () => {
    const currentToken =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (!currentToken) {
      handleUnauthorized();
      return;
    }

    try {
      setHistoryLoading(true);

      const response = await fetch(
        `${API_URL}/history`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${currentToken}`,
          },
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to load history"
        );
      }

      setHistory(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (requestError) {
      console.error(
        "History error:",
        requestError
      );

      setError(
        "Unable to load prediction history."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // ==========================================
  // FILE SELECTION
  // ==========================================

  const handleFileChange = (event) => {
    const file =
      event.target.files?.[0];

    setPrediction(null);
    setConfidence(null);
    setError("");

    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      setStatus("SYSTEM READY");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedFile(null);
      setPreview(null);
      setError(
        "Please select a valid image file."
      );
      setStatus("INVALID INPUT");
      return;
    }

    setSelectedFile(file);

    const imageURL =
      URL.createObjectURL(file);

    setPreview(imageURL);
    setStatus("IMAGE READY FOR ANALYSIS");
  };

  // ==========================================
  // PREDICT
  // ==========================================

  const handlePredict = async () => {
    setIsAnalyzing(true);
    if (!selectedFile) {
      setError(
        "Select an earthquake image before analysis."
      );
      return;
    }

    const currentToken =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (!currentToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError("");
    setPrediction(null);
    setConfidence(null);
    setStatus("ANALYZING IMAGE...");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response = await fetch(
        `${API_URL}/predict`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${currentToken}`,
          },

          body: formData,
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Prediction failed."
        );
      }

      setPrediction(
        data.prediction
      );

      setConfidence(
        Number(data.confidence)
      );

      setStatus(
        "ASSESSMENT COMPLETE"
      );

      await loadHistory();
    } catch (requestError) {
      console.error(
        "Prediction error:",
        requestError
      );

      setError(
        requestError.message ||
          "Unable to connect to prediction server."
      );

      setStatus(
        "ANALYSIS FAILED"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userRole");

    navigate("/login", {
      replace: true,
    });
  };

  // ==========================================
  // RIPPLE
  // ==========================================

  const spawnRipple = (event) => {
    const button =
      submitBtnRef.current;

    if (!button) return;

    const rect =
      button.getBoundingClientRect();

    const ripple =
      document.createElement("span");

    ripple.className =
      "gt-ripple";

    const size =
      Math.max(
        rect.width,
        rect.height
      );

    ripple.style.width =
      `${size}px`;

    ripple.style.height =
      `${size}px`;

    ripple.style.left =
      `${event.clientX - rect.left - size / 2}px`;

    ripple.style.top =
      `${event.clientY - rect.top - size / 2}px`;

    button.appendChild(ripple);

    setTimeout(
      () => ripple.remove(),
      650
    );
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date)
      .toLocaleString();
  };

  const getSeverityClass = (value) => {
    const normalized =
      String(value || "")
        .toLowerCase();

    if (
      normalized.includes("collapsed") ||
      normalized.includes("destroy")
    ) {
      return "severity-destroyed";
    }

    if (
      normalized.includes("damaged") ||
      normalized.includes("severe")
    ) {
      return "severity-severe";
    }

    return "severity-intact";
  };

  const confidenceValue =
    Number(confidence) || 0;

  const filteredHistory = history
    .filter((item) => {
      const predictionText = String(item.prediction || "").toLowerCase();
      const imageText = String(item.image_name || "").toLowerCase();
      const search = historySearch.trim().toLowerCase();

      const matchesSearch =
        !search ||
        predictionText.includes(search) ||
        imageText.includes(search);

      const normalized = predictionText;

      const matchesFilter =
        historyFilter === "ALL" ||
        (historyFilter === "COLLAPSED" &&
          (normalized.includes("collapsed") ||
            normalized.includes("destroy"))) ||
        (historyFilter === "DAMAGED" &&
          (normalized.includes("damaged") ||
            normalized.includes("severe"))) ||
        (historyFilter === "INTACT" &&
          normalized.includes("intact"));

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (historySort === "CONFIDENCE") {
        return (
          Number(b.confidence || 0) -
          Number(a.confidence || 0)
        );
      }

      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();

      return historySort === "OLDEST"
        ? aTime - bTime
        : bTime - aTime;
    });

  return (
    <div className="gt-root">

      <NavigationBar />

      {/* ======================================
          BACKGROUND
      ======================================= */}

      <div className="gt-bg-scan">
        <div
          className="gt-grid-layer"
          ref={gridRef}
        />

        <div className="gt-scanline" />

        <svg
          className="gt-contour-layer"
          viewBox="0 0 1400 900"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-20,180 C250,120 500,240 800,160 C1050,100 1300,200 1420,150"
            stroke="rgba(148,187,204,0.14)"
            strokeWidth="1"
            fill="none"
          />

          <path
            d="M-20,280 C280,220 540,340 850,260 C1080,200 1300,300 1420,250"
            stroke="rgba(148,187,204,0.10)"
            strokeWidth="1"
            fill="none"
          />

          <path
            d="M-20,600 C260,540 560,660 880,580 C1100,520 1320,610 1420,570"
            stroke="rgba(148,187,204,0.10)"
            strokeWidth="1"
            fill="none"
          />

          <path
            d="M-20,700 C300,650 590,760 920,690 C1120,640 1330,720 1420,680"
            stroke="rgba(148,187,204,0.14)"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </div>


      {/* ======================================
          MAIN DASHBOARD
      ======================================= */}

      <section className="gt-auth-panel">

      <div className="gt-auth-box dashboard-box">

          {/* BRAND / HEADER */}

          <div className="dashboard-header">

            <div className="gt-brand">

              <svg
                width="34"
                height="34"
                viewBox="0 0 34 34"
                fill="none"
              >
                <circle
                  cx="17"
                  cy="17"
                  r="15.5"
                  stroke="#3FD7C7"
                  strokeWidth="1.2"
                  opacity="0.5"
                />

                <circle
                  cx="17"
                  cy="17"
                  r="9.5"
                  stroke="#3FD7C7"
                  strokeWidth="1.2"
                  opacity="0.8"
                />

                <line
                  x1="17"
                  y1="0"
                  x2="17"
                  y2="7"
                  stroke="#3FD7C7"
                  strokeWidth="1.4"
                />

                <line
                  x1="17"
                  y1="27"
                  x2="17"
                  y2="34"
                  stroke="#3FD7C7"
                  strokeWidth="1.4"
                />

                <line
                  x1="0"
                  y1="17"
                  x2="7"
                  y2="17"
                  stroke="#3FD7C7"
                  strokeWidth="1.4"
                />

                <line
                  x1="27"
                  y1="17"
                  x2="34"
                  y2="17"
                  stroke="#3FD7C7"
                  strokeWidth="1.4"
                />

                <circle
                  cx="17"
                  cy="17"
                  r="2.4"
                  fill="#3FD7C7"
                />
              </svg>

              <div>
                <div className="gt-wordmark">
                  GROUND<span>TRUTH</span>
                </div>

                <div className="gt-sub">
                  DAMAGE ASSESSMENT &amp; RESCUE ROUTING
                </div>
              </div>

            </div>


            <button
              className="dashboard-logout"
              onClick={handleLogout}
            >
              LOGOUT
            </button>

          </div>


          {/* OPERATOR BAR */}

          <div className="operator-bar">

            <div>
              <span className="operator-label">
                OPERATOR
              </span>

              <span className="operator-email">
                {userEmail}
              </span>
            </div>

            <div className="operator-status">
              <span className="gt-led" />
              {status}
            </div>

          </div>


          {/* TITLE */}

          <div className="dashboard-title">

            <div className="gt-eyebrow">
              RAPID DAMAGE ASSESSMENT
            </div>

            <h2>
              Analyze field imagery.
            </h2>

            <p className="gt-lead">
              Upload an earthquake image
              and classify structural damage
              using the trained AIQuake model.
            </p>

          </div>


          {/* UPLOAD / PREVIEW */}

          <div className="assessment-grid">

            <div className="assessment-card">

              <div className="card-kicker">
                01 / IMAGE INPUT
              </div>

              <div
                className={
                  preview
                    ? "upload-zone has-image"
                    : "upload-zone"
                }
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >

                {preview ? (

                  <img
                    src={preview}
                    alt="Selected earthquake"
                    className="preview-image"
                  />

                ) : (

                  <div className="upload-empty">

                    <div className="upload-cross">
                      +
                    </div>

                    <strong>
                      SELECT FIELD IMAGE
                    </strong>

                    <span>
                      JPG · PNG · WEBP
                    </span>

                  </div>

                )}

              </div>


              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  display: "none",
                }}
              />


              {selectedFile && (

                <div className="file-readout">
                  <span>
                    FILE
                  </span>

                  <strong>
                    {selectedFile.name}
                  </strong>
                </div>

              )}

            </div>


            {/* RESULT */}

            <div className="assessment-card result-card">

              <div className="card-kicker">
                02 / AI ASSESSMENT
              </div>

              {prediction ? (

                <div className="result-content">

                  <div className="result-label">
                    CLASSIFICATION
                  </div>

                  <div
                    className={`result-value ${getSeverityClass(
                      prediction
                    )}`}
                  >
                    {String(
                      prediction
                    ).toUpperCase()}
                  </div>


                  <div className="confidence-row">

                    <div>
                      CONFIDENCE
                    </div>

                    <strong>
                      {confidenceValue.toFixed(
                        2
                      )}
                      %
                    </strong>

                  </div>


                  <div className="confidence-track">

                    <div
                      className="confidence-fill"
                      style={{
                        width:
                          `${Math.min(
                            confidenceValue,
                            100
                          )}%`,
                      }}
                    />

                  </div>


                  <div className="result-note">
                    MODEL STATUS · VERIFIED
                  </div>

                </div>

              ) : (

                <div className="result-empty">

                  <div className="result-cross">
                    ◇
                  </div>

                  <span>
                    AWAITING IMAGE ANALYSIS
                  </span>

                  <small>
                    Assessment output will
                    appear here.
                  </small>

                </div>

              )}

            </div>

          </div>


          {/* ANALYZE BUTTON */}

          <button
            ref={submitBtnRef}
            className="gt-submit dashboard-submit"
            onClick={(event) => {
              spawnRipple(event);
              handlePredict();
            }}
            disabled={
              loading ||
              !selectedFile
            }
          >
            {loading ? (
              "ANALYZING FIELD IMAGE…"
            ) : (
              <>
                RUN DAMAGE ASSESSMENT

                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>


          {/* ERROR */}

          {error && (

            <div className="dashboard-error">
              ASSESSMENT ERROR — {error}
            </div>

          )}


          {/* HISTORY */}

          <div className="history-section">

            <div className="history-heading">

              <div>
                <div className="card-kicker">
                  03 / OPERATIONS LOG
                </div>

                <h3>
                  Prediction history
                </h3>

                <div className="history-count">
                  {filteredHistory.length} of {history.length} assessments
                </div>
              </div>

              <button
                className="refresh-button"
                onClick={loadHistory}
                disabled={historyLoading}
              >
                {historyLoading
                  ? "SYNCING…"
                  : "↻ SYNC"}
              </button>

            </div>

            <div className="history-controls">

              <div className="history-search-wrap">
                <span className="history-search-icon">⌕</span>

                <input
                  type="search"
                  value={historySearch}
                  onChange={(event) =>
                    setHistorySearch(event.target.value)
                  }
                  placeholder="SEARCH IMAGE OR RESULT"
                  aria-label="Search prediction history"
                />
              </div>

              <select
                value={historyFilter}
                onChange={(event) =>
                  setHistoryFilter(event.target.value)
                }
                aria-label="Filter prediction history"
              >
                <option value="ALL">ALL RESULTS</option>
                <option value="COLLAPSED">COLLAPSED</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="INTACT">INTACT</option>
              </select>

              <select
                value={historySort}
                onChange={(event) =>
                  setHistorySort(event.target.value)
                }
                aria-label="Sort prediction history"
              >
                <option value="NEWEST">NEWEST FIRST</option>
                <option value="OLDEST">OLDEST FIRST</option>
                <option value="CONFIDENCE">CONFIDENCE</option>
              </select>

            </div>


            {historyLoading ? (

              <div className="history-empty">
                SYNCHRONIZING OPERATIONS LOG…
              </div>

            ) : filteredHistory.length === 0 ? (

              <div className="history-empty">
                {history.length === 0
                  ? "NO ASSESSMENTS RECORDED"
                  : "NO ASSESSMENTS MATCH CURRENT FILTER"}
              </div>

            ) : (

              <div className="history-table-wrap">

                <table className="history-table">

                  <thead>
                    <tr>
                      <th>RESULT</th>
                      <th>CONFIDENCE</th>
                      <th>IMAGE</th>
                      <th>TIMESTAMP</th>
                    </tr>
                  </thead>

                  <tbody>

                    {filteredHistory.map(
                      (item) => (

                        <tr key={item.id}>

                          <td>
                            <span
                              className={`history-badge ${getSeverityClass(
                                item.prediction
                              )}`}
                            >
                              {String(
                                item.prediction
                              ).toUpperCase()}
                            </span>
                          </td>

                          <td>
                            {Number(
                              item.confidence
                            ).toFixed(2)}
                            %
                          </td>

                          <td className="history-image-name">
                            {item.image_name}
                          </td>

                          <td className="history-date">
                            {formatDate(
                              item.created_at
                            )}
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>


          {/* STATUS FOOTER */}

          <div className="gt-status-footer">

            <div className="gt-ok">
              <span className="gt-led" />
              ALL FEEDS NOMINAL
            </div>

            <div>
              SYNCED {clockLine}
            </div>

          </div>


          <div className="dashboard-footer">
            AIQUAKE // SECURE RESPONSE NETWORK
          </div>

        </div>

      </section>


      <style>{`

        :root{
          --accent:#3FD7C7;
          --accent-soft:rgba(63,215,199,0.14);
          --bg:#07100f;
          --panel:rgba(8,17,17,0.94);
          --panel-2:rgba(10,22,21,0.88);
          --grid-line:rgba(148,187,204,0.07);
          --grid-line-strong:rgba(148,187,204,0.14);
          --text:#E6F0EF;
          --text-muted:#9AAEAC;
          --text-faint:#627573;
          --sev-destroyed:#E5484D;
          --sev-severe:#F59E0B;
          --sev-moderate:#EAB308;
          --sev-minor:#3FD7C7;
          --font-display:Inter,system-ui,sans-serif;
          --font-mono:"JetBrains Mono","SFMono-Regular",Consolas,monospace;
        }

        *{
          box-sizing:border-box;
        }

        .gt-root{
          min-height:100vh;
          background:var(--bg);
          color:var(--text);
          font-family:var(--font-display);
          position:relative;
          overflow-x:hidden;
        }

        .gt-bg-scan{
          position:fixed;
          inset:0;
          pointer-events:none;
          overflow:hidden;
          background:
            radial-gradient(circle at 20% 0%,rgba(63,215,199,0.055),transparent 30%),
            radial-gradient(circle at 85% 30%,rgba(67,97,238,0.045),transparent 34%),
            #07100f;
          z-index:0;
        }

        .gt-grid-layer{
          position:absolute;
          inset:-30px;
          background-image:
            linear-gradient(var(--grid-line) 1px,transparent 1px),
            linear-gradient(90deg,var(--grid-line) 1px,transparent 1px);
          background-size:42px 42px;
          transition:transform .2s ease-out;
        }

        .gt-scanline{
          position:absolute;
          left:0;
          right:0;
          top:-10%;
          height:2px;
          background:linear-gradient(
            90deg,
            transparent,
            rgba(63,215,199,.25),
            transparent
          );
          box-shadow:0 0 18px rgba(63,215,199,.18);
          animation:gt-scanline 12s linear infinite;
        }

        @keyframes gt-scanline{
          from{transform:translateY(0)}
          to{transform:translateY(120vh)}
        }

        .gt-auth-panel{
          position:relative;
          z-index:2;
          min-height:100vh;
          width:100%;
          padding:28px clamp(16px,4vw,56px);
          display:flex;
          justify-content:center;
        }

        .gt-auth-box{
          width:100%;
          max-width:1180px;
          align-self:flex-start;
          margin:0 auto;
          background:rgba(7,15,15,.91);
          border:1px solid var(--grid-line-strong);
          border-radius:8px;
          padding:clamp(18px,3vw,30px);
          box-shadow:
            0 24px 80px rgba(0,0,0,.38),
            inset 0 1px 0 rgba(255,255,255,.025);
          backdrop-filter:blur(10px);
        }

        .dashboard-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:20px;
          padding-bottom:16px;
          border-bottom:1px solid var(--grid-line-strong);
        }

        .gt-brand{
          display:flex;
          align-items:center;
          gap:11px;
        }

        .gt-wordmark{
          font-size:15px;
          font-weight:700;
          letter-spacing:.12em;
        }

        .gt-wordmark span{
          color:var(--accent);
        }

        .gt-sub{
          color:var(--text-faint);
          font-family:var(--font-mono);
          font-size:7px;
          letter-spacing:.11em;
          margin-top:3px;
        }

        .dashboard-logout{
          border:1px solid rgba(229,72,77,.4);
          background:rgba(229,72,77,.06);
          color:#E96A6F;
          padding:8px 13px;
          border-radius:5px;
          font-family:var(--font-mono);
          font-size:9px;
          letter-spacing:.08em;
          cursor:pointer;
        }

        .dashboard-logout:hover{
          background:rgba(229,72,77,.12);
        }

        .operator-bar{
          margin-top:14px;
          padding:10px 12px;
          border:1px solid var(--grid-line-strong);
          border-radius:5px;
          background:rgba(63,215,199,.025);
          display:flex;
          justify-content:space-between;
          gap:14px;
          font-family:var(--font-mono);
          font-size:9px;
          color:var(--text-faint);
        }

        .operator-label{
          color:var(--accent);
          margin-right:10px;
        }

        .operator-email{
          color:var(--text-muted);
        }

        .operator-status{
          display:flex;
          align-items:center;
          gap:7px;
          color:var(--sev-minor);
        }

        .gt-led{
          width:5px;
          height:5px;
          border-radius:50%;
          background:var(--sev-minor);
          box-shadow:0 0 8px rgba(63,215,199,.7);
          animation:gt-blink 1.8s ease-in-out infinite;
          flex:none;
        }

        @keyframes gt-blink{
          0%,100%{opacity:.45}
          50%{opacity:1}
        }

        .dashboard-title{
          margin:26px 0 20px;
          max-width:760px;
        }

        .gt-eyebrow,
        .card-kicker{
          color:var(--accent);
          font-family:var(--font-mono);
          font-size:10px;
          letter-spacing:.16em;
          text-transform:uppercase;
        }

        .dashboard-title h2{
          margin:7px 0 7px;
          font-size:clamp(26px,3vw,34px);
          letter-spacing:-.035em;
        }

        .gt-lead{
          margin:0;
          color:var(--text-muted);
          line-height:1.65;
          font-size:13px;
        }

        .assessment-grid{
          display:grid;
          grid-template-columns:minmax(0,1fr) minmax(0,1fr);
          gap:14px;
        }

        .assessment-card{
          min-width:0;
          border:1px solid var(--grid-line-strong);
          background:rgba(10,22,21,.7);
          border-radius:6px;
          padding:16px;
        }

        .upload-zone{
          height:300px;
          margin-top:12px;
          border:1px dashed rgba(63,215,199,.28);
          background:
            linear-gradient(
              135deg,
              rgba(63,215,199,.035),
              rgba(255,255,255,.012)
            );
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          overflow:hidden;
          position:relative;
          transition:border-color .2s ease,background .2s ease;
        }

        .upload-zone:focus-within,
        .upload-zone:hover{
          border-color:rgba(63,215,199,.7);
          background:rgba(63,215,199,.055);
        }

        .upload-zone.has-image{
          border-style:solid;
        }

        .upload-empty{
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:8px;
          font-family:var(--font-mono);
          color:var(--text-muted);
          font-size:9px;
          letter-spacing:.08em;
          text-align:center;
        }

        .upload-empty span{
          color:var(--text-faint);
          font-size:8px;
        }

        .upload-cross{
          width:48px;
          height:48px;
          display:grid;
          place-items:center;
          border:1px solid rgba(63,215,199,.3);
          color:var(--accent);
          font-size:27px;
          line-height:1;
          font-weight:200;
          border-radius:5px;
        }


        .preview-overlay{
          position:absolute;
          inset:0;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding:12px;
          background:linear-gradient(
            transparent 45%,
            rgba(3,10,10,.82)
          );
          color:var(--accent);
          font-family:var(--font-mono);
          font-size:9px;
          letter-spacing:.12em;
          opacity:0;
          transition:opacity .2s ease;
        }

        .upload-zone:hover .preview-overlay,
        .upload-zone:focus-within .preview-overlay{
          opacity:1;
        }

        .upload-zone.has-image .preview-overlay span{
          border:1px solid rgba(63,215,199,.4);
          background:rgba(7,15,15,.88);
          padding:7px 10px;
          border-radius:3px;
        }

        .analyzing-pulse{
          animation:gt-analyzing 1.2s ease-in-out infinite;
        }

        @keyframes gt-analyzing{
          0%,100%{opacity:.45}
          50%{opacity:1}
        }

        .preview-image{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
          background:#050b0b;
        }

        .file-readout{
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-top:9px;
          font-family:var(--font-mono);
          font-size:8px;
          color:var(--text-faint);
        }

        .file-readout strong{
          color:var(--text-muted);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .result-card{
          min-height:355px;
        }

        .result-content{
          margin-top:42px;
        }

        .result-label{
          font-family:var(--font-mono);
          color:var(--text-faint);
          font-size:9px;
          letter-spacing:.14em;
        }

        .result-value{
          margin-top:8px;
          font-size:clamp(34px,5vw,52px);
          line-height:1;
          font-weight:700;
          letter-spacing:-.04em;
        }

        .severity-destroyed{
          color:var(--sev-destroyed);
        }

        .severity-severe{
          color:var(--sev-severe);
        }

        .severity-intact{
          color:var(--sev-minor);
        }

        .confidence-row{
          display:flex;
          justify-content:space-between;
          margin-top:42px;
          color:var(--text-faint);
          font-family:var(--font-mono);
          font-size:9px;
        }

        .confidence-row strong{
          color:var(--text);
          font-size:12px;
        }

        .confidence-track{
          height:5px;
          margin-top:9px;
          background:rgba(255,255,255,.06);
          overflow:hidden;
          border-radius:2px;
        }

        .confidence-fill{
          height:100%;
          background:var(--accent);
          box-shadow:0 0 12px rgba(63,215,199,.45);
          transition:width .5s ease;
        }

        .result-note{
          margin-top:20px;
          font-family:var(--font-mono);
          color:var(--sev-minor);
          font-size:8px;
          letter-spacing:.08em;
        }

        .result-empty{
          min-height:285px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          gap:9px;
          color:var(--text-faint);
          font-family:var(--font-mono);
          font-size:9px;
          letter-spacing:.08em;
          text-align:center;
        }

        .result-empty small{
          color:#465856;
          font-size:8px;
        }

        .result-cross{
          color:#405552;
          font-size:30px;
        }

        .gt-submit{
          position:relative;
          overflow:hidden;
          width:100%;
          margin-top:14px;
          background:var(--accent);
          color:#062622;
          font-family:var(--font-display);
          font-weight:700;
          font-size:12px;
          letter-spacing:.05em;
          border:none;
          padding:14px;
          border-radius:5px;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          transition:filter .15s ease,transform .15s ease;
        }

        .gt-submit:hover{
          filter:brightness(1.08);
        }

        .gt-submit:active{
          transform:scale(.99);
        }

        .gt-submit:disabled{
          cursor:not-allowed;
          opacity:.48;
        }

        .gt-ripple{
          position:absolute;
          border-radius:50%;
          background:rgba(6,38,34,.35);
          transform:scale(0);
          animation:gt-ripple-anim .6s ease-out;
          pointer-events:none;
        }

        @keyframes gt-ripple-anim{
          to{
            transform:scale(3.2);
            opacity:0;
          }
        }

        .dashboard-error{
          margin-top:10px;
          padding:10px 12px;
          border:1px solid rgba(229,72,77,.45);
          background:rgba(229,72,77,.07);
          color:#E96A6F;
          border-radius:5px;
          font-family:var(--font-mono);
          font-size:9px;
          line-height:1.5;
        }

        .history-section{
          margin-top:28px;
        }

        .history-heading{
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap:15px;
          margin-bottom:12px;
        }

        .history-count{
          margin-top:6px;
          color:var(--text-faint);
          font-family:var(--font-mono);
          font-size:8px;
          letter-spacing:.05em;
        }

        .history-controls{
          display:grid;
          grid-template-columns:minmax(220px,1fr) 160px 160px;
          gap:8px;
          margin-bottom:10px;
        }

        .history-search-wrap{
          position:relative;
        }

        .history-search-icon{
          position:absolute;
          left:10px;
          top:50%;
          transform:translateY(-50%);
          color:var(--text-faint);
          font-size:15px;
          pointer-events:none;
        }

        .history-controls input,
        .history-controls select{
          width:100%;
          height:34px;
          border:1px solid var(--grid-line-strong);
          border-radius:4px;
          background:rgba(10,22,21,.75);
          color:var(--text-muted);
          outline:none;
          padding:0 10px;
          font-family:var(--font-mono);
          font-size:8px;
          letter-spacing:.04em;
        }

        .history-controls input{
          padding-left:28px;
        }

        .history-controls input::placeholder{
          color:#50605e;
        }

        .history-controls input:focus,
        .history-controls select:focus{
          border-color:rgba(63,215,199,.55);
          box-shadow:0 0 0 2px rgba(63,215,199,.06);
        }

        .history-controls option{
          background:#07100f;
          color:var(--text);
        }

        .history-heading h3{
          margin:7px 0 0;
          font-size:18px;
          font-weight:600;
        }

        .refresh-button{
          border:1px solid var(--grid-line-strong);
          background:transparent;
          color:var(--text-muted);
          padding:7px 10px;
          border-radius:4px;
          font-family:var(--font-mono);
          font-size:8px;
          cursor:pointer;
        }

        .refresh-button:hover{
          border-color:var(--accent);
          color:var(--accent);
        }

        .refresh-button:disabled{
          cursor:default;
          opacity:.55;
        }

        .history-table-wrap{
          border:1px solid var(--grid-line-strong);
          border-radius:6px;
          overflow:auto;
          background:rgba(10,22,21,.5);
        }

        .history-table{
          width:100%;
          border-collapse:collapse;
          min-width:600px;
        }

        .history-table th{
          padding:10px 12px;
          text-align:left;
          color:var(--text-faint);
          font-family:var(--font-mono);
          font-size:8px;
          letter-spacing:.1em;
          font-weight:500;
          border-bottom:1px solid var(--grid-line-strong);
        }

        .history-table td{
          padding:11px 12px;
          color:var(--text-muted);
          font-family:var(--font-mono);
          font-size:9px;
          border-bottom:1px solid var(--grid-line);
        }

        .history-table tr:last-child td{
          border-bottom:none;
        }

        .history-badge{
          font-size:8px;
          letter-spacing:.06em;
          font-weight:700;
        }

        .history-image-name{
          max-width:240px;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .history-date{
          color:var(--text-faint) !important;
          white-space:nowrap;
        }

        .history-empty{
          border:1px solid var(--grid-line-strong);
          padding:30px 15px;
          text-align:center;
          color:var(--text-faint);
          font-family:var(--font-mono);
          font-size:9px;
          letter-spacing:.1em;
        }

        .gt-status-footer{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:15px;
          padding-top:17px;
          margin-top:22px;
          border-top:1px solid var(--grid-line-strong);
          font-family:var(--font-mono);
          font-size:8px;
          color:var(--text-faint);
        }

        .gt-status-footer .gt-ok{
          display:flex;
          align-items:center;
          gap:6px;
          color:var(--sev-minor);
        }

        .dashboard-footer{
          margin-top:12px;
          text-align:center;
          color:#465856;
          font-family:var(--font-mono);
          font-size:7px;
          letter-spacing:.12em;
        }

        @media(max-width:800px){
          .gt-auth-panel{
            padding:12px;
          }

          .gt-auth-box{
            padding:16px;
          }

          .assessment-grid{
            grid-template-columns:1fr;
          }

          .upload-zone{
            height:250px;
          }

          .result-card{
            min-height:300px;
          }

          .result-empty{
            min-height:220px;
          }

          .result-content{
            margin-top:25px;
          }

          .confidence-row{
            margin-top:28px;
          }
        }

        @media(max-width:800px){
          .history-controls{
            grid-template-columns:1fr 1fr;
          }

          .history-search-wrap{
            grid-column:1 / -1;
          }
        }

        @media(max-width:560px){
          .dashboard-header{
            align-items:flex-start;
            flex-direction:column;
          }

          .dashboard-logout{
            align-self:flex-end;
          }

          .operator-bar{
            flex-direction:column;
            align-items:flex-start;
          }

          .dashboard-title{
            margin-top:22px;
          }

          .gt-lead{
            font-size:12px;
          }

          .history-heading{
            align-items:flex-start;
            flex-direction:column;
          }

          .history-table{
            min-width:560px;
          }

          .gt-status-footer{
            align-items:flex-start;
            flex-direction:column;
          }
        }

        @media(prefers-reduced-motion:reduce){
          .gt-scanline,
          .gt-led{
            animation:none !important;
          }
        }

      `}</style>

    </div>
  );
}

export default Dashboard;
