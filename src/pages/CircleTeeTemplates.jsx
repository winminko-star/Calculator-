import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { push, ref as dbRef, set as dbSet } from "firebase/database";

/** ---------- math helpers ---------- **/
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nearlyZero = (x, e=1e-9) => Math.abs(x) < e;

// build orthonormal basis from yaw/pitch
function makeAxis(yawDeg, pitchDeg) {
  // run axis = Z. Branch axis v:
  // yaw ψ around Z, then tilt by pitch α away from Z (α=90° → horizontal)
  const ψ = yawDeg * DEG;
  const α = pitchDeg * DEG;
  const sψ = Math.sin(ψ), cψ = Math.cos(ψ);
  const sα = Math.sin(α), cα = Math.cos(α);
  // unit axis
  const v = { x: cψ * sα, y: sψ * sα, z: cα }; // when pitch=90°, v is in XY; pitch=0°, v=+Z
  // pick e1 perpendicular to v (prefer near-X)
  const up = Math.abs(v.z) < 0.9 ? { x:0, y:0, z:1 } : { x:1, y:0, z:0 };
  // e1 = normalize(up × v), e2 = v × e1
  const cx = up.y * v.z - up.z * v.y;
  const cy = up.z * v.x - up.x * v.z;
  const cz = up.x * v.y - up.y * v.x;
  const m1 = Math.hypot(cx, cy, cz) || 1;
  const e1 = { x: cx / m1, y: cy / m1, z: cz / m1 };
  const ex = v.y * e1.z - v.z * e1.y;
  const ey = v.z * e1.x - v.x * e1.z;
  const ez = v.x * e1.y - v.y * e1.x;
  const e2 = { x: ex, y: ey, z: ez }; // already unit
  return { v, e1, e2 };
}

/** Solve quadratic a t^2 + b t + c = 0 → 2 or 0 solutions */
function qsolve(a,b,c){
  const D = b*b - 4*a*c;
  if (D < 0) return [];
  if (nearlyZero(a)) {
    if (nearlyZero(b)) return [];
    return [ -c / b ];
  }
  const s = Math.sqrt(Math.max(0,D));
  return [ (-b - s)/(2*a), (-b + s)/(2*a) ];
}

/** ---------- core generators ---------- **/
/** Run-hole stencil (wrap on RUN). Returns {pts, stations}
 * inputs: runOD, branchOD, yawDeg, pitchDeg, stepDeg
 * pts: array of {u,v} or null (gap)
 * u in mm along run circumference; v in mm (z on run)
 */
function genRunStencil(runOD, branchOD, yawDeg, pitchDeg, stepDeg=30) {
  const Rr = runOD / 2, Rb = branchOD / 2;
  const { v:axis, e1, e2 } = makeAxis(yawDeg, pitchDeg);

  // pre
  const vz = axis.z, vx = axis.x, vy = axis.y;

  const pts = [];
  const stations = [];
  for (let deg = 0; deg <= 360; deg += stepDeg) {
    stations.push({ deg, u: Rr * deg * DEG });
  }
  for (let d = 0; d <= 360; d++) {
    const θ = d * DEG;
    const cx = Rr * Math.cos(θ);
    const cy = Rr * Math.sin(θ);
    // distance from p=(cx,cy,z) to branch axis (through origin, dir=v) equals Rb
    // |p×v|^2 = |p|^2 - (p·v)^2 = Rb^2
    // => (Rr^2 + z^2) - ( (cx*vx + cy*vy + z*vz)^2 ) = Rb^2
    const a = (cx*vx + cy*vy); // not including z
    const A = 1 - vz*vz;
    const B = -2*a*vz;
    const C = Rr*Rr - a*a - Rb*Rb;
    const sol = qsolve(A,B,C);
    if (!sol.length) { pts.push(null); continue; }
    // keep both rims? take upper (+) by larger |v| then draw symmetric?
    // We want visible outline. Choose the one with greater absolute z (peak).
    const z = sol.sort((x,y)=>Math.abs(y)-Math.abs(x))[0];
    pts.push({ u: Rr * d * DEG, v: z });
  }
  // station v interpolation
  stations.forEach(s=>{
    const idx = clamp(Math.round(s.deg), 0, 360);
    const P = pts[idx] || null;
    s.v = P ? P.v : null;
  });
  return { pts, stations, uMax: 2*Math.PI*Rr };
}

