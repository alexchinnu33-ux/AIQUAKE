import React, { useState } from "react";
import { useNavigate } from "react-router-dom";


// ============================================================
// API
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000";


// ============================================================
// LOGIN PAGE
// ============================================================

export default function Login() {

  const navigate = useNavigate();


  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [keepSignedIn, setKeepSignedIn] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");


  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    // Basic validation
    if (!email.trim()) {

      setError(
        "Please enter your email address."
      );

      return;
    }


    if (!password) {

      setError(
        "Please enter your password."
      );

      return;
    }


    setSubmitting(true);


    try {

      // ------------------------------------------------------
      // SEND LOGIN REQUEST
      // ------------------------------------------------------

      const response = await fetch(
        `${API_BASE_URL}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );


      // ------------------------------------------------------
      // READ RESPONSE
      // ------------------------------------------------------

      let data = {};

      try {

        data = await response.json();

      } catch {

        data = {};

      }


      // ------------------------------------------------------
      // BACKEND ERROR
      // ------------------------------------------------------

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Invalid email or password."
        );
      }


      // ------------------------------------------------------
      // CHECK TOKEN
      // ------------------------------------------------------

      if (!data.access_token) {

        throw new Error(
          "Authentication succeeded, but no access token was returned."
        );
      }


      // ------------------------------------------------------
      // SAVE AUTHENTICATION
      // ------------------------------------------------------

      localStorage.setItem(
        "token",
        data.access_token
      );


      localStorage.setItem(
        "userEmail",
        data.user?.email || email.trim()
      );


      if (data.user?.username) {

        localStorage.setItem(
          "username",
          data.user.username
        );

      }


      if (data.user?.id !== undefined) {

        localStorage.setItem(
          "userId",
          String(data.user.id)
        );

      }


      if (data.user?.role) {

        localStorage.setItem(
          "role",
          data.user.role
        );

      }


      // ------------------------------------------------------
      // KEEP SIGNED IN
      // ------------------------------------------------------

      localStorage.setItem(
        "keepSignedIn",
        keepSignedIn ? "true" : "false"
      );


      // ------------------------------------------------------
      // GO TO DASHBOARD
      // ------------------------------------------------------

      navigate(
        "/new",
        {
          replace: true,
        }
      );


    } catch (err) {

      console.error(
        "LOGIN ERROR:",
        err
      );


      // Network / backend unavailable
      if (
        err instanceof TypeError &&
        err.message.toLowerCase().includes("fetch")
      ) {

        setError(
          "Failed to connect to the authentication server."
        );

      } else {

        setError(
          err.message ||
          "Authentication failed."
        );

      }


    } finally {

      setSubmitting(false);

    }

  };


  // ----------------------------------------------------------
  // REGISTER
  // ----------------------------------------------------------

  const handleRegister = () => {

    navigate("/register");

  };


  // ----------------------------------------------------------
  // FORGOT PASSWORD
  // ----------------------------------------------------------

  const handleForgotPassword = () => {

    setError(
      "Password recovery is not available yet."
    );

  };


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="groundtruth-page">
      <a
        href="/"
        style={{
          position: "fixed", top: 16, left: 16, zIndex: 50, padding: "9px 14px",
          borderRadius: 9, border: "1px solid rgba(46,230,208,.4)", background: "rgba(4,9,12,.8)",
          color: "#2ee6d0", textDecoration: "none", fontSize: 12, fontWeight: 700, letterSpacing: ".08em",
          fontFamily: "'JetBrains Mono', Consolas, monospace",
        }}
      >
        ← HOME
      </a>

      <style>{`

        * {
          box-sizing: border-box;
        }


        .groundtruth-page {

          min-height: 100vh;

          width: 100%;

          display: flex;

          align-items: center;

          justify-content: center;

          padding: 24px;

          position: relative;

          overflow: hidden;

          background:
            radial-gradient(
              circle at 15% 30%,
              rgba(47, 225, 209, 0.07),
              transparent 28%
            ),
            radial-gradient(
              circle at 85% 65%,
              rgba(135, 70, 180, 0.08),
              transparent 30%
            ),
            #081012;

          color: #e9f0f2;

          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }


        /* ----------------------------------------------------
           GRID
        ---------------------------------------------------- */

        .groundtruth-page::before {

          content: "";

          position: absolute;

          inset: 0;

          background-image:
            linear-gradient(
              rgba(75, 220, 211, 0.055) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(75, 220, 211, 0.055) 1px,
              transparent 1px
            );

          background-size: 45px 45px;

          pointer-events: none;

        }


        .groundtruth-page::after {

          content: "";

          position: absolute;

          width: 900px;

          height: 900px;

          border-radius: 50%;

          border: 1px solid
            rgba(72, 218, 209, 0.08);

          left: -450px;

          top: 30%;

          pointer-events: none;

        }


        /* ----------------------------------------------------
           CARD
        ---------------------------------------------------- */

        .login-card {

          width: 100%;

          max-width: 700px;

          min-height: 760px;

          position: relative;

          z-index: 2;

          padding: 34px 48px 28px;

          border-radius: 20px;

          border: 1px solid
            rgba(113, 145, 158, 0.28);

          background:
            linear-gradient(
              145deg,
              rgba(14, 24, 29, 0.98),
              rgba(15, 17, 23, 0.98)
            );

          box-shadow:
            0 30px 80px
              rgba(0, 0, 0, 0.42),
            inset 0 1px 0
              rgba(255, 255, 255, 0.025);

        }


        /* ----------------------------------------------------
           BRAND
        ---------------------------------------------------- */

        .brand {

          display: flex;

          align-items: center;

          gap: 18px;

          margin-bottom: 54px;

        }


        .brand-target {

          width: 42px;

          height: 42px;

          border: 2px solid
            #35ded1;

          border-radius: 50%;

          position: relative;

          flex-shrink: 0;

          box-shadow:
            0 0 18px
              rgba(53, 222, 209, 0.18);

        }


        .brand-target::before {

          content: "";

          position: absolute;

          width: 12px;

          height: 12px;

          border: 2px solid
            #35ded1;

          border-radius: 50%;

          left: 50%;

          top: 50%;

          transform: translate(
            -50%,
            -50%
          );

        }


        .brand-target::after {

          content: "";

          position: absolute;

          width: 5px;

          height: 5px;

          border-radius: 50%;

          background: #35ded1;

          left: 50%;

          top: 50%;

          transform: translate(
            -50%,
            -50%
          );

          box-shadow:
            0 -27px 0 -1px #35ded1,
            0 27px 0 -1px #35ded1,
            27px 0 0 -1px #35ded1,
            -27px 0 0 -1px #35ded1;

        }


        .brand-name {

          margin: 0;

          font-size: 25px;

          line-height: 1;

          font-weight: 800;

          letter-spacing: -0.5px;

        }


        .brand-ground {

          color: #e8eef0;

        }


        .brand-truth {

          color: #36ded1;

        }


        .brand-subtitle {

          margin-top: 10px;

          color: #536875;

          font-size: 12px;

          letter-spacing: 2px;

          font-family:
            "Courier New",
            monospace;

        }


        /* ----------------------------------------------------
           HEADER
        ---------------------------------------------------- */

        .login-header {

          text-align: center;

          margin-bottom: 38px;

        }


        .login-title {

          margin: 0;

          font-size: 32px;

          line-height: 1.15;

          font-weight: 750;

          letter-spacing: -0.8px;

        }


        .login-description {

          margin: 12px auto 0;

          max-width: 560px;

          color: #8394a2;

          font-size: 17px;

          line-height: 1.5;

        }


        /* ----------------------------------------------------
           ROLE SELECTOR
        ---------------------------------------------------- */

        .role-selector {

          display: grid;

          grid-template-columns:
            repeat(3, 1fr);

          gap: 10px;

          margin-bottom: 30px;

        }


        .role-button {

          min-height: 58px;

          border-radius: 8px;

          border: 1px solid
            #2b3a46;

          background: #111a21;

          color: #71808e;

          font-family:
            "Courier New",
            monospace;

          font-size: 12px;

          font-weight: 700;

          letter-spacing: 1px;

          cursor: pointer;

          transition:
            border-color 0.2s,
            background 0.2s,
            color 0.2s;

        }


        .role-button:hover {

          border-color: #35ded1;

          color: #a9b8c2;

        }


        .role-button.active {

          border: 2px solid #35ded1;

          background:
            rgba(53, 222, 209, 0.10);

          color: #35ded1;

        }


        /* ----------------------------------------------------
           ERROR
        ---------------------------------------------------- */

        .error-box {

          min-height: 48px;

          display: flex;

          align-items: center;

          justify-content: center;

          padding: 12px 16px;

          margin-bottom: 28px;

          border: 1px solid
            rgba(255, 67, 78, 0.7);

          border-radius: 7px;

          background:
            rgba(111, 22, 31, 0.16);

          color: #ff5058;

          font-family:
            "Courier New",
            monospace;

          font-size: 13px;

          text-align: center;

          letter-spacing: 0.4px;

        }


        /* ----------------------------------------------------
           FORM
        ---------------------------------------------------- */

        .login-form {

          width: 100%;

        }


        .field {

          margin-bottom: 27px;

        }


        .field-label {

          display: block;

          margin-bottom: 14px;

          text-align: center;

          color: #596a77;

          font-family:
            "Courier New",
            monospace;

          font-size: 12px;

          letter-spacing: 2px;

        }


        .input-wrapper {

          position: relative;

        }


        .field-input {

          width: 100%;

          height: 54px;

          padding: 0 17px;

          border-radius: 7px;

          border: 1px solid
            #3a4b61;

          outline: none;

          background: #273346;

          color: #edf2f5;

          font-size: 17px;

          transition:
            border-color 0.2s,
            box-shadow 0.2s;

        }


        .field-input::placeholder {

          color: #738190;

        }


        .field-input:focus {

          border-color: #35ded1;

          box-shadow:
            0 0 0 3px
              rgba(53, 222, 209, 0.08);

        }


        .password-input {

          padding-right: 55px;

        }


        .password-toggle {

          position: absolute;

          right: 12px;

          top: 50%;

          transform: translateY(-50%);

          width: 36px;

          height: 36px;

          border: 0;

          background: transparent;

          color: #617181;

          cursor: pointer;

          display: flex;

          align-items: center;

          justify-content: center;

        }


        .password-toggle:hover {

          color: #35ded1;

        }


        /* ----------------------------------------------------
           OPTIONS
        ---------------------------------------------------- */

        .form-options {

          display: flex;

          justify-content: space-between;

          align-items: center;

          margin-top: -3px;

          margin-bottom: 31px;

          color: #80909e;

          font-size: 16px;

        }


        .remember {

          display: flex;

          align-items: center;

          gap: 12px;

          cursor: pointer;

        }


        .remember input {

          appearance: none;

          width: 16px;

          height: 16px;

          margin: 0;

          border-radius: 3px;

          border: 1px solid #536778;

          background: #1b2630;

          cursor: pointer;

          position: relative;

        }


        .remember input:checked {

          background: #35ded1;

          border-color: #35ded1;

        }


        .remember input:checked::after {

          content: "";

          position: absolute;

          width: 4px;

          height: 8px;

          border-right: 2px solid #06201f;

          border-bottom: 2px solid #06201f;

          transform:
            rotate(45deg);

          left: 5px;

          top: 2px;

        }


        .forgot-button {

          border: 0;

          background: transparent;

          color: #80909e;

          font-size: 16px;

          cursor: pointer;

        }


        .forgot-button:hover {

          color: #35ded1;

        }


        /* ----------------------------------------------------
           SUBMIT
        ---------------------------------------------------- */

        .submit-button {

          width: 100%;

          height: 56px;

          border: 0;

          border-radius: 7px;

          background: #3cdbd0;

          color: #06201f;

          font-size: 17px;

          font-weight: 700;

          cursor: pointer;

          display: flex;

          align-items: center;

          justify-content: center;

          gap: 12px;

          transition:
            transform 0.15s,
            background 0.2s,
            opacity 0.2s;

        }


        .submit-button:hover {

          background: #51e4d9;

          transform:
            translateY(-1px);

        }


        .submit-button:active {

          transform:
            translateY(0);

        }


        .submit-button:disabled {

          opacity: 0.65;

          cursor: not-allowed;

          transform: none;

        }


        .arrow {

          font-size: 25px;

          line-height: 0;

          font-weight: 400;

        }


        .spinner {

          width: 18px;

          height: 18px;

          border-radius: 50%;

          border: 2px solid
            rgba(6, 32, 31, 0.25);

          border-top-color: #06201f;

          animation:
            spin 0.7s linear infinite;

        }


        @keyframes spin {

          to {

            transform:
              rotate(360deg);

          }

        }


        /* ----------------------------------------------------
           FOOTER
        ---------------------------------------------------- */

        .login-footer {

          margin-top: 27px;

          padding-top: 27px;

          border-top: 1px solid
            rgba(86, 106, 119, 0.25);

        }


        .system-status {

          display: flex;

          justify-content: space-between;

          align-items: center;

          margin-bottom: 37px;

          font-family:
            "Courier New",
            monospace;

          font-size: 12px;

          letter-spacing: 1px;

        }


        .status {

          display: flex;

          align-items: center;

          gap: 9px;

          color: #49c879;

        }


        .status-dot {

          width: 6px;

          height: 6px;

          border-radius: 50%;

          background: #49c879;

          box-shadow:
            0 0 8px
              rgba(73, 200, 121, 0.5);

        }


        .sync {

          color: #53616d;

        }


        .register-text {

          text-align: center;

          color: #8393a0;

          font-size: 17px;

        }


        .register-button {

          border: 0;

          background: transparent;

          padding: 0;

          color: #35ded1;

          font-size: inherit;

          cursor: pointer;

        }


        .register-button:hover {

          text-decoration: underline;

        }


        /* ----------------------------------------------------
           MOBILE
        ---------------------------------------------------- */

        @media (max-width: 700px) {

          .groundtruth-page {

            padding: 12px;

          }


          .login-card {

            min-height: auto;

            padding:
              28px 22px 24px;

          }


          .brand {

            margin-bottom: 40px;

          }


          .login-title {

            font-size: 27px;

          }


          .login-description {

            font-size: 15px;

          }


          .role-selector {

            grid-template-columns:
              1fr;

          }


          .role-button {

            min-height: 50px;

          }


          .form-options {

            font-size: 14px;

          }


          .forgot-button {

            font-size: 14px;

          }

        }

      `}</style>


      <div className="login-card">


        {/* ====================================================
            BRAND
        ==================================================== */}

        <div className="brand">

          <div className="brand-target" />

          <div>

            <div className="brand-name">

              <span className="brand-ground">
                GROUND
              </span>

              <span className="brand-truth">
                TRUTH
              </span>

            </div>

            <div className="brand-subtitle">

              DAMAGE ASSESSMENT &amp; RESCUE ROUTING

            </div>

          </div>

        </div>


        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="login-header">

          <h1 className="login-title">
            Sign in to your console
          </h1>

          <p className="login-description">
            Authenticate to view live sector scans,
            damage grades, and rescue routing for your
            assigned region.
          </p>

        </div>


        {/* ====================================================
            ROLE BUTTONS
        ==================================================== */}

        <div className="role-selector">

          <button
            type="button"
            className="role-button active"
          >
            RESCUE
            <br />
            COORDINATOR
          </button>


          <button
            type="button"
            className="role-button"
          >
            FIELD
            <br />
            ANALYST
          </button>


          <button
            type="button"
            className="role-button"
          >
            COMMAND
            <br />
            CENTER
          </button>

        </div>


        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (

          <div className="error-box">

            AUTHENTICATION FAILED — {error}

          </div>

        )}


        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >


          {/* EMAIL */}

          <div className="field">

            <label
              className="field-label"
              htmlFor="email"
            >
              ACCESS ID
            </label>


            <input
              id="email"
              name="email"
              type="email"
              className="field-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              autoComplete="email"
              disabled={submitting}
            />

          </div>


          {/* PASSWORD */}

          <div className="field">

            <label
              className="field-label"
              htmlFor="password"
            >
              PASSWORD
            </label>


            <div className="input-wrapper">

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                className="field-input password-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                disabled={submitting}
              />


              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >

                {showPassword ? (

                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >

                    <path
                      d="M3 3l18 18"
                    />

                    <path
                      d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                    />

                    <path
                      d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8-0.6 1.7-1.6 3.2-2.9 4.4"
                    />

                    <path
                      d="M6.6 6.6C4.9 7.7 3.6 9.4 2 12c1.5 4 5 8 10 8 1.6 0 3-.4 4.3-1.1"
                    />

                  </svg>

                ) : (

                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >

                    <path
                      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
                    />

                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />

                  </svg>

                )}

              </button>

            </div>

          </div>


          {/* OPTIONS */}

          <div className="form-options">

            <label className="remember">

              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) =>
                  setKeepSignedIn(
                    e.target.checked
                  )
                }
                disabled={submitting}
              />

              <span>
                Keep me signed in
              </span>

            </label>


            <button
              type="button"
              className="forgot-button"
              onClick={
                handleForgotPassword
              }
              disabled={submitting}
            >
              Forgot access?
            </button>

          </div>


          {/* SUBMIT */}

          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >

            {submitting ? (

              <>
                <span className="spinner" />

                Authenticating...
              </>

            ) : (

              <>
                Authenticate

                <span className="arrow">
                  →
                </span>
              </>

            )}

          </button>

        </form>


        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="login-footer">


          <div className="system-status">

            <div className="status">

              <span className="status-dot" />

              ALL FEEDS NOMINAL

            </div>


            <div className="sync">

              SYNCED

            </div>

          </div>


          <div className="register-text">

            New response team?{" "}

            <button
              type="button"
              className="register-button"
              onClick={handleRegister}
            >
              Request access →
            </button>

          </div>

        </div>


      </div>

    </div>

  );

}