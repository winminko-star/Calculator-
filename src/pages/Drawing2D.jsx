import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

// ---------- small helpers ----------
const safeId = () => (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

// ---------- export helpers (draw with given transform) ----------
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles) {
  // grid
  ctx.clearRect(0, 0, wCss, hCss);
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

  const W2S = (p) => ({ x: p.x * zoom + wCss/2 + tx, y: hCss/2 - p.y * zoom + ty });

  // lines + length
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2; ctx.fillStyle = "#0f172a"; ctx.font = "13px system-ui";
  lines.forEach(l => {
    const a = points.find(p => p.id === l.p1), b = points.find(p => p.id === l.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    ctx.fillText(`${l.len}`, (s1.x + s2.x)/2 + 6, (s1.y + s2.y)/2 - 6);
  });

  // angles
  angles.forEach(t=>{
    const a = points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb = W2S(b);
    ctx.fillStyle="#0f172a"; ctx.fillText(`${t.deg}°`, sb.x+10, sb.y-10);
    const a1=Math.atan2(a.y-b.y, a.x-b.x), a2=Math.atan2(c.y-b.y, c.x-b.x);
    let start=a1, end=a2; while(end-start>Math.PI) start+=2*Math.PI; while(start-end>Math.PI) end+=2*Math.PI;
    ctx.beginPath(); ctx.strokeStyle="#22c55e"; ctx.lineWidth=2; ctx.arc(sb.x, sb.y, 22, -end, -start, true); ctx.stroke();
  });

  // points (bigger + white halo)
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

// ============================================================
export default function Drawing2D() {
  // data
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);
  const [angles, setAngles] = useState([]);

  // inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [label, setLabel] = useState("");

  // modes / selection
  const [mode, setMode] = useState("line"); // 'line' | 'angle'
  const [selected, setSelected] = useState([]);
  const [refresh, setRefresh] = useState(0);

  // view transform
  const [zoom, setZoom] = useState(60);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // canvas
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
    const onResize = () => { clearTimeout(t); t = setTimeout(applySize, 60); };
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
  }, []);

  // 🔁 Restore from AllReview → localStorage
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
        if (typeof st.view.zoom === "number") setZoom(st.view.zoom);
        if (typeof st.view.tx === "number") setTx(st.view.tx);
        if (typeof st.view.ty === "number") setTy(st.view.ty);
      }
      setTimeout(() => setRefresh(r => r + 1), 0);
    } catch (e) {
      console.warn("restore failed", e);
    }
  }, []);

  // world<->screen
  const W2S = (p) => ({ x: p.x * zoom + sizeRef.current.wCss/2 + tx, y: sizeRef.current.hCss/2 - p.y*zoom + ty });
  const S2W = (sx, sy) => ({ x: (sx - sizeRef.current.wCss/2 - tx)/zoom, y: (sizeRef.current.hCss/2 - sy + ty)/zoom });

  // draw live
  useEffect(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawScene(ctx, sizeRef.current.wCss, sizeRef.current.hCss, zoom, tx, ty, points, lines, angles);
  }, [points, lines, angles, zoom, tx, ty, refresh]);

  // add point
  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E), y = Number(N);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    const id = safeId();
    setPoints(a => [...a, { id, label: label || id, x, y }]);
    setE(""); setN(""); setLabel("");
  };

  // gestures
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now() });
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: prev.t });

    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      setTx(v => v + (e.clientX - prev.x));
      setTy(v => v + (e.clientY - prev.y));
    } else if (pts.length >= 2) {
      const [p1, p2] = pts;
      const distPrev = Math.hypot(p1.x - prev.x, p1.y - prev.y) || 1;
      const distNow  = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const wrap = wrapRef.current, rect = wrap.getBoundingClientRect();
      const mid = { x: (p1.x + p2.x)/2 - rect.left, y: (p1.y + p2.y)/2 - rect.top };

      setZoom(z => {
        const nz = Math.min(300, Math.max(10, z * (distNow / distPrev)));
        const wx = (mid.x - tx) / z, wy = (mid.y - ty) / z;
        const afterX = wx * nz, afterY = wy * nz;
        setTx(v => v + (mid.x - (afterX + tx)));
        setTy(v => v + (mid.y - (afterY + ty)));
        return nz;
      });
    }
  };
  const onPointerUp = (e) => {
    const down = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);

    if (down && Date.now() - down.t < 200 && pointers.current.size === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const world = S2W(mx, my);
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
            setLines(ls=>[...ls,{ id:safeId(), p1:a.id, p2:b.id, len:dist(a,b).toFixed(3) }]);
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

  // view helpers
  const fitView = () => {
    if (points.length === 0) return;
    const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=maxX-minX || 1, h=maxY-minY || 1, pad=0.5;
    const { wCss,hCss }=sizeRef.current;
    const z = Math.min((wCss*0.9)/(w+pad*2), (hCss*0.9)/(h+pad*2));
    setZoom(Math.min(300, Math.max(10, z)));
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    setTx(-cx*z); setTy(cy*z);
  };
  const resetView = () => { setZoom(60); setTx(0); setTy(0); };
  const clearAll = () => { setPoints([]); setLines([]); setAngles([]); setSelected([]); };

  // ---------- SAVE (use CURRENT VIEW & store raw state) ----------
  const saveToFirebase = async () => {
    const { wCss, hCss } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;

    // hi-res offscreen (current view)
    const off = document.createElement("canvas");
    off.width  = wCss * 2 * dpr;
    off.height = hCss * 2 * dpr;
    const octx = off.getContext("2d");
    octx.setTransform(2 * dpr, 0, 0, 2 * dpr, 0, 0);
    drawScene(octx, wCss, hCss, zoom, tx, ty, points, lines, angles);
    const dataUrl = off.toDataURL("image/png", 0.92);

    // thumbnail (same view)
    const thumbMaxW = 600;
    const scale = thumbMaxW / wCss;
    const thumb = document.createElement("canvas");
    thumb.width = thumbMaxW;
    thumb.height = Math.round(hCss * scale);
    const tctx = thumb.getContext("2d");
    tctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawScene(tctx, wCss, hCss, zoom, tx, ty, points, lines, angles);
    let thumbUrl; try { thumbUrl = thumb.toDataURL("image/webp", 0.85); } catch { thumbUrl = thumb.toDataURL("image/jpeg", 0.85); }

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      expiresAt,
      dataUrl,
      thumbUrl,
      state: { points, lines, angles, view: { zoom, tx, ty } }, // ⭐ raw data + current view
      meta: { points: points.length, lines: lines.length, triples: angles.length },
    });

    alert("Saved ✅");
  };

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
            style={{ display:"block", width:"100%", background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", touchAction:"none", cursor:"crosshair" }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ position:"sticky", bottom:8, zIndex:10 }}>
        <div className="row">
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="E" value={E} onChange={(e)=>setE(e.target.value)}/>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="N" value={N} onChange={(e)=>setN(e.target.value)}/>
          <input className="input" placeholder="Label" value={label} onChange={(e)=>setLabel(e.target.value)}/>
          <button className="btn" onClick={addPoint}>➕ Add</button>
        </div>

        <div className="row" style={{ marginTop:8 }}>
          <button className="btn" onClick={()=>{ setMode("line"); setSelected([]); }} style={{ background: mode==="line" ? "#0ea5e9" : "#64748b" }}>📏 Line</button>
          <button className="btn" onClick={()=>{ setMode("angle"); setSelected([]); }} style={{ background: mode==="angle" ? "#0ea5e9" : "#64748b" }}>∠ Angle</button>

          <div className="row" style={{ marginLeft:"auto" }}>
            <button className="btn" onClick={fitView}>🧭 Fit</button>
            <button className="btn" onClick={resetView}>↺ Reset</button>
            <button className="btn" onClick={clearAll}>🧹 Clear</button>
            <button className="btn" onClick={saveToFirebase}>💾 Save</button>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines yet.</div>}
        {lines.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between" }}>
            <div>#{l.id} — {l.p1} ↔ {l.p2} — <b>{l.len}</b></div>
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
