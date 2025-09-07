// src/pages/Drawing2D.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** ===== Units / Display =====
 * Coordinates are in mm. (1 unit == 1 mm)
 * zoom = pixels per mm
 */
const UNIT_LABEL = "mm";

/* ---------- helpers ---------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);
const distMm = (a, b) => Math.hypot(b.x - a.x, b.y - a.y); // distance in mm

// Smaller angle (0..180°)
const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

// rounded label pill for angle text
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

/* ---------- scene renderer ---------- */
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, highlightLineId=null) {
  ctx.clearRect(0, 0, wCss, hCss);

  // grid
  const step = Math.max(zoom * 1, 24); // 1mm grid, but never denser than 24px
  const originX = wCss / 2 + tx;
  const originY = hCss / 2 + ty;

  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke(); }
  for (let gx = originX % step; gx > 0; gx -= step)   { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke(); }
  for (let gy = originY % step; gy < hCss; gy += step){ ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke(); }
  for (let gy = originY % step; gy > 0; gy -= step)   { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke(); }

  // axes (screen center axes)
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, hCss/2 + ty); ctx.lineTo(wCss, hCss/2 + ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss/2 + tx, 0); ctx.lineTo(wCss/2 + tx, hCss); ctx.stroke();

  // world(mm) → screen(px)
  const W2S = (p) => ({
    x: wCss/2 + p.x * zoom + tx,
    y: hCss/2 - p.y * zoom + ty
  });

  // lines + length (show in mm)
  ctx.font = "13px system-ui";
  lines.forEach(l => {
    const a = points.find(p => p.id === l.p1), b = points.find(p => p.id === l.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);

    ctx.lineWidth = 2;
    ctx.strokeStyle = (l.id === highlightLineId) ? "#ef4444" : "#0ea5e9";
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();

    ctx.fillStyle = "#0f172a";
    const midX = (s1.x + s2.x)/2 + 6, midY = (s1.y + s2.y)/2 - 6;
    ctx.fillText(`${Math.round(l.lenMm)} ${UNIT_LABEL}`, midX, midY);
  });

  // angles: label only (no arc)
  angles.forEach(t=>{
    const a = points.find(p=>p.id===t.a),
          b = points.find(p=>p.id===t.b),
          c = points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb = W2S(b);
    drawLabelPill(ctx, sb.x + 10, sb.y - 10, `${t.deg}°`);
  });

  // points (bigger + white halo + label)
  points.forEach(p=>{
    const s = W2S(p);
    const r = 6;
    ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.arc(s.x, s.y, r-1, 0, Math.PI*2); ctx.fill();

    const text = p.label ?? p.id;
    ctx.font = "13px system-ui";
    ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff";
    ctx.strokeText(text, s.x + 8, s.y - 8);
    ctx.fillStyle = "#0f172a"; ctx.fillText(text, s.x + 8, s.y - 8);
  });
}

/* ---------- distance from point to line segment (in px, screen space) ---------- */
function pointToSegDistPx(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  const hx = ax + t * vx, hy = ay + t * vy;
  return Math.hypot(px - hx, py - hy);
}

