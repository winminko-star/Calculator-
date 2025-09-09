// src/pages/Drawing2D.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units: coordinates are in millimetres (mm). zoom = px per mm */
const UNIT_LABEL = "mm";

/* ---------------- helpers ---------------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);
const distMm = (a, b) => Math.hypot(b.x - a.x, b.y - a.y); // mm
const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};
// auto labels: A, B, ..., Z, AA, AB, ...
const labelFromIndex = (i) => {
  let s = "";
  i += 1;
  while (i > 0) {
    i--;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
};

function drawLabelPill(ctx, x, y, text) {
  ctx.font = "bold 14px system-ui";
  const padX = 6, padY = 4;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = 22, r = 8;
  const bx = Math.round(x), by = Math.round(y - h);

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
  ctx.closePath();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + padX, by + h - padY - 2);
}

/* --------------- renderer ---------------- */
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles) {
  ctx.clearRect(0, 0, wCss, hCss);

  // grid
  const step = Math.max(zoom * 1, 24);
  const originX = wCss / 2 + tx;
  const originY = hCss / 2 + ty;

  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke(); }
  for (let gx = originX % step; gx > 0; gx -= step)   { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke(); }
  for (let gy = originY % step; gy < hCss; gy += step){ ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke(); }
  for (let gy = originY % step; gy > 0; gy -= step)   { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke(); }

  // axes
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, hCss/2 + ty); ctx.lineTo(wCss, hCss/2 + ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss/2 + tx, 0); ctx.lineTo(wCss/2 + tx, hCss); ctx.stroke();

  const W2S = (p) => ({ x: wCss/2 + p.x * zoom + tx, y: hCss/2 - p.y * zoom + ty });

  // lines + length
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2; ctx.fillStyle = "#0f172a"; ctx.font = "13px system-ui";
  lines.forEach(l => {
    const a = points.find(p => p.id === l.p1), b = points.find(p => p.id === l.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    ctx.fillText(`${Math.round(l.lenMm)} ${UNIT_LABEL}`, (s1.x + s2.x)/2 + 6, (s1.y + s2.y)/2 - 6);
  });

  // angle pills
  angles.forEach(t=>{
    const a = points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb = W2S(b);
    drawLabelPill(ctx, sb.x + 10, sb.y - 10, `${t.deg}°`);
  });

  // points
  points.forEach(p=>{
    const s = W2S(p);
    const r = 6;
    ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.arc(s.x, s.y, r-1, 0, Math.PI*2); ctx.fill();

    ctx.font = "13px system-ui";
    ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff";
    ctx.strokeText(p.label, s.x + 8, s.y - 8);
    ctx.fillStyle = "#0f172a"; ctx.fillText(p.label, s.x + 8, s.y - 8);
  });
}

