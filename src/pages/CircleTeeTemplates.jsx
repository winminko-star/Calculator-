// src/pages/CircleTee.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/* ───────── helpers ───────── */
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n) => (Math.round(n * 100) / 100).toString(); // mm ကို 그대로, decimal 2

// 3-mode tilt: run, side, combined (= run * side on cos)
function makeProfiles({ runOD, branchOD, runTiltDeg, sideTiltDeg, stepDeg = 15 }) {
  const Rr = runOD / 2;      // run radius (mm)
  const Rb = branchOD / 2;   // branch radius (mm)
  const a = rad(runTiltDeg || 0);
  const b = rad(sideTiltDeg || 0);

  // effective cos between axes for hole contour on run
  const cosθ = Math.cos(a) * Math.cos(b);

  const steps = Math.max(4, Math.round(360 / stepDeg));
  const tList = Array.from({ length: steps + 1 }, (_, i) => i * stepDeg); // deg list

  // Run tube (unwrapped) hole template (y = distance from reference line, x = arc length)
  const run = tList.map((deg) => {
    const t = rad(deg);
    // canonical “saddle” approximation for branch round on cylindrical run
    // height in mm; clamp to >= 0
    const h = Math.max(0, Rr - Rr * cosθ * Math.cos(t));
    return { u: (Rr * 2 * Math.PI) * (deg / 360), v: h, deg };
  });

  // Branch cut (wrap on branch) — tilt along side only has strongest effect;
  // for simplicity use side tilt as primary; run tilt changes phase slightly
  const branch = tList.map((deg) => {
    const t = rad(deg);
    const eff = Math.cos(b); // side tilt factor
    const h = Math.max(0, Rb - Rb * eff * Math.cos(t));
    return { u: (Rb * 2 * Math.PI) * (deg / 360), v: h, deg };
  });

  return {
    run,
    branch,
    widthRun: 2 * Math.PI * Rr,
    widthBranch: 2 * Math.PI * Rb,
    steps,
  };
}

function drawTemplate(canvas, pts, width, title) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 220;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // padding & scale
  const pad = 16;
  const maxX = width || (pts.length ? pts[pts.length - 1].u : 1);
  const maxY = Math.max(1, ...pts.map((p) => p.v));
  const sx = (W - pad * 2) / maxX;
  const sy = (H - pad * 2) / maxY;

  // grid (vertical each 30deg tick, horizontal every 10 mm)
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let mm = 0; mm <= maxY; mm += 10) {
    const y = H - pad - mm * sy;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  }
  // ticks by deg label if available
  if (pts.length) {
    const stepDeg = pts.length > 1 ? pts[1].deg - pts[0].deg : 30;
    const degs = Array.from({ length: Math.round(360 / stepDeg) + 1 }, (_, i) => i * stepDeg);
    degs.forEach((d) => {
      const x = pad + (width * (d / 360)) * sx;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
      ctx.fillStyle = "#334155"; ctx.font = "12px system-ui";
      ctx.fillText(String(d), x - 6, H - 2);
    });
  }

  // axis
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

  // polyline
  if (pts.length) {
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const p0 = pts[0];
    ctx.moveTo(pad + p0.u * sx, H - pad - p0.v * sy);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      ctx.lineTo(pad + p.u * sx, H - pad - p.v * sy);
    }
    ctx.stroke();

    // value bubbles on each 30deg
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px system-ui";
    pts.forEach((p, i) => {
      // show every ~30deg (skip too dense)
      if (i % Math.max(1, Math.round(30 / (pts[1]?.deg || 30))) !== 0) return;
      const x = pad + p.u * sx;
      const y = H - pad - p.v * sy;
      const label = fmt(p.v);
      // pill
      const w = ctx.measureText(label).width + 10, h = 18, r = 9;
      const bx = x - w / 2, by = y - h - 8;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + w - r, by);
      ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
      ctx.lineTo(bx + w, by + h - r);
      ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
      ctx.lineTo(bx + r, by + h);
      ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // text
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, bx + 5, by + h - 4);
    });
  }

  // title
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui";
  ctx.fillText(title, pad, 18);
}

