// src/pages/ENHTie.jsx
import React, { useMemo, useState } from "react";

const box = { width: 120, textAlign: "right" }; // 6 digits လောက်ပဲ ဆန့်အောင်
const parseNum = (s) => (s?.trim() === "" ? null : Number(s));
const fmt = (v) => (v == null || Number.isNaN(v) ? "" : (Math.round(v * 1000) / 1000).toString());

export default function ENHTie() {
  // Point A
  const [e1, setE1] = useState("");
  const [n1, setN1] = useState("");
  const [h1, setH1] = useState("");
  // Point B
  const [e2, setE2] = useState("");
  const [n2, setN2] = useState("");
  const [h2, setH2] = useState("");

  // live result
  const res = useMemo(() => {
    const E1 = parseNum(e1), N1 = parseNum(n1), H1 = parseNum(h1);
    const E2 = parseNum(e2), N2 = parseNum(n2), H2 = parseNum(h2);

    const dE = E1 == null || E2 == null ? null : (E2 - E1); // B - A
    const dN = N1 == null || N2 == null ? null : (N2 - N1);
    const dH = H1 == null || H2 == null ? null : (H2 - H1);

    const d2D = dE == null || dN == null ? null : Math.hypot(dE, dN);
    const d3D = d2D == null || dH == null ? null : Math.hypot(d2D, dH);

    return { dE, dN, dH, d2D, d3D };
  }, [e1, n1, h1, e2, n2, h2]);

  const clearAll = () => { setE1(""); setN1(""); setH1(""); setE2(""); setN2(""); setH2(""); };
  const swapAB = () => { setE1(e2); setN1(n2); setH1(h2); setE2(e1); setN2(n1); setH2(h1); };

  const NumInput = ({ value, onChange, ph }) => (
    <input
      className="input"
      type="text"
      inputMode="decimal"
      pattern="[0-9.\-]*"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={ph}
      style={box}
      autoComplete="off"
    />
  );

  return (
    <div className="container" style={{ marginTop: 12 }}>
      {/* Point A */}
      <div className="card">
        <div className="page-title">Point A</div>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <div style={{ width: 20 }}>E</div><NumInput value={e1} onChange={setE1} ph="E₁" />
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 8 }}>
          <div style={{ width: 20 }}>N</div><NumInput value={n1} onChange={setN1} ph="N₁" />
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 8 }}>
          <div style={{ width: 20 }}>H</div><NumInput value={h1} onChange={setH1} ph="H₁" />
        </div>
      </div>

      {/* Point B */}
      <div className="card">
        <div className="page-title">Point B</div>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <div style={{ width: 20 }}>E</div><NumInput value={e2} onChange={setE2} ph="E₂" />
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 8 }}>
          <div style={{ width: 20 }}>N</div><NumInput value={n2} onChange={setN2} ph="N₂" />
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 8 }}>
          <div style={{ width: 20 }}>H</div><NumInput value={h2} onChange={setH2} ph="H₂" />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={swapAB}>⇄ Swap A/B</button>
          <button className="btn" onClick={clearAll} style={{ background: "#64748b" }}>🧹 Clear</button>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="page-title">Result</div>

        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 120, fontWeight: 700 }}>ΔE (E₂−E₁)</div>
          <input className="input" readOnly value={fmt(res.dE)} style={box} />
          <span className="small">mm</span>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 120, fontWeight: 700 }}>ΔN (N₂−N₁)</div>
          <input className="input" readOnly value={fmt(res.dN)} style={box} />
          <span className="small">mm</span>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 120, fontWeight: 700 }}>ΔH (H₂−H₁)</div>
          <input className="input" readOnly value={fmt(res.dH)} style={box} />
          <span className="small">mm</span>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 120, fontWeight: 700 }}>Plan (2D)</div>
          <input className="input" readOnly value={fmt(res.d2D)} style={box} />
          <span className="small">mm</span>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <div style={{ width: 120, fontWeight: 700 }}>3D Tie</div>
          <input className="input" readOnly value={fmt(res.d3D)} style={box} />
          <span className="small">mm</span>
        </div>
      </div>
    </div>
  );
    }
