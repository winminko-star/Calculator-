import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/** Pipe Tee – dual stencil (run-hole & branch-cut)
 * Units: mm, degrees. Step = degree ticks (e.g. 30).
 * Math:
 *  - Base (perpendicular) Steinmetz intersection on cylinder unwrap:
 *      z_run(θ)    =  ±sqrt( Rb^2 − (Rr cos(θ))^2 )
 *      z_branch(φ) =  ±sqrt( Rr^2 − (Rb cos(φ))^2 )
 *  - Yaw β → phase-shift: θ' = θ − β, φ' = φ
 *  - Pitch α → scale on height (approx): z' = z / max(1e-6, sin α)
 *    (α=90° ⇒ exact; α≠90° ⇒ good practical approximation for templates)
 */

const deg2rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// compute arrays for 0..360 stepped by `stepDeg`
function buildStencils({ runOD, branchOD, pitchDeg, yawDeg, stepDeg }) {
  const Rr = (runOD || 0) / 2;
  const Rb = (branchOD || 0) / 2;
  const α = deg2rad(pitchDeg || 90);
  const β = deg2rad(yawDeg || 0);
  const sPitch = Math.max(1e-6, Math.sin(α));

  const ptsRun = [];     // unwrap on run (x = arc mm, y = height mm)
  const ptsBranch = [];  // unwrap on branch (x = arc mm, y = depth mm)
  const stations = [];   // labels every `stepDeg`

  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const t = deg2rad(deg) - β;       // yaw shift on run
    const p = deg2rad(deg);           // branch yaw is just shift around itself (not needed)
    const zRun = Math.sqrt(Math.max(0, Rb * Rb - (Rr * Math.cos(t)) ** 2)) / sPitch;
    const zBr  = Math.sqrt(Math.max(0, Rr * Rr - (Rb * Math.cos(p)) ** 2)) / sPitch;

    ptsRun.push({ x: (2 * Math.PI * Rr) * (deg / 360), y: zRun });
    ptsBranch.push({ x: (2 * Math.PI * Rb) * (deg / 360), y: zBr });

    stations.push({
      deg,
      uRun: (2 * Math.PI * Rr) * (deg / 360),
      vRun: zRun,
      uBranch: (2 * Math.PI * Rb) * (deg / 360),
      vBranch: zBr,
    });
  }
  return { ptsRun, ptsBranch, stations, Rr, Rb };
}

/* ---------- canvas drawer (print-ready style) ---------- */
function drawStencil(canvas, title, radius, pts, stations, stepDeg) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 220;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  if (!pts?.length || !(radius > 0)) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui";
    ctx.fillText("No domain", 12, 22);
    return;
  }

  const pad = 18;
  const minX = 0;
  const maxX = 2 * Math.PI * radius;

  let minY = Infinity, maxY = -Infinity;
  pts.forEach(p => { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  // symmetric around baseline
  minY = Math.min(0, minY);
  maxY = Math.max(0, maxY);
  const yHead = Math.max(6, 0.08 * (maxY - minY || 1));
  minY -= yHead; maxY += yHead;

  const X = (u) => pad + ((u - minX) * (W - 2 * pad)) / Math.max(1e-6, (maxX - minX));
  const Y = (v) => H - pad - ((v - minY) * (H - 2 * pad)) / Math.max(1e-6, (maxY - minY));

  // grid every 30°
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  const tickU = (2 * Math.PI * radius) / 12;
  for (let u = 0; u <= maxX + 1e-6; u += tickU) {
    ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H - pad); ctx.stroke();
  }
  // border
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);

  // title
  ctx.fillStyle = "#0f172a"; ctx.font = "600 15px system-ui";
  ctx.fillText(title, pad, pad - 4);

  // baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad, Y(0)); ctx.stroke();

  // curve
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(p.x), y = Y(p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();

  // station labels (deg at bottom; height on top of curve)
  ctx.textAlign = "center"; ctx.font = "bold 12px system-ui";
  stations.forEach(s => {
    const x = X(s.uRun ?? s.uBranch);
    const v = s.vRun ?? s.vBranch;
    // bottom degree
    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(s.deg), x, H - pad + 14);

    // height pill
    const y = Y(v) - 8;
    const txt = String(Math.round(v));
    const w = Math.ceil(ctx.measureText(txt).width) + 8;
    const h = 18, r = 8, rx = x - w / 2, ry = y - h + 4;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + w - r, ry);
    ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + r);
    ctx.lineTo(rx + w, ry + h - r);
    ctx.quadraticCurveTo(rx + w, ry + h, rx + w - r, ry + h);
    ctx.lineTo(rx + r, ry + h);
    ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(txt, x, y);
  });
}