/* ───────── Page ───────── */
export default function CircleTee() {
  // inputs
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("200");     // mm
  const [branchOD, setBranchOD] = useState("50");
  const [runTilt, setRunTilt] = useState("35");  // deg
  const [sideTilt, setSideTilt] = useState("0"); // deg
  const [stepDeg, setStepDeg] = useState("15");

  const parsed = useMemo(() => {
    const rOD = clamp(Number(runOD) || 0, 1, 1e6);
    const bOD = clamp(Number(branchOD) || 0, 1, 1e6);
    const rt = clamp(Number(runTilt) || 0, 0, 180);
    const st = clamp(Number(sideTilt) || 0, 0, 180);
    const sd = clamp(Number(stepDeg) || 15, 1, 90);
    return { rOD, bOD, rt, st, sd };
  }, [runOD, branchOD, runTilt, sideTilt, stepDeg]);

  const data = useMemo(
    () =>
      makeProfiles({
        runOD: parsed.rOD,
        branchOD: parsed.bOD,
        runTiltDeg: parsed.rt,
        sideTiltDeg: parsed.st,
        stepDeg: parsed.sd,
      }),
    [parsed]
  );

  // canvases
  const refRun = useRef(null);
  const refBranch = useRef(null);
  useEffect(() => {
    drawTemplate(refRun.current, data.run, data.widthRun, "Run hole template");
    drawTemplate(
      refBranch.current,
      data.branch,
      data.widthBranch,
      "Branch cut template (wrap on branch)"
    );
  }, [data]);

  const onUpdate = () => {
    // redraw is handled by useEffect through state; noop here
  };

  const onClear = () => {
    setTitle("");
    setRunOD("");
    setBranchOD("");
    setRunTilt("");
    setSideTilt("");
    setStepDeg("15");
  };

  const onSave = async () => {
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    const payload = {
      createdAt: now,
      expiresAt,
      title: title || "Untitled",
      inputs: {
        Rr: parsed.rOD / 2,
        Rb: parsed.bOD / 2,
        runOD: parsed.rOD,
        branchOD: parsed.bOD,
        runTilt: parsed.rt,
        sideTilt: parsed.st,
        stepDeg: parsed.sd,
      },
      // raw series for All Review preview
      data: {
        run: data.run,
        branch: data.branch,
        widthRun: data.widthRun,
        widthBranch: data.widthBranch,
      },
    };
    await dbSet(push(dbRef(db, "teeTemplates")), payload);
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 8 }}
        />

        <div className="row">
          <input
            className="input"
            placeholder="Run OD (mm)"
            inputMode="decimal"
            value={runOD}
            onChange={(e) => setRunOD(e.target.value)}
          />
          <input
            className="input"
            placeholder="Branch OD (mm)"
            inputMode="decimal"
            value={branchOD}
            onChange={(e) => setBranchOD(e.target.value)}
          />
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="input"
            placeholder="Run tilt (deg)"
            inputMode="decimal"
            value={runTilt}
            onChange={(e) => setRunTilt(e.target.value)}
          />
          <input
            className="input"
            placeholder="Side tilt (deg)"
            inputMode="decimal"
            value={sideTilt}
            onChange={(e) => setSideTilt(e.target.value)}
          />
          <input
            className="input"
            placeholder="Step (deg)"
            inputMode="decimal"
            value={stepDeg}
            onChange={(e) => setStepDeg(e.target.value)}
            title="Station spacing along circumference"
          />
        </div>

        <div className="row" style={{ marginTop: 10, gap: 10 }}>
          <button className="btn" onClick={onUpdate}>↻ Update</button>
          <button className="btn" onClick={onSave}>💾 Save</button>
          <button className="btn" onClick={onClear} style={{ background: "#64748b" }}>
            🧹 Clear
          </button>
        </div>
      </div>

      {/* canvases */}
      <div className="card">
        <canvas
          ref={refRun}
          style={{
            width: "100%",
            height: 240,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        />
      </div>

      <div className="card">
        <canvas
          ref={refBranch}
          style={{
            width: "100%",
            height: 240,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        />
      </div>

      {/* quick facts */}
      <div className="card">
        <div className="page-title">Dimensions (for checking)</div>
        <div className="small">
          Run circumference: <b>{fmt(data.widthRun)}</b> mm · Branch circumference:{" "}
          <b>{fmt(data.widthBranch)}</b> mm
        </div>
        <div className="small" style={{ marginTop: 4 }}>
          Tilts → Run: <b>{parsed.rt}°</b>, Side: <b>{parsed.st}°</b>, Step:{" "}
          <b>{parsed.sd}°</b>
        </div>
      </div>
    </div>
  );
}
