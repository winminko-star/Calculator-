import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/**
 * Pipe Tee Templates (General: pitch + yaw)
 * Units: mm, degree. 0°..360° unwrapped (wrap on pipe).
 *
 * Geometry (run axis = X):
 *  - Run cylinder: y^2 + z^2 = Rr^2.  Point on run surface: P(θ,x) = (x, Rr cosθ, Rr sinθ).
 *  - Branch axis unit vector d = (cosα, sinα cosβ, sinα sinβ).   α=pitch, β=yaw.
 *  - Distance from P to branch axis = Rb  ⇒  ||P × d|| = Rb.
 *    Solve quadratic in x  →  x(θ) = [ Rr cosα cos(θ-β) ± sqrt( Rb^2 - Rr^2 sin^2(θ-β) ) ] / sinα
 *    (choose “+” root for outer envelope used by template)
 *
 *  - Branch side (wrap on branch):
 *    symmetry swapping Rr↔Rb and angle variable φ.  For practical stencil we use:
 *      t(φ) = [ Rb cosα cosφ + sqrt( Rr^2 - Rb^2 sin^2φ ) ] / sinα
 *    (φ can be considered local to branch; yaw is a rotation around run so branch template phase
 *     is typically taken with φ=0 aligned to fitter’s seam mark.)
 *
 * Domain: inside sqrt must be ≥0; otherwise there is no intersection → leave gap.
 */

const deg = (x) => (x * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (n) => (Math.round(n)).toString(); // show integer mm on labels

function buildRunTemplate({ Rr, Rb, pitchDeg, yawDeg, stepDeg }) {
  const a = deg(pitchDeg);
  const b = deg(yawDeg);
  const sA = Math.sin(a), cA = Math.cos(a);
  const step = clamp(stepDeg, 1, 60);

  const pts = [];         // {u, v} with u = arc(mm) on run, v = height(mm)
  const stations = [];    // {deg, u, v}
  const circ = 2 * Math.PI * Rr;

  for (let d = 0; d <= 360; d += step) {
    const th = deg(d);
    const phase = th - b;
    const under = Rb * Rb - (Rr * Math.sin(phase)) ** 2;
    const v = under >= 0 && sA !== 0
      ? (Rr * cA * Math.cos(phase) + Math.sqrt(under)) / sA
      : null;
    const u = Rr * th;
    pts.push(v == null ? null : { u, v });
  }
  for (let d = 0; d <= 360; d += 30) {
    const th = deg(d), phase = th - b;
    const under = Rb * Rb - (Rr * Math.sin(phase)) ** 2;
    stations.push({
      deg: d,
      u: Rr * th,
      v: under >= 0 && sA !== 0
        ? (Rr * cA * Math.cos(phase) + Math.sqrt(under)) / sA
        : null,
    });
  }
  return { pts, stations, circ };
}

function buildBranchTemplate({ Rr, Rb, pitchDeg, stepDeg }) {
  const a = deg(pitchDeg);
  const sA = Math.sin(a), cA = Math.cos(a);
  const step = clamp(stepDeg, 1, 60);

  const pts = [];
  const stations = [];
  const circ = 2 * Math.PI * Rb;

  for (let d = 0; d <= 360; d += step) {
    const ph = deg(d);
    const under = Rr * Rr - (Rb * Math.sin(ph)) ** 2;
    const v = under >= 0 && sA !== 0
      ? (Rb * cA * Math.cos(ph) + Math.sqrt(under)) / sA
      : null;
    const u = Rb * ph;
    pts.push(v == null ? null : { u, v });
  }
  for (let d = 0; d <= 360; d += 30) {
    const ph = deg(d);
    const under = Rr * Rr - (Rb * Math.sin(ph)) ** 2;
    stations.push({
      deg: d,
      u: Rb * ph,
      v: under >= 0 && sA !== 0
        ? (Rb * cA * Math.cos(ph) + Math.sqrt(under)) / sA
        : null,
    });
  }
  return { pts, stations, circ };
}

/* ===== Drawer (print-ready flat stencil) ===== */
function drawStencil(canvas, title, circ, pts, stations) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 680;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  // bounds
  const pad = 20;
  const minU = 0, maxU = circ;
  let minV = 0, maxV = 0;
  pts.forEach(p => { if (p) { minV = Math.min(minV, p.v); maxV = Math.max(maxV, p.v); } });
  if (maxV - minV < 1) maxV = minV + 1;

  const X = (u) => pad + (u - minU) * (W - 2 * pad) / (maxU - minU);
  const Y = (v) => H - pad - (v - minV) * (H - 2 * pad) / (maxV - minV);

  // grid (30° ticks)
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let d = 0; d <= 360; d += 30) {
    const u = (circ * d) / 360;
    const x = X(u);
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
  }

  // frame + baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

  // title
  ctx.fillStyle = "#0f172a"; ctx.font = "600 15px system-ui";
  ctx.fillText(title, pad, pad - 6);

  // seam note (0°/360°)
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(X(0), pad); ctx.lineTo(X(0), H - pad); ctx.stroke();
  ctx.setLineDash([]);

  // curve
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.6;
  ctx.beginPath();
  let started = false;
  pts.forEach(p => {
    if (!p) { started = false; return; }
    const x = X(p.u), y = Y(p.v);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // degree + height labels (avoid overlap a bit)
  ctx.textAlign = "center"; ctx.font = "bold 12px system-ui";
  stations.forEach((st, idx) => {
    const x = X(st.u);
    // bottom degree numbers
    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(st.deg), x, H - 4);

    if (st.v != null) {
      const txt = fmt(st.v);
      const y = Y(st.v) - 10 - ((idx % 2) ? 8 : 0); // small staggering
      const w = Math.ceil(ctx.measureText(txt).width) + 10;
      const h = 18, r = 9, rx = x - w / 2, ry = y - h / 2;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
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
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.fillText(txt, x, y + 4);
    }
  });
}

