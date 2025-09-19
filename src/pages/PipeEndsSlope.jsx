// src/pages/PipeEndsSlope.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** ---------- small math ---------- */
const dot3 = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add3 = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub3 = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul3 = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const norm3 = (a)=>Math.hypot(a[0],a[1],a[2])||1;
const unit3 = (a)=>{const n=norm3(a);return [a[0]/n,a[1]/n,a[2]/n];};
function cross3(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

/** ---------- Plane fit by PCA (least squares) ---------- */
function fitPlanePCA(pts){
  const n = pts.length;
  if(n<3) return null;
  let c=[0,0,0];
  for(const p of pts) c=add3(c,[p.E,p.N,p.H]);
  c = mul3(c,1/n);
  let xx=0,xy=0,xz=0, yy=0,yz=0, zz=0;
  for(const p of pts){
    const x=p.E-c[0], y=p.N-c[1], z=p.H-c[2];
    xx+=x*x; xy+=x*y; xz+=x*z; yy+=y*y; yz+=y*z; zz+=z*z;
  }
  const A = [[xx,xy,xz],[xy,yy,yz],[xz,yz,zz]];
  const {eigVecs,eigVals} = jacobiEigenSym3(A);
  if(!eigVecs) return null;
  let k=0; if(eigVals[1]<eigVals[k]) k=1; if(eigVals[2]<eigVals[k]) k=2;
  const nrm = unit3([eigVecs[0][k], eigVecs[1][k], eigVecs[2][k]]);
  const ref = Math.abs(nrm[2])<0.9 ? [0,0,1] : [1,0,0];
  let U = unit3(cross3(nrm, ref));
  let V = unit3(cross3(nrm,U));
  return { C:c, n:nrm, U, V };
}
function jacobiEigenSym3(M){
  let a = [[...M[0]],[...M[1]],[...M[2]]];
  let v = [[1,0,0],[0,1,0],[0,0,1]];
  const maxIters=30; const off=()=>Math.hypot(a[0][1],a[0][2],a[1][2]);
  for(let it=0; it<maxIters && off()>1e-12; it++){
    let p=0,q=1;
    if(Math.abs(a[0][2])>Math.abs(a[p][q])){p=0;q=2;}
    if(Math.abs(a[1][2])>Math.abs(a[p][q])){p=1;q=2;}
    const app=a[p][p], aqq=a[q][q], apq=a[p][q];
    if(Math.abs(apq)<1e-18) break;
    const phi=0.5*Math.atan2(2*apq,(aqq-app));
    const c=Math.cos(phi), s=Math.sin(phi);
    for(let k=0;k<3;k++){
      const aik=a[k][p], aiq=a[k][q];
      a[k][p]=c*aik-s*aiq; a[k][q]=s*aik+c*aiq;
    }
    for(let k=0;k<3;k++){
      const apk=a[p][k], aqk=a[q][k];
      a[p][k]=c*apk-s*aqk; a[q][k]=s*apk+c*aqk;
    }
    a[p][q]=a[q][p]=0;
    for(let k=0;k<3;k++){
      const vkp=v[k][p], vkq=v[k][q];
      v[k][p]=c*vkp-s*vkq; v[k][q]=s*vkp+c*vkq;
    }
  }
  const eigVals=[a[0][0],a[1][1],a[2][2]]; const eigVecs=v;
  return {eigVals,eigVecs};
}

/** ---------- Circle fit (Kåsa) on 2D (u,v) points ---------- */
function fitCircleKasa2D(points2){
  const n=points2.length; if(n<3) return null;
  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0,Sz=0;
  for(const p of points2){
    const x=p.u, y=p.v, z=x*x+y*y;
    Sx+=x; Sy+=y; Sxx+=x*x; Syy+=y*y; Sxy+=x*y; Sxz+=x*z; Syz+=y*z; Sz+=z;
  }
  const A=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]], b=[-Sxz,-Syz,-Sz];
  const sol=solve3x3(A,b); if(!sol) return null;
  const [D,E,F]=sol; const uc=-D/2, vc=-E/2;
  const r2=(D*D+E*E)/4 - F; if(!(r2>0)) return null;
  const R=Math.sqrt(r2);
  let sse=0; for(const p of points2){ const d=Math.hypot(p.u-uc,p.v-vc); sse+=(d-R)*(d-R); }
  const rms=Math.sqrt(sse/n); return {uc,vc,R,rms};
}
function solve3x3(A,b){
  const M=[[A[0][0],A[0][1],A[0][2],b[0]],[A[1][0],A[1][1],A[1][2],b[1]],[A[2][0],A[2][1],A[2][2],b[2]]];
  for(let i=0;i<3;i++){
    let p=i; for(let r=i+1;r<3;r++) if(Math.abs(M[r][i])>Math.abs(M[p][i])) p=r;
    if(Math.abs(M[p][i])<1e-12) return null;
    if(p!==i){const t=M[i];M[i]=M[p];M[p]=t;}
    const piv=M[i][i];
    for(let r=i+1;r<3;r++){ const f=M[r][i]/piv; for(let c=i;c<4;c++) M[r][c]-=f*M[i][c]; }
  }
  const x=[0,0,0];
  for(let i=2;i>=0;i--){ let s=M[i][3]; for(let j=i+1;j<3;j++) s-=M[i][j]*x[j];
    const piv=M[i][i]; if(Math.abs(piv)<1e-12) return null; x[i]=s/piv; }
  return x;
}

