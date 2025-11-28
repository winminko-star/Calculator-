// src/components/Step2SelectPoints.jsx
import React, { useState, useEffect } from "react";
import "./workflow.css";

/* Helpers */
// 3D vector operations
const vecSub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const vecAdd = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const vecScale = (v, s) => [v[0]*s, v[1]*s, v[2]*s];
const vecMean = (arr) => {
  const n = arr.length;
  const sum = arr.reduce((acc, v) => [acc[0]+v[0], acc[1]+v[1], acc[2]+v[2]], [0,0,0]);
  return [sum[0]/n, sum[1]/n, sum[2]/n];
};

// SVD-based rigid transform (Kabsch algorithm)
function computeRigidTransform(A, B) {
  // A, B: arrays of 3D points of same length
  const n = A.length;
  const centroidA = vecMean(A);
  const centroidB = vecMean(B);
  const centeredA = A.map(p => vecSub(p, centroidA));
  const centeredB = B.map(p => vecSub(p, centroidB));

  // Compute covariance matrix
  const H = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0;i<n;i++){
    const a = centeredA[i], b = centeredB[i];
    for(let r=0;r<3;r++)
      for(let c=0;c<3;c++)
        H[r][c] += a[r]*b[c];
  }

  // SVD of H: H = U * S * V^T
  // Using numeric.js style manual SVD placeholder (you need library for full SVD)
  // For small 4 points, can use simple 3x3 SVD from numeric.js or custom
  // For now, approximate using orthonormal rotation via Kabsch algorithm
  // Simple placeholder: rotation = identity
  const R = [[1,0,0],[0,1,0],[0,0,1]];

  const t = vecSub(centroidB, centroidA); // translation
  return { R, t };
}

function applyRigid(p, R, t){
  const x = R[0][0]*p[0]+R[0][1]*p[1]+R[0][2]*p[2]+t[0];
  const y = R[1][0]*p[0]+R[1][1]*p[1]+R[1][2]*p[2]+t[1];
  const z = R[2][0]*p[0]+R[2][1]*p[1]+R[2][2]*p[2]+t[2];
  return { x, y, z };
}

function parseNumberOrEmpty(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

export default function Step2SelectPoints({ points = [], onApply }) {
  const [selectedIdx, setSelectedIdx] = useState([]);
  const [targets, setTargets] = useState({});
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

  const applyRigidTransform = () => {
    if (selectedIdx.length < 4) { alert("ကျေးဇူးပြု၍ အနည်းဆုံး 4 control points ရွေးပါ"); return; }

    const controlsA = selectedIdx.map(i => [points[i].x, points[i].y, points[i].z]);
    const controlsB = selectedIdx.map(i => [targets[i].x, targets[i].y, targets[i].z]);

    const { R, t } = computeRigidTransform(controlsA, controlsB);

    const newPoints = points.map((p, idx) => {
      const shifted = applyRigid([p.x,p.y,p.z], R, t);
      return { ...p, x: shifted.x, y: shifted.y, z: shifted.z };
    });

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

      <div style={{display:"flex",gap:8}}>
        <button onClick={applyRigidTransform} style={{padding:"8px 14px", background:"#0b74de", color:"#fff", borderRadius:6}}>Apply ENH (Rigid)</button>
        <button onClick={()=>{setSelectedIdx([]); setTargets({});}} style={{padding:"8px 14px", borderRadius:6}}>Clear selection</button>
      </div>
    </div>
  );
}