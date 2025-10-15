// src/components/FloatingCircleCalc.jsx
import React, { useState, useRef, useEffect } from "react";

export default function FloatingCircleCalc() {
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(
    JSON.parse(localStorage.getItem("circleCalcPos")) || { x: 40, y: 80 }
  );
  const [points, setPoints] = useState([
    { x: "", y: "" },
    { x: "", y: "" },
    { x: "", y: "" },
    { x: "", y: "" },
  ]);
  const [result, setResult] = useState(null);
  const ref = useRef(null);

  // Save position
  useEffect(() => {
    localStorage.setItem("circleCalcPos", JSON.stringify(pos));
  }, [pos]);

  // Mouse dragging logic
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      setPos((p) => ({
        x: p.x + e.movementX,
        y: p.y + e.movementY,
      }));
    };
    const stop = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [dragging]);

  // ---- Calculation Logic ----
  const calcCircle = (mode) => {
    const pts = points.filter((p) => p.x && p.y).map((p) => [parseFloat(p.x), parseFloat(p.y)]);
    if (pts.length < 3) {
      alert("Please enter at least 3 points!");
      return;
    }

    let cx = 0,
      cy = 0,
      r = 0;

    if (mode === "rounded") {
      // Exact circle through 3 points (use first 3)
      const [A, B, C] = pts;
      const D =
        2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
      if (D === 0) return alert("Points are collinear!");
      cx =
        ((A[0] ** 2 + A[1] ** 2) * (B[1] - C[1]) +
          (B[0] ** 2 + B[1] ** 2) * (C[1] - A[1]) +
          (C[0] ** 2 + C[1] ** 2) * (A[1] - B[1])) /
        D;
      cy =
        ((A[0] ** 2 + A[1] ** 2) * (C[0] - B[0]) +
          (B[0] ** 2 + B[1] ** 2) * (A[0] - C[0]) +
          (C[0] ** 2 + C[1] ** 2) * (B[0] - A[0])) /
        D;
      r = Math.sqrt((A[0] - cx) ** 2 + (A[1] - cy) ** 2);
    } else {
      // Best-fit circle (least squares)
      let sumX = 0,
        sumY = 0,
        sumX2 = 0,
        sumY2 = 0,
        sumXY = 0,
        sumR = 0;
      const n = pts.length;
      for (const [x, y] of pts) {
        sumX += x;
        sumY += y;
        sumX2 += x * x;
        sumY2 += y * y;
        sumXY += x * y;
      }
      const C = n * sumX2 - sumX ** 2;
      const D = n * sumY2 - sumY ** 2;
      const E = n * sumXY - sumX * sumY;
      const F =
        0.5 *
        (n * (sumX2 + sumY2) * sumX - sumX * (sumX2 + sumY2) * n) /
        (C + D + E);
      cx = sumX / n;
      cy = sumY / n;
      r =
        pts.reduce((acc, [x, y]) => acc + Math.sqrt((x - cx) ** 2 + (y - cy) ** 2), 0) /
        n;
    }

    const circumference = 2 * Math.PI * r;
    setResult({ cx, cy, r, circumference });
  };

  const handleChange = (i, field, value) => {
    const newPts = [...points];
    newPts[i][field] = value;
    setPoints(newPts);
  };

  return (
    <div>
      {!visible && (
        <button
          onMouseDown={() => setDragging(true)}
          onClick={() => setVisible(true)}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            background: "#22c55e",
            color: "#fff",
            fontSize: 24,
            borderRadius: "50%",
            width: 56,
            height: 56,
            border: "none",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            cursor: "grab",
          }}
        >
          ⭕
        </button>
      )}

      {visible && (
        <div
          ref={ref}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: 320,
            background: "#f9fafb",
            borderRadius: 16,
            boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
            padding: 16,
            cursor: dragging ? "grabbing" : "grab",
            zIndex: 999,
          }}
          onMouseDown={() => setDragging(true)}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h3 style={{ margin: 0 }}>Circle Center Calc</h3>
            <button onClick={() => setVisible(false)}>×</button>
          </div>

          {points.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input
                type="number"
                placeholder={`X${i + 1}`}
                value={p.x}
                onChange={(e) => handleChange(i, "x", e.target.value)}
                style={{ width: "50%", padding: 6 }}
              />
              <input
                type="number"
                placeholder={`Y${i + 1}`}
                value={p.y}
                onChange={(e) => handleChange(i, "y", e.target.value)}
                style={{ width: "50%", padding: 6 }}
              />
            </div>
          ))}

          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button onClick={() => calcCircle("rounded")} style={{ flex: 1 }}>
              Rounded
            </button>
            <button onClick={() => calcCircle("bestfit")} style={{ flex: 1 }}>
              Best Fit
            </button>
          </div>

          {result && (
            <div style={{ fontSize: 14, background: "#eef2ff", padding: 8, borderRadius: 8 }}>
              <div>Center X: {result.cx.toFixed(3)}</div>
              <div>Center Y: {result.cy.toFixed(3)}</div>
              <div>Radius: {result.r.toFixed(3)}</div>
              <div>Circumference: {result.circumference.toFixed(3)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
