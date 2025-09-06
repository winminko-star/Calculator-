import React, { useState, useEffect } from "react";
import "../index.css";

export default function RightTriangle() {
  const [a, setA] = useState("");   // vertical side
  const [b, setB] = useState("");   // base side
  const [h, setH] = useState("");   // hypotenuse
  const [A, setAngleA] = useState(""); // angle at A (°)
  const [B, setAngleB] = useState(""); // angle at B (°)
  const [C] = useState(90); // right angle

  // calculation results
  const [results, setResults] = useState({});

  useEffect(() => {
    calc();
  }, [a, b, h, A, B]);

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const calc = () => {
    let aa = parseFloat(a);
    let bb = parseFloat(b);
    let hh = parseFloat(h);
    let angA = parseFloat(A);
    let angB = parseFloat(B);

    // try to solve step by step
    if (hh && aa) bb = Math.sqrt(hh * hh - aa * aa);
    if (hh && bb) aa = Math.sqrt(hh * hh - bb * bb);
    if (aa && bb) hh = Math.sqrt(aa * aa + bb * bb);

    if (angA) {
      angB = 90 - angA;
      if (hh) {
        aa = hh * Math.sin(toRad(angA));
        bb = hh * Math.cos(toRad(angA));
      }
    }

    if (angB) {
      angA = 90 - angB;
      if (hh) {
        aa = hh * Math.sin(toRad(angA));
        bb = hh * Math.cos(toRad(angA));
      }
    }

    if (aa && bb) {
      angA = toDeg(Math.atan2(aa, bb));
      angB = 90 - angA;
    }

    setResults({
      a: aa ? aa.toFixed(3) : "",
      b: bb ? bb.toFixed(3) : "",
      h: hh ? hh.toFixed(3) : "",
      A: angA ? angA.toFixed(2) : "",
      B: angB ? angB.toFixed(2) : "",
      C: 90,
    });
  };

  return (
    <div className="container grid">
      <h2 className="page-title">📐 Right Triangle Calculator</h2>

      {/* Diagram */}
      <div className="card">
        <img
          src="/triangle.png"
          alt="Right Triangle Diagram"
          style={{ maxWidth: "100%", marginBottom: "12px" }}
        />
      </div>

      {/* Inputs */}
      <div className="card grid">
        <label>
          a (vertical):
          <input
            className="input"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="side a"
          />
        </label>
        <label>
          b (base):
          <input
            className="input"
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="side b"
          />
        </label>
        <label>
          h (hypotenuse):
          <input
            className="input"
            value={h}
            onChange={(e) => setH(e.target.value)}
            placeholder="side h"
          />
        </label>
        <label>
          ∠A (deg):
          <input
            className="input"
            value={A}
            onChange={(e) => setAngleA(e.target.value)}
            placeholder="angle A"
          />
        </label>
        <label>
          ∠B (deg):
          <input
            className="input"
            value={B}
            onChange={(e) => setAngleB(e.target.value)}
            placeholder="angle B"
          />
        </label>
      </div>

      {/* Results */}
      <div className="card">
        <h3>✅ Results</h3>
        <p>a = {results.a}</p>
        <p>b = {results.b}</p>
        <p>h = {results.h}</p>
        <p>∠A = {results.A}°</p>
        <p>∠B = {results.B}°</p>
        <p>∠C = {results.C}°</p>
      </div>
    </div>
  );
    }
