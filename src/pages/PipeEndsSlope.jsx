// src/pages/PipeEndsSlope.jsx (Part 1/3)
import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- small math ---------- */
const dot3 = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add3 = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub3 = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul3 = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const norm3 = (a)=>Math.hypot(a[0],a[1],a[2])||1;
const unit3 = (a)=>{const n=norm3(a);return [a[0]/n,a[1]/n,a[2]/n];};

function cross3(a,b){
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

/** ---------- Plane fit by PCA (least squares) ----------
 * input: pts = [{E,N,H}, ...] with n>=3
 * return: {C:[E,N,H], n:[nx,ny,nz], U:[ux,uy,uz], V:[vx,vy,vz]}
 * where U,V are orthonormal basis of plane, n is plane normal.
 */
function fitPlanePCA(pts){
  const n = pts.length;
  if(n<3) return null;

  // centroid
  let c=[0,0,0];
  for(const p of pts) c=add3(c,[p.E,p.N,p.H]);
  c = mul3(c,1/n);

  // covariance 3x3
  let xx=0,xy=0,xz=0, yy=0,yz=0, zz=0;
  for(const p of pts){
    const x=p.E-c[0], y=p.N-c[1], z=p.H-c[2];
    xx+=x*x; xy+=x*y; xz+=x*z;
    yy+=y*y; yz+=y*z; zz+=z*z;
  }
  // symmetric covariance matrix
  const A = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ];

  // eigen decomposition (Jacobi) to get smallest eigenvector as normal
  const {eigVecs, eigVals} = jacobiEigenSym3(A);
  if(!eigVecs) return null;

  // find smallest eigenvalue index
  let k=0; if(eigVals[1]<eigVals[k]) k=1; if(eigVals[2]<eigVals[k]) k=2;
  const nrm = unit3([eigVecs[0][k], eigVecs[1][k], eigVecs[2][k]]);

  // choose U in-plane (not parallel to nrm)
  const ref = Math.abs(nrm[2])<0.9 ? [0,0,1] : [1,0,0];
  let U = cross3(nrm, ref);
  U = unit3(U);
  let V = cross3(nrm,U);
  V = unit3(V);

  return { C:c, n:nrm, U, V };
}

/** Jacobi eigen for 3x3 symmetric */
function jacobiEigenSym3(M){
  // deep copy
  let a = [[...M[0]], [...M[1]], [...M[2]]];
  let v = [[1,0,0],[0,1,0],[0,0,1]];
  const maxIters = 30;

  const off = ()=>Math.hypot(a[0][1],a[0][2],a[1][2]);
  for(let it=0; it<maxIters && off()>1e-12; it++){
    // pick largest off-diagonal
    let p=0,q=1;
    if(Math.abs(a[0][2])>Math.abs(a[p][q])){ p=0;q=2; }
    if(Math.abs(a[1][2])>Math.abs(a[p][q])){ p=1;q=2; }

    const app=a[p][p], aqq=a[q][q], apq=a[p][q];
    if(Math.abs(apq)<1e-18) break;
    const phi = 0.5*Math.atan2(2*apq, (aqq-app));
    const c=Math.cos(phi), s=Math.sin(phi);

    // rotate a (p,q)
    for(let k=0;k<3;k++){
      const aik=a[k][p], aiq=a[k][q];
      a[k][p]=c*aik - s*aiq;
      a[k][q]=s*aik + c*aiq;
    }
    for(let k=0;k<3;k++){
      const apk=a[p][k], aqk=a[q][k];
      a[p][k]=c*apk - s*aqk;
      a[q][k]=s*apk + c*aqk;
    }
    a[p][q]=a[q][p]=0;

    // rotate eigenvectors
    for(let k=0;k<3;k++){
      const vkp=v[k][p], vkq=v[k][q];
      v[k][p]=c*vkp - s*vkq;
      v[k][q]=s*vkp + c*vkq;
    }
  }
  const eigVals=[a[0][0],a[1][1],a[2][2]];
  const eigVecs=v; // columns are eigenvectors
  return {eigVals, eigVecs};
}

/** ---------- Circle fit (Kåsa) on 2D (u,v) points ----------
 * points2 = [{u,v}] n>=3
 * return {uc, vc, R, rms}
 */
