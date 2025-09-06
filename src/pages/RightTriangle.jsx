// src/pages/RightTriangle.jsx
import React, { useState, useEffect } from "react";
import "../index.css";

export default function RightTriangle() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [h, setH] = useState("");
  const [Adeg, setAdeg] = useState("");
  const [Bdeg, setBdeg] = useState("");
  const [results, setResults] = useState({});

  useEffect(() => {
    const A = parseFloat(a);
    const B = parseFloat(b);
    const H = parseFloat(h);
    const angA = parseFloat(Adeg);
    const angB = parseFloat(Bdeg);
    let res = {};

    // ---- Pythagoras ----
    if (A && B) {
      res.h = Math.sqrt(A * A + B * B);
      res.Adeg = (Math.atan2(A, B) * 180) / Math.PI;
      res.Bdeg = 90 - res.Adeg;
    } else if (A && H) {
      res.b = Math.sqrt(H * H - A * A);
      res.Adeg = (Math.asin(A / H) * 180) / Math.PI;
      res.Bdeg = 90 - res.Adeg;
    } else if (B && H) {
      res.a = Math.sqrt(H * H - B * B);
      res.Adeg = (Math.atan2(res.a, B) * 180) / Math.PI;
      res.Bdeg = 90 - res.Adeg;
    } else if (angA) {
      if (A && angA) {
        res.h = A / Math.sin((angA * Math.PI) / 180);
        res.b = res.h * Math.cos((angA * Math.PI) / 180);
        res.Bdeg = 90 - angA;
      } else if (B && angA) {
        res.h = B / Math.cos((angA * Math.PI) / 180);
        res.a = res.h * Math.sin((angA * Math.PI) / 180);
        res.Bdeg = 90 - angA;
      }
    }

    setResults(res);
  }, [a, b, h, Adeg, Bdeg]);

  return (
    <div className="container">
      <h2 className="page-title">📐 Right Triangle Calculator</h2>

      {/* Triangle diagram */}
      <div className="card" style={{ textAlign: "center" }}>
        <svg viewBox="0 0 330 220" width="100%" height="180">
          <g stroke="#000" strokeWidth="2" fill="none">
            <path d="M30,180 L300,180 L300,40 Z" />
            <path d="M286,180 h14 v-14" />
          </g>
          <g fontFamily="system-ui, sans-serif" fontSize="14" fill="#000">
            <text x="20" y="195">A</text>
            <text x="305" y="35">B</text>
            <text x="305" y="195">C</text>
            <text x="160" y="195">b</text>
            <text x="310" y="110" transform="rotate(-90 310 110)">a</text>
            <text x="160" y="95" transform="rotate(-62 160 95)">h</text>
          </g>
        </svg>
      </div>

      {/* Inputs */}
      <div className="card grid">
        <label>
          a (vertical):
          <input
            className="input"
            type="number"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="side a"
          />
        </label>
        <label>
          b (base):
          <input
            className="input"
            type="number"
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="side b"
          />
        </label>
        <label>
          h (hypotenuse):
          <input
            className="input"
            type="number"
            value={h}
            onChange={(e) => setH(e.target.value)}
            placeholder="side h"
          />
        </label>
        <label>
          ∠A (deg):
          <input
            className="input"
            type="number"
            value={Adeg}
            onChange={(e) => setAdeg(e.target.value)}
            placeholder="angle A"
          />
        </label>
        <label>
          ∠B (deg):
          <input
            className="input"
            type="number"
            value={Bdeg}
            onChange={(e) => setBdeg(e.target.value)}
            placeholder="angle B"
          />
        </label>
      </div>

      {/* Results */}
      <div className="card">
        <h3>✅ Results</h3>
        <div className="small">
          {results.a && <div>a = {results.a.toFixed(3)}</div>}
          {results.b && <div>b = {results.b.toFixed(3)}</div>}
          {results.h && <div>h = {results.h.toFixed(3)}</div>}
          {results.Adeg && <div>∠A = {results.Adeg.toFixed(2)}°</div>}
          {results.Bdeg && <div>∠B = {results.Bdeg.toFixed(2)}°</div>}
        </div>
      </div>
    </div>
  );
        }
