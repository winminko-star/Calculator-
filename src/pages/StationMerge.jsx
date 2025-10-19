// Part 1/2 - Imports, State, File Upload, STA Parse & Merge
import React, { useState } from "react";
import "./StationMerge.css"; // သင့်အတိုင်း style လှလှထည့်နိုင်မယ်
// ✅ Note: FileSaver import မလိုတော့ဘူး, browser native Blob+download က အသုံးပြုမယ်

export default function StationMerge() {
  const [stas, setStas] = useState({});
  const [mergedSta, setMergedSta] = useState([]);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  // --------------------- File Upload ---------------------
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFileName(file.name);
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
  // Part 2/2 - Reference Line, 3-point ENH, Auto Recalc, Export, Styled Table
  // --------------------- Reference Line / 3-point ENH ---------------------
  const calculateWithReference = (p1, p2, updatedPoint = null) => {
    if (!p1 || !p2 || mergedSta.length < 2) return;

    const newMerged = mergedSta.map((p) => {
      if (p.name !== p1.name && p.name !== p2.name) {
        const deltaN = p2.N - p1.N;
        if (deltaN === 0) return { ...p };
        const slope = (p2.H - p1.H) / deltaN;
        const H_new = p1.H + slope * (p.N - p1.N);
        return { ...p, H: parseFloat(H_new.toFixed(3)) };
      }
      return { ...p };
    });

    if (updatedPoint) {
      const idx = newMerged.findIndex((p) => p.name === updatedPoint.name);
      if (idx >= 0) newMerged[idx].H = updatedPoint.H;
    }

    const tolerance = 3; // mm
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
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Merged_STA.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="station-merge-container">
      <h2>Station Merge & Reference Calculator</h2>

      <input type="file" accept=".txt" onChange={handleFileUpload} />
      {uploadedFileName && <p>Uploaded: {uploadedFileName}</p>}

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

        <button
          onClick={() => {
            if (mergedSta.length >= 2)
              calculateWithReference(mergedSta[0], mergedSta[1]);
            else alert("Need at least 2 points for reference line");
          }}
        >
          Auto Reference Line
        </button>
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
