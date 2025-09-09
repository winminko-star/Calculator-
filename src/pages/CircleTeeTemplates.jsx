// src/pages/CircleTeeTemplates.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/* ----------------- small math helpers ----------------- */
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isNum = (x) => Number.isFinite(x);

/* Branch axis unit-vector from pitch/yaw (run axis = +X)
   - pitch = 90° ⇒ branch ⟂ run (base = +Z)
   - yaw   = rotate around +X
   - then tilt by (90° - pitch) about +Y to make it oblique along X
*/
function axisFromPitchYaw(pitchDeg, yawDeg) {
  const yaw = rad(yawDeg || 0);
  const tilt = rad(90 - (pitchDeg || 90));
  // start from +Z
  let bx = 0, by = 0, bz = 1;        // (0,0,1)
  // yaw about +X
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  // (x, y cos - z sin, y sin + z cos)
  let ny = by * cy - bz * sy;
  let nz = by * sy + bz * cy;
  by = ny; bz = nz; // bx stays 0
  // tilt about +Y
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const nx = bx * ct + bz * st;   // new x
  const nz2 = -bx * st + bz * ct; // new z
  bx = nx; bz = nz2;
  // normalize
  const m = Math.hypot(bx, by, bz) || 1;
  return { x: bx / m, y: by / m, z: bz / m };
}

/* ---------- RUN-side sampling (unwrap on RUN) ----------
   We solve |(P × b)| = Rb, with P=(x, Rr cosθ, Rr sinθ) on RUN surface.
   This yields quadratic in x. We take the larger |root| as height h(θ) ≥ 0.
   u = Rr * θ   (wrap coordinate in mm).
*/
function sampleRunClosed(Rr, Rb, b, stepDeg = 30) {
  const out = [];
  const Acoef = 1 - b.x * b.x; // = by^2 + bz^2
  const A = (Math.abs(Acoef) < 1e-9) ? 1e-9 : Acoef; // avoid parallel-case

  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const th = rad(deg);
    const k = b.y * Math.cos(th) + b.z * Math.sin(th);
    const B = -2 * b.x * Rr * k;
    const C = Rr * Rr * (1 - k * k) - Rb * Rb;
    const D = B * B - 4 * A * C;
    if (D < 0) { out.push(null); continue; }
    const sD = Math.sqrt(D);
    const x1 = (-B + sD) / (2 * A);
    const x2 = (-B - sD) / (2 * A);
    const h = Math.max(Math.abs(x1), Math.abs(x2)); // symmetric height
    out.push({ u: Rr * th, h, deg });
  }
  return out;
}

/* ---------- BRANCH-side sampling (unwrap on BRANCH) ----------
   Local branch frame: (b, e1, e2). For branch generatrix angle φ:
   Q = s*b + Rb*(cosφ*e1 + sinφ*e2). Distance to RUN axis (X-axis):
   (Qy^2 + Qz^2) = Rr^2 → quadratic in s. Take larger |s|.
   ub = Rb * φ   (wrap coordinate on BRANCH).
*/
function orthoBasis(b) {
  const ex = { x: 1, y: 0, z: 0 };
  let e1 = cross(b, ex);
  const n1 = norm(e1);
  if (n1 < 1e-8) {
    // b ∥ ex ⇒ pick ey
    e1 = cross(b, { x: 0, y: 1, z: 0 });
  }
  e1 = unit(e1);
  const e2 = unit(cross(b, e1));
  return { e1, e2 };
}
function cross(a, c) { return { x: a.y * c.z - a.z * c.y, y: a.z * c.x - a.x * c.z, z: a.x * c.y - a.y * c.x }; }
function norm(v) { return Math.hypot(v.x, v.y, v.z); }
function unit(v) { const m = norm(v) || 1; return { x: v.x / m, y: v.y / m, z: v.z / m }; }

function sampleBranchFish(Rr, Rb, b, stepDeg = 30) {
  const { e1, e2 } = orthoBasis(b);
  const out = [];
  const Ayz = b.y * b.y + b.z * b.z;   // coef of s^2
  const A = (Ayz < 1e-9) ? 1e-9 : Ayz;

  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const ph = rad(deg);
    const wy = e1.y * Math.cos(ph) + e2.y * Math.sin(ph);
    const wz = e1.z * Math.cos(ph) + e2.z * Math.sin(ph);
    const B = 2 * Rb * (b.y * wy + b.z * wz);
    const C = Rb * Rb * (wy * wy + wz * wz) - Rr * Rr;
    const D = B * B - 4 * A * C;
    if (D < 0) { out.push(null); continue; }
    const sD = Math.sqrt(D);
    const s1 = (-B + sD) / (2 * A);
    const s2 = (-B - sD) / (2 * A);
    const h = Math.max(Math.abs(s1), Math.abs(s2)); // axial height from baseline
    out.push({ u: Rb * ph, h, deg });
  }
  return out;
}

