// src/pages/ENHTie.jsx
import React, { useState, useMemo } from "react";

export default function ENHTie() {
  // Point A
  const [e1, setE1] = useState("");
  const [n1, setN1] = useState("");
  const [h1, setH1] = useState("");

  // Point B
  const [e2, setE2] = useState("");
  const [n2, setN2] = useState("");
  const [h2, setH2] = useState("");

  // Helper Input
  const NumInput = ({ value, onChange, ph, name }) => (
    <input
      className="input"
      type="text"                // keyboard bug fix
      inputMode="decimal"        // numeric keypad
      enterKeyHint="next"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={ph}
      style={{
        width: 100,
        textAlign: "right",
        marginRight: 6,
      }}
    />
  );

  // Calculate Tie Distance
  const result = useMemo(() => {
    const x1 = Number(e1), y1 = Number(n1), z1 = Number(h1);
    const x2 = Number(e2), y2 = Number(n2), z2 = Number(h2);

    if ([x1, y1, z1, x2, y2, z2].some((v) => Number.isNaN(v))) {
      return { dE: "", dN: "", dH: "", dist: "" };
    }

    const dE = x2 - x1;
    const dN = y2 - y1;
    const dH = z2 - z1;
    const dist = Math.sqrt(dE * dE + dN * dN + dH * dH);

    return {
      dE: dE.toFixed(3),
      dN: dN.toFixed(3),
      dH: dH.toFixed(3),
      dist: dist.toFixed(3),
    };
  }, [e1, n1, h1, e2, n2, h2]);

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <h2 className="page-title">📏 Tie Distance (Point to Point)</h2>

      {/* Point A */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-subtitle">Station A</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <NumInput value={e1} onChange={setE1} ph="E₁" name="E1" />
          <NumInput value={n1} onChange={setN1} ph="N₁" name="N1" />
          <NumInput value={h1} onChange={setH1} ph="H₁" name="H1" />
        </div>
      </div>

      {/* Point B */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-subtitle">Station B</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <NumInput value={e2} onChange={setE2} ph="E₂" name="E2" />
          <NumInput value={n2} onChange={setN2} ph="N₂" name="N2" />
          <NumInput value={h2} onChange={setH2} ph="H₂" name="H2" />
        </div>
      </div>

      {/* Result */}
      <div className="card">
        <div className="page-subtitle">Result</div>
        <div className="row">ΔE = <b>{result.dE}</b> mm</div>
        <div className="row">ΔN = <b>{result.dN}</b> mm</div>
        <div className="row">ΔH = <b>{result.dH}</b> mm</div>
        <div className="row" style={{ marginTop: 6, fontSize: 18 }}>
          Distance = <b>{result.dist}</b> mm
        </div>
      </div>
    </div>
  );
      }
