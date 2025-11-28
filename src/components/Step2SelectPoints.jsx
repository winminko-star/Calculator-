// src/components/Step2SelectPoints.jsx
import React, { useState, useEffect } from "react";
import "./workflow.css";

/* Helpers */
// 3D distance for RBF
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const gaussianKernel = (r, eps) => Math.exp(-(r * r) / (eps * eps));

// Simple linear solver for small systems
function solveLinear(A, b) {
  const n = A.length;
  const M = new Array(n);
  for (let i = 0; i < n; i++) M[i] = [...A[i], b[i]];

  for (let k = 0; k < n; k++) {
    let iMax = k, maxV = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > maxV) { maxV = Math.abs(M[i][k]); iMax = i; }
    if (maxV < 1e-12) throw new Error("Matrix is singular");
    if (iMax !== k) [M[k], M[iMax]] = [M[iMax], M[k]];
    const pivot = M[k][k];
    for (let j = k; j <= n; j++) M[k][j] /= pivot;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const factor = M[i][k];
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
    }
  }

  return M.map(row => row[n]);
}

function parseNumberOrEmpty(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

export default function Step2SelectPoints({ points = [], onApply }) {
  const [selectedIdx, setSelectedIdx] = useState([]);
  const [targets, setTargets] = useState({}); // idx -> {x,y,z}
  const [eps, setEps] = useState(100);
  const [lambda, setLambda] = useState(0.001);
  const [filter, setFilter] = useState("");

  useEffect(() => { setSelectedIdx([]); setTargets({}); }, [points]);

  const toggleSelect = (i) => {
    setSelectedIdx(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
    setTargets(t => (t[i] !== undefined ? t : { ...t, [i]: { ...points[i] } }));
  };

  const handleTargetChange = (i, axis, v) => {
    const clean = v.replace(/^0+(\d)/, '$1');
    setTargets(t => ({ ...t, [i]: { ...t[i], [axis]: clean === "" ? "" : Number(clean) } }));
  };

  const handleEpsChange = v => setEps(parseNumberOrEmpty(v));
  const handleLambdaChange = v => setLambda(parseNumberOrEmpty(v));

  const applyRBF = () => {
    if (selectedIdx.length < 4) { alert("ကျေးဇူးပြု၍ အနည်းဆုံး 4 control points ရွေးပါ"); return; }
    const epsN = Number(eps), lambdaN = Number(lambda);
    if (!Number.isFinite(epsN) || epsN <= 0) { alert("Kernel width must be positive"); return; }
    if (!Number.isFinite(lambdaN) || lambdaN < 0) { alert("Regularization must be non-negative"); return; }

    const controls = selectedIdx.map(i => ({ idx: i, ...targets[i] }));
    for (const c of controls) if (!["x","y","z"].every(axis => Number.isFinite(c[axis]))) {
      alert("All control targets must be numeric"); return;
    }

    const n = controls.length;
    const K = Array.from({ length: n }, (_, i) => Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        K[i][j] = gaussianKernel(dist3(
          [controls[i].x, controls[i].y, controls[i].z],
          [controls[j].x, controls[j].y, controls[j].z]
        ), epsN);
    for (let i = 0; i < n; i++) K[i][i] += lambdaN;

    const applyAxisRBF = (axis) => {
      const d = controls.map(c => c[axis]);
      let w;
      try { w = solveLinear(K, d); } catch(err) { alert("Solver failed: "+err.message); return null; }
      return points.map(p => {
        let pred = 0;
        for (let i = 0; i < n; i++)
          pred += w[i] * gaussianKernel(dist3(
            [p.x, p.y, p.z],
            [controls[i].x, controls[i].y, controls[i].z]
          ), epsN);
        return pred;
      });
    };

    const xPreds = applyAxisRBF("x");
    const yPreds = applyAxisRBF("y");
    const zPreds = applyAxisRBF("z");

    const newPoints = points.map((p, idx) => ({ ...p, x: xPreds[idx], y: yPreds[idx], z: zPreds[idx] }));
    controls.forEach(c => { newPoints[c.idx] = { ...c }; });

    if (typeof onApply === "function") onApply(newPoints);
  };

  const visible = points.map((p,i)=>({p,i})).filter(({p})=>!filter||String(p.id).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="step-container">
      <h2>Step 2 — Select Control Points & Apply ENH</h2>

      <div style={{ marginBottom: 8 }}>
        <label>Search ID:</label>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="filter by ID/name"/>
        <button onClick={()=>{
          const first4 = visible.slice(0,4).map(v=>v.i);
          setSelectedIdx(first4);
          const t={}; first4.forEach(i=>t[i]={...points[i]});
          setTargets(t);
        }}>Select first 4</button>
      </div>

      <div style={{ maxHeight:260, overflow:"auto", border:"1px solid #eee", padding:8, marginBottom:8 }}>
        <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
          <thead>
            <tr style={{ borderBottom:"1px solid #ddd" }}>
              <th>Sel</th><th>ID</th><th>X</th><th>Y</th><th>Z</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({p,i})=>(
              <tr key={p.id+"-"+i}>
                <td><input type="checkbox" checked={selectedIdx.includes(i)} onChange={()=>toggleSelect(i)}/></td>
                <td>{p.id}</td>
                <td style={{textAlign:"right"}}>{Number(p.x).toFixed(4)}</td>
                <td style={{textAlign:"right"}}>{Number(p.y).toFixed(4)}</td>
                <td style={{textAlign:"right"}}>{Number(p.z).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIdx.length>0 && (
        <div style={{marginBottom:12}}>
          <strong>Selected controls — enter target X/Y/Z:</strong>
          <div className="selected-grid" style={{marginTop:8}}>
            {selectedIdx.map(i=>(
              <div key={i} style={{padding:8,border:"1px solid #eee",borderRadius:6}}>
                <div style={{fontSize:13,marginBottom:6}}>
                  {points[i].id} — current: x:{points[i].x}, y:{points[i].y}, z:{points[i].z}
                </div>
                {["x","y","z"].map(axis=>(
                  <input
                    key={axis} type="number"
                    value={targets[i]?.[axis] ?? points[i][axis]}
                    onChange={e=>handleTargetChange(i, axis, e.target.value)}
                    style={{width:"32%", marginRight:4, padding:6}}
                    placeholder={axis.toUpperCase()}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
        <label>Kernel width (eps):</label>
        <input type="number" value={eps} onChange={e=>handleEpsChange(e.target.value)} style={{width:120,padding:6}}/>
        <label>Regularization (lambda):</label>
        <input type="number" value={lambda} onChange={e=>handleLambdaChange(e.target.value)} style={{width:120,padding:6}}/>
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={applyRBF} style={{padding:"8px 14px", background:"#0b74de", color:"#fff", borderRadius:6}}>Apply ENH (RBF)</button>
        <button onClick={()=>{setSelectedIdx([]); setTargets({});}} style={{padding:"8px 14px", borderRadius:6}}>Clear selection</button>
      </div>
    </div>
  );
}