
import { useLocation, useNavigate } from "react-router-dom";

export default function NavigationBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userRole");

    navigate("/login", { replace: true });
  };

  const go = (path) => navigate(path);

  return (
    <>
      <nav className="gt-navigation" aria-label="Main navigation">
        <button
          className="gt-nav-brand"
          onClick={() => go("/dashboard")}
          aria-label="Go to dashboard"
        >
          <span className="gt-nav-mark">+</span>

          <span>
            <strong>GROUND<span>TRUTH</span></strong>
            <small>AIQUAKE RESPONSE NETWORK</small>
          </span>
        </button>

        <div className="gt-nav-links">
          <button
            className={
              location.pathname === "/dashboard"
                ? "gt-nav-link active"
                : "gt-nav-link"
            }
            onClick={() => go("/dashboard")}
          >
            DASHBOARD
          </button>

          <button
            className={
              location.pathname === "/command-center"
                ? "gt-nav-link active"
                : "gt-nav-link"
            }
            onClick={() => go("/command-center")}
          >
            COMMAND CENTER
          </button>
        </div>

        <div className="gt-nav-actions">
          <span className="gt-nav-online">
            <span className="gt-nav-dot" />
            ONLINE
          </span>

          <button
            className="gt-nav-logout"
            onClick={handleLogout}
          >
            LOGOUT
          </button>
        </div>
      </nav>

      <style>{`
        .gt-navigation {
          position: relative;
          z-index: 20;
          width: min(1180px, calc(100% - 32px));
          margin: 16px auto 0;
          min-height: 58px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 18px;
          padding: 9px 12px;
          border: 1px solid rgba(148,187,204,.14);
          border-radius: 7px;
          background: rgba(7,15,15,.91);
          box-shadow:
            0 14px 40px rgba(0,0,0,.22),
            inset 0 1px 0 rgba(255,255,255,.025);
          backdrop-filter: blur(12px);
        }

        .gt-nav-brand,
        .gt-nav-link,
        .gt-nav-logout {
          appearance: none;
          border: 0;
          font: inherit;
          cursor: pointer;
        }

        .gt-nav-brand {
          justify-self: start;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0;
          color: #e6f0ef;
          background: transparent;
          text-align: left;
        }

        .gt-nav-brand strong {
          display: block;
          font: 700 13px/1 Inter, system-ui, sans-serif;
          letter-spacing: .12em;
        }

        .gt-nav-brand strong span {
          color: #3fd7c7;
        }

        .gt-nav-brand small {
          display: block;
          margin-top: 3px;
          color: #536865;
          font: 7px/1.2 "JetBrains Mono","SFMono-Regular",Consolas,monospace;
          letter-spacing: .09em;
        }

        .gt-nav-mark {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(63,215,199,.35);
          border-radius: 5px;
          color: #3fd7c7;
          background: rgba(63,215,199,.04);
          font: 20px/1 Inter, system-ui, sans-serif;
        }

        .gt-nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .gt-nav-link {
          position: relative;
          padding: 10px 12px;
          color: #627573;
          background: transparent;
          border-radius: 4px;
          font: 8px/1 "JetBrains Mono","SFMono-Regular",Consolas,monospace;
          letter-spacing: .1em;
          transition: color .15s ease, background .15s ease;
        }

        .gt-nav-link:hover {
          color: #c7d7d4;
          background: rgba(63,215,199,.04);
        }

        .gt-nav-link.active {
          color: #3fd7c7;
          background: rgba(63,215,199,.08);
        }

        .gt-nav-link.active::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 4px;
          height: 1px;
          background: #3fd7c7;
          box-shadow: 0 0 8px rgba(63,215,199,.55);
        }

        .gt-nav-actions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .gt-nav-online {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #3fd7c7;
          font: 8px/1 "JetBrains Mono","SFMono-Regular",Consolas,monospace;
          letter-spacing: .08em;
        }

        .gt-nav-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #3fd7c7;
          box-shadow: 0 0 9px rgba(63,215,199,.75);
        }

        .gt-nav-logout {
          padding: 8px 10px;
          border: 1px solid rgba(229,72,77,.38);
          border-radius: 4px;
          background: rgba(229,72,77,.05);
          color: #e96a6f;
          font: 8px/1 "JetBrains Mono","SFMono-Regular",Consolas,monospace;
          letter-spacing: .08em;
        }

        .gt-nav-logout:hover {
          background: rgba(229,72,77,.11);
        }

        @media (max-width: 760px) {
          .gt-navigation {
            grid-template-columns: 1fr auto;
          }

          .gt-nav-links {
            grid-column: 1 / -1;
            grid-row: 2;
            justify-content: stretch;
            border-top: 1px solid rgba(148,187,204,.09);
            padding-top: 7px;
          }

          .gt-nav-link {
            flex: 1;
          }

          .gt-nav-online {
            display: none;
          }
        }

        @media (max-width: 420px) {
          .gt-navigation {
            width: calc(100% - 20px);
            margin-top: 10px;
            padding: 8px;
          }

          .gt-nav-brand small {
            display: none;
          }

          .gt-nav-brand strong {
            font-size: 11px;
          }

          .gt-nav-mark {
            width: 28px;
            height: 28px;
          }

          .gt-nav-link {
            padding: 10px 5px;
            font-size: 7px;
          }
        }
      `}</style>
    </>
  );
}
