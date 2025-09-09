// src/pages/CircleTeeTemplates.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/**
 * Pipe tee templates (Run-hole & Branch-cut)
 * Units: mm, degrees. Step = degree sampling (e.g., 30°).
 * Math:
 *  - Run cylinder = radius Rr, axis = +Z.
 *  - Branch axis unit u = (cos(yaw)*sin(p), sin(yaw)*sin(p), cos(p)).
 *  - Intersection z(θ) = ( cos(p)*Rr*cosΔ ± sqrt(Rb^2 - Rr^2*sin^2Δ ) ) / sin(p)
 *        where Δ = θ - yaw, θ∈[0,360).
 *  - Unwrap (RUN): u = Rr * θ(rad), v = z.
 *  - Unwrap (BRANCH): for 3D point p=(x,y,z) take
 *        t = p·u  (axial on branch),
 *        r = p - t u,
 *        φ = atan2( r·e2 , r·e1 ), with {e1,e2,u} orthonormal.
 *        uB = Rb * φ, vB = t.
 */

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const nice = (x) => Math.round(x * 100) / 100;

function makeOrthoBasis(u) {
  // pick any vector not collinear with u
  const a = Math.abs(u.z) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  // e1 = normalize( a × u ), e2 = u × e1
  const e1x = a.y * u.z - a.z * u.y;
  const e1y = a.z * u.x - a.x * u.z;
  const e1z = a.x * u.y - a.y * u.x;
  const n1 = Math.hypot(e1x, e1y, e1z) || 1;
  const e1 = { x: e1x / n1, y: e1y / n1, z: e1z / n1 };
  const e2 = {
    x: u.y * e1.z - u.z * e1.y,
    y: u.z * e1.x - u.x * e1.z,
    z: u.x * e1.y - u.y * e1.x,
  };
  return { e1, e2 };
}

function computeTemplates({ runOD, branchOD, pitchDeg, yawDeg, stepDeg }) {
  const Rr = runOD / 2;
  const Rb = branchOD / 2;
  const p = rad(clamp(pitchDeg, 0.0001, 179.9999)); // avoid 0/180 singular
  const y = rad(yawDeg % 360);
  const s = Math.sin(p), c = Math.cos(p);

  // branch axis unit vector
  const u = { x: Math.cos(y) * s, y: Math.sin(y) * s, z: c };
  const { e1, e2 } = makeOrthoBasis(u);

  const ptsRun = [];     // [{u, v}]  (unwrap on RUN)  u in mm, v in mm
  const ptsBranch = [];  // [{u, v}]  (unwrap on BRANCH)

  for (let d = 0; d <= 360; d += stepDeg) {
    const θ = rad(d);
    const Δ = θ - y;

    // sqrtArg = Rb^2 - Rr^2 * sin^2(Δ)
    const sqrtArg = Rb * Rb - (Rr * Rr) * (Math.sin(Δ) ** 2);
    if (sqrtArg < 0) {
      // No real intersection (very rare due to rounding) → skip this station
      ptsRun.push(null);
      ptsBranch.push(null);
      continue;
    }
    const zTop = (c * Rr * Math.cos(Δ) + Math.sqrt(sqrtArg)) / s; // outer edge
    // RUN unwrap
    const uRun = Rr * θ;  // arc length
    const vRun = zTop;

    // Back to 3D point on RUN surface
    const x = Rr * Math.cos(θ);
    const yx = Rr * Math.sin(θ);
    const p3 = { x, y: yx, z: zTop };

    // Project to BRANCH coordinates
    const t = p3.x * u.x + p3.y * u.y + p3.z * u.z; // axial along branch
    const rx = p3.x - t * u.x, ry = p3.y - t * u.y, rz = p3.z - t * u.z;
    const a1 = rx * e1.x + ry * e1.y + rz * e1.z;
    const a2 = rx * e2.x + ry * e2.y + rz * e2.z;
    let φ = Math.atan2(a2, a1);
    if (φ < 0) φ += 2 * Math.PI;

    const uBr = Rb * φ;
    const vBr = t;

    ptsRun.push({ u: uRun, v: vRun, deg: d });
    ptsBranch.push({ u: uBr, v: vBr, deg: d });
  }

  // Sort by u (unwrap axis)
  ptsRun.sort((a, b) => (a?.u ?? 0) - (b?.u ?? 0));
  ptsBranch.sort((a, b) => (a?.u ?? 0) - (b?.u ?? 0));

  // simple stations list at every step for labels
  const stations = [];
  for (let i = 0; i < ptsRun.length; i++) {
    const r = ptsRun[i], b = ptsBranch[i];
    if (!r || !b) continue;
    stations.push({
      deg: r.deg,
      run: { u: nice(r.u), v: nice(r.v) },
      branch: { u: nice(b.u), v: nice(b.v) },
    });
  }

  return { ptsRun, ptsBranch, stations, Rr, Rb };
}

