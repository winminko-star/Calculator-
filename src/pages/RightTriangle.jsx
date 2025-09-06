// src/pages/RightTriangle.jsx
import React, { useState, useEffect } from "react";
import "../index.css";

// --- Diagram (inline SVG: no external file needed) ---
function Diagram() {
  return (
    <svg viewBox="0 0 330 220" width="100%" style={{ display: "block" }}>
      <rect x="0" y="0" width="330" height="220" rx="12" fill="#fff" stroke="#e5e7eb" />
      <g stroke="#000" strokeWidth="2" fill="none">
        <path d="M30,180 L300,180 L300,40 Z" />
        <path d="M286,180 h14 v-14" />
      </g>
      <g fontFamily="system-ui, sans-serif" fontSize="14" fill="#000">
        <text x="20" y="195">A</text>
        <text x="305" y="35">B</text>
        <text x="305" y="195">C</text>
        <text x="165" y="195">b</text>
        <text x="310" y="110" transform="rotate(-90 310 110)">a</text>
        <text x="165" y="95" transform="rotate(-62 165 95)">h</text>
      </g>
    </svg>
  );
}

export default function RightTriangle() {
  const [a, setA] = useState(""), [b, setB] = useState(""),
        [h, setH] = useState(""), [Adeg, setAdeg] = useState(""),
        [Bdeg, setBdeg] = useState(""), [results, setResults] = useState(null);

  useEffect(() => {
    const A = parseFloat(a) || null;
    const B = parseFloat(b) || null;
    const H = parseFloat(h) || null;
    const angA = parseFloat(Adeg) || null;
    const angB = parseFloat(Bdeg) || null;

    let ra=A, rb=B, rh=H, rA=angA, rB=angB;

    if (ra && rb && !rh) rh = Math.hypot(ra, rb);
    if (ra && rh && !rb) rb = Math.sqrt(rh*rh - ra*ra);
    if (rb && rh && !ra) ra = Math.sqrt(rh*rh - rb*rb);

    if (ra && rb && !rA) rA = Math.atan2(ra, rb) * 180/Math.PI;
    if (ra && rb && !rB) rB = 90 - rA;
    if (rA && !rB) rB = 90 - rA;
    if (rB && !rA) rA = 90 - rB;

    if (ra || rb || rh || rA || rB) {
      setResults({
        a: ra?.toFixed(3), b: rb?.toFixed(3), h: rh?.toFixed(3),
        A: rA?.toFixed(2), B: rB?.toFixed(2)
      });
    } else {
      setResults(null);
    }
  }, [a,b,h,Adeg,Bdeg]);

  return (
    <div className="container">
      <div className="card">
        <div className="page-title">📐 Right Triangle Calculator</div>
        <Diagram />
        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          <label> a (vertical):
            <input className="input" type="number" value={a} onChange={(e)=>setA(e.target.value)} placeholder="side a"/>
          </label>
          <label> b (base):
            <input className="input" type="number" value={b} onChange={(e)=>setB(e.target.value)} placeholder="side b"/>
          </label>
          <label> h (hypotenuse):
            <input className="input" type="number" value={h} onChange={(e)=>setH(e.target.value)} placeholder="side h"/>
          </label>
          <label> ∠A (deg):
            <input className="input" type="number" value={Adeg} onChange={(e)=>setAdeg(e.target.value)} placeholder="angle A"/>
          </label>
          <label> ∠B (deg):
            <input className="input" type="number" value={Bdeg} onChange={(e)=>setBdeg(e.target.value)} placeholder="angle B"/>
          </label>
        </div>
      </div>

      {results && (
        <div className="card">
          <div className="page-title">✅ Results</div>
          <div className="small">
            {results.a && <>a = {results.a}<br/></>}
            {results.b && <>b = {results.b}<br/></>}
            {results.h && <>h = {results.h}<br/></>}
            {results.A && <>∠A = {results.A}°<br/></>}
            {results.B && <>∠B = {results.B}°</>}
          </div>
        </div>
      )}
    </div>
  );
}
