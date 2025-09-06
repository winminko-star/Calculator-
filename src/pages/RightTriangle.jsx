// src/pages/RightTriangle.jsx
import React, { useEffect, useMemo, useState } from "react";

// ---------- UI helpers ----------
function Field({ label, value, onChange, placeholder }) {
  return (
    <div className="grid" style={{ gap: 6 }}>
      <div className="small" style={{ fontWeight: 600 }}>{label}</div>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
const isNum = (x) => Number.isFinite(x);
const dfix = (x, n=3) => (isNum(x) ? x.toFixed(n) : "");

// ---------- Inline SVG Diagram (no image file needed) ----------
function Diagram({ Adeg }) {
  // fixed triangle A(24,180) C(300,180) B(300,36)
  return (
    <svg viewBox="0 0 330 220" width="100%" style={{ display: "block" }}>
      {/* light grid */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#fff" />
          <path d="M20 0H0V20" stroke="#e5e7eb" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="330" height="220" rx="12" fill="url(#grid)" />

      {/* triangle lines */}
      <g stroke="#0f172a" strokeWidth="2" fill="none">
        <path d="M24,180 L300,180 L300,36 Z" />
        {/* right mark at C */}
        <path d="M286,180 h14 v-14" />
      </g>

      {/* labels */}
      <g fill="#0f172a" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif" fontSize="14">
        <text x="16" y="196">A</text>
        <text x="306" y="32">B</text>
        <text x="306" y="196">C</text>

        <text x="160" y="196">b</text>
        <text x="310" y="110" transform="rotate(-90 310 110)">a</text>
        <text x="168" y="92" transform="rotate(-62 168 92)">h</text>

        {isNum(Adeg) && <text x="54" y="175">α={Adeg.toFixed(2)}°</text>}
      </g>
    </svg>
  );
}

// ---------- Solver ----------
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** solve from any 2 independent values */
function solve({ a, b, h, A, B }) {
  // normalize inputs
  if (!isNum(A) && isNum(B)) A = 90 - B;
  if (isNum(A) && (A <= 0 || A >= 90)) return { err: "∠A must be 0–90 (exclusive)" };

  // 2 sides
  if (isNum(a) && isNum(b)) {
    h = Math.hypot(a, b); A = deg(Math.atan2(a, b)); B = 90 - A;
  } else if (isNum(a) && isNum(h)) {
    if (a >= h) return { err: "h must be longest (h > a)" };
    b = Math.sqrt(h*h - a*a); A = deg(Math.asin(a/h)); B = 90 - A;
  } else if (isNum(b) && isNum(h)) {
    if (b >= h) return { err: "h must be longest (h > b)" };
    a = Math.sqrt(h*h - b*b); A = deg(Math.atan2(a, b)); B = 90 - A;
  }
  // 1 side + angle
  else if (isNum(A)) {
    if (isNum(a)) { b = a / Math.tan(rad(A)); h = a / Math.sin(rad(A)); }
    else if (isNum(b)) { a = b * Math.tan(rad(A)); h = b / Math.cos(rad(A)); }
    else if (isNum(h)) { a = h * Math.sin(rad(A)); b = h * Math.cos(rad(A)); }
    else return { err: "Provide a side with the angle" };
    B = 90 - A;
  } else {
    return { err: "Provide any two: (two sides) or (one side + one acute angle)" };
  }

  if (!(a > 0 && b > 0 && h > 0)) return { err: "Invalid dimensions" };
  if (!(h > a && h > b)) return { err: "h must be longest" };

  return { a, b, h, A, B, C: 90 };
}

export default function RightTriangle() {
  // raw text states
  const [ta, setTa] = useState("");
  const [tb, setTb] = useState("");
  const [th, setTh] = useState("");
  const [tA, settA] = useState("");
  const [tB, settB] = useState("");

  // parse
  const nums = useMemo(() => {
    const p = (s) => {
      const v = parseFloat(String(s).replace(",", "."));
      return Number.isFinite(v) ? v : undefined;
    };
    return { a: p(ta), b: p(tb), h: p(th), A: p(tA), B: p(tB) };
  }, [ta, tb, th, tA, tB]);

  const out = useMemo(() => solve(nums), [nums]);

  // show angle A on diagram when known
  const AforDiagram = isNum(nums.A) ? nums.A : (isNum(nums.B) ? 90 - nums.B : undefined);

  return (
    <div className="container grid" style={{ gap: 16 }}>
      {/* Diagram (inline SVG) */}
      <div className="card">
        <Diagram Adeg={AforDiagram} />
      </div>

      {/* Inputs (labels on top, inputs below) */}
      <div className="card grid" style={{ gap: 12 }}>
        <Field label="a (vertical)" value={ta} onChange={(e)=>setTa(e.target.value)} placeholder="side a" />
        <Field label="b (base)"    value={tb} onChange={(e)=>setTb(e.target.value)} placeholder="side b" />
        <Field label="h (hypotenuse)" value={th} onChange={(e)=>setTh(e.target.value)} placeholder="side h" />
        <Field label="∠A (deg)" value={tA} onChange={(e)=>settA(e.target.value)} placeholder="angle A" />
        <Field label="∠B (deg)" value={tB} onChange={(e)=>settB(e.target.value)} placeholder="angle B" />
        <div className="small" style={{ color:"#334155" }}>
          Hint: enter <b>any two</b> independent values. ∠C is fixed at 90°.
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="page-title">✅ Results</div>
        {out.err ? (
          <div className="small" style={{ color:"#b91c1c" }}>⚠ {out.err}</div>
        ) : (
          <div className="small">
            a = {dfix(out.a)} <br />
            b = {dfix(out.b)} <br />
            h = {dfix(out.h)} <br />
            ∠A = {dfix(out.A,2)}° <br />
            ∠B = {dfix(out.B,2)}° <br />
            ∠C = 90°
          </div>
        )}
      </div>
    </div>
  );
      }