/* ===== drawing helpers ===== */
function drawTemplate(canvas, pts, title, circumference, stations, color = "#0ea5e9") {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 680;
  const H = canvas.clientHeight || 260;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // padding and scales
  const pad = 18;
  const minU = 0, maxU = circumference;
  let minV = Infinity, maxV = -Infinity;
  pts.forEach(p => { if (p) { minV = Math.min(minV, p.v); maxV = Math.max(maxV, p.v); }});
  if (!isFinite(minV)) { ctx.fillStyle="#64748b"; ctx.fillText("No domain", 12, 22); return; }
  const head = Math.max(6, 0.08 * (maxV - minV || 1));
  minV -= head; maxV += head;

  const X = (u) => pad + (u - minU) * (W - 2 * pad) / Math.max(1e-6, maxU - minU);
  const Y = (v) => H - pad - (v - minV) * (H - 2 * pad) / Math.max(1e-6, maxV - minV);

  // grid at every 30°
  const stepU = circumference / 12;
  ctx.strokeStyle = "#eef2f7"; ctx.lineWidth = 1;
  for (let u = minU; u <= maxU + 1e-6; u += stepU) {
    ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H - pad); ctx.stroke();
  }
  // border + baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

  // title
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 14px system-ui";
  ctx.fillText(title, pad, pad - 4);

  // polyline
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  let first = true;
  ctx.beginPath();
  pts.forEach(p => {
    if (!p) { first = true; return; }
    const x = X(p.u), y = Y(p.v);
    if (first) { ctx.moveTo(x, y); first = false; }
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // station labels (deg at bottom, height on curve)
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  stations.forEach(s => {
    const pr = pts.find(p => p && nice(p.u) === s.run.u); // approx match
    if (!pr) return;
    const x = X(pr.u), y = Y(pr.v);
    // height pill
    const t = String(nice(pr.v));
    const tw = Math.ceil(ctx.measureText(t).width) + 10, th = 18, r = 9;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
    const bx = x - tw/2, by = y - th - 4;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + tw - r, by);
    ctx.quadraticCurveTo(bx + tw, by, bx + tw, by + r);
    ctx.lineTo(bx + tw, by + th - r);
    ctx.quadraticCurveTo(bx + tw, by + th, bx + tw - r, by + th);
    ctx.lineTo(bx + r, by + th);
    ctx.quadraticCurveTo(bx, by + th, bx, by + th - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a"; ctx.fillText(t, x, by + th - 4);

    // degree bottom
    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(s.deg), X(s.run.u), H - pad + 14);
  });
}