export default function Drawing2D() {
  // data
  const [points, setPoints] = useState([]);
  const [lines, setLines]   = useState([]);
  const [angles, setAngles] = useState([]);

  // inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [title, setTitle] = useState("");

  // modes / selection
  const [mode, setMode] = useState("line");
  const [selected, setSelected] = useState([]);

  // view
  const BASE_ZOOM = 60, MIN_Z = 0.0005, MAX_Z = 2400;
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0);
  const [autoFit, setAutoFit] = useState(true);

  // slider
  const MIN_S = -200, MAX_S = 80;
  const [sval, setSval] = useState(0);
  const sliderToZoom = (s) => BASE_ZOOM * Math.pow(2, s / 10);
  const zoomToSlider = (z) => 10 * Math.log2((z || BASE_ZOOM) / BASE_ZOOM);
  useEffect(() => { setSval(zoomToSlider(zoom)); }, [zoom]);

  const onSliderChange = (v) => {
    const s = Number(v);
    setSval(s);
    const nz = sliderToZoom(s);
    setZoom(Math.min(MAX_Z, Math.max(MIN_Z, nz)));
  };

  // canvas
  const wrapRef = useRef(null), canvasRef = useRef(null), ctxRef = useRef(null);
  const sizeRef = useRef({ wCss: 360, hCss: 420 });
  const pointers = useRef(new Map());

  const nextLabel = () => labelFromIndex(points.length);

  /* ---------- restore from AllReview ---------- */
  useEffect(() => {
    const raw = localStorage.getItem("wmk_restore");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) || {};
      const pts = Array.isArray(payload.points) ? payload.points : [];
      const lns = Array.isArray(payload.lines)  ? payload.lines  : [];
      const ags = Array.isArray(payload.angles) ? payload.angles : [];
      const vw  = payload.view || {};

      const withLabels = pts.map((p, i) => ({
        id: p.id || `p${i}`,
        label: p.label || labelFromIndex(i),
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
      }));
      setPoints(withLabels);
      setLines(lns.map(l => ({
        id: l.id || safeId(), p1: l.p1, p2: l.p2,
        lenMm: l.lenMm ?? distMm(
          withLabels.find(p=>p.id===l.p1) || {x:0,y:0},
          withLabels.find(p=>p.id===l.p2) || {x:0,y:0}
        )
      })));
      setAngles(ags.map(a => ({ id: a.id || safeId(), a:a.a, b:a.b, c:a.c, deg:a.deg })));

      setAutoFit(false);
      setZoom(vw.zoom ?? BASE_ZOOM);
      setTx(vw.tx ?? 0);
      setTy(vw.ty ?? 0);
    } catch(e) {
      console.error("restore failed", e);
    } finally {
      localStorage.removeItem("wmk_restore");
    }
  }, []);

  /* ---------- size / draw ---------- */
  useEffect(() => {
    const cvs = canvasRef.current, wrap = wrapRef.current;
    if (!cvs || !wrap) return;

    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(320, Math.floor(wrap.clientWidth || 360));
      const h = Math.min(Math.max(Math.floor(w * 1.0), 360), 640);
      sizeRef.current = { wCss: w, hCss: h };
      cvs.style.width = w + "px"; cvs.style.height = h + "px";
      cvs.width = Math.floor(w * dpr); cvs.height = Math.floor(h * dpr);
      const ctx = cvs.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
      drawScene(ctx, w, h, zoom, tx, ty, points, lines, angles);
    };

    applySize();
    let t;
    const onResize = () => { clearTimeout(t); t=setTimeout(()=>applySize(),60); };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, [points, lines, angles, zoom, tx, ty]);

  useEffect(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawScene(ctx, sizeRef.current.wCss, sizeRef.current.hCss, zoom, tx, ty, points, lines, angles);
  }, [points, lines, angles, zoom, tx, ty]);

  /* ---------- fit/reset/clear ---------- */
  const fitView = (pts = points) => { /* ... unchanged ... */ };
  const resetView = () => { setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearAll  = () => { setPoints([]); setLines([]); setAngles([]); setSelected([]); };
  const clearLines = () => setLines([]);
  const removeLastLine = () => setLines(ls => ls.slice(0, -1));
  const centerOnA = () => { if(points.length){ const A=points[0]; setTx(-A.x*zoom); setTy(+A.y*zoom);} };

  /* ---------- add point ---------- */
  const addPoint = () => {
    if (E===""||N==="") return;
    const x=Number(E), y=Number(N);
    if (!isFinite(x)||!isFinite(y)) return;
    const id=safeId();
    const pt={id,label:nextLabel(),x,y};
    const next=[...points,pt];
    setPoints(next);
    setE(""); setN("");
  };

  /* ---------- gestures / pointer handlers (unchanged) ---------- */
  // ... (keep your pointer handlers here)

  /* ---------- save ---------- */
  const saveToFirebase = async () => {
    const now=Date.now();
    const expiresAt = now+90*24*60*60*1000;
    await set(push(dbRef(db,"drawings")),{
      createdAt:now,expiresAt,
      title:title||"Untitled",
      unitLabel:UNIT_LABEL,
      state:{points,lines,angles,view:{zoom,tx,ty}},
      meta:{points:points.length,lines:lines.length,triples:angles.length},
    });
    alert("Saved ✅");
  };

  /* ---------- UI ---------- */
  return (
    <div className="grid">
      {/* Canvas */}
      <div className="card" style={{ padding: 8 }}>
        <div ref={wrapRef} style={{ width:"100%" }}>
          <canvas ref={canvasRef} /* pointer handlers */ />
        </div>
        {/* Scale slider ... */}
      </div>
      {/* Controls, Toolbar, Lists ... unchanged */}
    </div>
  );
                                                    }