/* ----------------- canvas drawers ----------------- */
function drawRunClosed(canvas, Rr, samples, title = "Run-hole stencil (wrap on RUN)") {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640, H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  const valid = samples.filter(Boolean);
  if (!valid.length) { ctx.fillStyle="#64748b"; ctx.fillText("No domain", 12, 20); return; }

  const pad = 16;
  const C = 2 * Math.PI * Rr; // wrap length
  const maxH = Math.max(...valid.map(p => p.h), 1);
  const X = (u) => pad + (u / C) * (W - 2 * pad);
  const Y = (y) => H - pad - ((y + maxH) / (2 * maxH)) * (H - 2 * pad);

  // grid each 30°
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  const stepU = C / 12;
  for (let u = 0; u <= C + 1e-6; u += stepU) { ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H - pad); ctx.stroke(); }

  // baseline y=0
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad, Y(0)); ctx.stroke();

  // closed polygon (top + mirrored bottom)
  const top = valid;
  const bot = [...top].reverse().map(p => ({ u: p.u, h: -p.h }));

  ctx.beginPath();
  ctx.moveTo(X(top[0].u), Y(top[0].h));
  top.slice(1).forEach(p => ctx.lineTo(X(p.u), Y(p.h)));
  bot.forEach(p => ctx.lineTo(X(p.u), Y(p.h)));
  ctx.closePath();
  ctx.fillStyle = "rgba(14,165,233,0.08)"; ctx.fill();
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.5; ctx.stroke();

  // degree labels bottom + height pill on crest
  ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#0f172a";
  for (let i = 0; i < top.length; i++) {
    const p = top[i]; if (!p) continue;
    const x = X(p.u);
    ctx.fillText(String(p.deg), x, H - 4);
    // small pill
    const txt = String(Math.round(p.h));
    const y = Y(p.h) - 10;
    const tw = Math.ceil(ctx.measureText(txt).width) + 8, th = 18, r = 8, rx = x - tw / 2, ry = y - th + 4;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + tw - r, ry);
    ctx.quadraticCurveTo(rx + tw, ry, rx + tw, ry + r);
    ctx.lineTo(rx + tw, ry + th - r);
    ctx.quadraticCurveTo(rx + tw, ry + th, rx + tw - r, ry + th);
    ctx.lineTo(rx + r, ry + th);
    ctx.quadraticCurveTo(rx, ry + th, rx, ry + th - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a"; ctx.fillText(txt, x, y);
  }

  // frame + title
  ctx.strokeStyle = "#cbd5e1"; ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  ctx.font = "600 14px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "#0f172a";
  ctx.fillText(title, pad, 18);
}

function drawBranchFish(canvas, Rb, samples, title = "Branch-cut stencil (wrap on BRANCH)") {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640, H = canvas.clientHeight || 220;
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  const valid = samples.filter(Boolean);
  if (!valid.length) { ctx.fillStyle="#64748b"; ctx.fillText("No domain", 12, 20); return; }

  const pad = 16;
  const C = 2 * Math.PI * Rb;
  const maxH = Math.max(...valid.map(p => p.h), 1);
  const X = (u) => pad + (u / C) * (W - 2 * pad);
  const Y = (y) => H - pad - (y / maxH) * (H - 2 * pad); // 0..max

  // grid 30°
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  const stepU = C / 12;
  for (let u = 0; u <= C + 1e-6; u += stepU) { ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H - pad); ctx.stroke(); }

  // baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad, Y(0)); ctx.stroke();

  // curve
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(X(valid[0].u), Y(valid[0].h));
  valid.slice(1).forEach(p => ctx.lineTo(X(p.u), Y(p.h)));
  ctx.stroke();

  // labels
  ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#0f172a";
  for (let i = 0; i < valid.length; i++) {
    const p = valid[i];
    const x = X(p.u);
    ctx.fillText(String(p.deg), x, H - 4);
    const txt = String(Math.round(p.h));
    const y = Y(p.h) - 10;
    const tw = Math.ceil(ctx.measureText(txt).width) + 8, th = 18, r = 8, rx = x - tw / 2, ry = y - th + 4;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + tw - r, ry);
    ctx.quadraticCurveTo(rx + tw, ry, rx + tw, ry + r);
    ctx.lineTo(rx + tw, ry + th - r);
    ctx.quadraticCurveTo(rx + tw, ry + th, rx + tw - r, ry + th);
    ctx.lineTo(rx + r, ry + th);
    ctx.quadraticCurveTo(rx, ry + th, rx, ry + th - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a"; ctx.fillText(txt, x, y);
  }

  // frame + title
  ctx.strokeStyle = "#cbd5e1"; ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  ctx.font = "600 14px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "#0f172a";
  ctx.fillText(title, pad, 18);
}