/* ===== Page component ===== */
export default function CircleTeeTemplates() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState(60);       // mm
  const [branchOD, setBranchOD] = useState(60); // mm
  const [pitchDeg, setPitchDeg] = useState(90); // 90 = perpendicular
  const [yawDeg, setYawDeg] = useState(0);      // seam direction
  const [stepDeg, setStepDeg] = useState(30);

  const cRun = useRef(null);
  const cBr = useRef(null);

  const [state, setState] = useState(null); // computed data for save + table

  const update = () => {
    const data = computeTemplates({ runOD: +runOD, branchOD: +branchOD, pitchDeg: +pitchDeg, yawDeg: +yawDeg, stepDeg: +stepDeg });
    setState(data);
  };

  useEffect(update, []); // initial

  useEffect(() => {
    if (!state) return;
    const Crun = Math.PI * (+runOD);
    const Cbr  = Math.PI * (+branchOD);
    drawTemplate(cRun.current, state.ptsRun, "Run-hole stencil (wrap on RUN)", Crun, state.stations, "#0ea5e9");
    drawTemplate(cBr.current, state.ptsBranch, "Branch-cut stencil (wrap on BRANCH)", Cbr, state.stations, "#22c55e");
  }, [state, runOD, branchOD]);

  const clearAll = () => {
    setTitle("");
    setRunOD(60); setBranchOD(60);
    setPitchDeg(90); setYawDeg(0); setStepDeg(30);
    setState(null);
    setTimeout(update, 0);
  };

  const save = async () => {
    if (!state) { alert("Nothing to save yet."); return; }
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    await dbSet(push(dbRef(db, "teeTemplates")), {
      createdAt: now,
      expiresAt,
      title: title || "Tee template",
      inputs: { runOD: +runOD, branchOD: +branchOD, pitchDeg: +pitchDeg, yawDeg: +yawDeg, stepDeg: +stepDeg },
      run: state.ptsRun,         // [{u,v,deg}...]
      branch: state.ptsBranch,   // [{u,v,deg}...]
      stations: state.stations,  // for labels
      meta: {
        runC: Math.PI * (+runOD),
        branchC: Math.PI * (+branchOD)
      }
    });
    alert("Saved ✅ — check All Review.");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} style={{ flex: "1 1 200px" }} />
          <input className="input" type="number" step="any" value={runOD} onChange={e=>setRunOD(e.target.value)} placeholder="Run OD (mm)"/>
          <input className="input" type="number" step="any" value={branchOD} onChange={e=>setBranchOD(e.target.value)} placeholder="Branch OD (mm)"/>
          <input className="input" type="number" step="any" value={pitchDeg} onChange={e=>setPitchDeg(e.target.value)} placeholder="Pitch (deg)"/>
          <input className="input" type="number" step="any" value={yawDeg} onChange={e=>setYawDeg(e.target.value)} placeholder="Yaw (deg)"/>
          <input className="input" type="number" step="1" value={stepDeg} onChange={e=>setStepDeg(e.target.value)} placeholder="Step (deg)"/>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 8 }}>
          <button className="btn" onClick={update}>🔄 Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#64748b" }}>🧹 Clear</button>
        </div>

        <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>
          • Pipe ကို 360° ပတ်ပတ်လည် unwrap လုပ်ပြီး baseline (အောက်ခြေ) က **height(mm)** ကို label တင်ထားပါတယ်
          — step အလိုက် (ဥပမာ 30°) integer mm လက်ခံလို့ လက်မှတ်ရိုက်ရသာပါ။<br/>
          • <b>Run-hole</b> stencil ကို RUN လျှင်ပတ် — အပေါက် outline ။ <b>Branch-cut</b> stencil ကို BRANCH လျှင်ပတ် — fish-mouth cut outline ။
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{ width:"100%", height:280, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>
      <div className="card">
        <canvas ref={cBr} style={{ width:"100%", height:280, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>

      {state && (
        <div className="card">
          <div className="page-title">Measurements (every {stepDeg}°)</div>
          <div className="small" style={{overflowX:"auto"}}>
            <table className="table">
              <thead>
                <tr>
                  <th>Deg</th>
                  <th>Run: u (mm)</th><th>Run: height (mm)</th>
                  <th>Branch: u (mm)</th><th>Branch: height (mm)</th>
                </tr>
              </thead>
              <tbody>
                {state.stations.map((s, i)=>(
                  <tr key={i}>
                    <td>{s.deg}</td>
                    <td>{s.run.u}</td><td>{s.run.v}</td>
                    <td>{s.branch.u}</td><td>{s.branch.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="small" style={{ marginTop:8 }}>
            Dimensions — Run C ≈ <b>{nice(Math.PI*runOD)}</b> mm · Branch C ≈ <b>{nice(Math.PI*branchOD)}</b> mm · Tilts → Pitch {pitchDeg}°, Yaw {yawDeg}°, Step {stepDeg}°
          </div>
        </div>
      )}
    </div>
  );
    }
