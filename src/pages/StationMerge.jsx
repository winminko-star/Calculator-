// Part 1/2 - Imports, State, File Upload, STA Merge, Table Display
import React, { useState, useEffect } from "react";
import { saveAs } from "file-saver";
import "./StationMerge.css";

export default function StationMerge() {
  const [fileData, setFileData] = useState(null);
  const [stas, setStas] = useState([]);
  const [mergedSta, setMergedSta] = useState([]);
  const [error, setError] = useState("");

  // File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      parseStaFile(text);
    };
    reader.readAsText(file);
  };

  // Parse TXT and Group by STA
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
        groups[currentSta].push({ name, E: parseFloat(E), N: parseFloat(N), H: parseFloat(H) });
      }
    });
    setStas(groups);
  };

  // Merge two STAs
  const mergeStas = (baseSta, targetSta) => {
    if (!stas[baseSta] || !stas[targetSta]) return;
    const basePoints = [...stas[baseSta]];
    const targetPoints = stas[targetSta];

    const nameMap = {};
    basePoints.forEach((p) => (nameMap[p.name] = p));

    targetPoints.forEach((p) => {
      if (!nameMap[p.name]) {
        nameMap[p.name] = { ...p };
      } else {
        // ENH can be merged later or kept as base
      }
    });

    setMergedSta(Object.values(nameMap));
  };
  // Part 2/2 - Reference line, 3-point ENH update, Auto recalc, Export, Styled Table
  // Reference line calculation
  const calculateWithReference = (p1, p2, updatedPoint = null) => {
    // p1, p2 = reference points
    // updatedPoint = optional 3rd point with ENH change
    if (!p1 || !p2) return;
    const newMerged = mergedSta.map((p) => {
      if (p.name !== p1.name && p.name !== p2.name) {
        // Auto-adjust H based on reference line
        const H_new = p.H + ((p2.H - p1.H) / (p2.N - p1.N)) * (p.N - p1.N);
        return { ...p, H: parseFloat(H_new.toFixed(3)) };
      }
      return p;
    });

    // Optional 3rd point ENH update
    if (updatedPoint) {
      const idx = newMerged.findIndex((p) => p.name === updatedPoint.name);
      if (idx >= 0) newMerged[idx].H = updatedPoint.H;
    }

    // Error check
    const tolerance = 3; // mm
    const hasError = newMerged.some((p) => Math.abs(p.H - p.H) > tolerance);
    setError(hasError ? "⚠ Error exceeds tolerance 3mm" : "");

    setMergedSta(newMerged);
  };

  // Export TXT
  const exportTxt = () => {
    let content = mergedSta.map((p) => `${p.name} ${p.E.toFixed(3)} ${p.N.toFixed(3)} ${p.H.toFixed(3)}`).join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "Merged_STA.txt");
  };

  return (
    <div className="station-merge-container">
      <h2>Station Merge & Reference Calculator</h2>
      <input type="file" accept=".txt" onChange={handleFileUpload} />
      <div className="merge-actions">
        <button onClick={() => mergeStas("STA1", "STA2")}>Merge STA1 + STA2</button>
        <button onClick={() => calculateWithReference(mergedSta[0], mergedSta[1])}>
          Auto Reference Line
        </button>
      </div>
      {error && <div className="error">{error}</div>}
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
      <button onClick={exportTxt}>Export TXT</button>
    </div>
  );
  }