/* ---------------- parse ENH list ---------------- */
function parseLine(line){
  const m=line.trim().split(/[,\s]+/).filter(Boolean);
  if(m.length<3) return null; const E=Number(m[0]),N=Number(m[1]),H=Number(m[2]);
  if(!isFinite(E)||!isFinite(N)||!isFinite(H)) return null; return {E,N,H};
}
function parseENH(raw){
  const out=[]; for(const ln of raw.split(/\r?\n/)){ const p=parseLine(ln); if(p) out.push(p); }
  return out;
}

/* ---------------- localStorage push key ---------------- */
const LS_KEY = "pipe_last_centers";

/* ---------------- hook ---------------- */
export function usePipeEndsSlope(){
  const [rawA,setRawA]=useState("");
  const [rawB,setRawB]=useState("");
  const ptsA=useMemo(()=>parseENH(rawA),[rawA]);
  const ptsB=useMemo(()=>parseENH(rawB),[rawB]);

  function fitEnd(pts){
    if(pts.length<3) return null;
    const plane=fitPlanePCA(pts); if(!plane) return null;
    const {C,n,U,V}=plane;
    const Puv=pts.map(p=>{ const d=sub3([p.E,p.N,p.H],C); return {u:dot3(d,U), v:dot3(d,V)}; });
    const circ=fitCircleKasa2D(Puv); if(!circ) return null;
    const center3=add3(C, add3(mul3(U,circ.uc), mul3(V,circ.vc)));
    return { center:{E:center3[0],N:center3[1],H:center3[2]}, R:circ.R, rms:circ.rms, planeNormal:n };
  }
  const fitA=useMemo(()=>fitEnd(ptsA),[ptsA]);
  const fitB=useMemo(()=>fitEnd(ptsB),[ptsB]);

  const metrics=useMemo(()=>{
    if(!fitA||!fitB) return null;
    const A=fitA.center, B=fitB.center;
    const dE=B.E-A.E, dN=B.N-A.N, dH=B.H-A.H;
    const horiz=Math.hypot(dE,dN); const length=Math.hypot(horiz,dH);
    const slopeDeg=horiz>0? (Math.atan2(dH,horiz)*180/Math.PI) : (dH>0?90:(dH<0?-90:0));
    const dir={e:dE/length,n:dN/length,h:dH/length};
    return { dE,dN,dH,horiz,length,slopeDeg,dir };
  },[fitA,fitB]);

  return { rawA,setRawA, rawB,setRawB, ptsA,ptsB, fitA,fitB, metrics };
}

