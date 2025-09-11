// src/pages/CanvasENH.jsx // React component: ENH canvas drawer with series + special joins, // custom keypad (no native keyboard), and "Save Review" snapshots // (stored in localStorage). No external libraries required.

import React, { useEffect, useMemo, useRef, useState } from "react"; import "../index.css"; // you can keep your global styles; minimal styles are inside this file as well

export default function CanvasENH() { // ====== UI state ====== const [count, setCount] = useState(4); // number of input rows const [values, setValues] = useState(() => Array.from({ length: 4 }, (_, i) => (i === 0 ? "0,0,0" : i === 1 ? "2000,0,0" : i === 2 ? "2000,1500,0" : "0,1500,0")) ); const [specialJoins, setSpecialJoins] = useState([]); // [{a:3,b:6}] const [sjInput, setSjInput] = useState(""); const [closeShape, setCloseShape] = useState(true); const [showKeypad, setShowKeypad] = useState(false); const [activeIndex, setActiveIndex] = useState(-1); const [showReviews, setShowReviews] = useState(false); const canvasRef = useRef(null);

// snapshots key const LS_KEY = "ENH_SNAPSHOTS_V1";

// ====== handlers ====== const applyCount = () => { setValues((prev) => { const next = prev.slice(0, count); while (next.length < count) next.push(""); return next; }); };

const updateValue = (idx, val) => { setValues((prev) => prev.map((v, i) => (i === idx ? val : v))); };

const addSJ = () => { const t = sjInput.trim(); if (!t) return; const arr = t.split(",").map((s) => Number(s.trim())); if (arr.length !== 2 || !Number.isInteger(arr[0]) || !Number.isInteger(arr[1])) { alert("Format should be a,b (numbers)"); return; } setSpecialJoins((p) => [...p, { a: arr[0], b: arr[1] }]); setSjInput(""); };

const removeSJ = (i) => { setSpecialJoins((p) => p.filter((_, idx) => idx !== i)); };

const clearAll = () => { setValues(Array.from({ length: count }, () => "")); setSpecialJoins([]); setShowKeypad(false); setActiveIndex(-1); draw(); };

// ====== parse points ====== function parsePoints() { const pts = []; for (let i = 0; i < values.length; i++) { const t = (values[i] || "").trim(); if (!t) continue; const a = t.split(",").map((s) => Number(s.trim())); if (a.length < 2 || a.some((x) => Number.isNaN(x))) continue; const [E, N, H = 0] = a; pts.push({ id: i + 1, E, N, H }); } return pts; }

// ====== math helpers ====== const dist = (A, B) => Math.hypot(B.E - A.E, B.N - A.N); const vec = (A, B) => ({ x: B.E - A.E, y: B.N - A.N }); function angleDeg(prev, center, next) { const v1 = vec(center, prev); const v2 = vec(center, next); const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y); if (d === 0) return null; let c = (v1.x * v2.x + v1.y * v2.y) / d; c = Math.max(-1, Math.min(1, c)); return (Math.acos(c) * 180) / Math.PI; // 0..180 }

// ====== draw ====== function draw() { const cv = canvasRef.current; if (!cv) return; const cx = cv.getContext("2d"); cx.clearRect(0, 0, cv.width, cv.height);

const pts = parsePoints();
if (pts.length < 2) return;

const pad = 80;
const minE = Math.min(...pts.map((p) => p.E));
const maxE = Math.max(...pts.map((p) => p.E));
const minN = Math.min(...pts.map((p) => p.N));
const maxN = Math.max(...pts.map((p) => p.N));
const w = maxE - minE || 1;
const h = maxN - minN || 1;
const scale = Math.min((cv.width - 2 * pad) / w, (cv.height - 2 * pad) / h);
const toXY = (p) => ({
  x: pad + (p.E - minE) * scale,
  y: cv.height - (pad + (p.N - minN) * scale), // invert y
});

cx.lineWidth = 2;
cx.strokeStyle = "#38bdf8";
cx.fillStyle = "#e5e7eb";
cx.font = "12px ui-monospace,monospace";

// build connections: series + optional close + special
const cons = [];
for (let i = 0; i < pts.length - 1; i++) cons.push([pts[i], pts[i + 1]]);
if (closeShape && pts.length >= 3) cons.push([pts.at(-1), pts[0]]);
specialJoins.forEach(({ a, b }) => {
  const A = pts.find((p) => p.id === a);
  const B = pts.find((p) => p.id === b);
  if (A && B) cons.push([A, B]);
});

// draw lines + mm labels
cons.forEach(([A, B]) => {
  const a = toXY(A), b = toXY(B);
  cx.beginPath();
  cx.moveTo(a.x, a.y);
  cx.lineTo(b.x, b.y);
  cx.stroke();
  const L = Math.round(dist(A, B));
  cx.fillStyle = "#cbd5e1";
  cx.fillText(`${L} mm`, (a.x + b.x) / 2 + 6, (a.y + b.y) / 2 - 6);
});

// interior angles for series path
if (pts.length >= 3) {
  for (let i = 1; i < pts.length - 1; i++) {
    const d = angleDeg(pts[i - 1], pts[i], pts[i + 1]);
    if (d != null) {
      const p = toXY(pts[i]);
      cx.fillStyle = "#fca5a5";
      cx.fillText(`${d.toFixed(0)}°`, p.x + 8, p.y - 8);
    }
  }
  if (closeShape) {
    const d1 = angleDeg(pts.at(-2), pts.at(-1), pts[0]);
    const d0 = angleDeg(pts.at(-1), pts[0], pts[1]);
    if (d1 != null) {
      const p = toXY(pts.at(-1));
      cx.fillText(`${d1.toFixed(0)}°`, p.x + 8, p.y - 8);
    }
    if (d0 != null) {
      const p = toXY(pts[0]);
      cx.fillText(`${d0.toFixed(0)}°`, p.x + 8, p.y - 8);
    }
  }
}

// points
pts.forEach((P) => {
  const p = toXY(P);
  cx.fillStyle = "#e5e7eb";
  cx.beginPath();
  cx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  cx.fill();
  cx.fillStyle = "#93c5fd";
  cx.fillText(`${P.id}`, p.x + 8, p.y + 12);
});

}

