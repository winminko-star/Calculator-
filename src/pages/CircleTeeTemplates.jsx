import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/**
 * Pipe Tee Templates (perpendicular 90°)
 * Inputs in millimetres (mm). We show numeric heights without unit suffix.
 * Canvas = 0..360° unwrapped horizontally, 30° stations with numbers.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const toRad = (deg) => (deg * Math.PI) / 180;

export default function CircleTee() {
  const [title, setTitle]     = useState("");
  const [runOD, setRunOD]     = useState("200"); // mm
  const [branchOD, setBrOD]   = useState("50");  // mm
  const [deg, setDeg]         = useState("90");  // kept for future; now must be 90
  const [heights, setHeights] = useState({ branch: [], run: [] });

  const cvsBranchRef = useRef(null);
  const cvsRunRef    = useRef(null);

  // compute heights at each degree (0..360)
  const recompute = () => {
    const Rr = +runOD / 2;
    const Rb = +branchOD / 2;

    // Only 90° supported precisely
    const a = +deg;
    if (a !== 90) {
      console.warn("Only 90° tees are supported exactly. Using perpendicular model.");
    }

    const N = 361;
    const branch = new Array(N);
    const run    = new Array(N);

    for (let d = 0; d < N; d++) {
      const s = Math.sin(toRad(d));
      // Branch cut (end profile depth up from a flat baseline)
      const hb = Rr - Math.sqrt(Math.max(0, Rr * Rr - (Rb * s) * (Rb * s)));
      // Run hole outline (depth along run from mid-plane)
      const hr = Rb - Math.sqrt(Math.max(0, Rb * Rb - (Rr * s) * (Rr * s)));

      branch[d] = hb; // mm
      run[d]    = hr; // mm
    }
    setHeights({ branch, run });
    requestAnimationFrame(() => {
      drawTemplate(cvsBranchRef.current, branch, "Branch cut template");
      drawTemplate(cvsRunRef.current, run, "Run hole template");
    });
  };

  // draw unwrapped template to canvas
  const drawTemplate = (cvs, data, title) => {
    if (!cvs || !data?.length) return;
    const ctx = cvs.getContext("2d");
    const w = cvs.clientWidth || 600;
    const h = cvs.clientHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);
    const pad = 16;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    // find max height for scale (avoid super tall scaling; add headroom)
    const maxH = Math.max(1, ...data) * 1.1;

    // helpers: degree -> x, height(mm) -> y
    const xAt = (deg) => pad + (deg / 360) * plotW;
    const yAt = (mm)  => pad + plotH - (mm / maxH) * plotH;

    // background grid (30° verticals)
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e5e7eb";
    // horizontal grid (5 steps)
    for (let i = 0; i <= 5; i++) {
      const gy = pad + (plotH * i) / 5;
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(pad + plotW, gy); ctx.stroke();
    }
    // vertical stations every 30°
    for (let d = 0; d <= 360; d += 30) {
      const gx = xAt(d);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, pad + plotH); ctx.stroke();

      // degree labels up top
      ctx.fillStyle = "#0f172a";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${d}°`, gx, pad - 4);
    }

    // title
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.font = "600 14px system-ui";
    ctx.fillText(title, pad, pad - 4);

    // curve
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(data[0]));
    for (let d = 1; d <= 360; d++) {
      ctx.lineTo(xAt(d), yAt(data[d]));
    }
    ctx.stroke();

    // station numbers (heights at 30°)
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    for (let d = 0; d <= 360; d += 30) {
      const mm = Math.round(data[d]); // show integer mm, no unit
      const px = xAt(d);
      const py = yAt(data[d]) - 8;
      // small white pill behind text
      const text = String(mm);
      const tw = Math.ceil(ctx.measureText(text).width) + 8;
      const th = 18;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const rx = px - tw / 2, ry = py - th + 4, r = 8;
      roundedRect(ctx, rx, ry, tw, th, r);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.fillText(text, px, py);
    }
  };

  const roundedRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  useEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save raw params + station tables
  const onSave = async () => {
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    const station30 = Array.from({ length: 13 }, (_, i) => i * 30);
    const branch30 = station30.map((d) => Math.round(heights.branch[d]));
    const run30    = station30.map((d) => Math.round(heights.run[d]));

    await set(push(dbRef(db, "teeTemplates")), {
      createdAt: now,
      expiresAt,
      kind: "pipe-tee-90",
      title: title || "Untitled tee",
      params: { runOD: +runOD, branchOD: +branchOD, deg: +deg },
      stationsDeg: station30,
      branchHeights: branch30, // integer mm at each 30°
      runHeights: run30
    });

    alert("Saved ✅");
  };

  const onClear = () => {
    setTitle("");
    setRunOD("200");
    setBrOD("50");
    setDeg("90");
    setTimeout(recompute, 0);
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <div className="grid" style={{ gap: 8 }}>
          <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />

          <input className="input" type="number" inputMode="decimal" step="any"
                 value={runOD} onChange={(e)=>setRunOD(e.target.value)} placeholder="Run OD (mm)" />
          <input className="input" type="number" inputMode="decimal" step="any"
                 value={branchOD} onChange={(e)=>setBrOD(e.target.value)} placeholder="Branch OD (mm)" />
          <input className="input" type="number" inputMode="decimal" step="any"
                 value={deg} onChange={(e)=>setDeg(e.target.value)} placeholder="Angle (deg, use 90)" />

          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={recompute}>⟳ Update</button>
            <button className="btn" onClick={onSave}>💾 Save</button>
            <button className="btn" style={{ background:"#64748b" }} onClick={onClear}>🧹 Clear</button>
          </div>
        </div>
      </div>

      {/* Branch cut template */}
      <div className="card">
        <div className="page-title">Branch cut template</div>
        <canvas ref={cvsBranchRef}
                style={{ width:"100%", height: 260, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>

      {/* Run hole template */}
      <div className="card">
        <div className="page-title">Run hole template</div>
        <canvas ref={cvsRunRef}
                style={{ width:"100%", height: 260, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }} />
      </div>
    </div>
  );
     }
