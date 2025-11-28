import React, { useState } from "react";
import './workflow.css';

// helper functions: dist2, gaussianKernel, solveLinear
const dist2 = (a, b) => Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2);
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
    for(let i=0;i<n;i++){if(i===k) continue; let factor=M[i][k]; for(let j=k;j<=n;j++) M[i][j]-=factor*M[k][j];}
  }
  return M.map(row=>row[n]);
}

export default function Step2SelectPoints({ points, onApply }) {
  const [selected, setSelected] = useState([]);
  const [targetZs, setTargetZs] = useState({});
  const [eps, setEps] = useState(500);
  const [lambda, setLambda] = useState(1e-3);

  const toggle = (i) => {
    setSelected(s => s.includes(i)?s.filter(x=>x!==i):[...s,i]);
    setTargetZs(t=>t[i]!==undefined?t:{...t,[i]:points[i].z});
  };

  const handleTargetChange = (i, v) => {
    const n=Number(v);
    setTargetZs(t=>({...t,[i]:Number.isNaN(n)?v:n}));
  };

  const applyInterpolation = () => {
    if(selected.length<4){alert("အနည်းဆုံး 4 control points ရွေးပါ"); return;}
    const controls = selected.map(i=>({idx:i,x:points[i].x,y:points[i].y,z:points[i].z,target:targetZs[i]}));
    const n=controls.length;
    const K=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>gaussianKernel(dist2([controls[i].x,controls[i].y],[controls[j].x,controls[j].y]),eps)));
    for(let i=0;i<n;i++) K[i][i]+=lambda;
    const d=controls.map(c=>c.target);
    let w;
    try{w=solveLinear(K,d);}catch(err){alert("Linear solve failed"); return;}
    const newVerts = points.map(p=>{
      let zPred=0;
      for(let i=0;i<n;i++) zPred+=w[i]*gaussianKernel(dist2([p.x,p.y],[controls[i].x,controls[i].y]),eps);
      return {...p,z:zPred};
    });
    controls.forEach(c=>{newVerts[c.idx].z=c.target;});
    onApply(newVerts);
  };

  return (
    <div className="step-container">
      <h2>Step 2: Select Control Points & Apply ENH</h2>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {points.map((p,i)=>(
          <button key={p.id} className={`point-btn ${selected.includes(i)?'selected':''}`} onClick={()=>toggle(i)} title={`#${i}`}>
            #{i}<div style={{fontSize:11}}>{Math.round(p.z)}mm</div>
          </button>
        ))}
      </div>

      {selected.length>0 && (
        <div className="selected-grid">
          {selected.map(i=>(
            <div key={i}>
              <div>#{i} (x:{points[i].x}, y:{points[i].y})</div>
              <input value={targetZs[i]} onChange={e=>handleTargetChange(i,e.target.value)} />
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

      <button onClick={applyInterpolation} style={{marginTop:12}}>Apply ENH via RBF</button>
    </div>
  );
}