// redraw whenever inputs change useEffect(() => { draw(); /* eslint-disable-next-line */ }, [values, specialJoins, closeShape]);

// ====== save / load reviews ====== const snapshots = useMemo(() => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } }, [showReviews]); // refresh when toggled

const saveReview = () => { const snap = { ts: Date.now(), count, values, specialJoins, closeShape, }; const all = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } })(); all.push(snap); localStorage.setItem(LS_KEY, JSON.stringify(all)); alert("✅ Saved to Reviews"); };

const loadReview = (snap) => { setCount(snap.count); setValues(snap.values); setSpecialJoins(snap.specialJoins || []); setCloseShape(!!snap.closeShape); setShowReviews(false); setTimeout(() => draw(), 0); };

const deleteReview = (idx) => { const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); all.splice(idx, 1); localStorage.setItem(LS_KEY, JSON.stringify(all)); setShowReviews((s) => !s); // trigger refresh };

const clearAllReviews = () => { if (confirm("Clear ALL saved reviews?")) { localStorage.removeItem(LS_KEY); setShowReviews((s) => !s); } };

// ====== custom keypad ====== const kbdRef = useRef(null); const handleKey = (token) => { if (activeIndex < 0) return; setValues((prev) => { const next = [...prev]; next[activeIndex] = (next[activeIndex] || "") + token; return next; }); }; const handleBack = () => { if (activeIndex < 0) return; setValues((prev) => { const next = [...prev]; next[activeIndex] = (next[activeIndex] || "").slice(0, -1); return next; }); }; const handleClearRow = () => { if (activeIndex < 0) return; setValues((prev) => prev.map((v, i) => (i === activeIndex ? "" : v))); }; const handleNext = () => { setActiveIndex((i) => Math.min(values.length - 1, i + 1)); }; const handleDone = () => { setShowKeypad(false); setActiveIndex(-1); };

// ====== styles (scoped) ====== const S = { page: { maxWidth: 1200, margin: "0 auto", padding: 16, display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, }, card: { background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 12, color: "#e5e7eb", }, label: { fontSize: 12, color: "#94a3b8" }, input: { background: "#0b1220", color: "#e5e7eb", border: "1px solid #1f2937", borderRadius: 10, padding: "10px 12px", width: "100%", }, btn: { background: "#22d3ee", color: "#05343c", border: 0, borderRadius: 999, padding: "8px 14px", fontWeight: 700, cursor: "pointer", }, btnGhost: { background: "#0b1220", color: "#e5e7eb", border: "1px solid #223046", borderRadius: 999, padding: "8px 14px", cursor: "pointer", }, pill: { display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "#0b1220", border: "1px solid #223046", margin: "3px 4px 0 0", fontSize: 12, }, canvas: { width: "100%", height: 680, background: "#0b1220", border: "1px dashed #334155", borderRadius: 16 }, keypad: { position: "sticky", bottom: 0, background: "#0b1220", border: "1px solid #223046", borderRadius: 14, padding: 8, marginTop: 10, }, };

// ====== render ====== return ( <div style={{ background: "#0f172a", minHeight: "100vh" }}> <div style={S.page}> {/* LEFT */} <div style={S.card}> <h2 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>Input</h2>

