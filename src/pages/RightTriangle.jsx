// src/pages/RightTriangle.jsx
import React, { useMemo, useState } from "react";

/* ---------- UI helpers ---------- */
function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="small" style={{ fontWeight: 600 }}>{label}</span>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}
const dfix = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");

/* ---------- Inline SVG diagram (no external file) ---------- */
function Diagram() {
  return (
    <svg viewBox="0 0 330 220" width="100%" style={{ display: "block" }}>
      <rect x="0" y="0" width="330" height="220" rx="12" fill="#fff" stroke="#e5e7eb" />
      <g stroke="#000" strokeWidth="2" fill="none">
        <path d="M30,180 L300,180 L300,40 Z" />
        <path d="M286,180 h14 v-14" />
      </g>
      <g fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif" fontSize="14" fill="#000">
        <text x="20" y="195">A</text>
        <text x="305" y="35">B</text>
        <text x="305" y="195">C</text>
        <text x="165" y="195">b</text>
        <text x="310" y="110" transform="rotate(-90 310 110)">a</text>
        <text x="166" y="96" transform="rotate(-61 166 96)">h</text>
      </g>
    </svg>
  );
}

/* ---------- Solver ---------- */
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function solve({ a, b, h, A, B }) {
  // normalize angles
  if (!Number.isFinite(A) && Number.isFinite(B)) A = 90 - B;
  if (Number.isFinite(A) && (A <= 0 || A >= 90)) return { err: "∠A must be between 0 and 90" };

  // two sides
  if (Number.isFinite(a) && Number.isFinite(b)) {
    h = Math.hypot(a, b); A = deg(Math.atan2(a, b)); B = 90 - A;
  } else if (Number.isFinite(a) && Number.isFinite(h)) {
    if (a >= h) return { err: "h must be longest (h > a)" };
    b = Math.sqrt(h*h - a*a); A = deg(Math.asin(a/h)); B = 90 - A;
  } else if (Number.isFinite(b) && Number.isFinite(h)) {
    if (b >= h) return { err: "h must be longest (h > b)" };
    a = Math.sqrt(h*h - b*b); A = deg(Math.atan2(a, b)); B = 90 - A;
  }
  // one side + angle A
  else if (Number.isFinite(A)) {
    if (Number.isFinite(a)) { b = a / Math.tan(rad(A)); h = a / Math.sin(rad(A)); }
    else if (Number.isFinite(b)) { a = b * Math.tan(rad(A)); h = b / Math.cos(rad(A)); }
    else if (Number.isFinite(h)) { a = h * Math.sin(rad(A)); b = h * Math.cos(rad(A)); }
    else return { err: "Add at least one side with the angle" };
    B = 90 - A;
  } else {
    return { err: "Provide any two: (two sides) or (one side + one angle)" };
  }

  if (!(h > 0 && a > 0 && b > 0)) return { err: "Invalid dimensions" };
  if (!(h > a && h > b)) return { err: "h must be longest" };

  return { a, b, h, A, B, C: 90 };
}

/* ---------- Page ---------- */
export default function RightTriangle() {
  const [ta, setTa] = useState("");
  const [tb, setTb] = useState("");
  const [th, setTh] = useState("");
  const [tA, setTA] = useState("");
  const [tB, setTB] = useState("");

  const nums = useMemo(() => {
    const p = (s) => {
      const v = parseFloat(String(s).replace(",", "."));
      return Number.isFinite(v) ? v : undefined;
    };
    return { a: p(ta), b: p(tb), h: p(th), A: p(tA), B: p(tB) };
  }, [ta, tb, th, tA, tB]);

  const out = useMemo(() => solve(nums), [nums]);

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">📐 Right Triangle Calculator</div>
        <Diagram />
      </div>

      <div className="card grid" style={{ gap: 12 }}>
        <Field label="a (vertical)" value={ta} onChange={(e)=>setTa(e.target.value)} placeholder="side a" />
        <Field label="b (base)"    value={tb} onChange={(e)=>setTb(e.target.value)} placeholder="side b" />
        <Field label="h (hypotenuse)" value={th} onChange={(e)=>setTh(e.target.value)} placeholder="side h" />
        <Field label="∠A (deg)" value={tA} onChange={(e)=>setTA(e.target.value)} placeholder="angle A" />
        <Field label="∠B (deg)" value={tB} onChange={(e)=>setTB(e.target.value)} placeholder="angle B" />
        <div className="small" style={{ color:"#334155" }}>
          Enter <b>any two</b> independent values. ∠C is fixed at 90°.
        </div>
      </div>

      <div className="card">
        <div className="page-title">✅ Results</div>
        {out.err ? (
          <div className="small" style={{ color:"#b91c1c" }}>⚠ {out.err}</div>
        ) : (
          <div className="small">
            a = {dfix(out.a)} <br/>
            b = {dfix(out.b)} <br/>
            h = {dfix(out.h)} <br/>
            ∠A = {dfix(out.A,2)}° <br/>
            ∠B = {dfix(out.B,2)}° <br/>
            ∠C = 90°
          </div>
        )}
      </div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
      }