/** Branch-cut stencil (wrap on BRANCH). Returns {pts, stations}
 * unwrap around branch: u = Rb*φ, v = t (mm along branch axis)
 */
function genBranchStencil(runOD, branchOD, yawDeg, pitchDeg, stepDeg=30) {
  const Rr = runOD / 2, Rb = branchOD / 2;
  const { v:axis, e1, e2 } = makeAxis(yawDeg, pitchDeg);
  const vx = axis.x, vy = axis.y, vz = axis.z;

  const pts = [];
  const stations = [];
  for (let deg = 0; deg <= 360; deg += stepDeg) {
    stations.push({ deg, u: Rb * deg * DEG });
  }

  for (let d = 0; d <= 360; d++) {
    const φ = d * DEG;
    // point on branch surface: p = c + t v
    const c = {
      x: Rb * (Math.cos(φ)*e1.x + Math.sin(φ)*e2.x),
      y: Rb * (Math.cos(φ)*e1.y + Math.sin(φ)*e2.y),
      z: Rb * (Math.cos(φ)*e1.z + Math.sin(φ)*e2.z),
    };
    // distance to run z-axis: sqrt( x^2 + y^2 ) = Rr → solve for t
    // (c_x + t v_x)^2 + (c_y + t v_y)^2 = Rr^2
    const A = vx*vx + vy*vy;                      // = 1 - vz^2
    const B = 2*(c.x*vx + c.y*vy);
    const C = c.x*c.x + c.y*c.y - Rr*Rr;
    const sol = qsolve(A,B,C);
    if (!sol.length) { pts.push(null); continue; }
    // pick t nearer to 0 (intersection around mid-thickness)
    const t = sol.sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
    pts.push({ u: Rb * d * DEG, v: t });
  }

  stations.forEach(s=>{
    const idx = clamp(Math.round(s.deg), 0, 360);
    const P = pts[idx] || null;
    s.v = P ? P.v : null;
  });
  return { pts, stations, uMax: 2*Math.PI*Rb };
}

