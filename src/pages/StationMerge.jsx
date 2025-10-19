// src/pages/StationMerge.jsx
import React, { useState } from "react";
import { saveAs } from "file-saver";
import "./index.css";

export default function StationMerge() {
  const [stas, setStas] = useState({});
  const [mergedSta, setMergedSta] = useState([]);
  const [error, setError] = useState("");
  const [refPoints, setRefPoints] = useState([]);
  const [enhPoints, setEnhPoints] = useState({ name: "", E: "", N: "", H: "" });

  // --------------------- File Upload ---------------------
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseStaFile(reader.result);
    reader.readAsText(file);
  };

  // --------------------- Parse TXT ---------------------
  const parseStaFile = (text) => {
    const lines = text.split("\n");
    const groups = {};
    let currentSta = "";
    lines.forEach((line) => {
      if (line.startsWith("STA")) {
        currentSta = line.trim();
        if (!groups[currentSta]) groups[currentSta] = [];
      } else if (line.trim() !== "") {
        const [name, E, N, H] = line.trim().split(/\s+/);
        if (!name || !E || !N || !H) return;
        groups[currentSta].push({
          name,
          E: parseFloat(E),
          N: parseFloat(N),
          H: parseFloat(H),
        });
      }
    });
    setStas(groups);
    setMergedSta([]);
    setError("");
  };

  // --------------------- Merge STAs ---------------------
  const mergeStas = (base, target) => {
    if (!stas[base] || !stas[target]) return;
    const basePts = [...stas[base]];
    const targetPts = stas[target];
    const merged = [...basePts];

    targetPts.forEach((p) => {
      if (!merged.find((x) => x.name === p.name)) merged.push(p);
    });

    setMergedSta(merged);
    setError("");
  };

  // --------------------- Reference Line Calculation ---------------------
  const calculateWithReference = () => {
    if (refPoints.length !== 2) return alert("Select 2 reference points first.");
    const [p1, p2] = refPoints;
    const newMerged = mergedSta.map((p) => {
      if (p.name !== p1.name && p.name !== p2.name) {
        const deltaN = p2.N - p1.N;
        const slope = deltaN === 0 ? 0 : (p2.H - p1.H) / deltaN;
        const H_new = p1.H + slope * (p.N - p1.N);
        return { ...p, H: parseFloat(H_new.toFixed(3)) };
      }
      return p;
    });

    const tolerance = 3;
    const hasError = newMerged.some(
      (p, i) => Math.abs(p.H - mergedSta[i].H) > tolerance
    );
    setError(hasError ? "⚠ Error exceeds tolerance 3mm" : "");
    setMergedSta(newMerged);
  };

  // --------------------- 3-point ENH Calculation ---------------------
  const handleEnhApply = () => {
    if (!enhPoints.name) return alert("Enter 3rd point name");
    const updated = mergedSta.map((p) =>
      p.name === enhPoints.name
        ? { ...p, ...enhPoints, E: +enhPoints.E, N: +enhPoints.N, H: +enhPoints.H }
        : p
    );
    setMergedSta(updated);
    setError("");
  };

  // --------------------- Export ---------------------
  const exportTxt = () => {
    const content = mergedSta
      .map(
        (p) => `${p.name} ${p.E.toFixed(3)} ${p.N.toFixed(3)} ${p.H.toFixed(3)}`
      )
      .join("\n");
    saveAs(new Blob([content], { type: "text/plain;charset=utf-8" }), "Merged_STA.txt");
  };

  // --------------------- JSX Layout ---------------------
  return (
    <div className="station-merge-container">
      <h2>📘 Station Merge & Reference Calculator</h2>
      <input type="file" accept=".txt" onChange={handleFileUpload} />

      <div className="sta-list">
        {Object.keys(stas).map((k) => (
          <div key={k} className="sta-item">
            {k} ({stas[k].length} pts)
          </div>
        ))}
      </div>

      <div className="merge-actions">
        <button
          onClick={() => {
            const keys = Object.keys(stas);
            if (keys.length >= 2) mergeStas(keys[0], keys[1]);
          }}
        >
          🔗 Merge First 2 STAs
        </button>

        <button onClick={calculateWithReference}>📏 Reference Line</button>
        <button onClick={handleEnhApply}>🧮 3-Point ENH Apply</button>
        <button onClick={exportTxt}>💾 Export</button>
      </div>

      {error && <div className="error">{error}</div>}

      {mergedSta.length > 0 && (
        <table className="merged-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>E</th>
              <th>N</th>
              <th>H</th>
            </tr>
          </thead>
          <tbody>
            {mergedSta.map((p, i) => (
              <tr
                key={i}
                onClick={() => {
                  if (refPoints.find((r) => r.name === p.name)) return;
                  if (refPoints.length < 2)
                    setRefPoints([...refPoints, p]);
                }}
              >
                <td>{p.name}</td>
                <td>{p.E.toFixed(3)}</td>
                <td>{p.N.toFixed(3)}</td>
                <td>{p.H.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
                                       }