function fitCircleKasa2D(points2){
  const n = points2.length;
  if(n<3) return null;

  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0,Sz=0;
  for(const p of points2){
    const x=p.u, y=p.v, z=x*x+y*y;
    Sx+=x; Sy+=y; Sxx+=x*x; Syy+=y*y; Sxy+=x*y; Sxz+=x*z; Syz+=y*z; Sz+=z;
  }
  // [Sxx Sxy Sx][D] = [-Sxz]
  // [Sxy Syy Sy][E] = [-Syz]
  // [Sx  Sy  n ][F] = [-Sz ]
  const A = [
    [Sxx,Sxy,Sx],
    [Sxy,Syy,Sy],
    [Sx, Sy, n ],
  ];
  const b = [-Sxz,-Syz,-Sz];
  const sol = solve3x3(A,b);
  if(!sol) return null;
  const [D,E,F]=sol;
  const uc = -D/2, vc = -E/2;
  const r2 = (D*D+E*E)/4 - F;
  if(!(r2>0)) return null;
  const R = Math.sqrt(r2);

  // rms residual
  let sse=0;
  for(const p of points2){
    const d=Math.hypot(p.u-uc, p.v-vc);
    sse+=(d-R)*(d-R);
  }
  const rms=Math.sqrt(sse/n);
  return {uc,vc,R,rms};
}

/** 3x3 solver (Gaussian elimination) */
function solve3x3(A,b){
  const M=[
    [A[0][0],A[0][1],A[0][2],b[0]],
    [A[1][0],A[1][1],A[1][2],b[1]],
    [A[2][0],A[2][1],A[2][2],b[2]],
  ];
  for(let i=0;i<3;i++){
    // pivot
    let p=i;
    for(let r=i+1;r<3;r++) if(Math.abs(M[r][i])>Math.abs(M[p][i])) p=r;
    if(Math.abs(M[p][i])<1e-12) return null;
    if(p!==i){ const t=M[i]; M[i]=M[p]; M[p]=t; }
    const piv=M[i][i];
    for(let r=i+1;r<3;r++){
      const f=M[r][i]/piv;
      for(let c=i;c<4;c++) M[r][c]-=f*M[i][c];
    }
  }
  const x=[0,0,0];
  for(let i=2;i>=0;i--){
    let s=M[i][3];
    for(let j=i+1;j<3;j++) s-=M[i][j]*x[j];
    const piv=M[i][i];
    if(Math.abs(piv)<1e-12) return null;
    x[i]=s/piv;
  }
  return x;
                     }
