// src/pages/CircleTeeFlat.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

const TAU = Math.PI * 2;
const deg2rad = d => (d * Math.PI) / 180;
const rad2deg = r => (r * 180) / Math.PI;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const safeId = () => (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0,8);

// unit vectors from pitch/yaw (pitch=90 = cross, yaw=0 = symmetric)
function dirFromPitchYaw(pitchDeg, yawDeg){
  const p = deg2rad(pitchDeg);
  const y = deg2rad(yawDeg);
  // run axis = +X. start from +X then rotate:
  // yaw around X, then pitch away from X into +Z
  const dx = Math.cos(p);
  const dy = Math.sin(p) * Math.sin(y);
  const dz = Math.sin(p) * Math.cos(y);
  const L = Math.hypot(dx,dy,dz)||1;
  return { x:dx/L, y:dy/L, z:dz/L };
}

// build an orthonormal basis around d (for branch surface)
function basisPerp(d){
  // pick a non-parallel helper
  const h = Math.abs(d.x) < 0.9 ? {x:1,y:0,z:0} : {x:0,y:1,z:0};
  // u = normalize(h - (h·d)d)
  const dot = h.x*d.x + h.y*d.y + h.z*d.z;
  let ux = h.x - dot*d.x, uy = h.y - dot*d.y, uz = h.z - dot*d.z;
  const ul = Math.hypot(ux,uy,uz)||1;
  ux/=ul; uy/=ul; uz/=ul;
  // v = d × u
  const vx = d.y*uz - d.z*uy;
  const vy = d.z*ux - d.x*uz;
  const vz = d.x*uy - d.y*ux;
  return { u:{x:ux,y:uy,z:uz}, v:{x:vx,y:vy,z:vz} };
}

/** Solve intersection = two-quadratic trick
 * RUN surface: P(x,θ) = (x, Rr cosθ, Rr sinθ)
 * BRANCH axis: line through origin with direction d (unit)
 * Distance to axis^2 = |P|^2 - (d·P)^2 = Rb^2
 * -> α x^2 + β x + γ = 0  (α=B^2+C^2, β=-2 A K, K = Rr(B cosθ + C sinθ))
 */
function runHoleCurve(Rr, Rb, d, stepDeg=10){
  const {x:A,y:B,z:C} = d;
  const alpha = 1 - A*A; // = B^2 + C^2
  const CperDeg = TAU*Rr/360; // unwrap scale (mm per degree)

  const pts = [];
  const stations = [];
  for(let ddeg=0; ddeg<=360; ddeg+=stepDeg){
    const t = deg2rad(ddeg);
    const K = Rr*(B*Math.cos(t) + C*Math.sin(t));
    const beta = -2*A*K;
    const gamma = Rr*Rr - K*K - Rb*Rb;
    let x=null;
    if(alpha<=1e-9){
      // branch axis almost parallel to run axis → straight slot; use linear solve
      const S = A*0 + K; // at x=0
      const need = Math.sqrt(Math.max(0, Rr*Rr - Rb*Rb));
      x = Math.abs(need - S); // fallback
    }else{
      const disc = beta*beta - 4*alpha*gamma;
      if(disc<0){ x = 0; }
      else{
        const r1 = (-beta - Math.sqrt(disc))/(2*alpha);
        const r2 = (-beta + Math.sqrt(disc))/(2*alpha);
        // pick the smaller |x| (mouth both sides; use positive height)
        const pick = Math.abs(r1) < Math.abs(r2) ? r1 : r2;
        x = Math.abs(pick);
      }
    }
    pts.push({ u: ddeg*CperDeg, v: x });   // u = along circumference; v = axial (mm)
    stations.push({deg:ddeg, u: ddeg*CperDeg, v: x});
  }
  return { pts, stations, width: TAU*Rr, label:"Run-hole (wrap on RUN)" };
}

/** Branch side: Q(s,φ) = s d + Rb(u cosφ + v sinφ)
 * distance to run axis (X-axis) ⇒ sqrt( (Qy)^2 + (Qz)^2 ) = Rr
 * -> quadratic in s; solve as v(s)=Rr, take |s|
 */