/** ---------- canvas drawer (unwrap) ---------- **/
function drawStencil(canvas, title, data, uMax) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W*dpr);
  canvas.height = Math.floor(H*dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  // if nothing
  if (!data?.pts?.length) {
    ctx.fillStyle="#64748b"; ctx.font="14px system-ui";
    ctx.fillText("No domain", 12, 22);
    return;
  }

  // bounds
  const pad = 18;
  let minU=0, maxU=uMax||1, minV=Infinity, maxV=-Infinity;
  data.pts.forEach(p=>{
    if(!p) return; minV=Math.min(minV,p.v); maxV=Math.max(maxV,p.v);
  });
  if (!isFinite(minV)) { minV=-1; maxV=1; }
  const head = Math.max(2, 0.06*(maxV-minV||1));
  minV-=head; maxV+=head;

  const X = u => pad + (u-minU)*(W-2*pad)/Math.max(1e-6, (maxU-minU));
  const Y = v => H-pad - (v-minV)*(H-2*pad)/Math.max(1e-6, (maxV-minV));

  // grid every 30°
  const stepU = (maxU-minU)/12;
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for (let u=minU; u<=maxU+1e-6; u+=stepU){
    ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H-pad); ctx.stroke();
  }
  // axes/border
  ctx.strokeStyle="#94a3b8"; ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);

  // title
  ctx.fillStyle="#0f172a"; ctx.font="600 16px system-ui";
  ctx.fillText(title, pad, pad-6);

  // curve
  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5; ctx.beginPath();
  let penUp=true;
  data.pts.forEach(p=>{
    if(!p){ penUp=true; return; }
    const x=X(p.u), y=Y(p.v);
    if(penUp){ ctx.moveTo(x,y); penUp=false; } else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // stations (u bottom, v bubble)
  ctx.textAlign="center"; ctx.font="bold 12px system-ui";
  data.stations?.forEach(s=>{
    const x=X(s.u), y=Y(s.v??minV);
    // bottom u
    ctx.fillStyle="#0f172a"; ctx.fillText(String(Math.round(s.u)), x, H-pad+14);
    // bubble
    if (s.v==null) return;
    const txt=String(Math.round(s.v));
    const tw=Math.ceil(ctx.measureText(txt).width)+10, th=18, r=8, rx=x-tw/2, ry=y-22;
    ctx.fillStyle="rgba(255,255,255,0.95)";
    ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(rx+r,ry);
    ctx.lineTo(rx+tw-r,ry); ctx.quadraticCurveTo(rx+tw,ry,rx+tw,ry+r);
    ctx.lineTo(rx+tw,ry+th-r); ctx.quadraticCurveTo(rx+tw,ry+th,rx+tw-r,ry+th);
    ctx.lineTo(rx+r,ry+th); ctx.quadraticCurveTo(rx,ry+th,rx,ry+th-r);
    ctx.lineTo(rx,ry+r); ctx.quadraticCurveTo(rx,ry,rx+r,ry); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle="#0f172a"; ctx.fillText(txt, x, ry+th-5);
  });
}

/** ---------- Page ---------- **/
export default function CircleTee(){
  const [title, setTitle]     = useState("");
  const [runOD, setRunOD]     = useState(200); // mm
  const [brOD,  setBrOD]      = useState(50);
  const [pitch, setPitch]     = useState(90);  // deg
  const [yaw,   setYaw]       = useState(0);   // deg
  const [step,  setStep]      = useState(30);  // deg

  const [runData, setRunData] = useState(null);
  const [brData,  setBrData]  = useState(null);
  const cRun = useRef(null);
  const cBr  = useRef(null);

  const updateAll = () => {
    const r = Number(runOD)||0, b=Number(brOD)||0;
    const p = Number(pitch)||0, y=Number(yaw)||0, st=clamp(Number(step)||30, 3, 90);
    const run = genRunStencil(r,b,y,p,st);
    const brc = genBranchStencil(r,b,y,p,st);
    setRunData({ ...run });
    setBrData({ ...brc });
  };
  useEffect(updateAll, []); // first paint
  useEffect(()=>{
    drawStencil(cRun.current, "Run-hole stencil (wrap on run)", runData, runData?.uMax);
  }, [runData]);
  useEffect(()=>{
    drawStencil(cBr.current, "Branch-cut stencil (wrap on branch)", brData, brData?.uMax);
  }, [brData]);

  const save = async ()=>{
    const now=Date.now(), expiresAt=now+90*24*60*60*1000;
    await dbSet(push(dbRef(db,"teeTemplates")), {
      createdAt: now, expiresAt,
      title: title || "Untitled",
      inputs: { runOD:Number(runOD), branchOD:Number(brOD), pitch:Number(pitch), yaw:Number(yaw), step:Number(step) },
      // stash raw arrays (compact)
      run: runData?.pts, branch: brData?.pts,
      stations: { run: runData?.stations, branch: brData?.stations }
    });
    alert("Saved ✅");
  };

  const clear = ()=>{
    setTitle("");
    setRunOD(""); setBrOD("");
    setPitch(90); setYaw(0); setStep(30);
    setRunData(null); setBrData(null);
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧷 Pipe Tee Templates</div>

        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />

        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="Run OD (mm)"  value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Branch OD (mm)" value={brOD}  onChange={e=>setBrOD(e.target.value)} />
        </div>
        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="Pitch (deg)" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Yaw (deg)"   value={yaw}   onChange={e=>setYaw(e.target.value)} />
        </div>
        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="Step (deg)"  value={step}  onChange={e=>setStep(e.target.value)} />
        </div>

        <div className="row" style={{marginTop:8}}>
          <button className="btn" onClick={updateAll}>⟳ Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clear} style={{background:"#6b7280"}}>🧹 Clear</button>
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12}} />
      </div>
      <div className="card">
        <canvas ref={cBr}  style={{width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12}} />
      </div>

      <div className="card small">
        <b>Dimensions</b> — Run C ≈ { (Math.PI*Number(runOD)||0).toFixed(2) } mm ·
        Branch C ≈ { (Math.PI*Number(brOD)||0).toFixed(2) } mm ·
        Tilts → Pitch {pitch}°, Yaw {yaw}°, Step {step}°
      </div>
    </div>
  );
                    }
