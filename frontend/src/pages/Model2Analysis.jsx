import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

/*
  Real earthquake sample data.

  These files are stored inside:

  AIQuake/
  └── ai/
      └── model2/
          └── real_samples/
              └── paired_samples/
*/

const REAL_SAMPLES = {
  destroyed: {
    label: "REAL SAMPLE 001 — DESTROYED",
    prePath:
      "paired_samples/sample_001_destroyed/pre_reference.png",
    postPath:
      "paired_samples/sample_001_destroyed/post_event.png",
  },

  major: {
    label: "REAL SAMPLE 002 — MAJOR DAMAGE",
    prePath:
      "paired_samples/sample_002_major-damage/pre_reference.png",
    postPath:
      "paired_samples/sample_002_major-damage/post_event.png",
  },

  minor: {
    label: "REAL SAMPLE 003 — MINOR DAMAGE",
    prePath:
      "paired_samples/sample_003_minor-damage/pre_reference.png",
    postPath:
      "paired_samples/sample_003_minor-damage/post_event.png",
  },
};


function Model2Analysis() {

  const [preImage, setPreImage] = useState(null);
  const [postImage, setPostImage] = useState(null);

  const [prePreview, setPrePreview] = useState(null);
  const [postPreview, setPostPreview] = useState(null);

  const [selectedSample, setSelectedSample] = useState("");

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");


  /*
    ------------------------------------------------------------
    USER UPLOAD — PRE IMAGE
    ------------------------------------------------------------
  */

  const handlePreImage = (event) => {

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPreImage(file);

    setPrePreview(
      URL.createObjectURL(file)
    );

    setSelectedSample("");

    setResult(null);

    setError("");
  };


  /*
    ------------------------------------------------------------
    USER UPLOAD — POST IMAGE
    ------------------------------------------------------------
  */

  const handlePostImage = (event) => {

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPostImage(file);

    setPostPreview(
      URL.createObjectURL(file)
    );

    setSelectedSample("");

    setResult(null);

    setError("");
  };


  /*
    ------------------------------------------------------------
    DOWNLOAD SAMPLE IMAGE
    ------------------------------------------------------------

    The sample image is downloaded internally.

    It is NOT displayed on the Dashboard.
  */

  const downloadSampleImage = async (path, filename) => {

    const response = await fetch(
      `${API_URL}/real-data/${path}`
    );

    if (!response.ok) {

      throw new Error(
        `Unable to load sample image: ${filename}`
      );
    }

    const blob = await response.blob();

    return new File(
      [blob],
      filename,
      {
        type: blob.type || "image/png",
      }
    );
  };


  /*
    ------------------------------------------------------------
    SELECT REAL EARTHQUAKE SAMPLE
    ------------------------------------------------------------
  */

  const handleSampleSelection = async (event) => {

    const sampleKey = event.target.value;

    setSelectedSample(sampleKey);

    setResult(null);

    setError("");

    if (!sampleKey) {
      return;
    }

    const sample =
      REAL_SAMPLES[sampleKey];

    if (!sample) {
      return;
    }

    try {

      setLoading(true);

      /*
        Download the real PRE image
        internally.
      */

      const preFile =
        await downloadSampleImage(
          sample.prePath,
          `${sampleKey}_pre.png`
        );


      /*
        Download the real POST image
        internally.
      */

      const postFile =
        await downloadSampleImage(
          sample.postPath,
          `${sampleKey}_post.png`
        );


      /*
        Store the files for Model 2.
      */

      setPreImage(preFile);

      setPostImage(postFile);


      /*
        IMPORTANT:

        We intentionally DO NOT create
        image previews here.

        The sample images are used as
        analysis data only.
      */

      setPrePreview(null);

      setPostPreview(null);

    } catch (sampleError) {

      console.error(
        "Real sample loading error:",
        sampleError
      );

      setError(
        sampleError.message ||
        "Unable to load the real earthquake sample."
      );

      setPreImage(null);

      setPostImage(null);

    } finally {

      setLoading(false);
    }
  };


  /*
    ------------------------------------------------------------
    RUN MODEL 2
    ------------------------------------------------------------
  */

  const runModel2 = async () => {

    if (!preImage || !postImage) {

      setError(
        "Please select both a pre-disaster image and a post-disaster image."
      );

      return;
    }


    setLoading(true);

    setError("");

    setResult(null);


    try {

      const formData =
        new FormData();


      formData.append(
        "pre_image",
        preImage
      );


      formData.append(
        "post_image",
        postImage
      );


      const response =
        await fetch(
          `${API_URL}/predict-damage`,
          {
            method: "POST",
            body: formData,
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.error ||
          "Model 2 damage analysis failed."
        );
      }


      setResult(
        data.result
      );


    } catch (requestError) {

      console.error(
        "Model 2 error:",
        requestError
      );


      setError(
        requestError.message ||
        "Unable to connect to Model 2."
      );


    } finally {

      setLoading(false);
    }
  };


  /*
    ------------------------------------------------------------
    DAMAGE PERCENTAGES
    ------------------------------------------------------------
  */

  const percentages =
    result?.damage_percentages || {};


  return (

    <section className="model2-card">


      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="card-kicker">
        03 / BUILDING DAMAGE ANALYSIS
      </div>


      <h2 className="model2-title">
        Model 2 — Fine-Grained Damage Assessment
      </h2>


      <p className="model2-description">
        Compare pre-disaster and post-disaster imagery
        to identify predicted damage regions.
      </p>


      {/* =====================================================
          REAL EARTHQUAKE SAMPLE DATA
          ===================================================== */}

      <div className="model2-sample-section">

        <label className="model2-label">
          REAL EARTHQUAKE SAMPLE DATA
        </label>


        <select
          className="model2-sample-select"
          value={selectedSample}
          onChange={handleSampleSelection}
          disabled={loading}
        >

          <option value="">
            SELECT REAL SAMPLE DATA
          </option>

          <option value="destroyed">
            REAL SAMPLE 001 — DESTROYED
          </option>

          <option value="major">
            REAL SAMPLE 002 — MAJOR DAMAGE
          </option>

          <option value="minor">
            REAL SAMPLE 003 — MINOR DAMAGE
          </option>

        </select>


        <div className="model2-sample-note">
          Real pre-event and post-event images are used
          internally for Model 2 analysis. Sample images
          are not displayed on the Dashboard.
        </div>

      </div>


      {/* =====================================================
          IMAGE INPUTS
          ===================================================== */}

      <div className="model2-upload-grid">


        {/* =================================================
            PRE IMAGE
            ================================================= */}

        <div className="model2-upload">

          <label className="model2-label">
            PRE-DISASTER IMAGE
          </label>


          <label className="model2-file-button">

            <input
              type="file"
              accept="image/*"
              onChange={handlePreImage}
            />


            {preImage
              ? selectedSample
                ? "REAL SAMPLE PRE-IMAGE LOADED"
                : preImage.name
              : "SELECT PRE-IMAGE"}

          </label>


          {/*

            User-uploaded images still show previews.

            Real sample images DO NOT show previews.

          */}

          {prePreview && (

            <img
              className="model2-preview"
              src={prePreview}
              alt="Pre-disaster preview"
            />

          )}

        </div>


        {/* =================================================
            POST IMAGE
            ================================================= */}

        <div className="model2-upload">

          <label className="model2-label">
            POST-DISASTER IMAGE
          </label>


          <label className="model2-file-button">

            <input
              type="file"
              accept="image/*"
              onChange={handlePostImage}
            />


            {postImage
              ? selectedSample
                ? "REAL SAMPLE POST-IMAGE LOADED"
                : postImage.name
              : "SELECT POST-IMAGE"}

          </label>


          {postPreview && (

            <img
              className="model2-preview"
              src={postPreview}
              alt="Post-disaster preview"
            />

          )}

        </div>

      </div>


      {/* =====================================================
          RUN BUTTON
          ===================================================== */}

      <button
        type="button"
        className="model2-run-button"
        onClick={runModel2}
        disabled={
          loading ||
          !preImage ||
          !postImage
        }
      >

        {loading
          ? "ANALYZING DAMAGE..."
          : "RUN MODEL 2 ANALYSIS"}

      </button>


      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (

        <div className="model2-error">
          {error}
        </div>

      )}


      {/* =====================================================
          RESULTS
          ===================================================== */}

      {result && (

        <div className="model2-results">


          {/* =================================================
              STATUS
              ================================================= */}

          <div className="model2-result-header">

            <span>
              MODEL STATUS
            </span>

            <strong>
              VERIFIED
            </strong>

          </div>


          {/* =================================================
              DAMAGE STATISTICS
              ================================================= */}

          <div className="model2-stat-grid">


            <div className="model2-stat no-damage">

              <span>
                NO DAMAGE
              </span>

              <strong>
                {percentages["No Damage"] ?? 0}%
              </strong>

            </div>


            <div className="model2-stat minor-damage">

              <span>
                MINOR DAMAGE
              </span>

              <strong>
                {percentages["Minor Damage"] ?? 0}%
              </strong>

            </div>


            <div className="model2-stat major-damage">

              <span>
                MAJOR DAMAGE
              </span>

              <strong>
                {percentages["Major Damage"] ?? 0}%
              </strong>

            </div>


            <div className="model2-stat destroyed">

              <span>
                DESTROYED
              </span>

              <strong>
                {percentages["Destroyed"] ?? 0}%
              </strong>

            </div>

          </div>


          {/* =================================================
              VISUAL DAMAGE MAP
              ================================================= */}

          {result.damage_overlay && (

            <div className="model2-visual-section">


              <div className="model2-visual-title">
                PREDICTED DAMAGE REGION MAP
              </div>


              <div className="model2-visual-frame">

                <img
                  src={result.damage_overlay}
                  alt="Model 2 predicted damage regions"
                  className="model2-damage-overlay"
                />

              </div>


              {/* LEGEND */}

              <div className="model2-legend">


                <div className="model2-legend-item">

                  <span className="legend-color legend-green" />

                  NO DAMAGE

                </div>


                <div className="model2-legend-item">

                  <span className="legend-color legend-yellow" />

                  MINOR

                </div>


                <div className="model2-legend-item">

                  <span className="legend-color legend-orange" />

                  MAJOR

                </div>


                <div className="model2-legend-item">

                  <span className="legend-color legend-red" />

                  DESTROYED

                </div>


              </div>

            </div>

          )}


          {/* =================================================
              PIXEL SUMMARY
              ================================================= */}

          <div className="model2-pixel-summary">

            <span>
              DAMAGE PIXEL ANALYSIS
            </span>


            <div>
              No Damage:
              {" "}
              {percentages["No Damage"] ?? 0}%
            </div>


            <div>
              Minor:
              {" "}
              {percentages["Minor Damage"] ?? 0}%
            </div>


            <div>
              Major:
              {" "}
              {percentages["Major Damage"] ?? 0}%
            </div>


            <div>
              Destroyed:
              {" "}
              {percentages["Destroyed"] ?? 0}%
            </div>

          </div>


        </div>

      )}

    </section>
  );
}


export default Model2Analysis;