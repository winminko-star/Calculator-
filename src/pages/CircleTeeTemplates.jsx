import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

// ---------- geom helpers ----------
const toRad = (d) => (d * Math.PI) / 180;

// branch cut template (yellow small pipe) – unfold length 0..2πRb
function buildBranchTemplate(Rb, Rr, deg, samples) {
  // θ = intersection half-angle in rad
  const th = toRad(deg);
  const L = 2 * Math.PI * Rb;             // development length
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;                 // 0..1
    const phi = t * 2 * Math.PI;           // around branch
    // height along development (y) from intersection curve:
    // classic equal-diameter formula (for ref: z = Rr * sin(phi) * tan(th) )
    const y = Rr * Math.sin(phi) * Math.tan(th);
    const x = t * L;
    pts.push({ x, y });
  }
  return pts;
}

// run-hole template (blue main pipe) – unfold length 0..2πRr
function buildRunTemplate(Rb, Rr, deg, samples) {
  const th = toRad(deg);
  const L = 2 * Math.PI * Rr;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const phi = t * 2 * Math.PI;
    // penetration curve height on the run:
    // z = Rb * sin(phi) * tan(th)
    const y = Rb * Math.sin(phi) * Math.tan(th);
    const x = t * L;
    pts.push({ x, y });
  }
  return pts;
}

// draw poly on canvas with grid
function drawTemplateOnCanvas(canvas, pts, title, scale = 1) {
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

  // grid
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  const step = 20;
  for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  if (!pts?.length) return;

  // fit to view (padding)
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  const pad = 16;

  const sx = (W - pad * 2) / Math.max(1, (maxX - minX));
  const sy = (H - pad * 2) / Math.max(1, (maxY - minY || 1));
  const s = Math.min(sx, sy) * scale;

  const toS = (p) => ({
    x: pad + (p.x - minX) * s,
    y: H - pad - (p.y - minY) * s,
  });

  // baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, H - pad - (0 - minY) * s);
  ctx.lineTo(W - pad, H - pad - (0 - minY) * s);
  ctx.stroke();

  // curve
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const p0 = toS(pts[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < pts.length; i++) {
    const p = toS(pts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // title
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui";
  ctx.fillText(title, 10, 18);
}

export default function CircleTeeTemplates() {
  const [Rb, setRb] = useState("");     // branch radius (mm)
  const [Rr, setRr] = useState("");     // run radius (mm)
  const [deg, setDeg] = useState("");   // intersection angle (deg)
  const [samples, setSamples] = useState(180);
  const [title, setTitle] = useState("");

  const canvasBranch = useRef(null);
  const canvasRun = useRef(null);
  const last = useRef({ ptsB: [], ptsR: [] });

  const recompute = () => {
    const rb = +Rb, rr = +Rr, d = +deg;
    if (!(rb > 0 && rr > 0 && isFinite(d))) {
      last.current = { ptsB: [], ptsR: [] };
      drawTemplateOnCanvas(canvasBranch.current, [], "Branch cut template");
      drawTemplateOnCanvas(canvasRun.current, [], "Run hole template");
      return;
    }
    const ptsB = buildBranchTemplate(rb, rr, d, +samples || 180);
    const ptsR = buildRunTemplate(rb, rr, d, +samples || 180);
    last.current = { ptsB, ptsR };
    drawTemplateOnCanvas(canvasBranch.current, ptsB, "Branch cut template");
    drawTemplateOnCanvas(canvasRun.current, ptsR, "Run hole template");
  };

  useEffect(() => { recompute(); /* eslint-disable */ }, [Rb, Rr, deg, samples]);

  const saveToFirebase = async () => {
    if (!last.current.ptsB.length || !last.current.ptsR.length) {
      alert("Please enter Rb, Rr and Degree first.");
      return;
    }
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    await set(
      push(dbRef(db, "teeTemplates")),
      {
        type: "tee-template",
        v: 1,
        createdAt: now,
        expiresAt,
        title: title || "Untitled",
        inputs: { Rb: +Rb, Rr: +Rr, deg: +deg, samples: +samples },
        data: { branch: last.current.ptsB, run: last.current.ptsR }
      }
    );
    alert("Saved ✅");
  };

  const clearAll = () => {
    setRb(""); setRr(""); setDeg(""); setSamples(180); setTitle("");
    last.current = { ptsB: [], ptsR: [] };
    recompute();
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <div className="row">
          <input className="input" placeholder="Title" value={title}
                 onChange={(e)=>setTitle(e.target.value)} style={{flex:"1 1 220px"}} />

          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Rb (branch radius, mm)" value={Rb} onChange={(e)=>setRb(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Rr (run radius, mm)" value={Rr} onChange={(e)=>setRr(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Degree (°)" value={deg} onChange={(e)=>setDeg(e.target.value)} />
          <input className="input" type="number" inputMode="numeric"
                 placeholder="Samples (e.g. 180)" value={samples} onChange={(e)=>setSamples(e.target.value)} />

          <button className="btn" onClick={recompute}>↻ Update</button>
          <button className="btn" onClick={saveToFirebase}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{background:"#64748b"}}>🧹 Clear</button>
        </div>
      </div>

      <div className="card" style={{display:"grid", gap:12}}>
        <canvas ref={canvasBranch}
                style={{width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12}}/>
        <canvas ref={canvasRun}
                style={{width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12}}/>
      </div>
    </div>
  );
}
