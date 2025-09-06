// src/pages/Drawing2D.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

// ---------- small helpers ----------
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);
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

// ---------- export helpers (fit-to-content) ----------
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles) {
  // grid
  ctx.clearRect(0, 0, wCss, hCss);
  const step = Math.max(zoom * 1, 24);
  const originX = wCss / 2 + tx;
  const originY = hCss / 2 + ty;

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, hCss);
    ctx.stroke();
  }
  for (let gx = originX % step; gx > 0; gx -= step) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, hCss);
    ctx.stroke();
  }
  for (let gy = originY % step; gy < hCss; gy += step) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(wCss, gy);
    ctx.stroke();
  }
  for (let gy = originY % step; gy > 0; gy -= step) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(wCss, gy);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, hCss / 2 + ty);
  ctx.lineTo(wCss, hCss / 2 + ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wCss / 2 + tx, 0);
  ctx.lineTo(wCss / 2 + tx, hCss);
  ctx.stroke();

  const W2S = (p) => ({
    x: p.x * zoom + wCss / 2 + tx,
    y: hCss / 2 - p.y * zoom + ty,
  });

  // lines
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#0f172a";
  ctx.font = "13px system-ui";
  lines.forEach((l) => {
    const a = points.find((p) => p.id === l.p1);
    const b = points.find((p) => p.id === l.p2);
    if (!a || !b) return;
    const s1 = W2S(a),
      s2 = W2S(b);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    ctx.fillText(`${l.len}`, (s1.x + s2.x) / 2 + 6, (s1.y + s2.y) / 2 - 6);
  });

  // angles
  angles.forEach((t) => {
    const a = points.find((p) => p.id === t.a);
    const b = points.find((p) => p.id === t.b);
    const c = points.find((p) => p.id === t.c);
    if (!a || !b || !c) return;
    const sb = W2S(b);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`${t.deg}°`, sb.x + 10, sb.y - 10);
    const a1 = Math.atan2(a.y - b.y, a.x - b.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let start = a1,
      end = a2;
    while (end - start > Math.PI) start += 2 * Math.PI;
    while (start - end > Math.PI) end += 2 * Math.PI;
    ctx.beginPath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.arc(sb.x, sb.y, 22, -end, -start, true);
    ctx.stroke();
  });

  // points
  points.forEach((p) => {
    const s = W2S(p);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(p.label ?? p.id, s.x + 6, s.y - 6);
  });
}

function computeFit(points, wCss, hCss, padUnits = 0.5) {
  if (!points.length) return { zoom: 60, tx: 0, ty: 0 };
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  let minX = Math.min(...xs),
    maxX = Math.max(...xs);
  let minY = Math.min(...ys),
    maxY = Math.max(...ys);
  minX -= padUnits;
  maxX += padUnits;
  minY -= padUnits;
  maxY += padUnits;

  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const z = Math.min((wCss * 0.9) / w, (hCss * 0.9) / h);
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  return { zoom: z, tx: -cx * z, ty: cy * z };
}

