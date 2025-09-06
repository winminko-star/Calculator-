import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

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

export default function Drawing2D() {
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);
  const [angles, setAngles] = useState([]);
  const [E, setE] = useState(""); const [N, setN] = useState(""); const [label, setLabel] = useState("");
  const [mode, setMode] = useState("line");
  const [selected, setSelected] = useState([]);
  const [scale, setScale] = useState(6);  // phone default: bigger

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ wCss: 360, hCss: 420 }); // phone-first

  // stable sizing
  useEffect(() => {
    const cvs = canvasRef.current, wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parentW = Math.max(320, Math.floor(wrap.clientWidth || 360));
      // use dynamic viewport height (100dvh) fallback
      let hCss = Math.min(Math.max(Math.floor(parentW * 1.0), 360), 640);
      sizeRef.current = { wCss: parentW, hCss };
      cvs.style.width = parentW + "px";
      cvs.style.height = hCss + "px";
      cvs.width = Math.floor(parentW * dpr);
      cvs.height = Math.floor(hCss * dpr);
      const ctx = cvs.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
    };
    applySize();
    const onResize = () => applySize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, []);

  // draw
  useEffect(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    const { wCss, hCss } = sizeRef.current;
    const origin = { x: wCss / 2, y: hCss / 2 };
    const toScreen = (p) => ({ x: origin.x + p.x * scale, y: origin.y - p.y * scale });

    ctx.clearRect(0, 0, wCss, hCss);

    // grid
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    const step = Math.max(scale * 10, 24);
    for (let gx = origin.x % step; gx < wCss; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke(); }
    for (let gy = origin.y % step; gy < hCss; gy += step) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke(); }

    // axes
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(wCss, origin.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, hCss); ctx.stroke();

    // lines
    ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2;
    ctx.fillStyle = "#0f172a"; ctx.font = "13px system-ui";
    lines.forEach((l) => {
      const p1 = points.find((p) => p.id === l.p1);
      const p2 = points.find((p) => p.id === l.p2);
      if (!p1 || !p2) return;
      const s1 = toScreen(p1), s2 = toScreen(p2);
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
      ctx.fillText(`${l.len}`, (s1.x + s2.x) / 2 + 6, (s1.y + s2.y) / 2 - 6);
    });

    // angles
    angles.forEach((t) => {
      const a = points.find((p) => p.id === t.a);
      const b = points.find((p) => p.id === t.b);
      const c = points.find((p) => p.id === t.c);
      if (!a || !b || !c) return;
      const sb = toScreen(b);
      ctx.fillStyle = "#0f172a"; ctx.fillText(`${t.deg}°`, sb.x + 10, sb.y - 10);
      const a1 = Math.atan2(a.y - b.y, a.x - b.x);
      const a2 = Math.atan2(c.y - b.y, c.x - b.x);
      let start = a1, end = a2;
      while (end - start > Math.PI) start += 2 * Math.PI;
      while (start - end > Math.PI) end += 2 * Math.PI;
      ctx.beginPath(); ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
      ctx.arc(sb.x, sb.y, 22, -end, -start, true); ctx.stroke();
    });

    // points
    points.forEach((p) => {
      const s = toScreen(p);
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillText(p.label ?? p.id, s.x + 6, s.y - 6);
    });
  }, [points, lines, angles, scale]);

  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E), y = Number(N); if (Number.isNaN(x) || Number.isNaN(y)) return;
    const id = safeId();
    setPoints((arr) => [...arr, { id, label: label || id, x, y }]);
    setE(""); setN(""); setLabel("");
  };

  const handlePointer = (evt) => {
    evt.preventDefault?.();
    const cvs = canvasRef.current; if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const mx = (evt.clientX ?? evt.touches?.[0]?.clientX) - rect.left;
    const my = (evt.clientY ?? evt.touches?.[0]?.clientY) - rect.top;

    const { wCss, hCss } = sizeRef.current;
    const origin = { x: wCss / 2, y: hCss / 2 };
    const wx = (mx - origin.x) / scale;
    const wy = (origin.y - my) / scale;

    const hitR = 12 / scale;
    let pick = null, best = Infinity;
    for (const p of points) {
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < best && d <= hitR) { best = d; pick = p; }
    }
    if (!pick) return;

    setSelected((sel) => {
      const next = [...sel, pick.id];
      if (mode === "line" && next.length === 2) {
        const [aId, bId] = next; if (aId !== bId) {
          const a = points.find((x) => x.id === aId);
          const b = points.find((x) => x.id === bId);
          const id = safeId(); setLines((ls) => [...ls, { id, p1: a.id, p2: b.id, len: dist(a, b).toFixed(3) }]);
        }
        return [];
      }
      if (mode === "angle" && next.length === 3) {
        const [aId, bId, cId] = next;
        if (new Set(next).size === 3) {
          const a = points.find((x) => x.id === aId);
          const b = points.find((x) => x.id === bId);
          const c = points.find((x) => x.id === cId);
          const id = safeId(); setAngles((ag) => [...ag, { id, a: a.id, b: b.id, c: c.id, deg: angleDeg(a, b, c) }]);
        }
        return [];
      }
      return next;
    });
  };

  const deleteLine = (id) => setLines((ls) => ls.filter((l) => l.id !== id));

  const saveToFirebase = async () => {
    const cvs = canvasRef.current; if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const { wCss, hCss } = sizeRef.current;
    const tmp = document.createElement("canvas");
    tmp.width = wCss * 2 * dpr; tmp.height = hCss * 2 * dpr;
    const tctx = tmp.getContext("2d");
    tctx.setTransform(2 * dpr, 0, 0, 2 * dpr, 0, 0);
    tctx.drawImage(cvs, 0, 0);
    const dataUrl = tmp.toDataURL("image/png", 0.92);
    const now = Date.now(); const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    await set(push(dbRef(db, "drawings")), {
      createdAt: now, expiresAt, dataUrl,
      meta: { points: points.length, lines: lines.length, triples: angles.length },
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      {/* Canvas block */}
      <div className="card" style={{ padding: 8 }}>
        <div ref={wrapRef} style={{ width: "100%" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointer}
            style={{
              display: "block",
              width: "100%", background: "#fff",
              borderRadius: 12, border: "1px solid #e5e7eb",
              touchAction: "none", cursor: "crosshair",
            }}
          />
        </div>
      </div>

      {/* Sticky controls for phone */}
      <div
        className="card"
        style={{
          position: "sticky", bottom: 8, zIndex: 10,
          backdropFilter: "blur(4px)"
        }}
      >
        <div className="row">
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="E"
                 value={E} onChange={(e) => setE(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="N"
                 value={N} onChange={(e) => setN(e.target.value)} />
          <input className="input" placeholder="Label"
                 value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn" onClick={addPoint}>➕ Add</button>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => { setMode("line"); setSelected([]); }}
            style={{ background: mode === "line" ? "#0ea5e9" : "#64748b" }}>📏 Line</button>
          <button className="btn" onClick={() => { setMode("angle"); setSelected([]); }}
            style={{ background: mode === "angle" ? "#0ea5e9" : "#64748b" }}>∠ Angle</button>

          <div className="small" style={{ marginLeft: "auto" }}>Scale: {scale}px/u</div>
          <input type="range" min="3" max="12" value={scale}
                 onChange={(e) => setScale(Number(e.target.value))} style={{ width: 120 }} />

          <button className="btn" onClick={() => { setPoints([]); setLines([]); setAngles([]); setSelected([]); }}>
            🧹 Clear
          </button>
          <button className="btn" onClick={saveToFirebase}>💾 Save</button>
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length === 0 && <div className="small">No lines yet.</div>}
        {lines.map((l) => (
          <div key={l.id} className="row" style={{ justifyContent: "space-between" }}>
            <div>#{l.id} — {l.p1} ↔ {l.p2} — <b>{l.len}</b></div>
            <button className="btn" onClick={() => deleteLine(l.id)}>🗑 Delete</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length === 0 && <div className="small">No angles yet.</div>}
        {angles.map((t) => (
          <div key={t.id} className="small">
            #{t.id} — ∠ at <b>{t.b}</b> from <b>{t.a}</b>→<b>{t.b}</b>→<b>{t.c}</b> = <b>{t.deg}°</b>
          </div>
        ))}
      </div>
    </div>
  );
      }