function branchCutCurve(Rr, Rb, d, stepDeg=10){
  const {u, v} = basisPerp(d);
  const CperDeg = TAU*Rb/360;

  const Ay = d.y, Az = d.z;
  const Uy = u.y, Uz = u.z;
  const Vy = v.y, Vz = v.z;

  const pts = [];
  const stations = [];
  for(let ddeg=0; ddeg<=360; ddeg+=stepDeg){
    const p = deg2rad(ddeg);
    const Cy = Rb*(Uy*Math.cos(p) + Vy*Math.sin(p));
    const Cz = Rb*(Uz*Math.cos(p) + Vz*Math.sin(p));

    // (Ay*s + Cy)^2 + (Az*s + Cz)^2 = Rr^2  ->  (Ay^2+Az^2)s^2 + 2(AyCy+AzCz)s + (Cy^2+Cz^2 - Rr^2) = 0
    const a = Ay*Ay + Az*Az;
    const b = 2*(Ay*Cy + Az*Cz);
    const c = (Cy*Cy + Cz*Cz - Rr*Rr);
    let s=0;
    if(a<=1e-9){
      // axis perpendicular to run axis -> use linear
      s = Math.abs(-c/(b||1e-6));
    }else{
      const disc = b*b - 4*a*c;
      if(disc<0) s = 0;
      else{
        const s1 = (-b - Math.sqrt(disc))/(2*a);
        const s2 = (-b + Math.sqrt(disc))/(2*a);
        s = Math.min(Math.abs(s1), Math.abs(s2));
      }
    }
    pts.push({ u: ddeg*CperDeg, v: s });   // u = branch circumference; v = along branch axis
    stations.push({deg:ddeg, u: ddeg*CperDeg, v: s});
  }
  return { pts, stations, width: TAU*Rb, label:"Branch-cut (wrap on BRANCH)" };
}