/* ----------------- Main Component ----------------- */
export default function CircleTeeTemplates() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("60");     // mm
  const [brOD,  setBrOD]  = useState("60");     // mm
  const [pitch, setPitch] = useState("90");     // deg
  const [yaw,   setYaw]   = useState("0");      // deg
  const [step,  setStep]  = useState("30");     // deg step (grid)

  const cRun = useRef(null);
  const cBr  = useRef(null);

  const [runSamples, setRunSamples] = useState([]);
  const [brSamples,  setBrSamples]  = useState([]);

  const compute = () => {
    const Rr = clamp(Number(runOD)/2, 0.1, 1e6);
    const Rb = clamp(Number(brOD) /2, 0.1, 1e6);
    const st = clamp(Number(step)||30, 5, 90);
    const ax = axisFromPitchYaw(Number(pitch)||90, Number(yaw)||0);
    const sRun = sampleRunClosed(Rr, Rb, ax, st);
    const sBr  = sampleBranchFish(Rr, Rb, ax, st);
    setRunSamples(sRun);
    setBrSamples(sBr);
    drawRunClosed(cRun.current, Rr, sRun);
    drawBranchFish(cBr.current, Rb, sBr);
  };

  useEffect(()=>{ compute(); /* on first mount */ }, []);

  const clearAll = () => {
    setTitle("");
    setRunOD(""); setBrOD("");
    setPitch("90"); setYaw("0"); setStep("30");
    setRunSamples([]); setBrSamples([]);
    const ctx1 = cRun.current?.getContext?.("2d"); const ctx2 = cBr.current?.getContext?.("2d");
    if (ctx1) ctx1.clearRect(0,0,cRun.current.width,cRun.current.height);
    if (ctx2) ctx2.clearRect(0,0,cBr.current.width,cBr.current.height);
  };

  const save = async () => {
    const now = Date.now();
    const expiresAt = now + 90*24*3600*1000;
    await set(push(dbRef(db, "teeTemplates")), {
      createdAt: now, expiresAt,
      title: title || "Untitled",
      inputs: {
        runOD: Number(runOD), branchOD: Number(brOD),
        pitch: Number(pitch), yaw: Number(yaw), step: Number(step)
      },
      run: runSamples,     // [{u,h,deg}|null]
      branch: brSamples,   // [{u,h,deg}|null]
    });
    alert("Saved ✅");
  };

  // redraw when window resized
  useEffect(()=>{
    const onR=()=>{ if(runSamples.length) drawRunClosed(cRun.current, Number(runOD)/2, runSamples);
                    if(brSamples.length)  drawBranchFish(cBr.current,  Number(brOD)/2,  brSamples); };
    window.addEventListener("resize", onR);
    return ()=>window.removeEventListener("resize", onR);
  }, [runSamples, brSamples, runOD, brOD]);

  return (
    <div className="grid">
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">🧩 Pipe Tee Templates</div>
        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="input" inputMode="decimal" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
        <input className="input" inputMode="decimal" placeholder="Branch OD (mm)" value={brOD} onChange={e=>setBrOD(e.target.value)} />
        <div className="row">
          <input className="input" inputMode="decimal" placeholder="Pitch (deg)" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Yaw (deg)"   value={yaw}   onChange={e=>setYaw(e.target.value)} />
        </div>
        <input className="input" inputMode="decimal" placeholder="Step (deg, e.g. 30)" value={step} onChange={e=>setStep(e.target.value)} />

        <div className="row" style={{ gap:8 }}>
          <button className="btn" onClick={compute}>🔁 Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#6b7280" }}>🧹 Clear</button>
        </div>

        <div className="small" style={{ color:"#475569" }}>
          • စက္ကူ/တိရိစ္ဆာန်လိပ်ကို <b>360°</b> ပတ်ပါ — 0° seam ကို pipe seam နေရာနဲ့ တင်းတင်းချိတ်ပါ။<br/>
          • Run-hole stencil = RUN ပေါ်မှာပတ်ဖို့ — ပိတ်ကွင်း outline ကို အဖြဲပြပါ။<br/>
          • Branch-cut stencil = BRANCH ပေါ်မှာပတ်ဖို့ — fish-mouth cut outline ကိုပြပါ။
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>
      <div className="card">
        <canvas ref={cBr}  style={{ width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>

      <div className="card small">
        <b>Hint:</b> Degree အမှတ် (0°, 30°, 60° …) တိုင်းမှာ **height(mm)** pill ကို အတိအကျ အကွာအဝေးလိုက်
        မှတ်ပြီး ကတ်လိုင်းဆွဲပါ — Run-hole (ပိတ်ကွင်း) အတိုင်းဖောက် ၊ Branch-cut ကိုလိုက်ဖြတ်နိုင်ပါတယ်။
      </div>
    </div>
  );
    }
