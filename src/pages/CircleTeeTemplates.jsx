// src/pages/CircleTeeDraft.jsx
import React, {useEffect, useRef, useState} from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/**
 * Inputs
 * - runOD, branchOD (mm)
 * - pitchDeg (branch ကို run longitudinal အလျားလိုက် test angle)
 * - yawDeg   (branch ကို side လှည့်မှု)
 * - stepDeg  (projection step, e.g. 30°)
 *
 * Output (exactly like your sketch):
 * - Canvas #1: Run-hole stencil (wrap on RUN) — projection lines @ stepDeg with mm heights
 * - Canvas #2: Branch-cut stencil (wrap on BRANCH) — projection lines @ stepDeg with mm heights
 * - Table: degree vs height(mm)
 * - Save to /teeDrafts with title + raw data, visible in AllReview (same style as teeTemplates)
 */

// ---------- math helpers ----------
const rad = d => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const range = (n, step = 1, start = 0) => Array.from({length: n}, (_,i)=> start + i*step);

// parametric intersection of two cylinders (equal / unequal OD) with pitch/yaw
// We use classic descriptive-geometry formula: distance from run surface
function heightsOnRun({runR, brR, pitch, yaw, degs}) {
  // unit vectors
  const ap = rad(pitch), ay = rad(yaw);
  // branch axis in run coords (x=along run axis, y=z wrap)
  const ax = Math.cos(ap);          // along RUN
  const ay_s = Math.sin(ap)*Math.sin(ay);
  const az_s = Math.sin(ap)*Math.cos(ay);

  // Closed form: for each wrap angle θ around RUN, the fish-mouth height h satisfies:
  // (y,z) on run surface => y = runR*cosθ, z = runR*sinθ
  // Distance from (y,z) to branch axis line equals brR  → solve for x (height).
  // Axis line direction v = (ax, ay_s, az_s), point through origin.
  // For point P(x,y,z) on intersection, shortest distance^2 = |P|^2 - (P·v)^2 = brR^2.
  // |P|^2 = x^2 + runR^2 ; P·v = ax x + ay_s y + az_s z
  // ⇒ x^2 + runR^2 - (ax x + ay_s y + az_s z)^2 = brR^2
  // Solve quadratic in x; pick real root with smallest |x| (symmetric).
  const res = [];
  for (const d of degs) {
    const th = rad(d);
    const y = runR * Math.cos(th);
    const z = runR * Math.sin(th);
    const B = ax;
    const C = ay_s*y + az_s*z;
    // x^2 + runR^2 - (B x + C)^2 = brR^2
    // => (1 - B^2)x^2 - 2BC x + (runR^2 - C^2 - brR^2) = 0
    const A2 = (1 - B*B);
    const B2 = (-2*B*C);
    const C2 = (runR*runR - C*C - brR*brR);
    let x = 0;
    if (Math.abs(A2) < 1e-9) {
      // linear (grazing)
      x = -C2 / B2;
    } else {
      const disc = B2*B2 - 4*A2*C2;
      if (disc < 0) { res.push(0); continue; }
      const r1 = (-B2 + Math.sqrt(disc)) / (2*A2);
      const r2 = (-B2 - Math.sqrt(disc)) / (2*A2);
      x = Math.abs(r1) < Math.abs(r2) ? r1 : r2;
    }
    res.push(x); // height along RUN axis (mm) — positive one side, negative the other
  }
  return res;
}

function heightsOnBranch({runR, brR, pitch, yaw, degs}) {
  // Swap roles: wrap around BRANCH; compute distance to RUN axis
  const ap = rad(pitch), ay = rad(yaw);
  // Run axis in branch coords is inverse rotation; derive direction components:
  // v_run_in_branch = (cos ap, -sin ap * sin ay, -sin ap * cos ay)
  const vx = Math.cos(ap);
  const vy = -Math.sin(ap)*Math.sin(ay);
  const vz = -Math.sin(ap)*Math.cos(ay);

  const res=[];
  for (const d of degs) {
    const th = rad(d);
    const y = brR * Math.cos(th);
    const z = brR * Math.sin(th);
    const B = vx;
    const C = vy*y + vz*z;
    const A2 = (1 - B*B);
    const B2 = (-2*B*C);
    const C2 = (brR*brR - C*C - runR*runR);
    let x=0;
    if (Math.abs(A2) < 1e-9) x = -C2/B2;
    else {
      const disc = B2*B2 - 4*A2*C2;
      if (disc < 0) { res.push(0); continue; }
      const r1 = (-B2 + Math.sqrt(disc)) / (2*A2);
      const r2 = (-B2 - Math.sqrt(disc)) / (2*A2);
      x = Math.abs(r1) < Math.abs(r2) ? r1 : r2;
    }
    res.push(x);
  }
  return res;
}

