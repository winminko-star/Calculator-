// StationMerge.jsx
import React, { useState } from "react";
import { saveAs } from "file-saver";
import "./StationMerge.css";

export default function StationMerge() {
  const [stas, setStas] = useState({});
  const [mergedSta, setMergedSta] = useState([]);
  const [error, setError] = useState("");
  const [selectedPoints, setSelectedPoints] = useState({ p1: "", p2: "", p3: "" });

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
        groups[currentSta].push({ name, E: parseFloat(E), N: parseFloat(N), H: parseFloat(H) });
      }
    });
    setStas(groups);
    setMergedSta([]);
    setError("");
  };

  // --------------------- Merge STA ---------------------
  const mergeStas = (baseSta, targetSta) => {
    if (!stas[baseSta] || !stas[targetSta]) return;
    const basePoints = [...stas[baseSta]];
    const targetPoints = stas[targetSta];
    const nameMap = {};
    basePoints.forEach((p) => (nameMap[p.name] = { ...p }));
    targetPoints.forEach((p) => {
      if (!nameMap[p.name]) nameMap[p.name] = { ...p };
    });
    setMergedSta(Object.values(nameMap));
    setError("");
  };

  // --------------------- Reference Line / 3-point ENH ---------------------
  const calculateWithReference = () => {
    const { p1, p2, p3 } = selectedPoints;
    const ref1 = mergedSta.find((p) => p.name === p1);
    const ref2 = mergedSta.find((p) => p.name === p2);
    const updatedPoint = mergedSta.find((p) => p.name === p3) || null;

    if (!ref1 || !ref2) {
      alert("Please select reference points p1 and p2");
      return;
    }

    const newMerged = mergedSta.map((p) => {
      if (p.name !== ref1.name && p.name !== ref2.name) {
        const deltaN = ref2.N - ref1.N;
        if (deltaN === 0) return { ...p };
        const slope = (ref2.H - ref1.H) / deltaN;
        const H_new = ref1.H + slope * (p.N - ref1.N);
        return { ...p, H: parseFloat(H_new.toFixed(3)) };
      }
      return { ...p };
    });

    if (updatedPoint) {
      const idx = newMerged.findIndex((p) => p.name === updatedPoint.name);
      if (idx >= 0) newMerged[idx].H = updatedPoint.H;
    }

    // Error check
    const tolerance = 3;
    const hasError = newMerged.some((p, i) => Math.abs(p.H - mergedSta[i].H) > tolerance);
    setError(hasError ? "⚠ Error exceeds tolerance 3mm" : "");
    setMergedSta(newMerged);
  };

  // --------------------- Export TXT ---------------------
  const exportTxt = () => {
    if (!mergedSta.length) return;
    const content = mergedSta
      .map((p) => `${p.name} ${p.E.toFixed(3)} ${p.N.toFixed(3)} ${p.H.toFixed(3)}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "Merged_STA.txt");
  };

  // --------------------- JSX ---------------------
  return (
    <div className="station-merge-container">
      <h2>Station Merge & Reference Calculator</h2>
      <input type="file" accept=".txt" onChange={handleFileUpload} />

      <div className="merge-actions">
        <button
          onClick={() => {
            const keys = Object.keys(stas);
            if (keys.length >= 2) mergeStas(keys[0], keys[1]);
            else alert("Need at least 2 STAs to merge");
          }}
        >
          Merge First 2 STAs
        </button>

        <div className="reference-picker">
          <label>
            p1:
            <select value={selectedPoints.p1} onChange={(e) => setSelectedPoints({ ...selectedPoints, p1: e.target.value })}>
              <option value="">Select</option>
              {mergedSta.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            p2:
            <select value={selectedPoints.p2} onChange={(e) => setSelectedPoints({ ...selectedPoints, p2: e.target.value })}>
              <option value="">Select</option>
              {mergedSta.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Optional p3 (ENH adjust):
            <select value={selectedPoints.p3} onChange={(e) => setSelectedPoints({ ...selectedPoints, p3: e.target.value })}>
              <option value="">None</option>
              {mergedSta.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <button onClick={calculateWithReference}>Apply Reference Line</button>
        </div>
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
            {mergedSta.map((p, idx) => (
              <tr key={idx}>
                <td>{p.name}</td>
                <td>{p.E.toFixed(3)}</td>
                <td>{p.N.toFixed(3)}</td>
                <td>{p.H.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={exportTxt}>Export TXT</button>
    </div>
  );
          }
