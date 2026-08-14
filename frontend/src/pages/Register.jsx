import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function GroundTruthRegister() {
  const navigate = useNavigate();

  const [role, setRole] = useState("coordinator");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [clockLine, setClockLine] = useState("00:00:00 UTC · SCAN CYCLE 001");
  const [coordLine, setCoordLine] = useState("17.3850° N, 78.4867° E");
  const [syncLine, setSyncLine] = useState("SYNCED 00:00:00");

  const gridRef = useRef(null);
  const submitBtnRef = useRef(null);

  const pad = (n) => n.toString().padStart(2, "0");

  // Live UTC clock + coordinate jitter
  useEffect(() => {
    const baseLat = 17.385;
    const baseLng = 78.4867;

    const tick = () => {
      const now = new Date();
      const t = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(
        now.getUTCSeconds()
      )} UTC`;
      setClockLine(`${t} · SCAN CYCLE 001`);
      setSyncLine(`SYNCED ${t.split(" ")[0]}`);

      const jLat = (baseLat + (Math.random() - 0.5) * 0.002).toFixed(4);
      const jLng = (baseLng + (Math.random() - 0.5) * 0.002).toFixed(4);
      setCoordLine(`${jLat}° N, ${jLng}° E`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Subtle grid parallax on mouse move (whole page)
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    const handleMove = (e) => {
      if (!gridRef.current) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      gridRef.current.style.transform = `translate(${x * -10}px, ${
        y * -10
      }px) scale(1.02)`;
    };
    const handleLeave = () => {
      if (!gridRef.current) return;
      gridRef.current.style.transform = "translate(0,0) scale(1)";
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const spawnRipple = (e) => {
    const btn = submitBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "gt-ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = e.clientX - rect.left - size / 2 + "px";
    ripple.style.top = e.clientY - rect.top - size / 2 + "px";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setRegisterError("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setRegisterError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        let message = "Registration failed.";

        if (Array.isArray(data.detail)) {
          message = data.detail
            .map((item) => item.msg)
            .join(", ");
        } else if (typeof data.detail === "string") {
          message = data.detail;
        }

        throw new Error(message);
      }

      setSuccessMessage(
        "ACCOUNT CREATED — REDIRECTING TO AUTHENTICATION..."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      console.error("Registration error:", error);

      setRegisterError(
        error.message ||
        "Unable to connect to AIQuake server."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const roles = [
    { id: "coordinator", label: "RESCUE\nCOORDINATOR" },
    { id: "analyst", label: "FIELD\nANALYST" },
    { id: "command", label: "COMMAND\nCENTER" },
  ];

  return (
    <div className="gt-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .gt-root{
          --bg-void:#0A0D12;
          --panel:#0E1319;
          --panel-raised:#141B23;
          --grid-line: rgba(148,187,204,0.09);
          --grid-line-strong: rgba(148,187,204,0.16);
          --text-primary:#E9EEF2;
          --text-muted:#7C8B99;
          --text-faint:#4C5964;
          --accent:#3FD7C7;
          --accent-dim: rgba(63,215,199,0.18);
          --sev-destroyed:#E5484D;
          --sev-severe:#F0883E;
          --sev-moderate:#EAC54F;
          --sev-minor:#4FBE7A;
          --font-display:'Space Grotesk', sans-serif;
          --font-body:'Inter', sans-serif;
          --font-mono:'JetBrains Mono', monospace;

          position:relative;
          background:var(--bg-void);
          color:var(--text-primary);
          font-family:var(--font-body);
          min-height:100vh;
          width:100%;
          display:grid;
          grid-template-columns: 1.1fr 1fr;
          overflow:hidden;
        }
        .gt-root *{ box-sizing:border-box; }

        /* ============ FULL-PAGE BACKGROUND ============ */
        .gt-bg-scan{
          position:fixed;
          inset:0;
          z-index:0;
          overflow:hidden;
          background:
            radial-gradient(ellipse at 22% 20%, rgba(63,215,199,0.08), transparent 55%),
            radial-gradient(ellipse at 88% 30%, rgba(229,72,77,0.05), transparent 50%),
            radial-gradient(ellipse at 60% 90%, rgba(240,136,62,0.05), transparent 55%),
            var(--panel);
        }
        .gt-grid-layer{
          position:absolute;
          inset:-2px;
          background-image:
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
          background-size: 42px 42px;
          will-change:transform;
          transition: transform 0.4s ease-out;
        }
        .gt-contour-layer{
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          opacity:0.5;
          pointer-events:none;
        }
        .gt-scanline{
          position:absolute;
          top:0; bottom:0;
          width:220px;
          left:-220px;
          background:linear-gradient(90deg, transparent, rgba(63,215,199,0.10) 40%, rgba(63,215,199,0.22) 50%, rgba(63,215,199,0.10) 60%, transparent);
          animation: gt-sweep 9s linear infinite;
          mix-blend-mode:screen;
        }
        @keyframes gt-sweep{
          0%{ left:-220px; }
          100%{ left:100%; }
        }

        /* ============ LEFT: SCAN PANEL ============ */
        .gt-scan-panel{
          position:relative;
          z-index:1;
          overflow:hidden;
          background:transparent;
          border-right:1px solid var(--grid-line-strong);
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          padding:clamp(20px,3vw,44px);
        }
        .gt-marker{
          position:absolute;
          display:flex;
          align-items:center;
          gap:8px;
          opacity:0;
          animation: gt-reveal 6.5s ease-in-out infinite;
        }
        .gt-marker .gt-dot{
          width:9px; height:9px; border-radius:50%;
          animation: gt-ping 2.2s ease-out infinite;
        }
        .gt-marker .gt-dot::after{
          content:'';
          position:absolute;
          inset:0;
          border-radius:50%;
          background:currentColor;
        }
        .gt-marker .gt-tag{
          font-family:var(--font-mono);
          font-size:11px;
          letter-spacing:0.02em;
          color:var(--text-primary);
          background:rgba(10,13,18,0.72);
          border:1px solid var(--grid-line-strong);
          padding:3px 8px;
          border-radius:3px;
          white-space:nowrap;
          backdrop-filter: blur(2px);
        }
        .gt-marker .gt-tag b{ color:inherit; font-weight:500; }
        @keyframes gt-reveal{
          0%, 8%{ opacity:0; transform:translateY(4px); }
          14%, 78%{ opacity:1; transform:translateY(0); }
          86%, 100%{ opacity:0; transform:translateY(4px); }
        }
        @keyframes gt-ping{
          0%{ box-shadow:0 0 0 0 currentColor; opacity:1; }
          70%{ box-shadow:0 0 0 10px transparent; opacity:0.4; }
          100%{ box-shadow:0 0 0 0 transparent; opacity:1; }
        }
        .gt-m1{ top:22%; left:18%; color:var(--sev-destroyed); animation-delay:0s; }
        .gt-m2{ top:58%; left:38%; color:var(--sev-severe); animation-delay:1.6s; }
        .gt-m3{ top:34%; left:62%; color:var(--sev-moderate); animation-delay:3.2s; }
        .gt-m4{ top:72%; left:74%; color:var(--sev-minor); animation-delay:4.8s; }

        .gt-readout{
          position:relative;
          z-index:2;
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          font-family:var(--font-mono);
          font-size:11.5px;
          color:var(--text-muted);
          letter-spacing:0.03em;
        }
        .gt-readout .gt-stack{ display:flex; flex-direction:column; gap:5px; }
        .gt-readout .gt-live{ display:flex; align-items:center; gap:6px; color:var(--accent); }
        .gt-readout .gt-live .gt-led{
          width:6px; height:6px; border-radius:50%;
          background:var(--accent);
          animation:gt-blink 1.6s ease-in-out infinite;
        }
        @keyframes gt-blink{ 0%,100%{opacity:1;} 50%{opacity:0.25;} }

        .gt-hero{ position:relative; z-index:2; max-width:520px; }
        .gt-eyebrow{
          font-family:var(--font-mono);
          font-size:11px;
          letter-spacing:0.14em;
          color:var(--accent);
          text-transform:uppercase;
          margin-bottom:16px;
          display:flex; align-items:center; gap:10px;
        }
        .gt-eyebrow::before{ content:''; width:22px; height:1px; background:var(--accent); }
        .gt-hero h1{
          font-family:var(--font-display);
          font-weight:600;
          font-size:clamp(28px, 3.2vw, 42px);
          line-height:1.12;
          letter-spacing:-0.01em;
          margin:0 0 16px;
        }
        .gt-hero p{
          color:var(--text-muted);
          font-size:15px;
          line-height:1.6;
          max-width:440px;
          margin:0;
        }

        .gt-legend{
          position:relative;
          z-index:2;
          display:flex;
          gap:22px;
          flex-wrap:wrap;
          padding-top:18px;
          border-top:1px solid var(--grid-line-strong);
        }
        .gt-legend .gt-item{
          display:flex; align-items:center; gap:8px;
          font-family:var(--font-mono);
          font-size:11px;
          color:var(--text-muted);
          letter-spacing:0.02em;
        }
        .gt-legend .gt-sw{ width:10px; height:10px; border-radius:2px; }

        /* ============ RIGHT: AUTH PANEL ============ */
        .gt-auth-panel{
          position:relative;
          z-index:1;
          background:transparent;
          display:flex;
          align-items:center;
          justify-content:center;
          padding: clamp(18px, 3vw, 42px);
          overflow-y:auto;
        }
        .gt-auth-box{
          width:100%;
          max-width:560px;
          background:rgba(14,19,25,0.55);
          -webkit-backdrop-filter: blur(16px);
          backdrop-filter: blur(16px);
          border:1px solid var(--grid-line-strong);
          border-radius:16px;
          padding:clamp(24px, 3vw, 36px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        }

        .gt-brand{ display:flex; align-items:center; gap:12px; margin-bottom:38px; }
        .gt-brand svg{ flex-shrink:0; }
        .gt-brand .gt-wordmark{
          font-family:var(--font-display);
          font-weight:700;
          font-size:19px;
          letter-spacing:0.01em;
          line-height:1;
        }
        .gt-brand .gt-wordmark span{ color:var(--accent); }
        .gt-brand .gt-sub{
          font-family:var(--font-mono);
          font-size:10px;
          color:var(--text-faint);
          letter-spacing:0.08em;
          margin-top:3px;
        }

        .gt-auth-box h2{
          font-family:var(--font-display);
          font-weight:600;
          font-size:24px;
          margin:0 0 8px;
        }
        .gt-auth-box > .gt-lead{
          color:var(--text-muted);
          font-size:13.5px;
          margin:0 0 28px;
          line-height:1.5;
        }

        .gt-roles{ display:flex; gap:8px; margin-bottom:24px; }
        .gt-role-chip{
          flex:1;
          background:var(--panel-raised);
          border:1px solid var(--grid-line-strong);
          color:var(--text-muted);
          font-family:var(--font-mono);
          font-size:10.5px;
          letter-spacing:0.03em;
          padding:9px 6px;
          border-radius:6px;
          cursor:pointer;
          text-align:center;
          white-space:pre-line;
          transition: all 0.15s ease;
        }
        .gt-role-chip:hover{ border-color:var(--text-muted); color:var(--text-primary); }
        .gt-role-chip[aria-pressed="true"]{
          border-color:var(--accent);
          color:var(--accent);
          background:var(--accent-dim);
          box-shadow: inset 0 0 0 1px var(--accent);
        }

        .gt-auth-box form{ display:flex; flex-direction:column; gap:18px; }
        .gt-field{ position:relative; }
        .gt-field label{
          display:block;
          font-family:var(--font-mono);
          font-size:10.5px;
          letter-spacing:0.06em;
          text-transform:uppercase;
          color:var(--text-faint);
          margin-bottom:8px;
        }
        .gt-field .gt-input-wrap{ position:relative; }
        .gt-field input{
          width:100%;
          background:var(--panel-raised);
          border:1px solid var(--grid-line-strong);
          color:var(--text-primary);
          font-family:var(--font-body);
          font-size:14px;
          padding:12px 14px;
          border-radius:6px;
          outline:none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .gt-field input::placeholder{ color:var(--text-faint); }
        .gt-field input:focus{
          border-color:var(--accent);
          box-shadow:0 0 0 3px var(--accent-dim);
        }
        .gt-scan-underline{
          position:absolute;
          bottom:-1px; left:0;
          height:1.5px;
          width:0%;
          background:var(--accent);
          transition:width 0.3s ease;
        }
        .gt-field input:focus ~ .gt-scan-underline{ width:100%; }

        .gt-toggle-vis{
          position:absolute;
          right:10px; top:50%;
          transform:translateY(-50%);
          background:none; border:none;
          color:var(--text-faint);
          cursor:pointer;
          padding:4px;
          display:flex;
          transition:color 0.15s ease;
        }
        .gt-toggle-vis:hover{ color:var(--accent); }

        .gt-row-between{ display:flex; align-items:center; justify-content:space-between; font-size:12.5px; }
        .gt-remember{ display:flex; align-items:center; gap:7px; color:var(--text-muted); cursor:pointer; user-select:none; }
        .gt-remember input{ accent-color:var(--accent); width:13px; height:13px; }
        .gt-row-between a{
          color:var(--text-muted);
          text-decoration:none;
          border-bottom:1px solid transparent;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .gt-row-between a:hover{ color:var(--accent); border-color:var(--accent); }

        .gt-submit{
          position:relative;
          overflow:hidden;
          margin-top:6px;
          background:var(--accent);
          color:#062622;
          font-family:var(--font-display);
          font-weight:600;
          font-size:14px;
          letter-spacing:0.01em;
          border:none;
          padding:13px;
          border-radius:6px;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          transition: filter 0.15s ease, transform 0.15s ease;
        }
        .gt-submit:hover{ filter:brightness(1.08); }
        .gt-submit:active{ transform:scale(0.98); }
        .gt-submit:disabled{ cursor:default; }
        .gt-ripple{
          position:absolute;
          border-radius:50%;
          background:rgba(6,38,34,0.35);
          transform:scale(0);
          animation:gt-ripple-anim 0.6s ease-out;
          pointer-events:none;
        }
        @keyframes gt-ripple-anim{ to{ transform:scale(3.2); opacity:0; } }

        .gt-status-footer{
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding-top:18px;
          margin-top:22px;
          border-top:1px solid var(--grid-line-strong);
          font-family:var(--font-mono);
          font-size:10.5px;
          color:var(--text-faint);
        }
        .gt-status-footer .gt-ok{ display:flex; align-items:center; gap:6px; color:var(--sev-minor); }
        .gt-status-footer .gt-ok .gt-led{
          width:5px; height:5px; border-radius:50%; background:var(--sev-minor);
          animation:gt-blink 1.8s ease-in-out infinite;
        }

        .gt-register-field{
          margin-bottom:12px !important;
        }
        .gt-register-field .gt-input-wrap input{
          padding-top:10px;
          padding-bottom:10px;
        }
        .gt-register-field label{
          margin-bottom:6px;
        }
        .gt-auth-box .gt-register-field:last-of-type{
          margin-bottom:14px !important;
        }

        .gt-request-access{ text-align:center; margin-top:22px; font-size:13px; color:var(--text-muted); }
        .gt-request-access a{ color:var(--accent); text-decoration:none; }
        .gt-request-access a:hover{ text-decoration:underline; }

        @media (max-width: 900px){
          .gt-root{ grid-template-columns: 1fr; grid-template-rows: 34vh 1fr; }
          .gt-scan-panel{ border-right:none; border-bottom:1px solid var(--grid-line-strong); padding:20px; }
          .gt-hero p{ display:none; }
          .gt-hero h1{ font-size:22px; }
          .gt-legend{ display:none; }
          .gt-readout .gt-stack:last-child{ display:none; }
          .gt-auth-panel{ padding:24px 16px; }
          .gt-auth-box{ padding:22px; }
        }

        @media (prefers-reduced-motion: reduce){
          .gt-scanline, .gt-marker, .gt-marker .gt-dot, .gt-readout .gt-live .gt-led, .gt-status-footer .gt-led{ animation:none !important; }
          .gt-marker{ opacity:1; }
        }
      `}</style>

      {/* Shared full-page background */}
      <div className="gt-bg-scan">
        <div className="gt-grid-layer" ref={gridRef} />
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

      {/* Left: scan panel */}
      <section className="gt-scan-panel">
        <div className="gt-marker gt-m1">
          <span className="gt-dot" />
          <span className="gt-tag">
            SECTOR 14-B — <b>DESTROYED · 71%</b>
          </span>
        </div>
        <div className="gt-marker gt-m2">
          <span className="gt-dot" />
          <span className="gt-tag">
            SECTOR 09-A — <b>SEVERE · 44%</b>
          </span>
        </div>
        <div className="gt-marker gt-m3">
          <span className="gt-dot" />
          <span className="gt-tag">
            SECTOR 22-C — <b>MODERATE · 26%</b>
          </span>
        </div>
        <div className="gt-marker gt-m4">
          <span className="gt-dot" />
          <span className="gt-tag">
            SECTOR 03-D — <b>MINOR · 8%</b>
          </span>
        </div>

        <div className="gt-readout">
          <div className="gt-stack">
            <div className="gt-live">
              <span className="gt-led" /> LIVE FEED — DRONE + SAT FUSION
            </div>
            <div>{clockLine}</div>
          </div>
          <div className="gt-stack" style={{ textAlign: "right" }}>
            <div>{coordLine}</div>
            <div>RES 0.3M/PX · CLOUD 4%</div>
          </div>
        </div>

        <div className="gt-hero">
          <div className="gt-eyebrow">Rapid Damage Assessment</div>
          <h1>See the damage before the dust settles.</h1>
          <p>
            GroundTruth fuses satellite passes with drone sweeps to grade
            structural damage block by block, then routes rescue teams to
            the worst-hit sectors and the nearest open hospitals — while
            conditions are still changing.
          </p>
        </div>

        <div className="gt-legend">
          <div className="gt-item">
            <span className="gt-sw" style={{ background: "var(--sev-destroyed)" }} />
            Destroyed
          </div>
          <div className="gt-item">
            <span className="gt-sw" style={{ background: "var(--sev-severe)" }} />
            Severe
          </div>
          <div className="gt-item">
            <span className="gt-sw" style={{ background: "var(--sev-moderate)" }} />
            Moderate
          </div>
          <div className="gt-item">
            <span className="gt-sw" style={{ background: "var(--sev-minor)" }} />
            Minor
          </div>
        </div>
      </section>

      {/* Right: auth panel */}
      <section className="gt-auth-panel">
        <div className="gt-auth-box">
          <div className="gt-brand">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="15.5" stroke="#3FD7C7" strokeWidth="1.2" opacity="0.5" />
              <circle cx="17" cy="17" r="9.5" stroke="#3FD7C7" strokeWidth="1.2" opacity="0.8" />
              <line x1="17" y1="0" x2="17" y2="7" stroke="#3FD7C7" strokeWidth="1.4" />
              <line x1="17" y1="27" x2="17" y2="34" stroke="#3FD7C7" strokeWidth="1.4" />
              <line x1="0" y1="17" x2="7" y2="17" stroke="#3FD7C7" strokeWidth="1.4" />
              <line x1="27" y1="17" x2="34" y2="17" stroke="#3FD7C7" strokeWidth="1.4" />
              <circle cx="17" cy="17" r="2.4" fill="#3FD7C7" />
            </svg>
            <div>
              <div className="gt-wordmark">
                GROUND<span>TRUTH</span>
              </div>
              <div className="gt-sub">DAMAGE ASSESSMENT &amp; RESCUE ROUTING</div>
            </div>
          </div>

          <h2>Create your response account</h2>
          <p className="gt-lead">
            Register to access live sector scans, damage grades, and
            rescue routing for your assigned region.
          </p>

          <div className="gt-roles" role="group" aria-label="Register as">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                className="gt-role-chip"
                aria-pressed={role === r.id}
                onClick={() => setRole(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {registerError && (
            <div
              style={{
                marginBottom: "18px",
                padding: "10px 12px",
                border: "1px solid rgba(229,72,77,0.5)",
                background: "rgba(229,72,77,0.08)",
                color: "#E5484D",
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                lineHeight: "1.5",
              }}
            >
              REGISTRATION FAILED — {registerError}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginBottom: "18px",
                padding: "10px 12px",
                border: "1px solid rgba(79,190,122,0.45)",
                background: "rgba(79,190,122,0.08)",
                color: "var(--sev-minor)",
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                lineHeight: "1.5",
              }}
            >
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="gt-field gt-register-field">
              <label htmlFor="gt-username">Operator ID</label>
              <div className="gt-input-wrap">
                <input
                  type="text"
                  id="gt-username"
                  placeholder="response.operator"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setRegisterError("");
                  }}
                  required
                />
                <div className="gt-scan-underline" />
              </div>
            </div>

            <div className="gt-field gt-register-field">
              <label htmlFor="gt-register-email">Access ID</label>
              <div className="gt-input-wrap">
                <input
                  type="email"
                  id="gt-register-email"
                  placeholder="you@agency.gov"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setRegisterError("");
                  }}
                  required
                />
                <div className="gt-scan-underline" />
              </div>
            </div>

            <div className="gt-field gt-register-field">
              <label htmlFor="gt-register-password">Password</label>
              <div className="gt-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  id="gt-register-password"
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setRegisterError("");
                  }}
                  required
                />
                <button
                  type="button"
                  className="gt-toggle-vis"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword((s) => !s)
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                <div className="gt-scan-underline" />
              </div>
            </div>

            <div className="gt-field gt-register-field">
              <label htmlFor="gt-confirm-password">
                Confirm Password
              </label>
              <div className="gt-input-wrap">
                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  id="gt-confirm-password"
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setRegisterError("");
                  }}
                  required
                />
                <button
                  type="button"
                  className="gt-toggle-vis"
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowConfirmPassword((s) => !s)
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                <div className="gt-scan-underline" />
              </div>
            </div>

            <button
              type="submit"
              className="gt-submit"
              ref={submitBtnRef}
              onClick={spawnRipple}
              disabled={submitting}
            >
              {submitting ? (
                "Provisioning account…"
              ) : (
                <>
                  Create account
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
          </form>

          <div className="gt-status-footer">
            <div className="gt-ok">
              <span className="gt-led" />
              ALL FEEDS NOMINAL
            </div>
            <div>{syncLine}</div>
          </div>

          <div className="gt-request-access">
            Already registered?{" "}
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                navigate("/login");
              }}
            >
              Authenticate →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}