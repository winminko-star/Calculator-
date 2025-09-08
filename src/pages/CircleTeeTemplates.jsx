import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/** Geometry helper:
 * Run radius Rr, Branch radius Rb, intersection at tilt θ (deg) in run–branch plane (yaw=0).
 * We generate station angles φ (0..360) around the run.  Unwrap distance u = Rr*φ (radians).
 * For each φ, surface intersection height v(φ) from baseline is:
 *   v_run(φ) =  Rb * cos(φ - 180°) * tan(θ)   (classic saddle when yaw=0)
 * Then clamp outside |cos|>1 domain → null (gap).
 * Stencil-outline (closed curve) = mirrored top/bottom around midline to allow CUT-OUT.
 */

const deg2rad = (d) => (d * Math.PI) / 180;
const rad2deg = (r) => (r * 180) / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const round = (x) => Math.round(x * 100) / 100;

function generateStations(Rr, Rb, tiltDeg, stepDeg = 15) {
  const θ = deg2rad(tiltDeg);
  const circRun = 2 * Math.PI * Rr;

  const stations = [];
  for (let φdeg = 0; φdeg <= 360; φdeg += stepDeg) {
    const φ = deg2rad(φdeg);
    // height from baseline on RUN unwrap (mm)
    const v = Rb * Math.cos(φ - Math.PI) * Math.tan(θ); // can be ±
    const u = (φ / (2 * Math.PI)) * circRun; // mm along band
    stations.push({ φdeg, u, v });
  }
  return { stations, circRun };
}

function buildRunHoleOutline(Rr, Rb, tiltDeg, samplesDeg = 5) {
  // Create a closed loop path (top curve forward, bottom curve back) for a printable cut-out.
  const { stations, circRun } = generateStations(Rr, Rb, tiltDeg, samplesDeg);
  const top = stations.map((s) => ({ u: s.u, v: s.v }));
  const bot = [...stations].reverse().map((s) => ({ u: s.u, v: -s.v }));
  const poly = [...top, ...bot]; // closed outline
  return { poly, circRun };
}

function buildBranchCutCurve(Rr, Rb, tiltDeg, samplesDeg = 5) {
  // On the BRANCH wrap, profile height vs arc along branch circumference.
  // Symmetric with run equation swapping radii.
  const θ = deg2rad(tiltDeg);
  const circBr = 2 * Math.PI * Rb;
  const pts = [];
  for (let φdeg = 0; φdeg <= 360; φdeg += samplesDeg) {
    const φ = deg2rad(φdeg);
    const v = Rr * Math.cos(φ - Math.PI) * Math.tan(θ);
    const u = (φ / (2 * Math.PI)) * circBr;
    pts.push({ u, v });
  }
  return { pts, circBr };
}

