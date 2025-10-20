import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [groups, setGroups] = useState({});
  const [mergedGroup, setMergedGroup] = useState(null);
  const [errors, setErrors] = useState([]);
  const [method, setMethod] = useState(null);
  const [refPoints, setRefPoints] = useState({ p1: "", p2: "" });
  const [fitPoints, setFitPoints] = useState([
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
  ]);

  // ---------- Parse TXT ----------
  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let current = null;
    for (let raw of lines) {
      if (!raw.trim()) continue;
      const parts = raw.split(",").map((x) => x.trim());
      if (parts.length >= 4) {
        const [first, e, n, h] = parts;
        if (/^STA\d+/i.test(first)) {
          current = first;
          out[current] = [];
        } else if (current) {
          const E = parseFloat(e);
          const N = parseFloat(n);
          const H = parseFloat(h);
          if ([E, N, H].every(Number.isFinite))
            out[current].push({ name: first, E, N, H });
        }
      }
    }
    return out;
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSTAFile(reader.result);
      setGroups(parsed);
      setMergedGroup(null);
      setErrors([]);
    };
    reader.readAsText(file);
  };

  // ---------- Merge Two STA ----------
  const [selA, setSelA] = useState("");
  const [selB, setSelB] = useState("");

  function mergeTwo() {
    if (!selA || !selB || selA === selB) return alert("Select two different groups");
    const gA = groups[selA];
    const gB = groups[selB];
    if (!gA || !gB) return;
    const tol = 0.003;
    const newErrs = [];
    const merged = [...gA];

    gB.forEach((p2) => {
      const match = gA.find((p1) => p1.name === p2.name);
      if (match) {
        const dE = Math.abs(p1.E - p2.E);
        const dN = Math.abs(p1.N - p2.N);
        const dH = Math.abs(p1.H - p2.H);
        const dmm = Math.sqrt(dE ** 2 + dN ** 2 + dH ** 2);
        if (dmm > tol) newErrs.push(`${selB} → ${p2.name} exceeded ${dmm.toFixed(3)}m`);
      } else merged.push(p2);
    });

    const newGroups = { ...groups };
    delete newGroups[selB];
    newGroups[selA] = merged;
    setGroups(newGroups);
    setMergedGroup(selA);
    setErrors(newErrs);
    alert(`Merged ${selB} into ${selA}`);
  }

  // ---------- Reference Line ----------
  function applyReferenceLine() {
    if (!mergedGroup) return alert("No merged group yet");
    const { p1, p2 } = refPoints;
    if (!p1 || !p2) return alert("Enter two reference points");
    alert(`Reference transform with ${p1}, ${p2} applied (demo only)`);
    setMethod("ref");
  }

  // ---------- Manual 4-Point Fit ----------
  function apply4PointFit() {
    if (!mergedGroup) return alert("No merged group yet");
    if (fitPoints.some((p) => !p.name || !p.E || !p.N || !p.H))
      return alert("Fill all 4 target ENH");
    // simplified demo alignment (translate only)
    alert("4-Point Fit applied (demo)");
    setMethod("fit");
  }

  // ---------- Export ----------
  function exportTXT() {
    if (!mergedGroup) return alert("Nothing to export");
    const txt = groups[mergedGroup]
      .map((p) => `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`)
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mergedGroup}_result.txt`;
    a.click();
  }

  const groupKeys = Object.keys(groups);

  return (
    <div className="station-merge">
      <h1>Station Merge Tool</h1>
      <input type="file" accept=".txt" onChange={handleUpload} />

      {groupKeys.length > 0 && (
        <>
          <div className="merge-section">
            <h3>Merge Groups</h3>
            <select value={selA} onChange={(e) => setSelA(e.target.value)}>
              <option value="">From (Base)</option>
              {groupKeys.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <select value={selB} onChange={(e) => setSelB(e.target.value)}>
              <option value="">To (Merge in)</option>
              {groupKeys.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <button onClick={mergeTwo}>Merge Selected</button>
          </div>

          {errors.length > 0 && (
            <div className="error-summary">
              <h4>⚠ Merge Warnings</h4>
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </>
      )}

      {mergedGroup && (
        <>
          <h3>Transform Methods ({mergedGroup})</h3>
          <div className="method-area">
            <div>
              <h4>Method 1 – Reference Line</h4>
              <input
                placeholder="Point 1"
                value={refPoints.p1}
                onChange={(e) => setRefPoints({ ...refPoints, p1: e.target.value })}
              />
              <input
                placeholder="Point 2"
                value={refPoints.p2}
                onChange={(e) => setRefPoints({ ...refPoints, p2: e.target.value })}
              />
              <button onClick={applyReferenceLine}>Apply Reference Line</button>
            </div>

            <div>
              <h4>Method 2 – Manual 4-Point Fit</h4>
              <div className="fit-grid">
                {fitPoints.map((p, i) => (
                  <div key={i} className="fit-row">
                    <input
                      placeholder="Name"
                      value={p.name}
                      onChange={(e) => {
                        const arr = [...fitPoints];
                        arr[i].name = e.target.value;
                        setFitPoints(arr);
                      }}
                    />
                    <input
                      placeholder="E"
                      value={p.E}
                      onChange={(e) => {
                        const arr = [...fitPoints];
                        arr[i].E = e.target.value;
                        setFitPoints(arr);
                      }}
                    />
                    <input
                      placeholder="N"
                      value={p.N}
                      onChange={(e) => {
                        const arr = [...fitPoints];
                        arr[i].N = e.target.value;
                        setFitPoints(arr);
                      }}
                    />
                    <input
                      placeholder="H"
                      value={p.H}
                      onChange={(e) => {
                        const arr = [...fitPoints];
                        arr[i].H = e.target.value;
                        setFitPoints(arr);
                      }}
                    />
                  </div>
                ))}
              </div>
              <button onClick={apply4PointFit}>Apply 4-Point Fit</button>
            </div>
          </div>

          <button className="export-btn" onClick={exportTXT}>
            📄 Export TXT
          </button>
        </>
      )}
    </div>
  );
    }
