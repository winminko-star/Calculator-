// src/components/ENHWorkflow.jsx
import React, { useState, useEffect } from "react";
import "./workflow.css";
import Step1Upload from "./Step1Upload";
import Step2SelectPoints from "./Step2SelectPoints";
import Step3PreviewExport from "./Step3PreviewExport";
import Step4Download from "./Step4Download";

export default function ENHWorkflow() {
  const [step, setStep] = useState(1);
  const [points, setPoints] = useState([]);    // original / current points
  const [result, setResult] = useState([]);    // final ENH result

  // small helper to advance and keep UI consistent
  const next = () => setStep(s => Math.min(s + 1, 4));
  const back = () => setStep(s => Math.max(s - 1, 1));

  // Debug log so we know component loaded
  useEffect(() => {
    console.log("ENHWorkflow mounted");
  }, []);

  return (
    <div className="step-container" style={{ maxWidth: 980 }}>
      <h2>ENH — Workflow (Step {step}/4)</h2>

      {step === 1 && (
        <Step1Upload
          onDataLoaded={(pts) => {
            console.log("Step1 loaded points:", pts && pts.length);
            setPoints(pts || []);
            // go to next step automatically (optional)
            setTimeout(next, 150);
          }}
        />
      )}

      {step === 2 && (
        <Step2SelectPoints
          points={points}
          onApply={(newPts) => {
            console.log("Step2 applied, points:", newPts && newPts.length);
            setPoints(newPts || []);
            next();
          }}
        />
      )}

      {step === 3 && (
        <Step3PreviewExport
          points={points}
          // optional: allow user to "apply" (here we already updated in step2)
          // if Step3 should call any processing, handle it here and setResult(...)
        />
      )}

      {step === 4 && (
        <Step4Download
          data={points} // final points in points state
          onReset={() => {
            setPoints([]);
            setResult([]);
            setStep(1);
          }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <div>
          {step > 1 && <button onClick={back} style={{ marginRight: 8 }}>Back</button>}
          {step < 4 && <button onClick={next}>Next</button>}
        </div>
        <div style={{ color: "#666", fontSize: 13 }}>
          {points.length > 0 ? `${points.length} points loaded` : "No points loaded"}
        </div>
      </div>
    </div>
  );
}