// ---------- drawing ----------
function drawStencil(canvas, title, radiiCircum, degs, heights, style="run") {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 680;
  const H = canvas.clientHeight || 340;
  canvas.width = Math.floor(W*dpr); canvas.height = Math.floor(H*dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  const pad = 28;
  const minU = 0, maxU = radiiCircum;
  const minV = Math.min(...heights), maxV = Math.max(...heights);
  const vPad = Math.max(10, 0.15*Math.max(1, maxV-minV));
  const X = u => pad + (u - minU) * (W-2*pad)/Math.max(1e-6, maxU-minU);
  const Y = v => H-pad - (v - (minV - vPad)) * (H-2*pad)/Math.max(1e-6, (maxV - minV + 2*vPad));

  // grid @ 30°
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  const stepU = radiiCircum / 12;
  for (let u=0; u<=maxU+1e-6; u+=stepU) { ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H-pad); ctx.stroke(); }
  // baseline
  ctx.strokeStyle="#94a3b8";
  ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W-pad, Y(0)); ctx.stroke();

  // title
  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui";
  ctx.fillText(title, pad, 18);

  // polyline
  ctx.strokeStyle = style==="run" ? "#0ea5e9" : "#22c55e";
  ctx.lineWidth=2.5; ctx.beginPath();
  degs.forEach((d,i)=>{
    const u = (d/360)*radiiCircum;
    const x=X(u), y=Y(heights[i]);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // degree + height pills at every stepDeg
  ctx.font="bold 12px system-ui"; ctx.textAlign="center";
  degs.forEach((d,i)=>{
    const u=(d/360)*radiiCircum, x=X(u), y=Y(heights[i]);
    // vertical guideline
    ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Y(0)); ctx.stroke();
    // height pill
    const label = Math.round(heights[i]);
    const tw = ctx.measureText(String(label)).width + 10, th=18, r=8;
    const bx = x - tw/2, by = y - th - 4;
    ctx.fillStyle="rgba(255,255,255,0.95)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(bx+r,by); ctx.lineTo(bx+tw-r,by);
    ctx.quadraticCurveTo(bx+tw,by,bx+tw,by+r);
    ctx.lineTo(bx+tw,by+th-r); ctx.quadraticCurveTo(bx+tw,by+th,bx+tw-r,by+th);
    ctx.lineTo(bx+r,by+th); ctx.quadraticCurveTo(bx,by+th,bx,by+th-r);
    ctx.lineTo(bx,by+r); ctx.quadraticCurveTo(bx,by,bx+r,by); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle="#0f172a"; ctx.fillText(String(label), x, by+th-5);

    // degree ticks at bottom
    ctx.fillStyle="#0f172a"; ctx.fillText(String(d), x, H-6);
  });
}

