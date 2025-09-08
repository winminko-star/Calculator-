import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/* ------------------------ math helpers ------------------------ */
// deg↔rad
const D2R = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const safe = (x) => (Number.isFinite(x) ? x : null);

// unit axis from pitch/yaw (run axis = +X)
// pitch: 0° = true tee (⊥ to run), 90° = parallel to run
// yaw: rotate around run axis to choose where the branch sits (0° = +Y, 90° = +Z)
function axisFromPitchYaw(pitchDeg, yawDeg) {
  const p = D2R(pitchDeg || 0);
  const y = D2R(yawDeg || 0);
  // unit vector in YZ-plane pointing outwards at yaw
  const u = { x: 0, y: Math.cos(y), z: Math.sin(y) };
  // move from perpendicular towards +X by pitch
  const d = {
    x: Math.sin(p),
    y: u.y * Math.cos(p),
    z: u.z * Math.cos(p),
  };
  // normalize (already unit but guard)
  const m = Math.hypot(d.x, d.y, d.z) || 1;
  return { x: d.x / m, y: d.y / m, z: d.z / m };
}

// build an orthonormal basis (n1,n2) ⟂ d   (for parameterising the branch surface)
function buildPerpBasis(d) {
  // pick any vector not collinear
  const tmp = Math.abs(d.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  // n1 = normalize(tmp × d)
  const n1 = {
    x: tmp.y * d.z - tmp.z * d.y,
    y: tmp.z * d.x - tmp.x * d.z,
    z: tmp.x * d.y - tmp.y * d.x,
  };
  const m1 = Math.hypot(n1.x, n1.y, n1.z) || 1;
  n1.x /= m1; n1.y /= m1; n1.z /= m1;
  // n2 = d × n1
  const n2 = {
    x: d.y * n1.z - d.z * n1.y,
    y: d.z * n1.x - d.x * n1.z,
    z: d.x * n1.y - d.y * n1.x,
  };
  return { n1, n2 };
}

/* --------------------- core geometry (closed-form) --------------------- */
/** Run-hole curve (unwrap run cylinder)
 * Run axis = X, radius Rr. A surface point is (x, Rr cosθ, Rr sinθ).
 * Branch axis = line through origin along d (unit). Branch radius Rb.
 * Intersection condition: |P × d| = Rb.
 * This yields a quadratic in x: A x² + B x + C = 0 (θ is parameter), we pick |x|.
 */
function computeRunHole(Rr, Rb, pitch, yaw, stepAngle = 1) {
  const d = axisFromPitchYaw(pitch, yaw);
  const A = (d.y * d.y) + (d.z * d.z);

  const res = [];
  for (let deg = 0; deg <= 360; deg += stepAngle) {
    const θ = D2R(deg);
    const s = Math.sin(θ), c = Math.cos(θ);

    const B = -2 * Rr * d.x * (s * d.z + c * d.y);
    const C =
      Rr * Rr * (d.x * d.x) +
      Rr * Rr * ( (c * d.z - s * d.y) * (c * d.z - s * d.y) ) -
      Rb * Rb;

    const disc = B * B - 4 * A * C;
    if (disc < 0) { res.push(null); continue; }

    const root = Math.sqrt(disc);
    const x1 = (-B + root) / (2 * A);
    const x2 = (-B - root) / (2 * A);
    // stencil needs axial distance from mid-plane → take the smaller magnitude
    const x = Math.abs(Math.abs(x1) < Math.abs(x2) ? x1 : x2);

    // unwrap: u (mm along circumference), v (mm along axis)
    res.push({
      u: Rr * θ,         // arc length on run (0 .. 2πRr)
      v: safe(x),        // axial distance
      deg,
    });
  }
  return res;
}

/** Branch-cut curve (unwrap branch cylinder)
 * Parameterise Q(t, φ) = t d + Rb( n1 cosφ + n2 sinφ ), want y²+z² = Rr²
 * Solve for t: (d_y²+d_z²)t² + 2Rb(d·A)t + Rb²|A|² - Rr² = 0 where A = (0, A_y, A_z)
 */
function computeBranchCut(Rr, Rb, pitch, yaw, stepAngle = 1) {
  const d = axisFromPitchYaw(pitch, yaw);
  const { n1, n2 } = buildPerpBasis(d);

  const Ay = (c) => n1.y * c + n2.y * Math.sqrt(1 - c * c); // cosφ known → sinφ from c
  const Az = (c) => n1.z * c + n2.z * Math.sqrt(1 - c * c);

  const A2 = d.y * d.y + d.z * d.z;
  const res = [];
  for (let deg = 0; deg <= 360; deg += stepAngle) {
    const φ = D2R(deg);
    const c = Math.cos(φ), s = Math.sin(φ);
    const Ayv = n1.y * c + n2.y * s;
    const Azv = n1.z * c + n2.z * s;

    const B = 2 * Rb * (d.y * Ayv + d.z * Azv);
    const C = Rb * Rb * (Ayv * Ayv + Azv * Azv) - Rr * Rr;

    const disc = B * B - 4 * A2 * C;
    if (disc < 0) { res.push(null); continue; }

    const root = Math.sqrt(disc);
    const t1 = (-B + root) / (2 * A2);
    const t2 = (-B - root) / (2 * A2);
    const t = Math.abs(Math.abs(t1) < Math.abs(t2) ? t1 : t2);

    res.push({
      u: Rb * φ,    // arc length on branch (0 .. 2πRb)
      v: safe(t),   // along branch axis from saddle plane
      deg,
    });
  }
  return res;
}

/* --------------------------- tiny canvas drawer --------------------------- */
function drawUnwrap(canvas, pts, title, OD, tickDeg = 30) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 220;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // guard
  const valid = pts.filter(p => p && Number.isFinite(p.u) && Number.isFinite(p.v));
  if (!valid.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui";
    ctx.fillText("No domain", 12, 22);
    return;
  }

  const pad = 16;
  const minU = 0, maxU = Math.max(...valid.map(p=>p.u));
  let minV = Math.min(...valid.map(p=>p.v));
  let maxV = Math.max(...valid.map(p=>p.v));
  const head = Math.max(2, 0.08*(maxV - minV || 1));
  minV = Math.max(0, minV - head); maxV += head;

  const X = (u) => pad + (u - minU) * (W - 2*pad) / Math.max(1e-6, (maxU - minU));
  const Y = (v) => H - pad - (v - minV) * (H - 2*pad) / Math.max(1e-6, (maxV - minV));

  // vertical ticks each tickDeg
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  const C = Math.PI * (OD || 0);
  const stepU = (tickDeg/360) * C;
  for (let u = 0; u <= C + 0.5; u += stepU) {
    ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H-pad); ctx.stroke();
  }
  // baseline + title
  ctx.strokeStyle="#94a3b8";
  ctx.strokeRect(pad, pad, W-2*pad, H-2*pad);
  ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();
  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui"; ctx.fillText(title, pad, pad-4);

  // curve
  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5; ctx.beginPath();
  let first=true;
  pts.forEach(p=>{
    if(!p){first=true; return;}
    const x=X(p.u), y=Y(p.v);
    if(first){ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // station dots every tickDeg
  ctx.font="bold 12px system-ui"; ctx.textAlign="center";
  (function drawStations(){
    const keep = new Set();
    for(let d=0; d<=360; d+=tickDeg) keep.add(d);
    pts.forEach(p=>{
      if(!p || !keep.has(p.deg)) return;
      const x=X(p.u), y=Y(p.v);
      // bubble
      const text = String(Math.round(p.v));
      const tw = Math.ceil(ctx.measureText(text).width)+8, th=18, r=8;
      const rx=x-tw/2, ry=y-th-6;
      ctx.fillStyle="rgba(255,255,255,0.95)";
      ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(rx+r,ry);
      ctx.lineTo(rx+tw-r,ry);
      ctx.quadraticCurveTo(rx+tw,ry,rx+tw,ry+r);
      ctx.lineTo(rx+tw,ry+th-r);
      ctx.quadraticCurveTo(rx+tw,ry+th,rx+tw-r,ry+th);
      ctx.lineTo(rx+r,ry+th);
      ctx.quadraticCurveTo(rx,ry+th,rx,ry+th-r);
      ctx.lineTo(rx,ry+r);
      ctx.quadraticCurveTo(rx,ry,rx+r,ry);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#0f172a"; ctx.fillText(text,x,ry+th-5);

      // bottom degree text
      ctx.fillStyle="#0f172a";
      ctx.fillText(String(p.deg), x, H-pad+14);
    });
  })();
}

/* ------------------------------- component ------------------------------- */
export default function CircleTee() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState(200);     // mm
  const [branchOD, setBranchOD] = useState(50);// mm
  const [pitch, setPitch] = useState(0);       // deg (0 ⟂, 90 ∥)
  const [yaw, setYaw] = useState(0);           // deg (around run)
  const [stepDeg, setStepDeg] = useState(30);  // station step
  const [wrapDeg, setWrapDeg] = useState(360); // how much of circumference to draw (keep 360)

  const [runPts, setRunPts] = useState([]);
  const [brPts, setBrPts] = useState([]);

  const refRun = useRef(null);
  const refBr  = useRef(null);

  const update = () => {
    const Rr = clamp(runOD/2, 0.1, 1e6);
    const Rb = clamp(branchOD/2, 0.1, 1e6);
    const step = clamp(stepDeg, 1, 90);

    const denseStep = 1; // draw smooth curve (1°)
    const run = computeRunHole(Rr, Rb, pitch, yaw, denseStep)
      .filter(p => p && p.deg <= wrapDeg);
    const br  = computeBranchCut(Rr, Rb, pitch, yaw, denseStep)
      .filter(p => p && p.deg <= wrapDeg);

    setRunPts(run);
    setBrPts(br);
  };

  useEffect(update, []); // first paint
  useEffect(()=>{
    drawUnwrap(refRun.current, runPts, "Run hole stencil (cut-out)", runOD, stepDeg);
    drawUnwrap(refBr.current,  brPts,  "Branch cut stencil (wrap on branch)", branchOD, stepDeg);
  }, [runPts, brPts, runOD, branchOD, stepDeg]);

  const clearAll = () => {
    setTitle(""); setRunOD(200); setBranchOD(50);
    setPitch(0); setYaw(0); setStepDeg(30); setWrapDeg(360);
    setRunPts([]); setBrPts([]);
  };

  const save = async () => {
    const now = Date.now();
    const expiresAt = now + 90*24*60*60*1000;
    await set(push(dbRef(db, "teeTemplates")), {
      createdAt: now, expiresAt,
      title: title || "Untitled",
      inputs: { runOD, branchOD, pitch, yaw, stepDeg, wrapDeg },
      run: runPts,     // {u, v, deg}
      branch: brPts,   // {u, v, deg}
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <button className="btn" onClick={update}>↻ Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#6b7280" }}>🧹 Clear</button>
        </div>

        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="Run OD (mm)"
                 value={runOD} onChange={e=>setRunOD(+e.target.value||0)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Branch OD (mm)"
                 value={branchOD} onChange={e=>setBranchOD(+e.target.value||0)} />
        </div>
        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="Pitch (deg)"
                 value={pitch} onChange={e=>setPitch(+e.target.value||0)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Yaw (deg)"
                 value={yaw} onChange={e=>setYaw(+e.target.value||0)} />
        </div>
        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="Step (deg)"
                 value={stepDeg} onChange={e=>setStepDeg(+e.target.value||0)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Wrap (deg)"
                 value={wrapDeg} onChange={e=>setWrapDeg(+e.target.value||0)} />
        </div>
      </div>

      {/* canvases */}
      <div className="card">
        <canvas ref={refRun} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>
      <div className="card">
        <canvas ref={refBr} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>

      <div className="card">
        <div className="small">
          Dimensions (quick check): Run C ≈ <b>{(Math.PI*runOD).toFixed(2)}</b> mm ·
          Branch C ≈ <b>{(Math.PI*branchOD).toFixed(2)}</b> mm ·
          Tilts → Pitch <b>{pitch}</b>°, Yaw <b>{yaw}</b>°, Step <b>{stepDeg}</b>°
        </div>
        <div className="small" style={{ marginTop:6 }}>
          စက္ကူပတ်နည်း: <b>Run hole stencil</b> ကို run ပိုက်ပတ်ပြီး ellipse ကို ရိတ်/မှတ်ပါ။ <b>Branch cut stencil</b> ကို branch ပိုက်ပတ်ပြီး contour ကို ဖြတ်ပါ။
          အောက်ခြေ 0-360 တိုင်ရိယာက 30° တစ်ခါစီ mm တန်ဖိုးတွေ ပြထားပါတယ် (mm စာလုံးမထည့်ဘဲ ဂဏန်းဘဲ)။
        </div>
      </div>
    </div>
  );
    }
