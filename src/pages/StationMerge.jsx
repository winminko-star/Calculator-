import React, { useState } from "react";

// ===== Helpers =====
const parseTXT = (txt) => {
  const groups = {};
  let currentSTA = null;
  txt.split(/\r?\n/).forEach((line) => {
    const l = line.trim();
    if (!l) return;
    if (l.startsWith("STA")) {
      currentSTA = l;
      groups[currentSTA] = [];
    } else if (currentSTA) {
      const parts = l.split(/[,\s]+/).filter(Boolean);
      if (parts.length >= 4) {
        const [name, E, N, H] = parts;
        groups[currentSTA].push({ name, E: Number(E), N: Number(N), H: Number(H) });
      }
    }
  });
  return groups;
};

const mergeSTA = (base, target) => {
  const existingNames = new Set(base.map((p) => p.name));
  target.forEach((p) => {
    if (!existingNames.has(p.name)) base.push(p);
  });
};

// Simple 2D reference line transformation
const computeReference = (points, idx1, idx2) => {
  const dx = points[idx1].E;
  const dy = points[idx1].N;
  const ux = points[idx2].E - points[idx1].E;
  const uy = points[idx2].N - points[idx1].N;
  const len = Math.hypot(ux, uy);
  const cosA = ux / len;
  const sinA = uy / len;

  return points.map((p) => {
    const ex = p.E - dx;
    const ny = p.N - dy;
    const Enew = ex * cosA + ny * sinA;
    const Nnew = -ex * sinA + ny * cosA;
    return { ...p, E: Enew, N: Nnew };
  });
};

// ===== Main Component =====
export default function MergeSTAProStyled() {
  const [txt, setTxt] = useState("");
  const [groups, setGroups] = useState({});
  const [baseSTA, setBaseSTA] = useState("");
  const [targetSTA, setTargetSTA] = useState("");
  const [refPoints, setRefPoints] = useState(["", ""]);
  const [finalPoints, setFinalPoints] = useState([]);

  // ===== Handlers =====
  const handleUpload = (e) => {
    const file = e.target.files[0];
    file.text().then((text) => {
      setTxt(text);
      setGroups(parseTXT(text));
    });
  };

  const handleMerge = () => {
    if (!baseSTA) return;
    const base = groups[baseSTA] ? [...groups[baseSTA]] : [];
    if (targetSTA && groups[targetSTA]) {
      mergeSTA(base, groups[targetSTA]);
      const newGroups = { ...groups };
      delete newGroups[targetSTA];
      setGroups(newGroups);
    }
    setFinalPoints(base);
  };

  const handleReference = () => {
    if (!refPoints[0] || !refPoints[1]) return;
    const idx1 = finalPoints.findIndex((p) => p.name === refPoints[0]);
    const idx2 = finalPoints.findIndex((p) => p.name === refPoints[1]);
    if (idx1 === -1 || idx2 === -1) return;
    const computed = computeReference(finalPoints, idx1, idx2);
    setFinalPoints(computed);
  };

  const exportTXT = () => {
    const lines = [];
    lines.push(baseSTA);
    finalPoints.forEach((p) => lines.push(`${p.name},${p.E.toFixed(3)},${p.N.toFixed(3)},${p.H.toFixed(3)}`));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "merged_STA.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== JSX =====
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20, maxWidth: 900, margin: "auto", gap: 20, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 16, background: "#0ea5e9", color: "#fff", borderRadius: 12 }}>
        <h2>📂 STA TXT Processor</h2>
        <p style={{ margin: 0 }}>Upload, merge STA, compute reference line, export.</p>
      </div>

      {/* Upload */}
      <div style={{ padding: 16, background: "#f8fafc", borderRadius: 12 }}>
        <h3>1️⃣ Upload TXT file</h3>
        <input type="file" accept=".txt" onChange={handleUpload} />
        <p style={{ fontSize: 12, color: "#64748b" }}>STA groups will be displayed below.</p>
        <div style={{ marginTop: 8 }}>
          {Object.keys(groups).map((g) => (
            <div key={g} style={{ padding: 6, background: "#e0f2fe", marginBottom: 4, borderRadius: 6 }}>{g} ({groups[g].length} points)</div>
          ))}
        </div>
      </div>

      {/* Merge STA */}
      <div style={{ padding: 16, background: "#f1f5f9", borderRadius: 12 }}>
        <h3>2️⃣ Merge STA</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label>Base STA:</label><br />
            <select value={baseSTA} onChange={(e) => setBaseSTA(e.target.value)}>
              <option value="">--</option>
              {Object.keys(groups).map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
          <div>
            <label>Target STA (optional):</label><br />
            <select value={targetSTA} onChange={(e) => setTargetSTA(e.target.value)}>
              <option value="">--</option>
              {Object.keys(groups).map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
          <button style={{ background: "#0ea5e9", color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer" }} onClick={handleMerge}>Merge</button>
        </div>
      </div>

      {/* Reference */}
      <div style={{ padding: 16, background: "#f1f5f9", borderRadius: 12 }}>
        <h3>3️⃣ Reference Line</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Point 1" value={refPoints[0]} onChange={(e) => setRefPoints([e.target.value, refPoints[1]])} />
          <input placeholder="Point 2" value={refPoints[1]} onChange={(e) => setRefPoints([refPoints[0], e.target.value])} />
          <button style={{ background: "#22c55e", color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer" }} onClick={handleReference}>Compute</button>
        </div>
        <p style={{ fontSize: 12, color: "#64748b" }}>Reference line transformation will be applied to all points in Base STA.</p>
      </div>

      {/* Final Points */}
      <div style={{ padding: 16, background: "#f8fafc", borderRadius: 12 }}>
        <h3>4️⃣ Final Points ({baseSTA})</h3>
        <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#e0f2fe" }}>
              <tr>
                <th style={{ padding: 6, borderBottom: "1px solid #cbd5e1" }}>Name</th>
                <th style={{ padding: 6, borderBottom: "1px solid #cbd5e1" }}>E</th>
                <th style={{ padding: 6, borderBottom: "1px solid #cbd5e1" }}>N</th>
                <th style={{ padding: 6, borderBottom: "1px solid #cbd5e1" }}>H</th>
              </tr>
            </thead>
            <tbody>
              {finalPoints.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: 6, borderBottom: "1px solid #e2e8f0" }}>{p.name}</td>
                  <td style={{ padding: 6, borderBottom: "1px solid #e2e8f0" }}>{p.E.toFixed(3)}</td>
                  <td style={{ padding: 6, borderBottom: "1px solid #e
