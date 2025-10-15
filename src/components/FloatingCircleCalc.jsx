// src/components/FloatingCircleCalc.jsx
import React, { useState, useRef, useEffect } from "react";

export default function FloatingCircleCalc() {
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(
    JSON.parse(localStorage.getItem("circleCalcPos")) || { x: 40, y: 100 }
  );
  const [points, setPoints] = useState([
    { x: "", y: "" },
    { x: "", y: "" },
    { x: "", y: "" },
    { x: "", y: "" },
  ]);
  const [result, setResult] = useState(null);
  const ref = useRef(null);

  // --- Save position locally ---
  useEffect(() => {
    localStorage.setItem("circleCalcPos", JSON.stringify(pos));
  }, [pos]);

  // --- Mouse drag logic ---
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      setPos((p) => ({
        x: Math.max(10, Math.min(window.innerWidth - 340, p.x + e.movementX)),
        y: Math.max(10, Math.min(window.innerHeight - 380, p.y + e.movementY)),
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
    const pts = points
      .filter((p) => p.x && p.y)
      .map((p) => [parseFloat(p.x), parseFloat(p.y)]);
    if (pts.length < 3) return alert("Please enter at least 3 points!");

    let cx = 0,
      cy = 0,
      r = 0;

    if (mode === "rounded") {
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
      const n = pts.length;
      const sum = pts.reduce(
        (a, [x, y]) => {
          a.x += x;
          a.y += y;
          a.x2 += x * x;
          a.y2 += y * y;
          a.xy += x * y;
          return a;
        },
        { x: 0, y: 0, x2: 0, y2: 0, xy: 0 }
      );
      cx = sum.x / n;
      cy = sum.y / n;
      r =
        pts.reduce(
          (acc, [x, y]) => acc + Math.sqrt((x - cx) ** 2 + (y - cy) ** 2),
          0
        ) / n;
    }

    setResult({
      cx,
      cy,
      r,
      circumference: 2 * Math.PI * r,
    });
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
            background: "linear-gradient(135deg, #16a34a, #4ade80)",
            color: "#fff",
            fontSize: 12,
            borderRadius: "20%",
            width: 29,
            height: 29,
            border: "none",
            boxShadow: "0 3px 9px rgba(0,0,0,0.3)",
            cursor: dragging ? "grabbing" : "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            zIndex: 9999,
          }}
        >
          ⭕
        </button>
      )}

      {visible && (
        <div
          ref={ref}
          onMouseDown={() => setDragging(true)}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: 320,
            background: "linear-gradient(180deg, #f0fdf4, #ecfccb)",
            borderRadius: 16,
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
            padding: 16,
            zIndex: 9999,
            cursor: dragging ? "grabbing" : "grab",
            transition: "transform 0.15s ease-in-out",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <h3 style={{ margin: 0, color: "#065f46" }}>⚙️ Circle Center Calc</h3>
            <button
              onClick={() => setVisible(false)}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {points.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                type="number"
                placeholder={`X${i + 1}`}
                value={p.x}
                onChange={(e) => handleChange(i, "x", e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
              />
              <input
                type="number"
                placeholder={`Y${i + 1}`}
                value={p.y}
                onChange={(e) => handleChange(i, "y", e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => calcCircle("rounded")}
              style={{
                flex: 1,
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 0",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Rounded
            </button>
            <button
              onClick={() => calcCircle("bestfit")}
              style={{
                flex: 1,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 0",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Best Fit
            </button>
          </div>

          {result && (
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                background: "#eef2ff",
                padding: 8,
                borderRadius: 8,
              }}
            >
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
