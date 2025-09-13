import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units: mm */
const UNIT_LABEL = "mm";

/* ---------- helpers ---------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const distMm = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};
const labelFromIndex = (i) => {
  let s = ""; i += 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
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
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + padX, by + h - padY - 2);
}

/* ---------- renderer (uses zoom/tx/ty) ---------- */
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, circles) {
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

  // circles
  circles.forEach(c => {
    const cp = { x: c.cx, y: c.cy };
    const cs = W2S(cp);
    ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cs.x, cs.y, c.r * zoom, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`R=${c.r} ${UNIT_LABEL}`, cs.x + 6, cs.y - 6);
  });

  // angle pills
  angles.forEach(t=>{
    const a = points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb = W2S(b);
    drawLabelPill(ctx, sb.x + 10, sb.y - 10, `${t.deg}`);
  });

  // points
  points.forEach(p=>{
    const s = W2S(p);
    const r = 6;
    ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(s.x, s.y, r-1, 0, Math.PI*2); ctx.fill();

    ctx.font = "13px system-ui";
    ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff";
    ctx.strokeText(p.label, s.x + 8, s.y - 8);
    ctx.fillStyle = "#0f172a"; ctx.fillText(p.label, s.x + 8, s.y - 8);
  });
    }
export default function Drawing2D() {
  // data
  const [points, setPoints] = useState([]);     // {id,label,x,y,h}
  const [lines, setLines]   = useState([]);     // {id,p1,p2,lenMm}
  const [angles, setAngles] = useState([]);
  const [circles, setCircles] = useState([]);   // {id,cx,cy,r}

  // inputs
  const [E, setE] = useState("");   // for point
  const [N, setN] = useState("");
  const [H, setH] = useState("");   // new: level
  const [title, setTitle] = useState("");

  // circle inputs
  const [cE, setCE] = useState(""), [cN, setCN] = useState(""), [cR, setCR] = useState("");

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
  const sliderToZoom = (s) => Math.min(MAX_Z, Math.max(MIN_Z, BASE_ZOOM * Math.pow(2, s/10)));
  const zoomToSlider = (z) => Math.max(MIN_S, Math.min(MAX_S, Math.round(10 * Math.log2((z||BASE_ZOOM)/BASE_ZOOM) * 100)/100));
  useEffect(() => { setSval(zoomToSlider(zoom)); }, [zoom]);
  const onSliderChange = (v) => { const s=Number(v); setSval(s); setZoom(sliderToZoom(s)); };

  // canvas
  const wrapRef = useRef(null), canvasRef = useRef(null), ctxRef = useRef(null);
  const sizeRef = useRef({ wCss: 360, hCss: 420 });
  const pointers = useRef(new Map());

  const nextLabel = () => labelFromIndex(points.length);
  const getLabel  = (id) => points.find(p=>p.id===id)?.label || id;

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
      drawScene(ctx, w, h, zoom, tx, ty, points, lines, angles, circles);
    };
    applySize();
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => { applySize(); if (autoFit) fitView(points); }, 60); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, [autoFit, points, lines, angles, circles, zoom, tx, ty]);

  // draw
  useEffect(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawScene(ctx, sizeRef.current.wCss, sizeRef.current.hCss, zoom, tx, ty, points, lines, angles, circles);
  }, [points, lines, angles, circles, zoom, tx, ty]);

  /* ---------- fit/reset/clear ---------- */
  const fitView = (pts = points) => {
    if (!pts || pts.length === 0) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    const { wCss, hCss } = sizeRef.current;

    if (w === 0 && h === 0) {
      const targetZ = Math.min(wCss, hCss) * 0.5;
      const nz = Math.min(MAX_Z, Math.max(MIN_Z, targetZ));
      setZoom(nz);
      const p = pts[0];
      setTx(-p.x * nz); setTy(+p.y * nz);
      return;
    }
    const pad = 0.1 * Math.max(w, h);
    const zX = (wCss * 0.9) / (w + pad * 2);
    const zY = (hCss * 0.9) / (h + pad * 2);
    const nz = Math.min(MAX_Z, Math.max(MIN_Z, Math.min(zX, zY)));
    setZoom(nz); setSval(zoomToSlider(nz));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setTx(-cx * nz); setTy(+cy * nz);
  };
  const resetView = () => { setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearAll  = () => { setPoints([]); setLines([]); setAngles([]); setCircles([]); setSelected([]); };
  const clearLines = () => setLines([]);
  const removeLastLine = () => setLines(ls => ls.slice(0, -1));
  const centerOnA = () => { if (!points.length) return; const A = points[0]; const z = zoom; setTx(-A.x * z); setTy(+A.y * z); };
  useEffect(() => { if (autoFit) fitView(points); }, [points]); // eslint-disable-line

  /* ---------- add point ---------- */
  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E), y = Number(N), h = H === "" ? 0 : Number(H);
    if (!isFinite(x) || !isFinite(y) || !isFinite(h)) return;
    const id = safeId();
    const pt = { id, label: nextLabel(), x, y, h };
    const next = [...points, pt];
    setPoints(next);
    setE(""); setN(""); setH("");
    if (autoFit) setTimeout(() => fitView(next), 0);
  };

  /* ---------- add circle ---------- */
  const addCircle = () => {
    if (cE==="" || cN==="" || cR==="") return;
    const cx = Number(cE), cy = Number(cN), r = Math.abs(Number(cR));
    if (!isFinite(cx) || !isFinite(cy) || !isFinite(r) || r<=0) return;
    setCircles(cs => [...cs, { id: safeId(), cx, cy, r }]);
    setCE(""); setCN(""); setCR("");
  };

  /* ---------- gestures (pan/pinch/select/erase) ---------- */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now() });
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: prev.t });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) { setTx(v => v + (e.clientX - prev.x)); setTy(v => v + (e.clientY - prev.y)); }
    else if (pts.length >= 2) {
      const [p1, p2] = pts;
      const distPrev = Math.hypot(p1.x - prev.x, p1.y - prev.y) || 1;
      const distNow  = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const wrap = wrapRef.current, rect = wrap.getBoundingClientRect();
      const mid = { x: (p1.x + p2.x)/2 - rect.left, y: (p1.y + p2.y)/2 - rect.top };
      const { wCss:w, hCss:h } = sizeRef.current;
      setZoom(z => {
        const nz = Math.min(MAX_Z, Math.max(MIN_Z, z * (distNow / distPrev)));
        const wx = ((mid.x - (w/2) - tx) ) / z;
        const wy = ((h/2) - (mid.y - ty) ) / z;
        const sx_after = w/2 + wx * nz + tx;
        const sy_after = h/2 - wy * nz + ty;
        setTx(v => v + (mid.x - sx_after));
        setTy(v => v + (mid.y - sy_after));
        return nz;
      });
    }
  };
  const onPointerUp = (e) => {
    const down = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (!down || Date.now() - down.t > 200 || pointers.current.size !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const world = { x: (mx - sizeRef.current.wCss/2 - tx)/zoom, y: (sizeRef.current.hCss/2 - my + ty)/zoom };

    // erase-line mode: tap near a segment to remove
    if (mode === "eraseLine") {
      const pxTol = 12; const mmTol = pxTol / zoom;
      let bestIdx = -1, bestD = Infinity;
      lines.forEach((ln, idx) => {
        const a = points.find(p => p.id === ln.p1);
        const b = points.find(p => p.id === ln.p2);
        if (!a || !b) return;
        const vx = b.x - a.x, vy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((world.x - a.x)*vx + (world.y - a.y)*vy) / (vx*vx + vy*vy || 1)));
        const cx = a.x + t*vx, cy = a.y + t*vy;
        const d = Math.hypot(world.x - cx, world.y - cy);
        if (d < bestD) { bestD = d; bestIdx = idx; }
      });
      if (bestIdx !== -1 && bestD <= mmTol) setLines(ls => ls.filter((_, i) => i !== bestIdx));
      return;
    }

    // select-near point
    const hitR = 12 / zoom;
    let pick=null, best=Infinity;
    for (const p of points) {
      const d = Math.hypot(p.x - world.x, p.y - world.y);
      if (d < best && d <= hitR) { best = d; pick = p; }
    }
    if (!pick) return;

    setSelected(sel=>{
      const next=[...sel, pick.id];
      if (mode==="line" && next.length===2) {
        const [aId,bId]=next; if (aId!==bId) {
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          setLines(ls=>[...ls,{ id:safeId(), p1:a.id, p2:b.id, lenMm: distMm(a,b) }]);
        }
        return [];
      }
      if (mode==="angle" && next.length===3) {
        const [aId,bId,cId]=next;
        if (new Set(next).size===3) {
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId), c=points.find(x=>x.id===cId);
          setAngles(ag=>[...ag,{ id:safeId(), a:a.id, b:b.id, c:c.id, deg:angleDeg(a,b,c) }]);
        }
        return [];
      }
      return next;
    });
  };

  /* ---------- save ---------- */
  const saveToFirebase = async () => {
    const now = Date.now();
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, circles, view: { zoom, tx, ty } },
      meta: { points: points.length, lines: lines.length, triples: angles.length, circles: circles.length },
    });
    alert("Saved");
  };

  /* ---------- H level summary ---------- */
  const levelSummary = (() => {
    const map = new Map(); // key: H (string), value: {h, count, labels}
    points.forEach(p=>{
      const key = String(p.h);
      if (!map.has(key)) map.set(key, { h: p.h, count: 0, labels: [] });
      const obj = map.get(key);
      obj.count += 1; obj.labels.push(p.label);
    });
    return Array.from(map.values()).sort((a,b)=>a.h - b.h);
  })();

  /* ---------------- end logic ---------------- */
}
/* -------------------- UI -------------------- */
  return (
    <div className="grid">
      {/* Canvas */}
      <div className="card" style={{ padding: 8 }}>
        <div ref={wrapRef} style={{ width: "100%" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              display:"block", width:"100%", background:"#fff",
              borderRadius:12, border:"1px solid #e5e7eb",
              touchAction:"none", cursor:"crosshair"
            }}
          />
        </div>

        {/* Scale slider */}
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <span className="small">Scale (px/{UNIT_LABEL})</span>
            <span className="small">{Math.max(0.0001, Math.round(zoom * 1000) / 1000)} px/{UNIT_LABEL}</span>
          </div>
          <input type="range" min={MIN_S} max={MAX_S} step={0.01} value={sval}
                 onChange={(e) => onSliderChange(e.target.value)} style={{ width: "100%" }} />
          <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <span className="small">{MIN_S}</span><span className="small">0</span><span className="small">{MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Controls: title + add point */}
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title (e.g. P83 pipe)" value={title}
                 onChange={(e)=>setTitle(e.target.value)} style={{ flex: "1 1 260px" }} />
          <button className="btn" onClick={saveToFirebase}> Save</button>
        </div>

        {/* ENH add */}
        <div className="row" style={{ marginBottom: 8, flexWrap:"wrap" }}>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`H (level)`} value={H} onChange={(e)=>setH(e.target.value)} />
          <button className="btn" onClick={addPoint}> Add (label {nextLabel()})</button>
        </div>

        {/* Toolbar */}
        <div className="row" style={{ overflowX:"auto", paddingBottom:4, gap:8 }}>
          <button className="btn" onClick={()=>{ setMode("line"); setSelected([]); }}
            style={{ background: mode==="line" ? "#0ea5e9" : "#64748b" }}> Line</button>
          <button className="btn" onClick={()=>{ setMode("angle"); setSelected([]); }}
            style={{ background: mode==="angle" ? "#0ea5e9" : "#64748b" }}> Angle</button>
          <button className="btn" onClick={()=>{ setMode("eraseLine"); setSelected([]); }}
            style={{ background: mode==="eraseLine" ? "#0ea5e9" : "#64748b" }}> Erase line (tap)</button>

          <button className="btn" onClick={centerOnA}> Find A</button>
          <button className="btn" onClick={fitView}> Fit</button>
          <button className="btn" onClick={resetView}> Reset</button>
          <button className="btn" onClick={clearAll}> Clear All</button>
          <button className="btn" onClick={removeLastLine}> Remove last line</button>
          <button className="btn" onClick={clearLines}> Clear lines</button>

          <label className="row" style={{ gap:8, marginLeft:8 }}>
            <input type="checkbox" checked={autoFit} onChange={(e)=>setAutoFit(e.target.checked)} />
            <span className="small">Auto fit</span>
          </label>
        </div>

        {/* Circle tool */}
        <div className="row" style={{ marginTop:8, gap:8, flexWrap:"wrap" }}>
          <span className="small" style={{ minWidth:80, color:"#64748b" }}>Add Circle</span>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`Center E`} value={cE} onChange={(e)=>setCE(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`Center N`} value={cN} onChange={(e)=>setCN(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`Radius (${UNIT_LABEL})`} value={cR} onChange={(e)=>setCR(e.target.value)} />
          <button className="btn" onClick={addCircle}> Add Circle</button>
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines yet.</div>}
        {lines.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between" }}>
            <div>
              <b>{getLabel(l.p1)}–{getLabel(l.p2)}</b> &nbsp;
              <b>{Math.round(l.lenMm)} {UNIT_LABEL}</b>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length===0 && <div className="small">No angles yet.</div>}
        {angles.map(t=>(
          <div key={t.id} className="small">
            at <b>{getLabel(t.b)}</b> from <b>{getLabel(t.a)}</b>-<b>{getLabel(t.b)}</b>-<b>{getLabel(t.c)}</b> = <b>{t.deg}</b>°
          </div>
        ))}
      </div>

      {/* H Levels */}
      <div className="card">
        <div className="page-title">Levels (H)</div>
        {points.length===0 && <div className="small">No points.</div>}
        {points.length>0 && (
          <>
            <div style={{ overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:10 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    <th style={th}>Label</th><th style={th}>E</th><th style={th}>N</th><th style={th}>H</th>
                  </tr>
                </thead>
                <tbody>
                {points.map(p=>(
                  <tr key={p.id}>
                    <td style={td}><b>{p.label}</b></td>
                    <td style={td}>{p.x}</td>
                    <td style={td}>{p.y}</td>
                    <td style={td}>{p.h}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop:10 }}>
              <div className="small" style={{ color:"#64748b", marginBottom:6 }}>Same level summary</div>
              {levelSummary.length===0 && <div className="small">-</div>}
              {levelSummary.map((g,i)=>(
                <div key={i} className="small">
                  H = <b>{g.h}</b> → <b>{g.count}</b> point(s) &nbsp; labels: {g.labels.join(", ")}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const th = { textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" };
const td = { padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:13 };
