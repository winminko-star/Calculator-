// src/pages/Drawing2D.jsx (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";
import Swal from "sweetalert2";

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

// rounded label pill for angles
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

/* --------------- renderer --------------- */
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, tempLine) {
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

  // lines
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
    drawLabelPill(ctx, sb.x + 10, sb.y - 10, `${t.deg}`);
  });

  // temp perpendicular line
  if (tempLine) {
    const s1 = W2S({x:tempLine.x1,y:tempLine.y1});
    const s2 = W2S({x:tempLine.x2,y:tempLine.y2});
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

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
// src/pages/Drawing2D.jsx (Part 2/3 logic)
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

  // refLine feature
  const [refLine, setRefLine] = useState(null);
  const [tempLine, setTempLine] = useState(null);

  // view
  const BASE_ZOOM = 60, MIN_Z = 0.0005, MAX_Z = 2400;
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0);
  const [autoFit, setAutoFit] = useState(true);

  const MIN_S = -200, MAX_S = 80;
  const [sval, setSval] = useState(0);
  const sliderToZoom = (s) => Math.min(MAX_Z, Math.max(MIN_Z, BASE_ZOOM * Math.pow(2, s/10)));
  const zoomToSlider = (z) => Math.max(MIN_S, Math.min(MAX_S, Math.round(10 * Math.log2((z||BASE_ZOOM)/BASE_ZOOM) * 100)/100));
  useEffect(() => { setSval(zoomToSlider(zoom)); }, [zoom]);
  const onSliderChange = (v) => { const s=Number(v); setSval(s); setZoom(sliderToZoom(s)); };

  // canvas
  const wrapRef = useRef(null), canvasRef = useRef(null), ctxRef = useRef(null);
  const sizeRef = useRef({ wCss: 360, hCss: 420 });
  const pointers = useRef(new Map());

  const nextLabel = () => labelFromIndex(points.length);

  /* restore from localStorage skipped for brevity (same as before) */

  /* ---------- size / DPR ---------- */
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
      drawScene(ctx, w, h, zoom, tx, ty, points, lines, angles, tempLine);
    };

    applySize();
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => { applySize(); if (autoFit) fitView(points); }, 60); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [autoFit, points, zoom, tx, ty, tempLine]);

  // draw
  useEffect(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawScene(ctx, sizeRef.current.wCss, sizeRef.current.hCss, zoom, tx, ty, points, lines, angles, tempLine);
  }, [points, lines, angles, zoom, tx, ty, tempLine]);

  /* ---------- fit/reset/clear ---------- */
  const fitView = (pts = points) => { /* ... same as before ... */ };
  const resetView = () => { setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearAll  = () => { setPoints([]); setLines([]); setAngles([]); setSelected([]); setRefLine(null); setTempLine(null); };

  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E), y = Number(N);
    if (!isFinite(x) || !isFinite(y)) return;
    const id = safeId();
    const pt = { id, label: nextLabel(), x, y };
    const next = [...points, pt];
    setPoints(next);
    setE(""); setN("");
    if (autoFit) setTimeout(() => fitView(next), 0);
  };

  /* ---------- gestures ---------- */
  const onPointerUp = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const world = { x: (mx - sizeRef.current.wCss/2 - tx)/zoom, y: (sizeRef.current.hCss/2 - my + ty)/zoom };

    // nearest point
    const hitR = 12 / zoom;
    let pick=null, best=Infinity;
    for (const p of points) {
      const d = Math.hypot(p.x - world.x, p.y - world.y);
      if (d < best && d <= hitR) { best = d; pick = p; }
    }
    if (!pick) return;

    if (mode==="refLine") {
      setSelected(sel=>{
        const next=[...sel,pick.id];
        if(next.length===2 && !refLine){
          setRefLine({aId:next[0],bId:next[1]});
          Swal.fire({icon:"success",title:"Ref line set!",timer:1000,showConfirmButton:false});
          return [];
        }
        if(refLine){
          const a=points.find(p=>p.id===refLine.aId);
          const b=points.find(p=>p.id===refLine.bId);
          const c=points.find(p=>p.id===pick.id);
          if(a&&b&&c){
            const vx=b.x-a.x, vy=b.y-a.y;
            const t=((c.x-a.x)*vx+(c.y-a.y)*vy)/(vx*vx+vy*vy||1);
            const px=a.x+t*vx, py=a.y+t*vy;
            const dist=Math.hypot(c.x-px,c.y-py);
            setTempLine({x1:c.x,y1:c.y,x2:px,y2:py});
            Swal.fire({
              icon:"info",title:`Perp distance: ${dist.toFixed(2)} ${UNIT_LABEL}`,
              timer:2000,showConfirmButton:false,
              willClose:()=>setTempLine(null)
            });
          }
          return [];
        }
        return next;
      });
      return;
    }

    // ... existing line/angle/erase modes remain unchanged ...
  };

  /* ---------- save ---------- */
  const saveToFirebase = async () => {
    const now = Date.now();
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, view: { zoom, tx, ty } },
      meta: { points: points.length, lines: lines.length, triples: angles.length },
    });
    alert("Saved");
  };
  // src/pages/Drawing2D.jsx (Part 3/3 UI)
  return (
    <div className="grid">
      {/* Canvas */}
      <div className="card" style={{ padding: 8 }}>
        <div ref={wrapRef} style={{ width: "100%" }}>
          <canvas
            ref={canvasRef}
            onPointerUp={onPointerUp}
            style={{
              display:"block", width:"100%", background:"#fff",
              borderRadius:12, border:"1px solid #e5e7eb",
              touchAction:"none", cursor:"crosshair"
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title"
            value={title} onChange={(e)=>setTitle(e.target.value)}
            style={{ flex:"1 1 260px" }} />
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>

        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder={`E (${UNIT_LABEL})`}
            value={E} onChange={(e)=>setE(e.target.value)} />
          <input className="input" placeholder={`N (${UNIT_LABEL})`}
            value={N} onChange={(e)=>setN(e.target.value)} />
          <button className="btn" onClick={addPoint}>Add (label {nextLabel()})</button>
        </div>

        <div className="row" style={{ overflowX:"auto", paddingBottom:4 }}>
          <button className="btn"
            onClick={()=>{setMode("line");setSelected([]);}}
            style={{background:mode==="line"?"#0ea5e9":"#64748b"}}>Line</button>
          <button className="btn"
            onClick={()=>{setMode("angle");setSelected([]);}}
            style={{background:mode==="angle"?"#0ea5e9":"#64748b"}}>Angle</button>
          <button className="btn"
            onClick={()=>{setMode("eraseLine");setSelected([]);}}
            style={{background:mode==="eraseLine"?"#0ea5e
