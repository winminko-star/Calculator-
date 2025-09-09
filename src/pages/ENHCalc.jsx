// src/pages/ENHCalc.jsx
import React, { useMemo, useState } from "react";

export default function ENHCalc() {
  // Station (first set)
  const [e1, setE1] = useState("");
  const [n1, setN1] = useState("");
  const [h1, setH1] = useState("");
  // How you want in First Point (second set)
  const [e2, setE2] = useState("");
  const [n2, setN2] = useState("");
  const [h2, setH2] = useState("");

  // parse helper
  const num = (v) => (v === "" ? NaN : parseFloat(v));

  const out = useMemo(() => {
    const E = num(e2) - num(e1);
    const N = num(n2) - num(n1);
    const H = num(h2) - num(h1);
    return {
      E: Number.isFinite(E) ? E : "",
      N: Number.isFinite(N) ? N : "",
      H: Number.isFinite(H) ? H : "",
    };
  }, [e1, n1, h1, e2, n2, h2]);

  const Row = ({ label, value, onChange, placeholder }) => (
    <div className="row" style={{ gap: 8 }}>
      <div style={{ width: 120, fontWeight: 700 }}>{label}</div>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: 120,          // ၆ လုံးတောင်လောက်
          textAlign: "right",
          fontWeight: 700,
        }}
      />
    </div>
  );

  const Out = ({ label, value }) => (
    <div className="row" style={{ gap: 8 }}>
      <div style={{ width: 120, fontWeight: 700 }}>{label}</div>
      <div
        className="input"
        style={{
          width: 120,
          textAlign: "right",
          fontWeight: 800,
          background: "#f8fafc",
        }}
      >
        {value === "" ? "" : value}
      </div>
    </div>
  );

  const clearAll = () => {
    setE1(""); setN1(""); setH1("");
    setE2(""); setN2(""); setH2("");
  };

  return (
    <div className="container" style={{ maxWidth: 520, marginTop: 12 }}>
      {/* Station */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-title">Station</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="E" value={e1} onChange={setE1} placeholder="E₁" />
          <Row label="N" value={n1} onChange={setN1} placeholder="N₁" />
          <Row label="H" value={h1} onChange={setH1} placeholder="H₁" />
        </div>
      </div>

      {/* How you want in First Point */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-title">How you want in First Point</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="E" value={e2} onChange={setE2} placeholder="E₂" />
          <Row label="N" value={n2} onChange={setN2} placeholder="N₂" />
          <Row label="H" value={h2} onChange={setH2} placeholder="H₂" />
        </div>
      </div>

      {/* New Station (answers) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-title">New Station</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Out label="E" value={out.E} />
          <Out label="N" value={out.N} />
          <Out label="H" value={out.H} />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" onClick={clearAll}>🧹 Clear</button>
      </div>
    </div>
  );
      }