/* ---------- page ---------- */
export default function CircleTee() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("100");      // mm
  const [branchOD, setBranchOD] = useState("80"); // mm
  const [pitch, setPitch] = useState("90");       // deg
  const [yaw, setYaw] = useState("0");            // deg (around run)
  const [step, setStep] = useState("30");         // deg tick
  const [dims, setDims] = useState(null);

  const cRun = useRef(null);
  const cBr  = useRef(null);

  const compute = () => {
    const inputs = {
      runOD: +runOD || 0,
      branchOD: +branchOD || 0,
      pitchDeg: +pitch || 0,
      yawDeg: +yaw || 0,
      stepDeg: clamp(+step || 30, 5, 90),
    };
    const { ptsRun, ptsBranch, stations, Rr, Rb } = buildStencils(inputs);

    drawStencil(cRun.current, "Run-hole stencil (wrap on run)", Rr, ptsRun, stations, inputs.stepDeg);
    drawStencil(cBr.current,  "Branch-cut stencil (wrap on branch)", Rb, ptsBranch, stations, inputs.stepDeg);

    setDims({
      runC: 2 * Math.PI * Rr,
      brC:  2 * Math.PI * Rb,
      pitch: inputs.pitchDeg,
      yaw:   inputs.yawDeg,
      step:  inputs.stepDeg,
      inputs,
      run: ptsRun,
      branch: ptsBranch,
      stations,
    });
  };

  useEffect(() => { compute(); /* auto first render */ }, []);

  const onClear = () => {
    setTitle("");
    setRunOD(""); setBranchOD("");
    setPitch("90"); setYaw("0"); setStep("30");
    const ctx1 = cRun.current?.getContext("2d");
    const ctx2 = cBr.current?.getContext("2d");
    if (ctx1) ctx1.clearRect(0,0,cRun.current.width,cRun.current.height);
    if (ctx2) ctx2.clearRect(0,0,cBr.current.width,cBr.current.height);
    setDims(null);
  };

  const onSave = async () => {
    if (!dims) { alert("Nothing to save. Press Update first."); return; }
    const now = Date.now();
    const expiresAt = now + 90*24*60*60*1000;
    await dbSet(push(dbRef(db, "teeTemplates")), {
      createdAt: now,
      expiresAt,
      title: title || "Untitled",
      inputs: dims.inputs,
      run: dims.run,
      branch: dims.branch,
      stations: dims.stations,
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />

        <div className="row" style={{ marginTop: 8 }}>
          <input className="input" inputMode="decimal" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Branch OD (mm)" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input className="input" inputMode="decimal" placeholder="Pitch (deg)" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Yaw (deg)" value={yaw} onChange={e=>setYaw(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input className="input" inputMode="decimal" placeholder="Step deg (e.g. 30)" value={step} onChange={e=>setStep(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={compute}>⟳ Update</button>
          <button className="btn" onClick={onSave}>💾 Save</button>
          <button className="btn" onClick={onClear} style={{ background:"#64748b" }}>🧹 Clear</button>
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{ width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>

      <div className="card">
        <canvas ref={cBr}  style={{ width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>

      {dims && (
        <div className="card">
          <div className="small">
            <b>Dimensions</b> — Run C ≈ {dims.runC.toFixed(2)} mm · Branch C ≈ {dims.brC.toFixed(2)} mm · Tilts → Pitch {dims.pitch}°, Yaw {dims.yaw}°, Step {dims.step}°
          </div>
          <div className="small" style={{ marginTop:6 }}>
            Tip: စက္ကူ/တိပ်ကို run/branch ပေါ် 360° ပတ်ပြီး ဘေးက degree အမှတ်တွေကို တိုက်ထုတ်၊
            pill ဝိုင်းခန့်လေးတွေက **height(mm)** — အဲဒီတန်ဖိုးအတိုင်း အညွှန်းထုတ်ပြီး
            စက်ဝိုင်းလိုင်းကို ဆော့ပေးပါ။
          </div>
        </div>
      )}
    </div>
  );
    }
