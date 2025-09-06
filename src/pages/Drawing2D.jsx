import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

// ---- helpers ----
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
  // data
  const [points, setPoints] = useState([]);   // {id,label,x,y}  (E=x, N=y)
  const [lines, setLines] = useState([]);     // {id,p1,p2,len}
  const [angles, setAngles] = useState([]);   // {id,a,b,c,deg}

  // inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [label, setLabel] = useState("");

  // UI state
  const [mode, setMode] = useState("line");   // 'line' | 'angle'
  const [selected, setSelected] = useState([]); // clicked point ids
  const [scale, setScale] = useState(4);      // px per unit

  const canvasRef = useRef(null);

  // ---- draw everything ----
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const w = cvs.width, h = cvs.height;
    const origin = { x: w / 2, y: h / 2 };
    const toScreen = (p) => ({ x: origin.x + p.x * scale, y: origin.y - p.y * scale });

    try {
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
      const step = scale * 10;
      for (let gx = origin.x % step; gx < w; gx += step) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = origin.y % step; gy < h; gy += step) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      // axes
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(w, origin.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, h); ctx.stroke();

      // lines with length
      ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2;
      ctx.fillStyle = "#0f172a"; ctx.font = "12px system-ui";
      lines.forEach((l) => {
        const p1 = points.find((p) => p.id === l.p1);
        const p2 = points.find((p) => p.id === l.p2);
        if (!p1 || !p2) return;
        const s1 = toScreen(p1), s2 = toScreen(p2);
        ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
        ctx.fillText(`${l.len}`, (s1.x + s2.x) / 2 + 6, (s1.y + s2.y) / 2 - 6);
      });

      // angles (arc + degree at vertex b)
      angles.forEach((t) => {
        const a = points.find((p) => p.id === t.a);
        const b = points.find((p) => p.id === t.b);
        const c = points.find((p) => p.id === t.c);
        if (!a || !b || !c) return;
        const sb = toScreen(b);
        ctx.fillStyle = "#0f172a";
        ctx.fillText(`${t.deg}°`, sb.x + 8, sb.y - 8);

        const a1 = Math.atan2(a.y - b.y, a.x - b.x);
        const a2 = Math.atan2(c.y - b.y, c.x - b.x);
        let start = a1, end = a2;
        while (end - start > Math.PI) start += 2 * Math.PI;
        while (start - end > Math.PI) end += 2 * Math.PI;
        ctx.beginPath(); ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
        ctx.arc(sb.x, sb.y, 20, -end, -start, true); ctx.stroke();
      });

      // points
      points.forEach((p) => {
        const s = toScreen(p);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.fillText(p.label ?? p.id, s.x + 6, s.y - 6);
      });
    } catch (e) {
      console.error("Canvas draw error:", e);
    }
  }, [points, lines, angles, scale]);

  // ---- add point from E,N ----
  const addPoint = () => {
    if (E === "" || N === "") return;
    const x = Number(E), y = Number(N);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    const id = safeId();
    setPoints((arr) => [...arr, { id, label: label || id, x, y }]);
    setE(""); setN(""); setLabel("");
  };

  // ---- pick nearest point on click ----
  const pickPointAt = (clientX, clientY) => {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    const w = cvs.width, h = cvs.height;
    const origin = { x: w / 2, y: h / 2 };
    const mx = clientX - rect.left, my = clientY - rect.top;
    const wx = (mx - origin.x) / scale;
    const wy = (origin.y - my) / scale;

    let nearest = null, best = Infinity;
    for (const p of points) {
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < best && d < 6 / scale) { best = d; nearest = p; }
    }
    return nearest;
  };

  const onCanvasClick = (e) => {
    const p = pickPointAt(e.clientX, e.clientY);
    if (!p) return;

    setSelected((sel) => {
      const next = [...sel, p.id];

      if (mode === "line" && next.length === 2) {
        const [aId, bId] = next;
        if (aId !== bId) {
          const a = points.find((x) => x.id === aId);
          const b = points.find((x) => x.id === bId);
          const id = safeId();
          setLines((ls) => [...ls, { id, p1: a.id, p2: b.id, len: dist(a, b).toFixed(3) }]);
        }
        return [];
      }

      if (mode === "angle" && next.length === 3) {
        const [aId, bId, cId] = next;
        if (new Set(next).size === 3) {
          const a = points.find((x) => x.id === aId);
          const b = points.find((x) => x.id === bId);
          const c = points.find((x) => x.id === cId);
          const id = safeId();
          setAngles((ag) => [...ag, { id, a: a.id, b: b.id, c: c.id, deg: angleDeg(a, b, c) }]);
        }
        return [];
      }

      return next;
    });
  };

  const deleteLine = (id) => setLines((ls) => ls.filter((l) => l.id !== id));

  // ---- save to Firebase (DB-only, base64) ----
  const saveToFirebase = async () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const tmp = document.createElement("canvas");
    tmp.width = cvs.width * 2; tmp.height = cvs.height * 2;
    const tctx = tmp.getContext("2d");
    tctx.scale(2, 2);
    tctx.drawImage(cvs, 0, 0);
    const dataUrl = tmp.toDataURL("image/png", 0.92);

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      expiresAt,
      dataUrl,
      meta: { points: points.length, lines: lines.length, triples: angles.length },
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧭 2D Drawing (E,N)</div>

        <div className="row" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="small">Add Point (E,N)</div>
            <div className="row">
              <input className="input" type="number" step="any" placeholder="E (x)"
                value={E} onChange={(e) => setE(e.target.value)} style={{ width: 120 }} />
              <input className="input" type="number" step="any" placeholder="N (y)"
                value={N} onChange={(e) => setN(e.target.value)} style={{ width: 120 }} />
              <input className="input" placeholder="Label (optional)"
                value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 160 }} />
              <button className="btn" onClick={addPoint}>➕ Add</button>
            </div>
          </div>

          <div className="row" style={{ marginLeft: "auto" }}>
            <div className="small">Mode:</div>
            <button className="btn" onClick={() => { setMode("line"); setSelected([]); }}
              style={{ opacity: mode === "line" ? 1 : 0.6 }}>📏 Line</button>
            <button className="btn" onClick={() => { setMode("angle"); setSelected([]); }}
              style={{ opacity: mode === "angle" ? 1 : 0.6 }}>∠ Angle</button>

            <div className="small" style={{ marginLeft: 10 }}>Scale: {scale}px/u</div>
            <input type="range" min="1" max="12" value={scale}
              onChange={(e) => setScale(Number(e.target.value))} />

            <button className="btn" onClick={() => { setPoints([]); setLines([]); setAngles([]); setSelected([]); }}>
              🧹 Clear
            </button>
            <button className="btn" onClick={saveToFirebase}>💾 Save</button>
          </div>
        </div>

        <p className="small" style={{ marginTop: 6 }}>
          Canvas မှာ point ပေါ်ကို click လုပ်နိုင်ပါတယ် — Line mode: point 2 ခုရွေးရင် line ထည့်ပြီး length ပြ • Angle mode: point 3 ခုရွေးရင် degree ပြ
        </p>

        <canvas
          ref={canvasRef}
          width={900}
          height={520}
          onClick={onCanvasClick}
          style={{
            width: "100%", maxWidth: 900, background: "#fff",
            borderRadius: 12, border: "1px solid #e5e7eb", cursor: "crosshair"
          }}
        />
      </div>

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