// simple canvas renderer
function drawUnwrap(canvas, curve, stepDeg, showFill=false){
  if(!canvas || !curve) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W*dpr);
  canvas.height = Math.floor(H*dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,W,H);

  const pad = 16;
  const minU = 0, maxU = curve.width;
  let minV = 0, maxV = 0;
  curve.pts.forEach(p=>{ minV=Math.min(minV,p.v); maxV=Math.max(maxV,p.v); });
  if(maxV-minV < 1e-6){ maxV = minV+1; }
  const X = u => pad + (u-minU)*(W-2*pad)/Math.max(1e-6, (maxU-minU));
  const Y = v => H-pad - (v-minV)*(H-2*pad)/Math.max(1e-6, (maxV-minV));

  // grid (every 30°)
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  const nTick = Math.round(360/stepDeg);
  for(let i=0;i<=nTick;i++){
    const u = (i*stepDeg/360)*curve.width;
    const x = X(u);
    ctx.beginPath(); ctx.moveTo(x,pad); ctx.lineTo(x,H-pad); ctx.stroke();
  }
  // border
  ctx.strokeStyle = "#94a3b8"; ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);

  // filled area (optional)
  if(showFill){
    ctx.fillStyle = "rgba(14,165,233,0.12)";
    ctx.beginPath();
    curve.pts.forEach((p,i)=>{ const x=X(p.u), y=Y(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.lineTo(X(maxU), Y(0));
    ctx.lineTo(X(minU), Y(0));
    ctx.closePath(); ctx.fill();
  }

  // curve
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  curve.pts.forEach((p,i)=>{ const x=X(p.u), y=Y(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.stroke();

  // station labels (degree → height)
  ctx.font = "bold 12px system-ui"; ctx.textAlign="center";
  curve.stations.forEach(st=>{
    const x = X(st.u), y = Y(st.v);
    // degree under axis
    ctx.fillStyle="#0f172a";
    ctx.fillText(String(st.deg), x, H-pad+14);
    // height pill
    const text = String(Math.round(st.v));
    const tw = Math.ceil(ctx.measureText(text).width)+8, th=18, r=8;
    const rx = x - tw/2, ry = y - th - 4;
    ctx.fillStyle="rgba(255,255,255,0.95)";
    ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(rx+r,ry); ctx.lineTo(rx+tw-r,ry);
    ctx.quadraticCurveTo(rx+tw,ry,rx+tw,ry+r);
    ctx.lineTo(rx+tw,ry+th-r);
    ctx.quadraticCurveTo(rx+tw,ry+th,rx+tw-r,ry+th);
    ctx.lineTo(rx+r,ry+th);
    ctx.quadraticCurveTo(rx,ry+th,rx,ry+th-r);
    ctx.lineTo(rx,ry+r);
    ctx.quadraticCurveTo(rx,ry,rx+r,ry);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#0f172a"; ctx.fillText(text, x, ry+th-5);
  });

  // title
  ctx.fillStyle = "#0f172a"; ctx.font = "600 14px system-ui";
  ctx.fillText(curve.label, pad, pad-4);
}

export default function CircleTeeFlat(){
  const [title,setTitle] = useState("");
  const [runOD,setRunOD] = useState("60");
  const [branchOD,setBranchOD] = useState("60");
  const [pitch,setPitch] = useState("90"); // deg
  const [yaw,setYaw] = useState("0");      // deg
  const [step,setStep] = useState("30");   // deg step labels
  const [runC, setRunC] = useState(null);
  const [brC, setBrC] = useState(null);

  const cRun = useRef(null);
  const cBr = useRef(null);

  const compute = ()=>{
    const Rr = Math.max(1, Number(runOD)/2);
    const Rb = Math.max(1, Number(branchOD)/2);
    const pitchDeg = Number(pitch);
    const yawDeg = Number(yaw);
    const stepDeg = clamp(Number(step)||30, 5, 90);

    const d = dirFromPitchYaw(pitchDeg, yawDeg);
    const run = runHoleCurve(Rr, Rb, d, stepDeg);
    const brn = branchCutCurve(Rr, Rb, d, stepDeg);

    setRunC(run); setBrC(brn);
    // draw
    setTimeout(()=>{
      drawUnwrap(cRun.current, run, stepDeg, true);
      drawUnwrap(cBr.current,  brn, stepDeg, false);
    },0);
  };

  useEffect(()=>{ compute(); /* eslint-disable-next-line */ }, []);

  const clearAll = ()=>{
    setTitle(""); setRunOD("60"); setBranchOD("60"); setPitch("90"); setYaw("0"); setStep("30");
    setRunC(null); setBrC(null);
    const ctx1=cRun.current?.getContext("2d"); const ctx2=cBr.current?.getContext("2d");
    if(ctx1){ ctx1.clearRect(0,0,cRun.current.width,cRun.current.height); }
    if(ctx2){ ctx2.clearRect(0,0,cBr.current.width,cBr.current.height); }
  };

  const saveToFirebase = async ()=>{
    if(!runC || !brC){ alert("Nothing to save yet."); return; }
    const now = Date.now();
    await set(push(dbRef(db,"teeFlat")),{
      createdAt: now,
      expiresAt: now + 90*24*60*60*1000,
      title: title || "Untitled tee",
      inputs:{
        runOD: Number(runOD), branchOD: Number(branchOD),
        pitch: Number(pitch), yaw: Number(yaw),
        stepDeg: Number(step)
      },
      run: runC.pts,         // [{u,v}...]
      branch: brC.pts,       // [{u,v}...]
      stations: runC.stations, // for quick labels (deg, u, v) – same degrees for both
      meta:{ widthRun: runC.width, widthBranch: brC.width }
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧷 Pipe Tee – Flat Templates</div>
        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />

        <div className="row" style={{marginTop:8}}>
          <input className="input" type="number" step="any" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" type="number" step="any" placeholder="Branch OD (mm)" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
        </div>
        <div className="row" style={{marginTop:8}}>
          <input className="input" type="number" step="any" placeholder="Pitch (deg)" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" type="number" step="any" placeholder="Yaw (deg)" value={yaw} onChange={e=>setYaw(e.target.value)} />
          <input className="input" type="number" step="1" placeholder="Step° (labels)" value={step} onChange={e=>setStep(e.target.value)} />
        </div>

        <div className="row" style={{marginTop:10}}>
          <button className="btn" onClick={compute}>🔁 Update</button>
          <button className="btn" onClick={saveToFirebase}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{background:"#6b7280"}}>🧹 Clear</button>
        </div>

        <div className="small" style={{marginTop:8}}>
          • 360° seam = 0° line. Graph ထဲက degree ကိန်းဂဏန်းတိုင်းမှာ **height(mm)** ကိုပြထားပြီး စက္ကူပတ် template အဖြစ် တိုက်ရိုက်သုံးနိုင်သည်။<br/>
          • <b>Run-hole</b> stencil ကို RUN ပိုက်ပေါ်ပတ်ပြီး hole outline ကိုမှတ်ပါ။ <b>Branch-cut</b> stencil ကို BRANCH ပိုက်ပေါ်ပတ်ပြီး fish-mouth cut outline ကိုမှတ်ပါ။
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{width:"100%",height:240,border:"1px solid #e5e7eb",borderRadius:12,background:"#fff"}}/>
      </div>

      <div className="card">
        <canvas ref={cBr} style={{width:"100%",height:240,border:"1px solid #e5e7eb",borderRadius:12,background:"#fff"}}/>
      </div>

      {runC && brC && (
        <div className="card">
          <div className="page-title">Dimensions (quick check)</div>
          <div className="small">
            Run circumference ≈ <b>{(Math.PI*Number(runOD)).toFixed(2)}</b> mm ·
            Branch circumference ≈ <b>{(Math.PI*Number(branchOD)).toFixed(2)}</b> mm ·
            Tilts → Pitch <b>{Number(pitch)}</b>°, Yaw <b>{Number(yaw)}</b>°, Step <b>{Number(step)}</b>°
          </div>
        </div>
      )}
    </div>
  );
    }
