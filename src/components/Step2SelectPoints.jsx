// src/components/Step2SelectPoints.jsx
import React, { useState, useEffect } from "react";
import "./workflow.css";

/* Helpers */
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const gaussianKernel = (r, eps) => Math.exp(- (r * r) / (eps * eps));

// Simple solver (Gaussian elimination) - okay for small n (<=100)
function solveLinear(A, b) {
  const n = A.length;
  const M = new Array(n);
  for (let i = 0; i < n; i++) {
    M[i] = new Array(n + 1);
    for (let j = 0; j < n; j++) M[i][j] = A[i][j];
    M[i][n] = b[i];
  }

  for (let k = 0; k < n; k++) {
    // pivot
    let iMax = k;
    let maxV = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > maxV) {
        maxV = v; iMax = i;
      }
    }
    if (maxV < 1e-12) throw new Error("Matrix is singular or ill-conditioned");
    if (iMax !== k) {
      const tmp = M[k]; M[k] = M[iMax]; M[iMax] = tmp;
    }
    const pivot = M[k][k];
    for (let j = k; j <= n; j++) M[k][j] /= pivot;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const factor = M[i][k];
      if (Math.abs(factor) < 1e-16) continue;
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
    }
  }
  return M.map(row => row[n]);
}

/*
Props:
- points: [{id, x, y, z}, ...]
- onApply(newPoints) => called with updated points (same order)
*/
export default function Step2SelectPoints({ points = [], onApply }) {
  const [selectedIdx, setSelectedIdx] = useState([]); // indices of selected controls
  const [targets, setTargets] = useState({}); // idx -> target z
  const [eps, setEps] = useState(500); // kernel width (adjust for your XY unit)
  const [lambda, setLambda] = useState(1e-3); // regularization
  const [filter, setFilter] = useState(""); // search filter for id

  useEffect(() => {
    // reset when points change
    setSelectedIdx([]);
    setTargets({});
  }, [points]);

  const toggleSelect = (i) => {
    setSelectedIdx(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
    setTargets(t => (t[i] !== undefined ? t : { ...t, [i]: points[i]?.z }));
  };

  const handleTargetChange = (i, v) => {
    const n = Number(v);
    setTargets(t => ({ ...t, [i]: Number.isNaN(n) ? v : n }));
  };

  const applyRBF = () => {
    if (selectedIdx.length < 4) {
      alert("ကျေးဇူးပြု၍ အနည်းဆုံး 4 control points ရွေးပါ (select at least 4).");
      return;
    }

    // build control list
    const controls = selectedIdx.map(i => {
      const p = points[i];
      return { idx: i, x: p.x, y: p.y, target: Number(targets[i]) };
    });

    // validate numeric targets
    for (const c of controls) {
      if (typeof c.target !== "number" || Number.isNaN(c.target)) {
        alert("Control point target values must be numeric.");
        return;
      }
    }

    const n = controls.length;
    // build K matrix
    const K = Array.from({ length: n }, (_, i) => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r = dist2([controls[i].x, controls[i].y], [controls[j].x, controls[j].y]);
        K[i][j] = gaussianKernel(r, eps);
      }
      K[i][i] += lambda;
    }

    const d = controls.map(c => c.target);

    let w;
    try {
      w = solveLinear(K, d);
    } catch (err) {
      alert("Linear solver failed: " + err.message);
      return;
    }

    // compute interpolated z for all points
    const newPoints = points.map((p) => {
      let zPred = 0;
      for (let i = 0; i < n; i++) {
        const r = dist2([p.x, p.y], [controls[i].x, controls[i].y]);
        zPred += w[i] * gaussianKernel(r, eps);
      }
      return { ...p, z: zPred };
    });

    // enforce exact control targets
    for (const c of controls) {
      newPoints[c.idx] = { ...newPoints[c.idx], z: c.target };
    }

    // call parent
    if (typeof onApply === "function") onApply(newPoints);
  };

  // filtered indices by id/name if filter provided
  const visible = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !filter || p.id.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="step-container">
      <h2>Step 2 — Select Control Points & Apply ENH</h2>

      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Search ID:</label>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="filter by id/name" />
        <button style={{ marginLeft: 8 }} onClick={() => {
          // convenience: auto-select first 4 visible
          const first4 = visible.slice(0,4).map(v=>v.i);
          setSelectedIdx(first4);
          const t = {};
          first4.forEach(i => t[i] = points[i].z);
          setTargets(t);
        }}>Select first 4</button>
      </div>

      <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #eee", padding: 8, marginBottom: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 6 }}>Sel</th>
              <th style={{ textAlign: "left", padding: 6 }}>ID</th>
              <th style={{ textAlign: "right", padding: 6 }}>X</th>
              <th style={{ textAlign: "right", padding: 6 }}>Y</th>
              <th style={{ textAlign: "right", padding: 6 }}>Z</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ p, i }) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #fafafa" }}>
                <td style={{ padding: 6 }}>
                  <input
                    type="checkbox"
                    checked={selectedIdx.includes(i)}
                    onChange={() => toggleSelect(i)}
                  />
                </td>
                <td style={{ padding: 6 }}>{p.id}</td>
                <td style={{ padding: 6, textAlign: "right" }}>{Number(p.x).toFixed(4)}</td>
                <td style={{ padding: 6, textAlign: "right" }}>{Number(p.y).toFixed(4)}</td>
                <td style={{ padding: 6, textAlign: "right" }}>{Number(p.z).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIdx.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong>Selected controls ({selectedIdx.length}) — enter new target Z for each:</strong>
          <div className="selected-grid" style={{ marginTop: 8 }}>
            {selectedIdx.map(i => (
              <div key={i} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>{points[i].id} — x:{points[i].x}, y:{points[i].y}</div>
                <input
                  value={targets[i] === undefined ? points[i].z : targets[i]}
                  onChange={e => handleTargetChange(i, e.target.value)}
                  style={{ width: "100%", padding: 6 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label>Kernel width (eps):</label>
        <input type="number" value={eps} onChange={e => setEps(Number(e.target.value))} style={{ width: 120, padding: 6 }} />
        <label>Regularization (lambda):</label>
        <input type="number" value={lambda} onChange={e => setLambda(Number(e.target.value))} style={{ width: 120, padding: 6 }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={applyRBF} style={{ padding: "8px 14px", background: "#0b74de", color: "#fff", borderRadius: 6 }}>
          Apply ENH (RBF)
        </button>
        <button onClick={() => { setSelectedIdx([]); setTargets({}); }} style={{ padding: "8px 14px", borderRadius: 6 }}>
          Clear selection
        </button>
      </div>
    </div>
  );
}