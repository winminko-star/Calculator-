import React, { useState, useEffect } from "react";
import "../index.css";
import triImg from "../assets/right-triangle.png"; // ပုံကို public/assets ထဲသို့ ထည့်

export default function RightTriangle() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [h, setH] = useState("");
  const [Adeg, setAdeg] = useState("");
  const [Bdeg, setBdeg] = useState("");
  const [results, setResults] = useState(null);

  useEffect(() => {
    calculate();
  }, [a, b, h, Adeg, Bdeg]);

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const calculate = () => {
    let A = parseFloat(a) || null;
    let B = parseFloat(b) || null;
    let H = parseFloat(h) || null;
    let angleA = parseFloat(Adeg) || null;
    let angleB = parseFloat(Bdeg) || null;

    // သုံးဘက်ထဲ ၂ဘက်ရိုက်လိုက်ရင် H တွက်
    if (A && B && !H) H = Math.sqrt(A * A + B * B);
    if (A && H && !B) B = Math.sqrt(H * H - A * A);
    if (B && H && !A) A = Math.sqrt(H * H - B * B);

    // ထောင့်တွက်
    if (A && B && !angleA) angleA = toDeg(Math.atan(A / B));
    if (A && B && !angleB) angleB = toDeg(Math.atan(B / A));

    // ထောင့်ပြည့်စုံ
    if (angleA && !angleB) angleB = 90 - angleA;
    if (angleB && !angleA) angleA = 90 - angleB;

    // Hypotenuse မရှိရင် သတ်မှတ်
    if (!H && A && B) H = Math.sqrt(A * A + B * B);

    if (A || B || H || angleA || angleB) {
      setResults({
        a: A ? A.toFixed(3) : null,
        b: B ? B.toFixed(3) : null,
        h: H ? H.toFixed(3) : null,
        angleA: angleA ? angleA.toFixed(2) : null,
        angleB: angleB ? angleB.toFixed(2) : null,
      });
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="page-title">📐 Right Triangle Calculator</div>
        <img src={triImg} alt="Right triangle diagram" style={{ maxWidth: "100%", marginBottom: "12px" }} />

        <div className="grid">
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
      </div>

      {results && (
        <div className="card">
          <div className="page-title">✅ Results</div>
          <ul>
            {results.a && <li>a = {results.a}</li>}
            {results.b && <li>b = {results.b}</li>}
            {results.h && <li>h = {results.h}</li>}
            {results.angleA && <li>∠A = {results.angleA}°</li>}
            {results.angleB && <li>∠B = {results.angleB}°</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