/* ===== Page ===== */
export default function CircleTee() {
  // inputs
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("114");     // mm (e.g. 4.5" ≈ 114.3)
  const [branchOD, setBranchOD] = useState("60"); // mm
  const [pitch, setPitch] = useState("90");       // deg (90 = perpendicular)
  const [yaw, setYaw] = useState("0");            // deg (rotate around run)
  const [stepDeg, setStepDeg] = useState("30");   // deg spacing for drawing

  const Rr = Math.max(1e-6, Number(runOD) / 2);
  const Rb = Math.max(1e-6, Number(branchOD) / 2);
  const step = clamp(Number(stepDeg) || 30, 1, 60);
  const pitchDeg = clamp(Number(pitch) || 90, 1, 179); // sinα ≠ 0
  const yawDeg = Number(yaw) || 0;

  // compute (memoized)
  const run = useMemo(
    () => buildRunTemplate({ Rr, Rb, pitchDeg, yawDeg, stepDeg: step }),
    [Rr, Rb, pitchDeg, yawDeg, step]
  );
  const brn = useMemo(
    () => buildBranchTemplate({ Rr, Rb, pitchDeg, stepDeg: step }),
    [Rr, Rb, pitchDeg, step]
  );

  const cRun = useRef(null), cBr = useRef(null);

  useEffect(() => {
    drawStencil(cRun.current, "Run-hole stencil (wrap on RUN)", run.circ, run.pts, run.stations);
  }, [run]);
  useEffect(() => {
    drawStencil(cBr.current, "Branch-cut stencil (wrap on BRANCH)", brn.circ, brn.pts, brn.stations);
  }, [brn]);

  const onClear = () => {
    setTitle("");
    setRunOD(""); setBranchOD("");
    setPitch("90"); setYaw("0"); setStepDeg("30");
    const ctx1 = cRun.current?.getContext("2d");
    const ctx2 = cBr.current?.getContext("2d");
    if (ctx1) ctx1.clearRect(0,0,cRun.current.width,cRun.current.height);
    if (ctx2) ctx2.clearRect(0,0,cBr.current.width,cBr.current.height);
  };

  const onSave = async () => {
    const now = Date.now();
    const expiresAt = now + 90*24*60*60*1000;
    await dbSet(push(dbRef(db, "teeTemplates")), {
      createdAt: now, expiresAt,
      title: title || "Tee template",
      inputs: { runOD: +runOD || 0, branchOD: +branchOD || 0, pitch: pitchDeg, yaw: yawDeg, stepDeg: step },
      run: run.pts,      // [{u,v}|null]
      branch: brn.pts,   // [{u,v}|null]
      stations: run.stations.map((s, i) => ({
        deg: s.deg,
        uRun: s.u, vRun: s.v,
        uBranch: brn.stations[i]?.u ?? null,
        vBranch: brn.stations[i]?.v ?? null,
      })),
    });
    alert("Saved ✅ — All Review မှာပြန်ကြည့်လို့ရပါပြီ");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates (Pitch/Yaw supported)</div>

        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={{flex:"1 1 auto"}} />
        </div>

        <div className="row">
          <input className="input" inputMode="decimal" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Branch OD (mm)" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop:8 }}>
          <input className="input" inputMode="decimal" placeholder="Pitch (deg)" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Yaw (deg)" value={yaw} onChange={e=>setYaw(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder="Step (deg)" value={stepDeg} onChange={e=>setStepDeg(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop:10 }}>
          <button className="btn" onClick={()=>{ /* recompute via state change only */ }}>⟳ Update</button>
          <button className="btn" onClick={onSave}>💾 Save</button>
          <button className="btn" onClick={onClear} style={{ background:"#64748b" }}>🧹 Clear</button>
        </div>

        <div className="small" style={{marginTop:6}}>
          • စက္ကူ/တိပ်ကို pipe ပေါ် 360° ပတ်ပြီး 0° seam ကို တိုက်ညှိပါ — အောက်ဘက်က degree တိုင်အလိုက် pill အကြောင်း (integer mm) တွေကို မှတ်ပြီး လိုင်းဆွဲပါ။  
          • <b>Run-hole</b> stencil ကို RUN ပိုက်ပေါ် ပတ် → အပေါက် outline.  <b>Branch-cut</b> stencil ကို BRANCH အဆုံး ပတ် → fish-mouth cut outline.
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }}/>
      </div>

      <div className="card">
        <canvas ref={cBr} style={{ width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }}/>
      </div>

      <div className="card small">
        <b>Notes</b> — Domain အပြင် (sqrt အောက်မှာ −) ဖြစ်တဲ့ angle များမှာ gap မျဉ်းကွက် မထုတ်ပါ (ဘောင်မလွှမ်းနေသေး).  
        Pitch = 90° / Yaw = 0° ဖြစ်ရင် perpendicular tee ကို တိကျစွာ ထုတ်ပေးသည်။ အခြား Pitch/Yaw များမှာ ဒီစနစ်ဟာ fitter template အတွက် သင်္ချာတိတိကျကျမှန်အောင် မူဘောင်ကနေ導ထားသော general formula ကို အသုံးပြုထားပါတယ်။
      </div>
    </div>
  );
}
