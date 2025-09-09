// src/pages/TeeTrueTemplates.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/* ===================== math helpers (true intersection) ===================== */
// deg <-> rad
const D2R = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// direction of branch axis relative to run-axis (run-axis = +X)
function branchDir(pitchDeg, yawDeg) {
  const phi = D2R(clamp(pitchDeg, 0.0001, 179.9999)); // angle between axes
  const psi = D2R(yawDeg);                              // rotation around run-axis
  return {
    x: Math.cos(phi),
    y: Math.sin(phi) * Math.cos(psi),
    z: Math.sin(phi) * Math.sin(psi),
  }; // unit by construction
}

// distance-squared from point P to a line through origin, dir d
function dist2ToLine(P, d) {
  const dot = P.x * d.x + P.y * d.y + P.z * d.z;
  return P.x * P.x + P.y * P.y + P.z * P.z - dot * dot;
}

// Solve quadratic ax^2 + bx + c = 0 (returns array, maybe empty)
function solveQuad(a, b, c) {
  if (Math.abs(a) < 1e-12) { // linear
    if (Math.abs(b) < 1e-12) return [];
    return [-c / b];
  }
  const D = b * b - 4 * a * c;
  if (D < -1e-12) return [];
  const sD = Math.sqrt(Math.max(0, D));
  return [(-b - sD) / (2 * a), (-b + sD) / (2 * a)];
}

/* ---- Run-hole: unwrap around RUN (y,z circle; find x where intersects branch) ----
   Run cylinder radius Rr; param φ (deg on run). Point on surface: (x, Rr cosφ, Rr sinφ).
   Solve for x with |P|^2 - (P·d)^2 = Rb^2  → quadratic in x.
*/
function sampleRunStencil(Rr, Rb, pitchDeg, yawDeg, stepDeg = 30) {
  const d = branchDir(pitchDeg, yawDeg);
  const A = Math.cos(D2R(pitchDeg));
  const s2 = 1 - A * A; // = sin^2(pitch)
  const psi = D2R(yawDeg);
  const pts = [];
  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const φ = D2R(deg);
    const B = Rr * Math.sin(D2R(pitchDeg)) * Math.cos(φ - psi);
    // s2 x^2 - 2 A B x + (Rr^2 - B^2 - Rb^2) = 0
    const roots = solveQuad(s2, -2 * A * B, Rr * Rr - B * B - Rb * Rb);
    if (roots.length === 0) {
      pts.push({ deg, h: null }); // out of domain
      continue;
    }
    // Two intersections along +X/−X. For run-hole outline we need the "near seam"
    // pick the root with smaller |x| (hole centered at x≈0)
    const x = roots.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    pts.push({ deg, h: x }); // height along RUN axis (mm)
  }
  return pts;
}

/* ---- Branch-cut: unwrap around BRANCH (around branch axis; find t on branch axis)
   Build orthonormal basis (u,v,d). Point on branch surface: P = t d + Rb (u cosθ + v sinθ).
   Condition: distance of P to RUN axis (X-axis) equals Rr  →  sqrt(P_y^2+P_z^2)=Rr.
   This gives quadratic in t (since P_y,P_z are linear in t).
*/
function sampleBranchStencil(Rr, Rb, pitchDeg, yawDeg, stepDeg = 30) {
  const d = branchDir(pitchDeg, yawDeg);
  // helper to build u,v ⟂ d
  let h = { x: 0, y: 1, z: 0 };
  if (Math.abs(h.x * d.x + h.y * d.y + h.z * d.z) > 0.99) h = { x: 0, y: 0, z: 1 };
  // u = normalize(h - (h·d)d)
  const hd = h.x * d.x + h.y * d.y + h.z * d.z;
  let u = { x: h.x - hd * d.x, y: h.y - hd * d.y, z: h.z - hd * d.z };
  const un = Math.hypot(u.x, u.y, u.z) || 1;
  u = { x: u.x / un, y: u.y / un, z: u.z / un };
  // v = d × u
  const v = {
    x: d.y * u.z - d.z * u.y,
    y: d.z * u.x - d.x * u.z,
    z: d.x * u.y - d.y * u.x,
  };

  const pts = [];
  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const θ = D2R(deg);
    // P = t d + Rb( u cosθ + v sinθ )
    // distance to X-axis = sqrt(P_y^2 + P_z^2) = Rr
    // → (t d_y + Rb( u_y c + v_y s ))^2 + (t d_z + Rb( u_z c + v_z s ))^2 = Rr^2
    const c = Math.cos(θ), s = Math.sin(θ);
    const ay = d.y, az = d.z;
    const by = Rb * (u.y * c + v.y * s);
    const bz = Rb * (u.z * c + v.z * s);
    // (ay t + by)^2 + (az t + bz)^2 = Rr^2
    const a = ay * ay + az * az;
    const b = 2 * (ay * by + az * bz);
    const c0 = by * by + bz * bz - Rr * Rr;
    const roots = solveQuad(a, b, c0);
    if (roots.length === 0) { pts.push({ deg, h: null }); continue; }
    // choose t near 0 (branch axis passes through origin at run center)
    const t = roots.sort((A, B) => Math.abs(A) - Math.abs(B))[0];
    pts.push({ deg, h: t }); // height along BRANCH axis (mm)
  }
  return pts;
}