/* ---------------- page ---------------- */
export default function PipeEndsSlopePage(){
  const st=usePipeEndsSlope();
  const nav=useNavigate();

  // helper: save centers to localStorage and navigate
  const pushCenters = ()=>{
    if(!st.fitA || !st.fitB) return;
    const A=st.fitA.center, B=st.fitB.center;
    const payload={ A, B, ts:Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    // for same-tab listeners (optional)
    try{ window.dispatchEvent(new StorageEvent("storage",{key:LS_KEY,newValue:JSON.stringify(payload)})); }catch{}
    nav("/flange-on-axis");
  };

  const Info = ({label, value, accent})=>(
    <div style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:10,background:"#fff",minWidth:140}}>
      <div style={{ fontSize:12, color:"#64748b" }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:16, color:accent||"#0f172a" }}>{value}</div>
    </div>
  );

  /* ---------- custom keyboard (unchanged style) ---------- */
  const [target, setTarget] = useState("A");
  const applyTo=(fn)=>{ if(target==="A") st.setRawA(fn(st.rawA)); else st.setRawB(fn(st.rawB)); };
  const onKey=(k)=>{
    if(k==="AC") return applyTo(()=> "");
    if(k==="DEL") return applyTo(s=>s.slice(0,-1));
    if(k==="↵") return applyTo(s=>s+"\n");
    if(k==="SPC") return applyTo(s=>s+" ");
    if(k===" , ") return applyTo(s=>s+", ");
    return applyTo(s=>s+k);
  };
  const Key=({label})=>(
    <button onClick={()=>onKey(label)} style={{height:42,padding:"0 12px",borderRadius:12,border:"1px solid #e5e7eb",background:"#f8fafc",fontWeight:800}}>
      {label}
    </button>
  );
  const Keyboard=()=>(
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,border:"1px solid #e5e7eb",borderRadius:12,padding:8,background:"#fff"}}>
      <Key label="7"/><Key label="8"/><Key label="9"/><Key label=","/><Key label=" , "/><Key label="DEL"/>
      <Key label="4"/><Key label="5"/><Key label="6"/><Key label="-"/><Key label="."/><Key label="AC"/>
      <Key label="1"/><Key label="2"/><Key label="3"/><Key label="SPC"/><Key label="↵"/><Key label="0"/>
      <Key label="E"/><Key label="N"/><Key label="H"/><Key label="/"/><Key label=";"/><Key label=":"/>
    </div>
  );
  const chip=(id,text)=>(
    <button onClick={()=>setTarget(id)}
      style={{padding:"6px 10px",border:"1px solid #e5e7eb",borderRadius:9999,background:target===id?"#0ea5e9":"#f8fafc",color:target===id?"#fff":"#0f172a",fontWeight:700}}>
      {text}
    </button>
  );
  const activeBg=(id)=>({ background: target===id ? "#dbeafe" : "#fff" });

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Inputs + keyboard */}
      <div className="card" style={{ background:"#ffffff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">Pipe Ends — ENH Points</div>

        <div style={{ display:"grid", gap:8, marginBottom:12 }}>
          <div className="small" style={{ fontWeight:700 }}>End A</div>
          <textarea rows={6} value={st.rawA} onChange={(e)=>st.setRawA(e.target.value)} onFocus={()=>setTarget("A")}
            placeholder={`E,N,H per line\n1200.0, 350.0, 15.2\n1198.5 352.2 15.3\n1201.1, 348.9, 15.1`}
            style={{width:"100%",fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",border:"1px solid #e5e7eb",borderRadius:10,padding:10,outline:"none",...activeBg("A")}}/>
        </div>

        <div style={{ display:"grid", gap:8 }}>
          <div className="small" style={{ fontWeight:700 }}>End B</div>
          <textarea rows={6} value={st.rawB} onChange={(e)=>st.setRawB(e.target.value)} onFocus={()=>setTarget("B")}
            placeholder={`E,N,H per line\n1210.2, 365.0, 28.1\n1208.7 366.9 28.0\n1211.4, 363.1, 28.2`}
            style={{width:"100%",fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",border:"1px solid #e5e7eb",borderRadius:10,padding:10,outline:"none",...activeBg("B")}}/>
        </div>

        <div className="row" style={{ gap:8, marginTop:10, flexWrap:"wrap" }}>
          <span className="small" style={{ color:"#64748b" }}>Keyboard target:</span>
          {chip("A","End A")}
          {chip("B","End B")}
        </div>
        <div style={{ marginTop:8 }}><Keyboard/></div>
        <div className="small" style={{ color:"#64748b", marginTop:6 }}>
          Tips: <b>,</b> / <b>SPC</b> / <b>↵</b> / <b>DEL</b> / <b>AC</b>
        </div>
      </div>

      {/* End A */}
      <div className="card" style={{ background:"#fff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">End A — Fitted Center</div>
        {!st.fitA && <div className="small">Need ≥ 3 points.</div>}
        {st.fitA && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Info label="Center E" value={st.fitA.center.E.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Center N" value={st.fitA.center.N.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Center H" value={st.fitA.center.H.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Radius" value={st.fitA.R.toFixed(3)+" mm"} accent="#16a34a"/>
            <Info label="RMS error" value={st.fitA.rms.toFixed(3)+" mm"} accent="#ef4444"/>
          </div>
        )}
      </div>

      {/* End B */}
      <div className="card" style={{ background:"#fff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">End B — Fitted Center</div>
        {!st.fitB && <div className="small">Need ≥ 3 points.</div>}
        {st.fitB && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Info label="Center E" value={st.fitB.center.E.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Center N" value={st.fitB.center.N.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Center H" value={st.fitB.center.H.toFixed(3)} accent="#0ea5e9"/>
            <Info label="Radius" value={st.fitB.R.toFixed(3)+" mm"} accent="#16a34a"/>
            <Info label="RMS error" value={st.fitB.rms.toFixed(3)+" mm"} accent="#ef4444"/>
          </div>
        )}
      </div>

      {/* Axis & Slope + PUSH */}
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

        <div className="row" style={{ marginTop:10, gap:8 }}>
          <button className="btn" disabled={!st.fitA || !st.fitB} onClick={pushCenters}>
            ⏩ Push centers to “Flange on Axis”
          </button>
          {!st.fitA || !st.fitB ? <span className="small" style={{ color:"#ef4444" }}>Need both ends fitted.</span> : null}
        </div>
      </div>
    </div>
  );
  }