export default function CircleTeeDraft(){
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState(200);      // mm
  const [brOD, setBrOD]   = useState(100);      // mm
  const [pitch, setPitch] = useState(90);       // °
  const [yaw, setYaw]     = useState(0);        // °
  const [step, setStep]   = useState(30);       // °
  const [rows, setRows]   = useState([]);       // table rows

  const cRun = useRef(null), cBr = useRef(null);

  const compute = () => {
    const runR = runOD/2, brR = brOD/2;
    const degs = range(Math.floor(360/step)+1, step, 0).map(x=>clamp(x,0,360));
    if (degs[degs.length-1] !== 360) degs.push(360);

    const hRun = heightsOnRun({runR, brR, pitch, yaw, degs});
    const hBr  = heightsOnBranch({runR, brR, pitch, yaw, degs});

    drawStencil(cRun.current, "Run-hole stencil (wrap on RUN)", Math.PI*runOD, degs, hRun, "run");
    drawStencil(cBr.current,  "Branch-cut stencil (wrap on BRANCH)", Math.PI*brOD, degs, hBr, "branch");

    const tbl = degs.map((d,i)=>({deg:d, run: +hRun[i].toFixed(2), branch: +hBr[i].toFixed(2)}));
    setRows(tbl);
    return {degs, hRun, hBr};
  };

  useEffect(()=>{ compute(); },[]);

  const onUpdate = ()=> compute();

  const onClear = ()=>{
    setTitle(""); setRunOD(200); setBrOD(100); setPitch(90); setYaw(0); setStep(30);
    setRows([]); setTimeout(()=>compute(),0);
  };

  const onSave = async ()=>{
    const {degs, hRun, hBr} = compute();
    const payload = {
      createdAt: Date.now(),
      expiresAt: Date.now() + 90*24*3600*1000,
      title: title || "Pipe Tee Draft",
      inputs: { runOD, branchOD: brOD, pitch, yaw, step },
      stations: degs.map((d,i)=>({deg:d, run:hRun[i], branch:hBr[i]})),
      // raw for AllReview canvas preview
      run: degs.map((d,i)=>({ u:(d/360)*Math.PI*runOD, v:hRun[i] })),
      branch: degs.map((d,i)=>({ u:(d/360)*Math.PI*brOD,  v:hBr[i]  })),
      meta: { kind:"teeDraft", degs: degs.length }
    };
    await set(push(dbRef(db, "teeDrafts")), payload);
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee — Projection Draft (Run-hole & Branch-cut)</div>
        <div className="row" style={{gap:8, flexWrap:"wrap"}}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={{minWidth:160}}/>
          <input className="input" type="number" step="any" value={runOD} onChange={e=>setRunOD(+e.target.value)} placeholder="Run OD (mm)"/>
          <input className="input" type="number" step="any" value={brOD} onChange={e=>setBrOD(+e.target.value)} placeholder="Branch OD (mm)"/>
          <input className="input" type="number" step="any" value={pitch} onChange={e=>setPitch(+e.target.value)} placeholder="Pitch (°)"/>
          <input className="input" type="number" step="any" value={yaw} onChange={e=>setYaw(+e.target.value)} placeholder="Yaw (°)"/>
          <input className="input" type="number" step="1" value={step} onChange={e=>setStep(clamp(+e.target.value,5,90))} placeholder="Step (°)"/>
        </div>

        <div className="row" style={{gap:12, marginTop:8, flexWrap:"wrap"}}>
          <button className="btn" onClick={onUpdate}>🔄 Update</button>
          <button className="btn" onClick={onSave}>💾 Save</button>
          <button className="btn" onClick={onClear} style={{background:"#6b7280"}}>🧹 Clear</button>
        </div>

        <ul className="small" style={{marginTop:8}}>
          <li>360° ကို step degree အလိုက် projection line တွေနဲ့ mm height ကို pill label ထုတ်ပြထားတယ် (integer mm ပြန်လည်မျဉ်းတင်ခံရလို့ပေါ်တည်).</li>
          <li><b>Run-hole stencil</b> ကို RUN ပိုက်ပေါ် ပတ်ပြီး — အပေါက် outline. <b>Branch-cut stencil</b> ကို BRANCH ပိုက်ပေါ် ပတ်ပြီး — fish-mouth cut outline.</li>
        </ul>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{width:"100%", height:320, background:"#fff", border:"1px solid #e5e7eb", borderRadius:12}}/>
      </div>
      <div className="card">
        <canvas ref={cBr}  style={{width:"100%", height:320, background:"#fff", border:"1px solid #e5e7eb", borderRadius:12}}/>
      </div>

      <div className="card">
        <div className="page-title">Degree → Height (mm)</div>
        <div className="small" style={{overflowX:"auto"}}>
          <table className="table" style={{minWidth:480}}>
            <thead><tr><th>Deg</th>{rows.map(r=><th key={"d"+r.deg}>{r.deg}</th>)}</tr></thead>
            <tbody>
              <tr><td>Run-hole h(mm)</td>{rows.map(r=><td key={"r"+r.deg}>{Math.round(r.run)}</td>)}</tr>
              <tr><td>Branch-cut h(mm)</td>{rows.map(r=><td key={"b"+r.deg}>{Math.round(r.branch)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
                       }