// src/pages/PipeEndsSlope.jsx (Part 2/3)
export function usePipeEndsSlope(){
  const [rawA,setRawA]=useState("");
  const [rawB,setRawB]=useState("");

  // parse lines "E,N,H" / "E N H" / "E ,   N   , H"
  const parseENH = (raw)=>{
    const out=[];
    for(const line of raw.split(/\r?\n/)){
      const s=line.trim(); if(!s) continue;
      const m=s.split(/[,\s]+/).filter(Boolean);
      if(m.length>=3){
        const E=Number(m[0]), N=Number(m[1]), H=Number(m[2]);
        if(isFinite(E)&&isFinite(N)&&isFinite(H)) out.push({E,N,H});
      }
    }
    return out;
  };

  const ptsA=useMemo(()=>parseENH(rawA),[rawA]);
  const ptsB=useMemo(()=>parseENH(rawB),[rawB]);

  // fit each end: plane -> project -> 2D circle -> center back to 3D
  function fitEnd(pts){
    if(pts.length<3) return null;
    const plane=fitPlanePCA(pts);
    if(!plane) return null;
    const {C,n,U,V}=plane;
    // project points onto plane coords (u,v)
    const Puv = pts.map(p=>{
      const d = sub3([p.E,p.N,p.H], C);
      return { u: dot3(d,U), v: dot3(d,V) };
    });
    const circ = fitCircleKasa2D(Puv);
    if(!circ) return null;
    const center3 = add3(C, add3(mul3(U,circ.uc), mul3(V,circ.vc)));
    return {
      center: { E:center3[0], N:center3[1], H:center3[2] },
      R: circ.R,
      rms: circ.rms,
      planeNormal: n,
      planeCenter: {E:C[0],N:C[1],H:C[2]},
    };
  }

  const fitA = useMemo(()=>fitEnd(ptsA),[ptsA]);
  const fitB = useMemo(()=>fitEnd(ptsB),[ptsB]);

  // axis & slope
  const metrics = useMemo(()=>{
    if(!fitA || !fitB) return null;
    const A=fitA.center, B=fitB.center;
    const dE=B.E-A.E, dN=B.N-A.N, dH=B.H-A.H;
    const horiz = Math.hypot(dE,dN);
    const length = Math.hypot(horiz,dH);
    const slopeDeg = horiz>0 ? (Math.atan2(dH, horiz) * 180/Math.PI) : (dH>0?90:(dH<0?-90:0));
    const dir = { e:dE/length, n:dN/length, h:dH/length };
    return { dE, dN, dH, horiz, length, slopeDeg, dir };
  },[fitA,fitB]);

  // expose to Part 3
  return { rawA,setRawA, rawB,setRawB, ptsA,ptsB, fitA,fitB, metrics };
}
// src/pages/PipeEndsSlope.jsx (Part 3/3) — with Custom Keyboard for ENH input
export default function PipeEndsSlopePage(){
  const st = usePipeEndsSlope();

  // which textarea is active? "A" | "B"
  const [activeField, setActiveField] = React.useState("A");

  const Info = ({label, value, accent})=>(
    <div style={{
      padding:"8px 10px",
      border:"1px solid #e5e7eb",
      borderRadius:10,
      background:"#fff",
      minWidth:140
    }}>
      <div style={{ fontSize:12, color:"#64748b" }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:16, color:accent||"#0f172a" }}>{value}</div>
    </div>
  );

  // ---------- keyboard handlers ----------
  const applyToActive = (fn) => {
    if (activeField === "A") st.setRawA(fn(st.rawA));
    else st.setRawB(fn(st.rawB));
  };

  const onKeyPress = (k) => {
    if (k === "AC") return applyToActive(() => "");
    if (k === "DEL") return applyToActive((s)=>s.slice(0,-1));
    if (k === "↵")   return applyToActive((s)=>s + "\n");

    // quick tokens
    if (k === " , ") return applyToActive((s)=>s + ", ");
    if (k === "SPC") return applyToActive((s)=>s + " ");
    if (k === "TAB") return applyToActive((s)=>s + "\t");

    // regular char append
    return applyToActive((s)=>s + k);
  };

  const Key = ({label, wide, accent}) => (
    <button
      onClick={()=>onKeyPress(label)}
      style={{
        height: 44,
        padding: "0 12px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: accent ? "#0ea5e9" : "#f8fafc",
        color: accent ? "#fff" : "#0f172a",
        fontWeight: 800,
        fontSize: 16,
        gridColumn: wide ? "span 2" : "span 1",
      }}
    >
      {label}
    </button>
  );

  const Keyboard = () => (
    <div
      style={{
        display:"grid",
        gridTemplateColumns:"repeat(6, 1fr)",
        gap:8,
        background:"#ffffff",
        border:"1px solid #e5e7eb",
        borderRadius:12,
        padding:8
      }}
    >
      {/* Row 1 */}
      <Key label="7" /><Key label="8" /><Key label="9" />
      <Key label="," /><Key label=" , " /><Key label="DEL" />
      {/* Row 2 */}
      <Key label="4" /><Key label="5" /><Key label="6" />
      <Key label="-" /><Key label="." /><Key label="AC" />
      {/* Row 3 */}
      <Key label="1" /><Key label="2" /><Key label="3" />
      <Key label="SPC" /><Key label="TAB" /><Key label="↵" />
      {/* Row 4 */}
      <Key label="0" wide />
      <Key label="E" /><Key label="N" /><Key label="H" />
    </div>
  );

  const CenterBox = (title, fit)=>(
    <div className="card" style={{ background:"#fff", border:"1px solid #e5e7eb" }}>
      <div className="page-title">{title}</div>
      {!fit && <div className="small">Need ≥ 3 points.</div>}
      {fit && (
        <div style={{ display:"grid", gap:8 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Info label="Center E" value={fit.center.E.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Center N" value={fit.center.N.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Center H" value={fit.center.H.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Radius" value={fit.R.toFixed(3)+" mm"} accent="#16a34a"/>
            <Info label="RMS error" value={fit.rms.toFixed(3)+" mm"} accent="#ef4444"/>
          </div>
          <div className="small" style={{ opacity:0.8 }}>
            Plane normal ≈ [
              {fit.planeNormal.map(v=>v.toFixed(4)).join(", ")}
            ]
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid" style={{ gap:12 }}>
      {/* Inputs + keyboards */}
      <div className="card" style={{ background:"#ffffff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">Pipe Ends — ENH Points</div>

        {/* End A */}
        <div style={{ display:"grid", gap:8, marginBottom:12 }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div className="small" style={{ fontWeight:700 }}>End A</div>
            <div className="row" style={{ gap:6 }}>
              <label className="row" style={{
                gap:6, padding:"4px 8px", border:"1px solid #e5e7eb", borderRadius:10,
                background: activeField==="A" ? "#dbeafe" : "#f8fafc", color:"#0f172a", cursor:"pointer"
              }}>
                <input
                  type="radio"
                  name="activeField"
                  checked={activeField==="A"}
                  onChange={()=>setActiveField("A")}
                />
                <span className="small">Keyboard → A</span>
              </label>
            </div>
          </div>

          <textarea
            rows={6}
            value={st.rawA}
            onChange={e=>st.setRawA(e.target.value)}
            onFocus={()=>setActiveField("A")}
            placeholder={`E,N,H per line\n1200.0, 350.0, 15.2\n1198.5 352.2 15.3\n1201.1, 348.9, 15.1`}
            style={{
              width:"100%", fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",
              border:"1px solid #e5e7eb", borderRadius:10, padding:10, outline:"none"
            }}
          />

          {/* Keyboard for A (shared handler uses activeField) */}
          <Keyboard />
        </div>

        {/* End B */}
        <div style={{ display:"grid", gap:8 }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div className="small" style={{ fontWeight:700 }}>End B</div>
            <div className="row" style={{ gap:6 }}>
              <label className="row" style={{
                gap:6, padding:"4px 8px", border:"1px solid #e5e7eb", borderRadius:10,
                background: activeField==="B" ? "#dbeafe" : "#f8fafc", color:"#0f172a", cursor:"pointer"
              }}>
                <input
                  type="radio"
                  name="activeField"
                  checked={activeField==="B"}
                  onChange={()=>setActiveField("B")}
                />
                <span className="small">Keyboard → B</span>
              </label>
            </div>
          </div>

          <textarea
            rows={6}
            value={st.rawB}
            onChange={e=>st.setRawB(e.target.value)}
            onFocus={()=>setActiveField("B")}
            placeholder={`E,N,H per line\n1210.2, 365.0, 28.1\n1208.7 366.9 28.0\n1211.4, 363.1, 28.2`}
            style={{
              width:"100%", fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",
              border:"1px solid #e5e7eb", borderRadius:10, padding:10, outline:"none"
            }}
          />

          {/* Keyboard for B (same component; activeField controls target) */}
          <Keyboard />
        </div>

        <div className="small" style={{ marginTop:10, color:"#64748b" }}>
          Tips: <b>comma</b> (,) / <b>space</b> (SPC) / <b>tab</b> (TAB) နဲ့ delimiter ချရေးနိုင်ပါတယ်။  
          နောက်တစ်ကြောင်းသို့ <b>↵</b> (Enter) ကို သုံးပါ။ <b>AC</b>=အကုန်	clear၊ <b>DEL</b>=နောက်စာလုံးဖျက်။
        </div>
      </div>

      {/* Outputs */}
      {CenterBox("End A — Fitted Center", st.fitA)}
      {CenterBox("End B — Fitted Center", st.fitB)}

      <div className="card" style={{ background:"#fff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">Axis & Slope</div>
        {!st.metrics && <div className="small">Need both ends fitted.</div>}
        {st.metrics && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Info label="ΔE" value={st.metrics.dE.toFixed(3)+" mm"}/>
            <Info label="ΔN" value={st.metrics.dN.toFixed(3)+" mm"}/>
            <Info label="ΔH" value={st.metrics.dH.toFixed(3)+" mm"}/>
            <Info label="Horizontal" value={st.metrics.horiz.toFixed(3)+" mm"}/>
            <Info label="3D Length" value={st.metrics.length.toFixed(3)+" mm"}/>
            <Info label="Slope angle" value={st.metrics.slopeDeg.toFixed(4)+" °"} accent="#0ea5e9"/>
            <Info label="Dir (e,n,h)"
              value={`${st.metrics.dir.e.toFixed(4)}, ${st.metrics.dir.n.toFixed(4)}, ${st.metrics.dir.h.toFixed(4)}`} />
          </div>
        )}
        <div className="small" style={{ marginTop:6, color:"#64748b" }}>
          Angle = atan2(ΔH, √(ΔE²+ΔN²)) in degrees. (Uphill +)
        </div>
      </div>
    </div>
  );
        }