export default function Drawing2D() {
  /* ---------- data ---------- */
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);   // {id,p1,p2,lenMm}
  const [angles, setAngles] = useState([]);

  /* ---------- inputs ---------- */
  const [E, setE] = useState("");   // mm
  const [N, setN] = useState("");   // mm
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");

  /* ---------- modes / selection ---------- */
  // 'line' | 'angle' | 'eraseLine'
  const [mode, setMode] = useState("line");
  const [selected, setSelected] = useState([]);
  const [refresh, setRefresh] = useState(0);

  /* ---------- view transform ---------- */
  const BASE_ZOOM = 60;
  const MIN_Z = 0.0005;  // px/mm
  const MAX_Z = 2400;    // px/mm

  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [autoFit, setAutoFit] = useState(true);

  // slider state (−200 .. +80) in log scale (0.01 step)
  const MIN_S = -200, MAX_S = 80;
  const [sval, setSval] = useState(0);

  // UI highlight when Erase mode
  const [hoverLineId, setHoverLineId] = useState(null);

  const sliderToZoom = (s) => {
    const z = BASE_ZOOM * Math.pow(2, s / 10);
    return Math.min(MAX_Z, Math.max(MIN_Z, z));
  };
  const zoomToSlider = (z) => {
    const s = 10 * Math.log2((z || BASE_ZOOM) / BASE_ZOOM);
    return Math.min(MAX_S, Math.max(MIN_S, Math.round(s * 100) / 100));
  };

  /* ---------- canvas ---------- */
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ wCss: 360, hCss: 420 });
  const pointers = useRef(new Map());

  // size / DPR setup
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
      setRefresh(r => r + 1);
    };

    applySize();
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        applySize();
        if (autoFit) fitView(points); // refit on rotate/resize
      }, 60);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const onVis = () => document.visibilityState === "visible" && setRefresh(r => r + 1);
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, [autoFit, points]);

  // Restore from AllReview → localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("wmk_restore");
      if (!raw) return;
      localStorage.removeItem("wmk_restore");
      const st = JSON.parse(raw);
      if (st.points) setPoints(st.points);
      if (st.lines) setLines(st.lines);
      if (st.angles) setAngles(st.angles);
      if (st.view) {
        if (typeof st.view.zoom === "number") { setZoom(st.view.zoom); setSval(zoomToSlider(st.view.zoom)); }
        if (typeof st.view.tx === "number") setTx(st.view.tx);
        if (typeof st.view.ty === "number") setTy(st.view.ty);
      }
      setTimeout(() => setRefresh(r => r + 1), 0);
    } catch (e) {
      console.warn("restore failed", e);
    }
  }, []);

  // draw live
  useEffect(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawScene(ctx, sizeRef.current.wCss, sizeRef.current.hCss, zoom, tx, ty, points, lines, angles, hoverLineId);
  }, [points, lines, angles, zoom, tx, ty, refresh, hoverLineId]);

  /* ---------- Fit/Reset/Clear ---------- */
  const fitView = (pts = points) => {
    if (!pts || pts.length === 0) return;

    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    const { wCss, hCss } = sizeRef.current;

    if (w === 0 && h === 0) {
      // single point — center and zoom big
      const targetZ = Math.min(wCss, hCss) * 0.5;
      const nz = Math.min(MAX_Z, Math.max(MIN_Z, targetZ));
      setZoom(nz); setSval(zoomToSlider(nz));
      const p = pts[0];
      setTx(-p.x * nz);
      setTy(+p.y * nz);
      return;
    }

    const pad = 0.1 * Math.max(w, h);
    const zX = (wCss * 0.9) / (w + pad * 2);
    const zY = (hCss * 0.9) / (h + pad * 2);
    const nz = Math.min(MAX_Z, Math.max(MIN_Z, Math.min(zX, zY)));

    setZoom(nz); setSval(zoomToSlider(nz));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTx(-cx * nz);
    setTy(+cy * nz);
  };

  const resetView = () => { setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearAll = () => { setPoints([]); setLines([]); setAngles([]); setSelected([]); };

  // auto-fit whenever points change (and toggle ON)
  useEffect(() => {
    if (autoFit) fitView(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, autoFit]);

  /* ---------- Add point ---------- */
  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E), y = Number(N);
    if (!isFinite(x) || !isFinite(y)) return;
    const id = safeId();
    const next = [...points, { id, label: label || id, x, y }];
    setPoints(next);
    setE(""); setN(""); setLabel("");
    if (autoFit) setTimeout(() => fitView(next), 0);
  };

  /* ---------- Line deletion helpers ---------- */
  const removeLine = (id) => setLines((ls) => ls.filter((l) => l.id !== id));
  const removeLastLine = () => setLines((ls) => ls.slice(0, -1));
  const clearLinesOnly = () => setLines([]);

  // Hit-test for nearest line in px threshold (screen coords)
  const hitTestLine = (mx, my) => {
    const { wCss, hCss } = sizeRef.current;
    // world→screen helper
    const W2S = (p) => ({ x: wCss/2 + p.x*zoom + tx, y: hCss/2 - p.y*zoom + ty });
    let best = { id: null, d: Infinity };
    lines.forEach(l => {
      const a = points.find(p=>p.id===l.p1);
      const b = points.find(p=>p.id===l.p2);
      if (!a || !b) return;
      const s1 = W2S(a), s2 = W2S(b);
      const d = pointToSegDistPx(mx, my, s1.x, s1.y, s2.x, s2.y);
      if (d < best.d) best = { id: l.id, d };
    });
    const tol = 10; // px
    return best.d <= tol ? best.id : null;
  };

  /* ---------- Gestures (pan / pinch / erase / tap-select) ---------- */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now() });

    if (mode === "eraseLine") {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const id = hitTestLine(mx, my);
      setHoverLineId(id);
    }
  };

  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: prev.t });

    const pts = [...pointers.current.values()];
    if (pts.length === 1 && mode !== "eraseLine") {
      setTx(v => v + (e.clientX - prev.x));
      setTy(v => v + (e.clientY - prev.y));
    } else if (pts.length >= 2 && mode !== "eraseLine") {
      const [p1, p2] = pts;
      const distPrev = Math.hypot(p1.x - prev.x, p1.y - prev.y) || 1;
      const distNow  = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;

      const w = sizeRef.current.wCss, h = sizeRef.current.hCss;
      const wrap = wrapRef.current, rect = wrap.getBoundingClientRect();
      const mid = { x: (p1.x + p2.x)/2 - rect.left, y: (p1.y + p2.y)/2 - rect.top };

      setZoom(z => {
        const nz = Math.min(MAX_Z, Math.max(MIN_Z, z * (distNow / distPrev)));
        const wx = ((mid.x - (w/2) - tx) ) / z;
        const wy = ((h/2) - (mid.y - ty) ) / z;
        const sx_after = w/2 + wx * nz + tx;
        const sy_after = h/2 - wy * nz + ty;
        setTx(v => v + (mid.x - sx_after));
        setTy(v => v + (mid.y - sy_after));
        setSval(zoomToSlider(nz));
        return nz;
      });
    }

    if (mode === "eraseLine") {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const id = hitTestLine(mx, my);
      setHoverLineId(id);
    }
  };

  const onPointerUp = (e) => {
    const down = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (mode === "eraseLine") {
      const id = hitTestLine(mx, my);
      if (id) removeLine(id);
      setHoverLineId(null);
      return;
    }

    // quick tap -> select nearest point
    if (down && Date.now() - down.t < 200 && pointers.current.size === 0) {
      const x = (mx - sizeRef.current.wCss/2 - tx)/zoom;
      const y = (sizeRef.current.hCss/2 - my + ty)/zoom;
      const hitR = 12 / zoom; // 12px → mm
      let pick=null, best=Infinity;
      for (const p of points) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best && d <= hitR) { best = d; pick = p; }
      }
      if (!pick) return;

      setSelected(sel=>{
        const next=[...sel, pick.id];

        if (mode==="line" && next.length===2) {
          const [aId,bId]=next; if (aId!==bId) {
            const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
            const len = distMm(a,b);
            setLines(ls=>[...ls,{ id:safeId(), p1:a.id, p2:b.id, lenMm: len }]);
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
    }
  };

  /* ---------- SAVE (no image) — Title + raw state only ---------- */
  const saveToFirebase = async () => {
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      expiresAt,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, view: { zoom, tx, ty } },
      meta: { points: points.length, lines: lines.length, triples: angles.length },
    });
    alert("Saved ✅");
  };

  // slider change
  const onSliderChange = (v) => {
    const s = Number(v);
    setSval(s);
    setZoom(sliderToZoom(s));
  };
  return (
    <div className="grid">
      {/* Canvas (with vertical scale slider overlay at right) */}
      <div className="card" style={{ padding: 8, position: "relative" }}>
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
              touchAction:"none", cursor: mode==="eraseLine" ? "not-allowed" : "crosshair"
            }}
          />
        </div>

        {/* vertical slider (−200 .. +80, step 0.01) */}
        <div style={{
          position: "absolute", right: 8, top: 12, bottom: 12,
          width: 56, display: "grid", placeItems: "center", gap: 6,
          background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 12, padding: 6
        }}>
          <div className="small" style={{ textAlign:"center" }}>
            Scale<br/>(px/{UNIT_LABEL})
          </div>
          <input
            type="range"
            min={-200}
            max={80}
            step={0.01}
            value={sval}
            onChange={(e)=>onSliderChange(e.target.value)}
            style={{
              writingMode: "bt-lr",
              WebkitAppearance: "slider-vertical",
              height: "74%", width: 24
            }}
          />
          <div className="small" style={{ textAlign:"center" }}>
            {Math.max(0.0001, Math.round(zoom*1000)/1000)} px/{UNIT_LABEL}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ position:"sticky", bottom:8, zIndex:10 }}>
        {/* Title */}
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Title (e.g. P83 pipe)"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            style={{ flex: "1 1 260px" }}
          />
          <button className="btn" onClick={saveToFirebase}>💾 Save</button>
        </div>

        {/* Add point (mm inputs) */}
        <div className="row">
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)}/>
          <input className="input" placeholder="Label" value={label} onChange={(e)=>setLabel(e.target.value)}/>
          <button className="btn" onClick={addPoint}>➕ Add</button>
        </div>

        <div className="row" style={{ marginTop:8, alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <button className="btn" onClick={()=>{ setMode("line"); setSelected([]); setHoverLineId(null); }}
                  style={{ background: mode==="line" ? "#0ea5e9" : "#64748b" }}>
            📏 Line
          </button>
          <button className="btn" onClick={()=>{ setMode("angle"); setSelected([]); setHoverLineId(null); }}
                  style={{ background: mode==="angle" ? "#0ea5e9" : "#64748b" }}>
            ∠ Angle
          </button>
          <button className="btn" onClick={()=>{ setMode("eraseLine"); setSelected([]); }}
                  style={{ background: mode==="eraseLine" ? "#ef4444" : "#64748b" }}>
            🧽 Erase Line (tap)
          </button>

          <div className="row" style={{ marginLeft:"auto", alignItems:"center", gap:8 }}>
            <button className="btn" onClick={fitView}>🧭 Fit</button>
            <button className="btn" onClick={resetView}>↺ Reset</button>
            <button className="btn" onClick={clearAll}>🧹 Clear All</button>

            {/* line-only tools */}
            <button className="btn" onClick={removeLastLine} style={{ background:"#f59e0b" }}>
              ⤺ Remove last line
            </button>
            <button className="btn" onClick={clearLinesOnly} style={{ background:"#ef4444" }}>
              ✖ Clear lines
            </button>

            <label className="row" style={{ gap: 8, marginLeft: 8 }}>
              <input type="checkbox" checked={autoFit} onChange={(e) => setAutoFit(e.target.checked)} />
              <span className="small">Auto fit</span>
            </label>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines yet.</div>}
        {lines.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between", alignItems:"center", gap:8 }}>
            <div>
              #{l.id} — {l.p1} ↔ {l.p2} — <b>{Math.round(l.lenMm)} {UNIT_LABEL}</b>
            </div>
            <div className="row" style={{ gap:8 }}>
              <button className="btn" onClick={()=>removeLine(l.id)} style={{ background:"#ef4444" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length===0 && <div className="small">No angles yet.</div>}
        {angles.map(t=>(
          <div key={t.id} className="small">
            #{t.id} — ∠ at <b>{t.b}</b> from <b>{t.a}</b>→<b>{t.b}</b>→<b>{t.c}</b> = <b>{t.deg}°</b>
          </div>
        ))}
      </div>
    </div>
  );
        }
