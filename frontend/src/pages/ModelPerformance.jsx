import { useEffect, useState } from "react";

import NavigationBar from "./NavigationBar";
import { API_URL } from "../config";
import "./aq.css";

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function ModelPerformance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/model/metrics`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.detail || "Metrics unavailable.");
        setData(body);
      })
      .catch((err) => setError(err.message));
  }, []);

  const m1 = data?.model1;
  const matrix = m1?.confusion_matrix || [];

  return (
    <div className="aq-page">
      <NavigationBar />

      <div className="aq-wrap">
        <header className="aq-head">
          <div>
            <div className="aq-eyebrow">AIQUAKE / MODEL EVALUATION</div>
            <h1 className="aq-title">Model Performance</h1>
            <p className="aq-sub">
              How accurate the damage classifier is on images it never saw
              during training, and what is and is not validated.
            </p>
          </div>
        </header>

        {error && (
          <div className="aq-state err" role="alert">
            {error}
          </div>
        )}
        {!data && !error && <div className="aq-state">Loading metrics…</div>}

        {m1 && (
          <>
            <section className="aq-kpis" aria-label="Headline metrics">
              <div className="aq-kpi">
                <span>Accuracy</span>
                <strong>{pct(m1.accuracy)}</strong>
                <small>on held-out test set</small>
              </div>
              <div className="aq-kpi">
                <span>Macro F1</span>
                <strong>{pct(m1.macro_f1)}</strong>
                <small>mean over classes</small>
              </div>
              <div className="aq-kpi">
                <span>Test images</span>
                <strong>{m1.test_images.toLocaleString()}</strong>
                <small>15 % split, seed 42</small>
              </div>
            </section>

            <div className="aq-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
              <div className="aq-panel aq-card">
                <h3>Per-class results</h3>
                <div className="aq-table-wrap" style={{ marginTop: 0 }}>
                  <table className="aq-table" style={{ minWidth: 420 }}>
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th className="num">Precision</th>
                        <th className="num">Recall</th>
                        <th className="num">F1</th>
                        <th className="num">Images</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m1.classes.map((c) => (
                        <tr key={c} style={{ cursor: "default" }}>
                          <td><b>{c}</b></td>
                          <td className="num">{pct(m1.per_class[c].precision)}</td>
                          <td className="num">{pct(m1.per_class[c].recall)}</td>
                          <td className="num">{pct(m1.per_class[c].f1)}</td>
                          <td className="num">{m1.per_class[c].support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="aq-note" style={{ marginTop: 10 }}>
                  Recall on <b>Collapsed</b> matters most for rescue: it is the
                  share of truly collapsed buildings the model catches.
                </p>
              </div>

              <div className="aq-panel aq-card">
                <h3>Confusion matrix</h3>
                <div
                  role="table"
                  aria-label="Confusion matrix"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `auto repeat(${m1.classes.length}, 1fr)`,
                    gap: 4,
                    fontSize: 12,
                  }}
                >
                  <span />
                  {m1.classes.map((c) => (
                    <span key={c} className="aq-label" style={{ textAlign: "center" }}>
                      pred {c}
                    </span>
                  ))}
                  {matrix.map((row, i) => {
                    const total = row.reduce((a, b) => a + b, 0) || 1;
                    return [
                      <span key={`l${i}`} className="aq-label" style={{ alignSelf: "center" }}>
                        true {m1.classes[i]}
                      </span>,
                      ...row.map((value, j) => (
                        <div
                          key={`${i}-${j}`}
                          title={`${value} images (${pct(value / total)} of true ${m1.classes[i]})`}
                          style={{
                            padding: "16px 4px",
                            textAlign: "center",
                            borderRadius: 4,
                            fontWeight: 600,
                            color: i === j ? "#04110f" : "#edf5f3",
                            background:
                              i === j
                                ? `rgba(63,215,199,${0.35 + 0.65 * (value / total)})`
                                : `rgba(239,68,68,${Math.min(0.9, (value / total) * 4)})`,
                            border: "1px solid rgba(148,187,204,0.14)",
                          }}
                        >
                          {value}
                        </div>
                      )),
                    ];
                  })}
                </div>
                <p className="aq-note" style={{ marginTop: 10 }}>
                  Rows are the true class, columns the prediction. Teal diagonal =
                  correct; red = confusions.
                </p>
              </div>
            </div>

            <div className="aq-panel aq-card aq-note" style={{ marginTop: 14 }}>
              <h3>About the models</h3>
              <ul>
                <li>
                  <b>Model 1</b> — {m1.model}. Evaluated on {m1.evaluated_on}.
                </li>
                <li>
                  <b>Model 2</b> — {data.model2.model}. Input: {data.model2.input}.
                  Output: {data.model2.output}.
                </li>
                <li>{data.model2.validation_note}</li>
                <li>
                  Scores describe this dataset only. Real disasters differ in
                  sensor, angle and building style, so field verification is
                  still required.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
