import React, { useState } from "react";

// Helper: parse TXT lines
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

// Helper: merge two STA groups
const mergeSTA = (base, target) => {
  const existingNames = new Set(base.map((p) => p.name));
  target.forEach((p) => {
    if (!existingNames.has(p.name)) base.push(p);
  });
};

// Example 2D Reference line compute
const computeReference = (points, ref1, ref2) => {
  // Translate ref1 to origin
  const dx = points[ref1].E;
  const dy = points[ref1].N;
  const ux = points[ref2].E - points[ref1].E;
  const uy = points[ref2].N - points[ref1].N;
  const len = Math.hypot(ux, uy);
  const cosA = ux / len;
  const sinA = uy / len;

  return points.map((p) => {
    // Translate
    let ex = p.E - dx;
    let ny = p.N - dy;
    // Rotate
    const Enew = ex * cosA + ny * sinA;
    const Nnew = -ex * sinA + ny * cosA;
    return { ...p, E: Enew, N: Nnew };
  });
};

export default function MergeSTAPro() {
  const [txt, setTxt] = useState("");
  const [groups, setGroups] = useState({});
  const [baseSTA, setBaseSTA] = useState("");
  const [targetSTA, setTargetSTA] = useState("");
  const [refPoints, setRefPoints] = useState(["", ""]);
  const [finalPoints, setFinalPoints] = useState([]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    file.text().then((text) => {
      setTxt(text);
      const parsed = parseTXT(text);
      setGroups(parsed);
    });
  };

  const handleMerge = () => {
    if (!baseSTA || !targetSTA || baseSTA === targetSTA) return;
    const base = groups[baseSTA] ? [...groups[baseSTA]] : [];
    const target = groups[targetSTA] ? [...groups[targetSTA]] : [];
    mergeSTA(base, target);
    setFinalPoints(base);
    // Remove target STA from groups
    const newGroups = { ...groups };
    delete newGroups[targetSTA];
    setGroups(newGroups);
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
    finalPoints.forEach((p) => lines.push(`${p.name},${p.E},${p.N},${p.H}`));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "merged_STA.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>📂 Upload TXT with STA groups</h2>
      <input type="file" accept=".txt" onChange={handleUpload} />
      <div>
        <h3>Groups: {Object.keys(groups).join(", ")}</h3>
        <label>
          Base STA:
          <select onChange={(e) => setBaseSTA(e.target.value)}>
            <option value="">--</option>
            {Object.keys(groups).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Target STA:
          <select onChange={(e) => setTargetSTA(e.target.value)}>
            <option value="">--</option>
            {Object.keys(groups).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <button onClick={handleMerge}>Merge STA</button>
      </div>
      <div>
        <h3>Reference Points for computation</h3>
        <input placeholder="Point 1" value={refPoints[0]} onChange={(e)=>setRefPoints([e.target.value, refPoints[1]])} />
        <input placeholder="Point 2" value={refPoints[1]} onChange={(e)=>setRefPoints([refPoints[0], e.target.value])} />
        <button onClick={handleReference}>Compute Reference Line</button>
      </div>
      <div>
        <h3>Final Points ({baseSTA})</h3>
        <pre>{finalPoints.map(p => `${p.name},${p.E},${p.N},${p.H}`).join("\n")}</pre>
        <button onClick={exportTXT}>Export TXT</button>
      </div>
    </div>
  );
      }
