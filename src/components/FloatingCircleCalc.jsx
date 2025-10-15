// src/components/FloatingCircleCalc.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

/* ---------- persist keys ---------- */
const LS_OPEN = "circleCalc_open";
const LS_POS = "circleCalc_pos";
const LS_POINTS = "circleCalc_points";

/* ---------- helpers ---------- */
const BUBBLE = 32;
const MARGIN = 12;
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");

/* ---------- geometry (from CircleCenter.jsx) ---------- */
function circumcenter(p1, p2, p3) {
  const x1 = p1.e,
    y1 = p1.n;
  const x2 = p2.e,
    y2 = p2.n;
  const x3 = p3.e,
    y3 = p3.n;
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(d) < 1e-9) return null;
  const x1s = x1 * x1 + y1 * y1,
    x2s = x2 * x2 + y2 * y2,
    x3s = x3 * x3 + y3 * y3;
  const cx =
    (x1s * (y2 - y3) + x2s * (y3 - y1) + x3s * (y1 - y2)) / d;
  const cy =
    (x1s * (x3 - x2) + x2s * (x1 - x3) + x3s * (x2 - x1)) / d;
  return { cx, cy };
}

function solve3x3(A, b) {
  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  if (Math.abs(det) < 1e-12) return null;
  const detX =
    b[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (b[1] * A[2][2] - A[1][2] * b[2]) +
    A[0][2] * (b[1] * A[2][1] - A[1][1] * b[2]);
  const detY =
    A[0][0] * (b[1] * A[2][2] - A[1][2] * b[2]) -
    b[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * b[2] - b[1] * A[2][0]);
  const detZ =
    A[0][0] * (A[1][1] * b[2] - b[1] * A[2][1]) -
    A[0][1] * (A[1][0] * b[2] - b[1] * A[2][0]) +
    b[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  return [detX / det, detY / det, detZ / det];
}

function leastSquaresCenter(points) {
  const n = points.length;
  if (n < 3) return null;
  let Sx = 0,
    Sy = 0,
    Sxx = 0,
    Syy = 0,
    Sxy = 0,
    Sxz = 0,
    Syz = 0,
    Sz = 0;
  for (const p of points) {
    const x = p.e,
      y = p.n,
      z = x * x + y * y;
    Sx += x;
    Sy += y;
    Sxx += x * x;
    Syy += y * y;
    Sxy += x * y;
    Sxz += x * z;
    Syz += y * z;
    Sz += z;
  }
  const A = [
    [Sxx, Sxy, Sx],
    [Sxy, Syy, Sy],
    [Sx, Sy, n],
  ];
  const b = [-Sxz, -Syz, -Sz];
  const sol = solve3x3(A, b);
  if (!sol) return null;
  const [D, E] = sol;
  return { cx: -D / 2, cy: -E / 2 };
}

/* ---------- main component ---------- */
export default function FloatingCircleCalc() {
  const [open, setOpen] = useState(() => localStorage.getItem(LS_OPEN) === "1");
  const [pos, setPos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_POS) || "{}");
    } catch {
      return {};
    }
  });
  const [points, setPoints] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_POINTS) || "[]");
    } catch {
      return [];
    }
  });
  const [result, setResult] = useState(null);

  const panelRef = useRef(null);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const dragging = useRef(false);

  /* ---------- persist ---------- */
  useEffect(() => localStorage.setItem(LS_OPEN, open ? "1" : "0"), [open]);
  useEffect(
    () => localStorage.setItem(LS_POINTS, JSON.stringify(points)),
    [points]
  );

  /* ---------- default pos ---------- */
  useEffect(() => {
    if (pos.x == null || pos.y == null) {
      const x = window.innerWidth - 200;
      const y = 120;
      const p = { x, y };
      setPos(p);
      localStorage.setItem(LS_POS, JSON.stringify(p));
    }
  }, []);

  /* ---------- drag ---------- */
  const onDragStart = (e) => {
    dragging.current = true;
    start.current = {
      x: e.clientX,
      y: e.clientY,
      px: pos.x || 0,
      py: pos.y || 0,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x,
      dy = e.clientY - start.current.y;
    const next = {
      x: start.current.px + dx,
      y: start.current.py + dy,
    };
    setPos(next);
  };
  const onDragEnd = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    localStorage.setItem(LS_POS, JSON.stringify(pos));
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  /* ---------- input handlers ---------- */
  const handleChange = (i, field, value) => {
    const newPts = [...points];
    newPts[i][field] = value;
    setPoints(newPts);
  };
  const addPoint = () =>
    setPoints([...points, { e: "", n: "" }]);
  const clearAll = () => setPoints([]);

  /* ---------- calculations ---------- */
  const calcCircle = (mode) => {
    const pts = points
      .filter((p) => p.e && p.n)
      .map((p) => ({ e: parseFloat(p.e), n: parseFloat(p.n) }));
    if (pts.length < 3) return alert("Need at least 3 points!");

    if (mode === "triplet") {
      const cs = [];
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          for (let k = j + 1; k < pts.length; k++) {
            const c = circumcenter(pts[i], pts[j], pts[k]);
            if (c) cs.push(c);
          }
      if (!cs.length) return alert("Collinear points!");
      const cx = cs.reduce((s, c) => s + c.cx, 0) / cs.length;
      const cy = cs.reduce((s, c) => s + c.cy, 0) / cs.length;
      const rs = pts.map((p) => Math.hypot(p.e - cx, p.n - cy));
      const r = rs.sort((a, b) => a - b)[Math.floor(rs.length / 2)];
      setResult({ mode: "Triplet", cx, cy, r });
    } else {
      const c = leastSquaresCenter(pts);
      if (!c) return alert("Failed to fit circle!");
      const rs = pts.map((p) => Math.hypot(p.e - c.cx, p.n - c.cy));
      const r = rs.reduce((a, b) => a + b, 0) / rs.length;
      setResult({ mode: "Best Fit", cx: c.cx, cy: c.cy, r });
    }
  };

  /* ---------- UI ---------- */
  const containerStyle = {
    position: "fixed",
    left: pos.x || 0,
    top: pos.y || 0,
    zIndex: 9999,
    pointerEvents: "none",
  };
  const bubbleCommon = {
    pointerEvents: "auto",
    border: "none",
    color: "#fff",
    fontWeight: 800,
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  };

  const ui = !open ? (
    <div style={containerStyle}>
      <button
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onClick={() => setOpen(true)}
        style={{
          ...bubbleCommon,
          width: BUBBLE,
          height: BUBBLE,
          borderRadius: BUBBLE / 2,
          fontSize: 18,
          background:
            "linear-gradient(180deg,#16a34a 0%,#4ade80 100%)",
          touchAction: "none",
        }}
      >
        ⭕
      </button>
    </div>
  ) : (
    <div style={containerStyle}>
      <div
        ref={panelRef}
        style={{
          pointerEvents: "auto",
          width: "min(92vw, 300px)",
          background:
            "linear-gradient(180deg,#f0fdf4 0%,#ecfccb 100%)",
          borderRadius: 16,
          boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
          border: "1px solid #d1fae5",
          padding: 10,
        }}
      >
        {/* header */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          style={{
            cursor: "grab",
            background: "#16a34a",
            color: "#fff",
            padding: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: 10,
            userSelect: "none",
          }}
        >
          <div>⚙️ Circle Calc</div>
          <button
            onClick={() => setOpen(false)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              border: "none",
              background: "#ef4444",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            ×
          </button>
        </div>

        {/* inputs */}
        {points.map((p, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 4, marginTop: 6 }}
          >
            <input
              type="number"
              placeholder={`E${i + 1}`}
              value={p.e}
              onChange={(e) => handleChange(i, "e", e.target.value)}
              style={{
                width: 60,
                padding: 4,
                borderRadius: 6,
                border: "1px solid #d1d5db",
              }}
            />
            <input
              type="number"
              placeholder={`N${i + 1}`}
              value={p.n}
              onChange={(e) => handleChange(i, "n", e.target.value)}
              style={{
                width: 60,
                padding: 4,
                borderRadius: 6,
                border: "1px solid #d1d5db",
              }}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            onClick={addPoint}
            style={{
              flex: 1,
              background: "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: 6,
              fontWeight: 700,
            }}
          >
            + Add
          </button>
          <button
            onClick={clearAll}
            style={{
              flex: 1,
              background: "#334155",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: 6,
              fontWeight: 700,
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            onClick={() => calcCircle("triplet")}
            style={{
              flex: 1,
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: 6,
              fontWeight: 700,
            }}
          >
            Triplet
          </button>
          <button
            onClick={() => calcCircle("bestfit")}
            style={{
              flex: 1,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: 6,
              fontWeight: 700,
            }}
          >
            Best Fit
          </button>
        </div>

        {result && (
          <div
            style={{
              marginTop: 8,
              background: "#d9f99d",
              padding: 8,
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <div>
              <b>{result.mode}</b> → E={fmt(result.cx)}, N={fmt(result.cy)}
            </div>
            <div>R = {fmt(result.r)}</div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(ui, document.body);
    }