// ============================================================
export default function Drawing2D() {
  // data
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);
  const [angles, setAngles] = useState([]);

  // UI inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [label, setLabel] = useState("");

  // modes / selection
  const [mode, setMode] = useState("line"); // line | angle
  const [selected, setSelected] = useState([]);
  const [refresh, setRefresh] = useState(0);

  // view transform
  const [zoom, setZoom] = useState(60);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // canvas stuff
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ wCss: 360, hCss: 420 });
  const pointers = useRef(new Map());

  // sizing & context setup
  useEffect(() => {
    const cvs = canvasRef.current,
      wrap = wrapRef.current;
    if (!cvs || !wrap) return;

    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(320, Math.floor(wrap.clientWidth || 360));
      const h = Math.min(Math.max(Math.floor(w * 1.0), 360), 640);
      sizeRef.current = { wCss: w, hCss: h };
      cvs.style.width = w + "px";
      cvs.style.height = h + "px";
      cvs.width = Math.floor(w * dpr);
      cvs.height = Math.floor(h * dpr);
      const ctx = cvs.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
      setRefresh((r) => r + 1);
    };
    apply();

    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(apply, 60);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const onVis = () =>
      document.visibilityState === "visible" && setRefresh((r) => r + 1);
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

  // world<->screen
  const W2S = (p) => ({
    x: p.x * zoom + sizeRef.current.wCss / 2 + tx,
    y: sizeRef.current.hCss / 2 - p.y * zoom + ty,
  });
  const S2W = (sx, sy) => ({
    x: (sx - sizeRef.current.wCss / 2 - tx) / zoom,
    y: (sizeRef.current.hCss / 2 - sy + ty) / zoom,
  });

  // draw live canvas
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawScene(
      ctx,
      sizeRef.current.wCss,
      sizeRef.current.hCss,
      zoom,
      tx,
      ty,
      points,
      lines,
      angles
    );
  }, [points, lines, angles, zoom, tx, ty, refresh]);

  // add point
  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E),
      y = Number(N);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    const id = safeId();
    setPoints((a) => [...a, { id, label: label || id, x, y }]);
    setE("");
    setN("");
    setLabel("");
  };

  // gestures (pan / pinch / tap)
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now() });
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: prev.t });

    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      setTx((v) => v + (e.clientX - prev.x));
      setTy((v) => v + (e.clientY - prev.y));
    } else if (pts.length >= 2) {
      const [p1, p2] = pts;
      const distPrev =
        Math.hypot(p1.x - prev.x, p1.y - prev.y) || 1; // approximate
      const distNow = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      const wrap = wrapRef.current;
      const rect = wrap.getBoundingClientRect();
      const fx = mid.x - rect.left;
      const fy = mid.y - rect.top;

      setZoom((z) => {
        const nz = Math.min(300, Math.max(10, z * (distNow / distPrev)));
        const wx = (fx - tx) / z;
        const wy = (fy - ty) / z;
        const afterX = wx * nz;
        const afterY = wy * nz;
        setTx((v) => v + (fx - (afterX + tx)));
        setTy((v) => v + (fy - (afterY + ty)));
        return nz;
      });
    }
  };
  const onPointerUp = (e) => {
    const down = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);

    // quick tap -> select nearest point
    if (down && Date.now() - down.t < 200 && pointers.current.size === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const world = S2W(mx, my);
      const hitR = 12 / zoom;
      let pick = null,
        best = Infinity;
      for (const p of points) {
        const d = Math.hypot(p.x - world.x, p.y - world.y);
        if (d < best && d <= hitR) {
          best = d;
          pick = p;
        }
      }
      if (!pick) return;

      setSelected((sel) => {
        const next = [...sel, pick.id];

        if (mode === "line" && next.length === 2) {
          const [aId, bId] = next;
          if (aId !== bId) {
            const a = points.find((x) => x.id === aId);
            const b = points.find((x) => x.id === bId);
            setLines((ls) => [
              ...ls,
              { id: safeId(), p1: a.id, p2: b.id, len: dist(a, b).toFixed(3) },
            ]);
          }
          return [];
        }
        if (mode === "angle" && next.length === 3) {
          const [aId, bId, cId] = next;
          if (new Set(next).size === 3) {
            const a = points.find((x) => x.id === aId);
            const b = points.find((x) => x.id === bId);
            const c = points.find((x) => x.id === cId);
            setAngles((ag) => [
              ...ag,
              { id: safeId(), a: a.id, b: b.id, c: c.id, deg: angleDeg(a, b, c) },
            ]);
          }
          return [];
        }
        return next;
      });
    }
  };

  // Fit/Reset/Clear
  const fitView = () => {
    const { wCss, hCss } = sizeRef.current;
    const t = computeFit(points, wCss, hCss, 0.5);
    setZoom(t.zoom);
    setTx(t.tx);
    setTy(t.ty);
  };
  const resetView = () => {
    setZoom(60);
    setTx(0);
    setTy(0);
  };
  const clearAll = () => {
    setPoints([]);
    setLines([]);
    setAngles([]);
    setSelected([]);
  };

  // ---------- SAVE (fit-to-content export) ----------
  const saveToFirebase = async () => {
    const { wCss, hCss } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;

    // hi-res offscreen
    const outW = Math.floor(wCss * 2 * dpr);
    const outH = Math.floor(hCss * 2 * dpr);
    const off = document.createElement("canvas");
    off.width = outW;
    off.height = outH;
    const octx = off.getContext("2d");
    octx.setTransform(2 * dpr, 0, 0, 2 * dpr, 0, 0);

    // compute fit (ignore current view)
    const t = computeFit(points, wCss, hCss, 0.8);
    drawScene(octx, wCss, hCss, t.zoom, t.tx, t.ty, points, lines, angles);

    const dataUrl = off.toDataURL("image/png", 0.92);

    // thumbnail 600px width
    const maxW = 600;
    const ratio = (wCss * 2 * dpr) / maxW;
    const thumb = document.createElement("canvas");
    thumb.width = maxW;
    thumb.height = Math.round((hCss * 2 * dpr) / ratio);
    const tctx = thumb.getContext("2d");
    tctx.drawImage(off, 0, 0, thumb.width, thumb.height);
    let thumbUrl;
    try {
      thumbUrl = thumb.toDataURL("image/webp", 0.85);
    } catch {
      thumbUrl = thumb.toDataURL("image/jpeg", 0.85);
    }

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      expiresAt,
      dataUrl,
      thumbUrl,
      meta: {
        points: points.length,
        lines: lines.length,
        triples: angles.length,
      },
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
            style={{
              display: "block",
              width: "100%",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              touchAction: "none",
              cursor: "crosshair",
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ position: "sticky", bottom: 8, zIndex: 10 }}>
        <div className="row">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="E"
            value={E}
            onChange={(e) => setE(e.target.value)}
          />
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="N"
            value={N}
            onChange={(e) => setN(e.target.value)}
          />
          <input
            className="input"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button className="btn" onClick={addPoint}>
            ➕ Add
          </button>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="btn"
            onClick={() => {
              setMode("line");
              setSelected([]);
            }}
            style={{ background: mode === "line" ? "#0ea5e9" : "#64748b" }}
          >
            📏 Line
          </button>
          <button
            className="btn"
            onClick={() => {
              setMode("angle");
              setSelected([]);
            }}
            style={{ background: mode === "angle" ? "#0ea5e9" : "#64748b" }}
          >
            ∠ Angle
          </button>

          <div className="row" style={{ marginLeft: "auto" }}>
            <button className="btn" onClick={fitView}>
              🧭 Fit
            </button>
            <button className="btn" onClick={resetView}>
              ↺ Reset
            </button>
            <button className="btn" onClick={clearAll}>
              🧹 Clear
            </button>
            <button className="btn" onClick={saveToFirebase}>
              💾 Save
            </button>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length === 0 && <div className="small">No lines yet.</div>}
        {lines.map((l) => (
          <div key={l.id} className="row" style={{ justifyContent: "space-between" }}>
            <div>
              #{l.id} — {l.p1} ↔ {l.p2} — <b>{l.len}</b>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length === 0 && <div className="small">No angles yet.</div>}
        {angles.map((t) => (
          <div key={t.id} className="small">
            #{t.id} — ∠ at <b>{t.b}</b> from <b>{t.a}</b>→<b>{t.b}</b>→<b>{t.c}</b> ={" "}
            <b>{t.deg}°</b>
          </div>
        ))}
      </div>
    </div>
  );
  }