<div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label style={{ ...S.label, width: 120 }}>Input Numbers</label>
        <input
          type="number"
          min={3}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(3, Number(e.target.value || 0)))}
          style={{ ...S.input, maxWidth: 120 }}
        />
        <button style={S.btn} onClick={applyCount}>Apply</button>
      </div>

      {/* rows */}
      <div>
        {values.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ ...S.label, width: 42 }}>No.{i + 1}</label>
              <input
                readOnly
                placeholder="E,N,H (e.g. 0,0,0)"
                value={v}
                onClick={() => { setActiveIndex(i); setShowKeypad(true); }}
                style={S.input}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={S.btnGhost} onClick={() => updateValue(i, "")}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: "#1f2937", margin: "8px 0" }} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label style={{ ...S.label, width: 120 }}>Special Join</label>
        <input
          placeholder="e.g. 3,6"
          value={sjInput}
          onChange={(e) => setSjInput(e.target.value)}
          style={S.input}
        />
        <button style={S.btn} onClick={addSJ}>Add</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {specialJoins.map((sj, i) => (
          <span key={i} style={S.pill}>Join <b style={{ color: "#93c5fd" }}>{sj.a}</b> ↔ <b style={{ color: "#93c5fd" }}>{sj.b}</b>&nbsp;
            <button style={S.btnGhost} onClick={() => removeSJ(i)}>x</button>
          </span>
        ))}
      </div>

      <div style={{ margin: "8px 0" }}>
        <label style={S.label}>
          <input type="checkbox" checked={closeShape} onChange={(e) => setCloseShape(e.target.checked)} /> Close shape (N→1)
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={S.btn} onClick={draw}>Draw</button>
        <button style={S.btnGhost} onClick={clearAll}>All Clear</button>
        <button style={S.btnGhost} onClick={() => {
          const url = canvasRef.current.toDataURL("image/png");
          const a = document.createElement("a"); a.href = url; a.download = "enh-canvas.png"; a.click();
        }}>Save PNG</button>

        <button style={S.btn} onClick={saveReview}>Save Review</button>
        <button style={S.btnGhost} onClick={() => setShowReviews(true)}>Open Reviews</button>
      </div>

      {/* custom keypad */}
      {showKeypad && (
        <div style={S.keypad}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {["7","8","9"].map((k) => <K key={k} onClick={() => handleKey(k)}>{k}</K>)}
            <K tone onClick={handleBack}>⌫</K>
            {["4","5","6"].map((k) => <K key={k} onClick={() => handleKey(k)}>{k}</K>)}
            <K onClick={() => handleKey(",")}>,</K>
            {["1","2","3"].map((k) => <K key={k} onClick={() => handleKey(k)}>{k}</K>)}
            <K onClick={() => handleKey("-")}>-</K>
            <K wide onClick={() => handleKey("0")}>0</K>
            <K onClick={() => handleKey(".")}>.</K>
            <K tone onClick={handleClearRow}>Clear</K>
            <K wide tone onClick={handleNext}>Next</K>
            <K wide onClick={handleDone}>Done</K>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>E,N,H format (e.g. 1000,250,-7)</div>
        </div>
      )}
    </div>

    {/* RIGHT */}
    <div style={S.card}>
      <h2 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>Canvas</h2>
      <canvas ref={canvasRef} width={1000} height={680} style={S.canvas} />
    </div>
  </div>

  {/* Reviews Drawer */}
  {showReviews && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center" }} onClick={() => setShowReviews(false)}>
      <div style={{ ...S.card, width: 700, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Saved Reviews</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button style={S.btnGhost} onClick={clearAllReviews}>Clear All</button>
          <button style={S.btn} onClick={() => setShowReviews(false)}>Close</button>
        </div>
        {snapshots.length === 0 && <p style={{ color: "#94a3b8" }}>No saved reviews yet.</p>}
        {snapshots.map((s, i) => (
          <div key={i} style={{ border: "1px solid #223046", borderRadius: 12, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                {new Date(s.ts).toLocaleString()} • rows: {s.count} • close: {String(s.closeShape)} • joins: {(s.specialJoins||[]).length}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={S.btn} onClick={() => loadReview(s)}>Load</button>
                <button style={S.btnGhost} onClick={() => deleteReview(i)}>Delete</button>
              </div>
            </div>
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#e5e7eb", marginTop: 6 }}>
              {s.values.map((v, idx) => (
                <div key={idx}>No.{idx + 1}: {v || ""}</div>
              ))}
              {s.specialJoins && s.specialJoins.length > 0 && (
                <div style={{ marginTop: 6, color: "#93c5fd" }}>
                  Joins: {s.specialJoins.map((j) => `${j.a}-${j.b}`).join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>

); }

// Small keypad button component function K({ children, onClick, wide, tone }) { return ( <button onClick={onClick} style={{ background: tone ? "#1f2937" : "#111827", color: "#e5e7eb", border: "1px solid #223046", borderRadius: 10, padding: "14px 0", fontWeight: 700, gridColumn: wide ? "span 2" : "auto", cursor: "pointer", }} > {children} </button> ); }

                                              