/* ===================== Canvas drawer ===================== */
function drawUnwrap(canvas, samples, title, maxHForGrid) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // bounds
  const pad = 26;
  const minX = 0, maxX = 360;
  // vertical bounds from samples (ignore null)
  let minY = 0, maxY = 0;
  samples.forEach(p => { if (p.h != null) { minY = Math.min(minY, p.h); maxY = Math.max(maxY, p.h); } });
  if (Math.abs(maxY - minY) < 1e-6) { maxY = Math.max(1, maxHForGrid || 50); minY = -maxY; }
  const head = 0.1 * (maxY - minY || 1);
  minY -= head; maxY += head;

  const X = (deg) => pad + ((deg - minX) * (W - 2 * pad)) / (maxX - minX);
  const Y = (h) => H - pad - ((h - minY) * (H - 2 * pad)) / (maxY - minY);

  // grid
  ctx.strokeStyle = "#eef2f7"; ctx.lineWidth = 1;
  for (let g = 0; g <= 360; g += 30) {
    ctx.beginPath(); ctx.moveTo(X(g), pad); ctx.lineTo(X(g), H - pad); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad, Y(0)); ctx.stroke();

  // title
  ctx.fillStyle = "#0f172a"; ctx.font = "600 14px system-ui";
  ctx.fillText(title, pad, pad - 8);

  // curve
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  let first = true;
  samples.forEach((p, i) => {
    if (p.h == null) { first = true; return; }
    const x = X(p.deg), y = Y(p.h);
    if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // points + labels every 30°
  ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
  samples.forEach((p) => {
    if (p.h == null) return;
    const x = X(p.deg), y = Y(p.h);
    // marker
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    // pill label (integer mm)
    const t = String(Math.round(p.h));
    const tw = Math.ceil(ctx.measureText(t).width) + 10, th = 18, r = 8;
    const rx = x - tw / 2, ry = y - th - 6;
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
    ctx.fillStyle = "#0f172a"; ctx.fillText(t, x, ry + th - 5);
    // degree on baseline
    ctx.fillStyle = "#334155"; ctx.fillText(String(p.deg), x, H - 6);
  });

  // axis border
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
}

/* ===================== Main component ===================== */
export default function TeeTrueTemplates() {
  // inputs
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState(60);     // mm
  const [branchOD, setBranchOD] = useState(60);
  const [pitch, setPitch] = useState(90);     // deg (angle between axes)
  const [yaw, setYaw] = useState(0);          // deg (rotation about run axis)
  const [step, setStep] = useState(30);       // deg sample
  const [run, setRun] = useState([]);         // [{deg,h}]
  const [branch, setBranch] = useState([]);   // [{deg,h}]

  const cRun = useRef(null);
  const cBr  = useRef(null);

  const compute = () => {
    const Rr = (Number(runOD) || 0) / 2;
    const Rb = (Number(branchOD) || 0) / 2;
    const st = Math.max(1, Math.round(Number(step) || 30));
    const runS = sampleRunStencil(Rr, Rb, Number(pitch), Number(yaw), st);
    const brS  = sampleBranchStencil(Rr, Rb, Number(pitch), Number(yaw), st);
    setRun(runS); setBranch(brS);
  };

  useEffect(() => { compute(); /* auto first render */ }, []);

  useEffect(() => {
    drawUnwrap(cRun.current, run, "Run-hole stencil (wrap on RUN)", (Number(branchOD)||0)/2);
    drawUnwrap(cBr.current,  branch, "Branch-cut stencil (wrap on BRANCH)", (Number(runOD)||0)/2);
  }, [run, branch, runOD, branchOD]);

  const clearAll = () => { setRun([]); setBranch([]); };

  const save = async () => {
    const now = Date.now();
    const rec = {
      createdAt: now,
      expiresAt: now + 90*24*60*60*1000,
      title: title || "Untitled Tee",
      inputs: { runOD: Number(runOD), branchOD: Number(branchOD), pitch: Number(pitch), yaw: Number(yaw), step: Number(step) },
      // store raw arrays & an easy “stations” array for AllReview preview labels
      run, branch,
      stations: Array.from({length: Math.floor(360/Math.max(1,Number(step)))+1}, (_,i)=>({
        deg: i*Math.max(1,Number(step)),
        // unwrap positions (mm along circumference)
        uRun: (Number(runOD)*Math.PI/180) * (i*Math.max(1,Number(step))),
        uBranch: (Number(branchOD)*Math.PI/180) * (i*Math.max(1,Number(step))),
        vRun: run[i]?.h ?? null,
        vBranch: branch[i]?.h ?? null,
      })),
    };
    await dbSet(push(dbRef(db, "teeTemplates")), rec);
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates (true intersection)</div>
        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />

        <div className="row" style={{ marginTop:8 }}>
          <input className="input" type="number" inputMode="numeric" value={runOD}
                 onChange={e=>setRunOD(e.target.value)} placeholder="Run OD (mm)" />
          <input className="input" type="number" inputMode="numeric" value={branchOD}
                 onChange={e=>setBranchOD(e.target.value)} placeholder="Branch OD (mm)" />
        </div>

        <div className="row" style={{ marginTop:8 }}>
          <input className="input" type="number" inputMode="numeric" value={pitch}
                 onChange={e=>setPitch(e.target.value)} placeholder="Pitch (°)" />
          <input className="input" type="number" inputMode="numeric" value={yaw}
                 onChange={e=>setYaw(e.target.value)} placeholder="Yaw (°)" />
          <input className="input" type="number" inputMode="numeric" value={step}
                 onChange={e=>setStep(e.target.value)} placeholder="Step (°)" />
        </div>

        <div className="row" style={{ marginTop:10, gap:10, flexWrap:"wrap" }}>
          <button className="btn" onClick={compute}>🔄 Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#475569" }}>🧹 Clear</button>
        </div>

        <div className="small" style={{ marginTop:10, lineHeight:1.4 }}>
          • 360° အတွက် degree step လိုအပ်သလို ထားပါ — graph ထဲတွင် label တွေကို 30° အောက်တန်းပြ<br/>
          • <b>Run-hole</b> stencil ကို <b>RUN</b> ပိုက်ပတ် — အလယ်လိုင်းက baseline, pill က <b>height (mm)</b><br/>
          • <b>Branch-cut</b> stencil ကို <b>BRANCH</b> ပိုက်ပတ် — fish-mouth cut outline
        </div>
      </div>

      {/* canvases */}
      <div className="card">
        <canvas ref={cRun} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }}/>
      </div>
      <div className="card">
        <canvas ref={cBr} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }}/>
      </div>

      {/* tables (integer mm) */}
      <div className="card">
        <div className="page-title">Run-hole (mm @ degree)</div>
        <div className="row" style={{ flexWrap:"wrap", gap:6 }}>
          {run.map(p => (
            <div key={`r${p.deg}`} className="pill">{p.deg}° → <b>{p.h==null?"–":Math.round(p.h)}</b></div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="page-title">Branch-cut (mm @ degree)</div>
        <div className="row" style={{ flexWrap:"wrap", gap:6 }}>
          {branch.map(p => (
            <div key={`b${p.deg}`} className="pill">{p.deg}° → <b>{p.h==null?"–":Math.round(p.h)}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}
