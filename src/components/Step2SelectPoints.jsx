// src/components/Step2SelectPoints.jsx
import React, { useState } from "react";
import './workflow.css';

// helper functions
const dist3 = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const gaussianKernel = (r, eps) => Math.exp(-(r*r)/(eps*eps));

function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row,i)=>[...row, b[i]]);
  for(let k=0;k<n;k++){
    let iMax=k, maxV=Math.abs(M[k][k]);
    for(let i=k+1;i<n;i++) if(Math.abs(M[i][k])>maxV){maxV=Math.abs(M[i][k]); iMax=i;}
    if(maxV<1e-12) throw new Error("Matrix singular");
    if(iMax!==k){[M[k],M[iMax]]=[M[iMax],M[k]];}
    let pivot=M[k][k]; for(let j=k;j<=n;j++) M[k][j]/=pivot;
    for(let i=0;i<n;i++){if(i===k) continue; let factor=M[i][k]; for(let j=0;j<=n;j++) M[i][j]-=factor*M[k][j];}
  }
  return M.map(row=>row[n]);
}

export default function Step2SelectPoints({ points, onApply }) {
  const [selected, setSelected] = useState([]);
  const [targetPoints, setTargetPoints] = useState({});
  const [eps, setEps] = useState(500);
  const [lambda, setLambda] = useState(1e-3);

  const toggle = (i) => {
    setSelected(s => s.includes(i)?s.filter(x=>x!==i):[...s,i]);
    if(targetPoints[i]===undefined){
      setTargetPoints(t=>({...t, [i]: {...points[i]} }));
    }
  };

  const handleTargetChange = (i, axis, value) => {
    const n = Number(value);
    setTargetPoints(t=>({
      ...t,
      [i]: {...t[i], [axis]: Number.isNaN(n)?value:n}
    }));
  };

  const applyInterpolation = () => {
    if(selected.length<4){alert("အနည်းဆုံး 4 control points ရွေးပါ"); return;}
    const controls = selected.map(i=>({
      idx: i,
      x: points[i].x, y: points[i].y, z: points[i].z,
      target: targetPoints[i]
    }));

    const n = controls.length;
    // Compute Gaussian kernel matrix
    const K = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>gaussianKernel(dist3([controls[i].x,controls[i].y,controls[i].z],[controls[j].x,controls[j].y,controls[j].z]), eps)));
    for(let i=0;i<n;i++) K[i][i] += lambda;

    const dX = controls.map(c=>c.target.x);
    const dY = controls.map(c=>c.target.y);
    const dZ = controls.map(c=>c.target.z);

    let wX, wY, wZ;
    try{
      wX = solveLinear(K, dX);
      wY = solveLinear(K, dY);
      wZ = solveLinear(K, dZ);
    }catch(err){
      alert("Linear solve failed");
      return;
    }

    const newPoints = points.map(p=>{
      let xPred=0, yPred=0, zPred=0;
      for(let i=0;i<n;i++){
        const r = dist3([p.x,p.y,p.z],[controls[i].x,controls[i].y,controls[i].z]);
        const k = gaussianKernel(r, eps);
        xPred += wX[i]*k;
        yPred += wY[i]*k;
        zPred += wZ[i]*k;
      }
      return {x:xPred, y:yPred, z:zPred};
    });

    // Enforce exact targets on control points
    controls.forEach(c=>{
      newPoints[c.idx] = {...c.target};
    });

    onApply(newPoints);
  };

  return (
    <div className="step-container">
      <h2>Step 2: Select Control Points & Apply ENH (X/Y/Z)</h2>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {points.map((p,i)=>(
          <button key={i} className={`point-btn ${selected.includes(i)?'selected':''}`} onClick={()=>toggle(i)} title={`#${i}`}>
            #{i}
            <div style={{fontSize:11}}>x:{p.x.toFixed(2)} y:{p.y.toFixed(2)} z:{p.z.toFixed(2)}</div>
          </button>
        ))}
      </div>

      {selected.length>0 && (
        <div className="selected-grid">
          {selected.map(i=>(
            <div key={i}>
              <div>#{i}</div>
              <label>X:</label>
              <input value={targetPoints[i]?.x} onChange={e=>handleTargetChange(i,'x',e.target.value)} />
              <label>Y:</label>
              <input value={targetPoints[i]?.y} onChange={e=>handleTargetChange(i,'y',e.target.value)} />
              <label>Z:</label>
              <input value={targetPoints[i]?.z} onChange={e=>handleTargetChange(i,'z',e.target.value)} />
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:12,display:'flex',gap:12,alignItems:'center'}}>
        <label>Kernel width (eps):</label>
        <input type="number" value={eps} onChange={e=>setEps(Number(e.target.value))}/>
        <label>Regularization (lambda):</label>
        <input type="number" value={lambda} onChange={e=>setLambda(Number(e.target.value))}/>
      </div>

      <button onClick={applyInterpolation} style={{marginTop:12}}>Apply ENH (X/Y/Z)</button>
    </div>
  );
}