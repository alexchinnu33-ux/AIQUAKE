import React from "react";

const API_URL = "http://127.0.0.1:8000";

const realDataUrl = (path) => {
  return `${API_URL}/real-data/${path}`;
};

const samples = [
  {
    title: "DESTROYED",
    folder: "sample_001_destroyed",
  },
  {
    title: "MAJOR DAMAGE",
    folder: "sample_002_major-damage",
  },
  {
    title: "MINOR DAMAGE",
    folder: "sample_003_minor-damage",
  },
];

function RealIncidentData() {
  return (
    <section className="real-incident-section">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="real-incident-header">

        <div>
          <div className="real-incident-kicker">
            REAL INCIDENT DATA
          </div>

          <h2>
            CARABALLEDA — VENEZUELA
          </h2>

          <p>
            2026 EARTHQUAKE · REAL REMOTE-SENSING DATA
          </p>
        </div>

        <div className="real-incident-status">
          <span className="real-status-dot"></span>
          DATA LOADED
        </div>

      </div>


      {/* =====================================================
          WHOLE AREA POST-EVENT IMAGE
          ===================================================== */}

      <div className="real-section-block">

        <div className="real-section-title">
          WHOLE AREA — POST-EVENT IMAGERY
        </div>

        <div className="real-full-image-container">

          <img
            src={realDataUrl("post_event_full_area.png")}
            alt="Caraballeda post-event earthquake imagery"
            className="real-full-image"
          />

        </div>

        <div className="real-image-caption">
          Real post-event imagery from the Caraballeda
          earthquake response dataset.
        </div>

      </div>


      {/* =====================================================
          DAMAGE AREA EXAMPLES
          ===================================================== */}

      <div className="real-section-block">

        <div className="real-section-title">
          DAMAGE AREA EXAMPLES
        </div>

        <div className="real-damage-example-container">

          <img
            src={realDataUrl("damaged_area_examples.png")}
            alt="Real Caraballeda damaged area examples"
            className="real-damage-example-image"
          />

        </div>

        <div className="real-image-caption">
          Representative damaged-area examples from the
          real Caraballeda earthquake dataset.
        </div>

      </div>


      {/* =====================================================
          PRE-EVENT / POST-EVENT SAMPLE PAIRS
          ===================================================== */}

      <div className="real-section-block">

        <div className="real-section-title">
          PRE-EVENT / POST-EVENT DAMAGE SAMPLES
        </div>

        <div className="real-sample-grid">

          {samples.map((sample) => (

            <div
              className="real-sample-card"
              key={sample.folder}
            >

              {/* SAMPLE TITLE */}

              <div className="real-sample-card-header">
                {sample.title}
              </div>


              {/* PRE / POST IMAGES */}

              <div className="real-sample-images">

                {/* PRE-EVENT */}

                <div className="real-sample-image-box">

                  <div className="real-image-label">
                    PRE-EVENT
                  </div>

                  <img
                    src={realDataUrl(
                      `paired_samples/${sample.folder}/pre_reference.png`
                    )}
                    alt={`${sample.title} pre-event reference`}
                  />

                </div>


                {/* POST-EVENT */}

                <div className="real-sample-image-box">

                  <div className="real-image-label">
                    POST-EVENT
                  </div>

                  <img
                    src={realDataUrl(
                      `paired_samples/${sample.folder}/post_event.png`
                    )}
                    alt={`${sample.title} post-event`}
                  />

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>


      {/* =====================================================
          WHOLE AREA DAMAGE MAP
          ===================================================== */}

      <div className="real-section-block">

        <div className="real-section-title">
          WHOLE AREA DAMAGE ASSESSMENT MAP
        </div>

        <div className="real-map-container">

          <iframe
            src={realDataUrl("caraballeda_damage_map.html")}
            title="Caraballeda earthquake damage assessment map"
            className="real-map-frame"
          />

        </div>

        <div className="real-image-caption">
          Damage polygons shown here are HOTOSM/fAIr
          assessment data associated with the real earthquake
          response dataset.
        </div>

      </div>

    </section>
  );
}

export default RealIncidentData;