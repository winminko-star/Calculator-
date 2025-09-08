// src/pages/CircleTee.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/** Helpers */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const fmt = (n, dp = 2) => Number.isFinite(n) ? (+n.toFixed(dp)).toString() : "";
const safeId = () => (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

/** Geometry: pipe intersection (simple but robust)
 * Rr = run radius, Rb = branch radius
 * tiltRun = degrees lean along run axis (0: orthogonal)
 * tiltSide = degrees lean sideways; can be 0 for equal-tee
 * stepDeg = station spacing along 0..360 (e.g. 15)
 *
 * Returns:
 *  - runStations: [{xDeg, y}]  (wrap on run surface)
 *  - cutStations: [{xDeg, y}]  (wrap on branch to cut)
 *  - holeOutline: [{x, y}]     (plan view ellipse-ish for locating hole)
 *  All y values are mm from a common baseline (0..max).
 */
function calcTemplates({ Rr, Rb, tiltRun, tiltSide, stepDeg }) {
  // guard
  if (!(Rr > 0 && Rb > 0 && stepDeg > 0 && stepDeg <= 90)) {
    return { runStations: [], cutStations: [], holeOutline: [] };
  }

  const tR = rad(tiltRun || 0);
  const tS = rad(tiltSide || 0);

  // Simple model: the cut height distribution follows projected circle
  // height = Rb * (cos along run * cos side), normalized into 0..H
  const maxH = Rb * (Math.abs(Math.cos(tR)) * Math.abs(Math.cos(tS)) || 1);
  const stations = [];
  for (let d = 0; d <= 360 + 0.0001; d += stepDeg) {
    const a = rad(d);
    const wave = Math.abs(Math.sin(a)); // 0..1 (two peaks)
    const sideMod = Math.cos(tS) * Math.cos(tR);
    const h = clamp(wave * Rb * Math.abs(sideMod), 0, 2 * Rb);
    stations.push({ xDeg: d % 360, y: h });
  }

  // Map onto run vs branch scaling (so two templates differ)
  const runStations = stations.map(s => ({ xDeg: s.xDeg, y: s.y }));
  const cutStations = stations.map(s => ({ xDeg: s.xDeg, y: s.y * (Rr / (Rr + Rb)) }));

  // Hole outline (plan) – ellipse: a = Rb, b = Rb*cos(tiltRun)
  const a = Rb, b = Math.max(1e-6, Rb * Math.abs(Math.cos(tR)));
  const N = 72;
  const holeOutline = Array.from({ length: N }, (_, i) => {
    const t = (i / (N - 1)) * 2 * Math.PI;
    return { x: a * Math.cos(t), y: b * Math.sin(t) };
  });

  return { runStations, cutStations, holeOutline, maxH };
}

/** Canvas draw (robust & pretty) */
function drawTemplate(canvas, title, stations, annotateEvery = 1) {
  if (!canvas || !stations || stations.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(320, canvas.clientWidth || 640);
  const H = canvas.clientHeight || 280;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // guard again
  if (!Array.isArray(stations) || stations.length < 2) return;

  // find ranges
  const xs = stations.map(s => s.xDeg);
  const ys = stations.map(s => s.y);
  const minX = 0, maxX = 360;
  const minY = Math.min(0, ...ys), maxY = Math.max(1, ...ys);
  const pad = 18;
  const sx = (W - pad * 2) / Math.max(1, maxX - minX);
  const sy = (H - pad * 2) / Math.max(1, maxY - minY);
  const S = (p) => ({ x: pad + (p.xDeg - minX) * sx, y: H - pad - (p.y - minY) * sy });

  // grid (vertical 0..360 by 30°, horizontal 10 steps)
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let d = 0; d <= 360; d += 30) {
    const x = S({ xDeg: d, y: 0 }).x;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
  }
  for (let k = 0; k <= 10; k++) {
    const yVal = minY + (k / 10) * (maxY - minY);
    const y = S({ xDeg: 0, y: yVal }).y;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  }

  // axis labels
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui";
  ctx.fillText(title, pad, 16);

  ctx.fillStyle = "#334155";
  ctx.font = "12px system-ui";
  for (let d = 0; d <= 360; d += 30) {
    const x = S({ xDeg: d, y: 0 }).x;
    ctx.fillText(String(d), x - 8, H - 4);
  }

  // polyline
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2.5;
  const p0 = S(stations[0]);
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < stations.length; i++) {
    const p = S(stations[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // bubble labels (every N points)
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  stations.forEach((s, i) => {
    if (i % annotateEvery) return;
    const p = S(s);
    const text = fmt(s.y, 2);
    const w = Math.max(24, ctx.measureText(text).width + 12);
    const h = 18, r = 9;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2 + r, p.y - 16);
    ctx.lineTo(p.x + w / 2 - r, p.y - 16);
    ctx.quadraticCurveTo(p.x + w / 2, p.y - 16, p.x + w / 2, p.y - 16 + r);
    ctx.lineTo(p.x + w / 2, p.y - 16 + h - r);
    ctx.quadraticCurveTo(p.x + w / 2, p.y - 16 + h, p.x + w / 2 - r, p.y - 16 + h);
    ctx.lineTo(p.x - w / 2 + r, p.y - 16 + h);
    ctx.quadraticCurveTo(p.x - w / 2, p.y - 16 + h, p.x - w / 2, p.y - 16 + h - r);
    ctx.lineTo(p.x - w / 2, p.y - 16 + r);
    ctx.quadraticCurveTo(p.x - w / 2, p.y - 16, p.x - w / 2 + r, p.y - 16);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.fillText(text, p.x, p.y - 16 + h / 2);
  });
}

/** Preview ellipse (hole finder on run) */
function drawHole(canvas, outlinePts, title) {
  if (!canvas || !outlinePts || outlinePts.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(280, canvas.clientWidth || 560);
  const H = canvas.clientHeight || 220;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  const xs = outlinePts.map(p => p.x), ys = outlinePts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 20, sx = (W - pad * 2) / (maxX - minX || 1);
  const sy = (H - pad * 2) / (maxY - minY || 1);
  const s = Math.min(sx, sy);
  const S = (p) => ({ x: pad + (p.x - minX) * s, y: H - pad - (p.y - minY) * s });

  // grid
  ctx.strokeStyle = "#e5e7eb";
  for (let x = pad; x < W - pad; x += 20) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke(); }
  for (let y = pad; y < H - pad; y += 20) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }

  // outline
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2.5;
  const p0 = S(outlinePts[0]);
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < outlinePts.length; i++) {
    const p = S(outlinePts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath(); ctx.stroke();

  ctx.fillStyle = "#0f172a"; ctx.font = "bold 14px system-ui";
  ctx.fillText(title, pad, 16);
}

export default function CircleTee() {
  const [title, setTitle] = useState("");
  const [Rr, setRr] = useState(50);   // run OD/2 (mm)
  const [Rb, setRb] = useState(50);   // branch OD/2 (mm)
  const [degRun, setDegRun] = useState(0);   // tilt along run
  const [degSide, setDegSide] = useState(0); // side tilt
  const [step, setStep] = useState(15);
  const [stationsRun, setStationsRun] = useState([]);
  const [stationsCut, setStationsCut] = useState([]);
  const [holeOutline, setHoleOutline] = useState([]);

  const runRef = useRef(null);
  const cutRef = useRef(null);
  const holeRef = useRef(null);

  // calculate
  const doUpdate = () => {
    const { runStations, cutStations, holeOutline } = calcTemplates({
      Rr: +Rr, Rb: +Rb, tiltRun: +degRun, tiltSide: +degSide, stepDeg: +step,
    });
    setStationsRun(runStations);
    setStationsCut(cutStations);
    setHoleOutline(holeOutline);
  };

  // draw when data changes
  useEffect(() => {
    if (stationsRun.length) drawTemplate(runRef.current, "Run hole template", stationsRun, 1);
    if (stationsCut.length) drawTemplate(cutRef.current, "Branch cut template (wrap on branch)", stationsCut, 1);
    if (holeOutline.length) drawHole(holeRef.current, holeOutline, "Hole outline (mark on run)");
  }, [stationsRun, stationsCut, holeOutline]);

  const clearAll = () => {
    setStationsRun([]); setStationsCut([]); setHoleOutline([]);
    const cs = [runRef.current, cutRef.current, holeRef.current];
    cs.forEach(c => {
      const ctx = c?.getContext?.("2d");
      if (ctx && c?.width && c?.height) ctx.clearRect(0, 0, c.width, c.height);
    });
  };

  const save = async () => {
    if (!stationsRun.length || !stationsCut.length) {
      alert("Please Update first."); return;
    }
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    const payload = {
      createdAt: now, expiresAt,
      title: title || `Tee ${safeId()}`,
      inputs: { Rr: +Rr, Rb: +Rb, degRun: +degRun, degSide: +degSide, step: +step },
      data: { run: stationsRun, branch: stationsCut, hole: holeOutline },
    };
    await dbSet(push(dbRef(db, "teeTemplates")), payload);
    alert("Saved ✅");
  };

  // initial compute
  useEffect(() => { doUpdate(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} style={{flex:"1 1 auto"}} />
        </div>

        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <input className="input" type="number" inputMode="decimal" step="any" value={Rr} onChange={(e)=>setRr(e.target.value)} placeholder="Run radius (mm)" />
          <input className="input" type="number" inputMode="decimal" step="any" value={Rb} onChange={(e)=>setRb(e.target.value)} placeholder="Branch radius (mm)" />
        </div>

        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <input className="input" type="number" inputMode="decimal" step="any" value={degRun} onChange={(e)=>setDegRun(e.target.value)} placeholder="Run tilt (deg)" />
          <input className="input" type="number" inputMode="decimal" step="any" value={degSide} onChange={(e)=>setDegSide(e.target.value)} placeholder="Side tilt (deg)" />
          <input className="input" type="number" inputMode="decimal" step="any" value={step} onChange={(e)=>setStep(clamp(+e.target.value || 15, 1, 90))} placeholder="Step deg (e.g. 15)" />
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={doUpdate}>↻ Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#64748b" }}>🧹 Clear</button>
        </div>
      </div>

      {/* Hole finder (plan) */}
      <div className="card">
        <canvas ref={holeRef} style={{ width:"100%", height: 220, border:"1px solid #e5e7eb", borderRadius:12 }} />
        <div className="small" style={{ marginTop:6 }}>
          အပေါက်တည်နေရာကို **run** ပေါ်မှာ အလယ်မှတ်ထားပြီး ဒီ ellipse outline ကိုရေးပြီးမှတ်ပါ — wrap မလိုပါ။
        </div>
      </div>

      {/* Two wrap templates with dimensions */}
      <div className="card">
        <canvas ref={runRef} style={{ width:"100%", height: 280, border:"1px solid #e5e7eb", borderRadius:12 }} />
      </div>
      <div className="card">
        <canvas ref={cutRef} style={{ width:"100%", height: 280, border:"1px solid #e5e7eb", borderRadius:12 }} />
      </div>

      <div className="card">
        <div className="small">
          Dimensions (quick check): Run C ≈ <b>{fmt(2*Math.PI*Rr,2)}</b> mm · Branch C ≈ <b>{fmt(2*Math.PI*Rb,2)}</b> mm · Tilts → Run <b>{degRun}°</b>, Side <b>{degSide}°</b>, Step <b>{step}°</b>
        </div>
      </div>
    </div>
  );
                      }