/* ---------- Canvas drawer (band with grid + labels) ---------- */
function drawBand(canvas, poly, circ, title, showClosed = false) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  const pad = 18;
  if (!poly?.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui";
    ctx.fillText("No data", 12, 22);
    return;
  }
  let minU = 0, maxU = circ;
  let minV = Infinity, maxV = -Infinity;
  poly.forEach(p => { minV = Math.min(minV, p.v); maxV = Math.max(maxV, p.v); });
  const head = Math.max(4, 0.08 * Math.max(1, maxV - minV));
  minV -= head; maxV += head;

  const X = (u) => pad + ((u - minU) * (W - 2 * pad)) / Math.max(1e-6, (maxU - minU));
  const Y = (v) => H - pad - ((v - minV) * (H - 2 * pad)) / Math.max(1e-6, (maxV - minV));

  // grid (vertical every 30°)
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  const stepU = circ / 12;
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

  // curve / outline
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#0ea5e9";
  ctx.beginPath();
  poly.forEach((p, i) => {
    const x = X(p.u), y = Y(p.v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (showClosed) ctx.closePath();
  ctx.stroke();

  // numbers (u bottom, v near)
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  const labelEvery = Math.max(1, Math.floor(poly.length / 12));
  for (let i = 0; i < poly.length; i += labelEvery) {
    const p = poly[i];
    const x = X(p.u), y = Y(p.v);
    // u bottom
    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(Math.round(p.u)), x, H - pad + 14);
    // v pill
    const txt = String(round(p.v));
    const tw = Math.ceil(ctx.measureText(txt).width) + 10;
    const th = 18, r = 8, rx = x - tw / 2, ry = y - th - 4;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
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
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(txt, x, ry + th - 4);
  }
}

/* ---------- Page ---------- */
export default function CircleTeeTemplates() {
  // inputs
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("200");     // mm
  const [branchOD, setBranchOD] = useState("50");// mm
  const [tiltDeg, setTiltDeg] = useState("35");  // deg (pitch)
  const [stepDeg, setStepDeg] = useState("15");  // deg per station

  // computed curves
  const runCanvas = useRef(null);
  const brCanvas  = useRef(null);
  const [curves, setCurves] = useState(null);

  const update = () => {
    const Rr = Math.max(1e-6, Number(runOD) / 2);
    const Rb = Math.max(1e-6, Number(branchOD) / 2);
    const θ  = Number(tiltDeg);
    const step = Math.max(1, Number(stepDeg));

    // run hole = closed outline (cut-out)
    const { poly, circRun } = buildRunHoleOutline(Rr, Rb, θ, step);
    // branch cut = open curve
    const { pts, circBr } = buildBranchCutCurve(Rr, Rb, θ, step);

    setCurves({
      runOutline: poly,
      runCirc: round(circRun),
      brCurve: pts,
      brCirc: round(circBr),
      inputs: { runOD: Number(runOD), branchOD: Number(branchOD), tilt: θ, step }
    });
  };

  useEffect(update, []); // first render

  useEffect(() => {
    if (!curves) return;
    // draw both canvases
    drawBand(runCanvas.current, curves.runOutline, curves.runCirc, "Run hole stencil (cut-out)", true);
    drawBand(brCanvas.current, curves.brCurve,  curves.brCirc,  "Branch cut stencil (wrap on branch)", false);
  }, [curves]);

  const clearAll = () => {
    setTitle("");
    setRunOD(""); setBranchOD(""); setTiltDeg(""); setStepDeg("15");
    setCurves(null);
    const c1 = runCanvas.current, c2 = brCanvas.current;
    if (c1) c1.getContext("2d").clearRect(0,0,c1.width,c1.height);
    if (c2) c2.getContext("2d").clearRect(0,0,c2.width,c2.height);
  };

  const save = async () => {
    if (!curves) { alert("No data to save."); return; }
    const now = Date.now();
    const expiresAt = now + 90*24*60*60*1000;
    await dbSet(push(dbRef(db, "teeTemplates")), {
      title: title || "Pipe tee",
      createdAt: now,
      expiresAt,
      inputs: {
        runOD: curves.inputs.runOD,
        branchOD: curves.inputs.branchOD,
        pitch: curves.inputs.tilt, // to keep name compatible with AllReview
        yaw: 0,
        samples: Math.round(360/curves.inputs.step)
      },
      // keep previous schema fields used by AllReview.jsx
      run: curves.runOutline.map(p => ({ u: p.u, v: p.v })),     // closed outline
      branch: curves.brCurve.map(p => ({ u: p.u, v: p.v })),     // open curve
      stations: generateStations(curves.inputs.runOD/2, curves.inputs.branchOD/2, curves.inputs.tilt, curves.inputs.step)
                   .stations.map(s => ({ uRun: s.u, vRun: s.v }))
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card" style={{ paddingBottom: 10 }}>
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <input className="input" placeholder="Title"
               value={title} onChange={(e)=>setTitle(e.target.value)} />

        <div className="row" style={{ marginTop:8 }}>
          <input className="input" type="number" inputMode="decimal" placeholder="Run OD (mm)"
                 value={runOD} onChange={(e)=>setRunOD(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Branch OD (mm)"
                 value={branchOD} onChange={(e)=>setBranchOD(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop:8 }}>
          <input className="input" type="number" inputMode="decimal" placeholder="Tilt (deg)"
                 value={tiltDeg} onChange={(e)=>setTiltDeg(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Step (deg)"
                 value={stepDeg} onChange={(e)=>setStepDeg(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop:10 }}>
          <button className="btn" onClick={update}>🔁 Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#6b7280" }}>🧹 Clear</button>
        </div>
      </div>

      <div className="card">
        <canvas ref={runCanvas} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12 }} />
      </div>

      <div className="card">
        <canvas ref={brCanvas} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12 }} />
      </div>

      {curves && (
        <div className="card">
          <div className="page-title">Dimensions (quick check)</div>
          <div className="small">
            Run C ≈ <b>{round(curves.runCirc)}</b> mm · Branch C ≈ <b>{round(curves.brCirc)}</b> mm ·
            Tilt <b>{curves.inputs.tilt}°</b> · Step <b>{curves.inputs.step}°</b>
          </div>
          <div className="small" style={{ marginTop:6 }}>
            Tip: Run stencil (ပထမခု) ကို **print & cut** → pipe ကို 360° ပတ်ပြီး outline ကို တိတိကျကျမှတ်ပါ။
            Branch stencil (ဒုတိယခု) ကို စက္ကူပတ်ပြီး **ဖြတ်ဇာတ်ညွှန်း** အဖြစ်သုံးပါ။
          </div>
        </div>
      )}
    </div>
  );
    }
