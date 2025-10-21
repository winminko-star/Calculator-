import React, { useEffect, useMemo, useRef, useState } from "react";

/** Circle Arc – compute from any 2 of (R, B°, D)
 * R = radius (mm)
 * B = central angle (deg)
 * D = chord length (mm)
 * Also shows: Arc length (A), Sector area, Segment area.
 */

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (radv) => (radv * 180) / Math.PI;

export default function CircleArc() {
  // inputs (as strings so user can type freely)
  const [R, setR] = useState("");
  const [B, setB] = useState("");
  const [D, setD] = useState("");

  const [err, setErr] = useState("");

  // parsed numeric (undefined if invalid/empty)
  const nR = useNum(R);
  const nB = useNum(B);
  const nD = useNum(D);

  // auto-solve from any 2 knowns
  const solved = useMemo(() => {
    setErr("");
    let r = nR, b = nB, d = nD;

    const has = {
      r: isFiniteNum(r),
      b: isFiniteNum(b),
      d: isFiniteNum(d),
    };
    if ((has.r ? 1 : 0) + (has.b ? 1 : 0) + (has.d ? 1 : 0) < 2) {
      return null; // need at least 2
    }

    try {
      if (has.r && has.b) {
        // D from R, B
        const θ = rad(b);
        d = 2 * r * Math.sin(θ / 2);
      } else if (has.r && has.d) {
        // B from R, D
        if (d < 0 || d > 2 * r) throw new Error("Chord must be ≤ 2R.");
        const θ = 2 * Math.asin(d / (2 * r));
        b = deg(θ);
      } else if (has.b && has.d) {
        // R from B, D
        const θ = rad(b);
        const s = Math.sin(θ / 2);
        if (s === 0) throw new Error("Angle must be > 0.");
        r = d / (2 * s);
      }

      // sanity
      if (!(r > 0)) throw new Error("R must be > 0.");
      if (!(b > 0 && b <= 360)) throw new Error("B must be 0–360.");
      if (!(d > 0 && d <= 2 * r)) throw new Error("D must be 0–2R.");

      // derived
      const θ = rad(b);
      const arc = r * θ;                 // arc length
      const sector = 0.5 * r * r * θ;    // sector area
      const segment = sector - 0.5 * r * r * Math.sin(θ);

      return { r, b, d, arc, sector, segment };
    } catch (e) {
      setErr(e.message || "Invalid values.");
      return null;
    }
  }, [nR, nB, nD]);

  // canvas preview
  const cvsRef = useRef(null);
  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const w = (cvs.width = cvs.clientWidth * devicePixelRatio);
    const h = (cvs.height = cvs.clientHeight * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    // clear
    ctx.clearRect(0, 0, cvs.clientWidth, cvs.clientHeight);

    // light frame
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cvs.clientWidth - 1, cvs.clientHeight - 1);

    if (!solved) return;

    const { r, b } = solved;

    // fit: draw circle radius to 40% of min dimension
    const pad = 16;
    const cx = cvs.clientWidth / 2;
    const cy = cvs.clientHeight / 2;
    const drawR = Math.min(cx, cy) - pad;

    // scaling factor (drawing units vs mm)
    const k = drawR / r;

    // circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // radii (start angle at -90° so arc sits nicely)
    const start = -Math.PI / 2;
    const end = start + rad(b);

    // arc
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, start, end);
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 4;
    ctx.stroke();

    // radii lines
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(start) * r * k, cy + Math.sin(start) * r * k);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(end) * r * k, cy + Math.sin(end) * r * k);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // chord
    const x1 = cx + Math.cos(start) * r * k;
    const y1 = cy + Math.sin(start) * r * k;
    const x2 = cx + Math.cos(end) * r * k;
    const y2 = cy + Math.sin(end) * r * k;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.stroke();

    // angle label pill
    drawPill(ctx, cx + 10, cy - 10, `${fmt(solved.b)}°`);
  }, [solved]);

  // UI helpers
  const clearAll = () => {
    setR(""); setB(""); setD(""); setErr("");
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="page-title">🟡 Circle Arc</div>
        <div className="small">Enter any **two** of R (mm), B (deg), D (mm). The third value will be solved automatically.</div>
      </div>

      {/* Preview */}
      <div className="card">
        <canvas
          ref={cvsRef}
          style={{
            width: "100%",
            height: 220,
            display: "block",
            borderRadius: 12,
            background: "#fff",
          }}
        />
      </div>

      {/* Inputs */}
      <div className="card grid" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <label style={{ width: 90 }} className="small">R (mm)</label>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="radius"
                 value={R} onChange={(e)=>setR(e.target.value)} style={{ flex: 1 }}/>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <label style={{ width: 90 }} className="small">B (deg)</label>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="angle"
                 value={B} onChange={(e)=>setB(e.target.value)} style={{ flex: 1 }}/>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <label style={{ width: 90 }} className="small">D (mm)</label>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="chord"
                 value={D} onChange={(e)=>setD(e.target.value)} style={{ flex: 1 }}/>
        </div>

        {err && <div className="small" style={{ color: "#b91c1c" }}>⚠️ {err}</div>}

        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={clearAll} style={{ background: "#64748b" }}>🧹 Clear</button>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="page-title">✅ Results</div>
        {!solved && <div className="small">Provide any two inputs to see results.</div>}
        {solved && (
          <div className="grid" style={{ gap: 6 }}>
            <Line label="R (mm)" value={fmt(solved.r)} />
            <Line label="B (deg)" value={fmt(solved.b)} />
            <Line label="D (mm)" value={fmt(solved.d)} />
            <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "6px 0" }} />
            <Line label="Arc length A (mm)" value={fmt(solved.arc)} />
            <Line label="Sector area (mm²)" value={fmt(solved.sector)} />
            <Line label="Segment area (mm²)" value={fmt(solved.segment)} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- tiny helpers ---------- */
function useNum(s) {
  if (s === "" || s === null || s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function isFiniteNum(n) { return typeof n === "number" && Number.isFinite(n); }
function fmt(n) { return Number(n.toFixed(3)); }

function drawPill(ctx, x, y, text) {
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

function Line({ label, value }) {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <div className="small" style={{ color: "#334155" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
  }
