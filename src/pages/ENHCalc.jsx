// src/pages/ENHCalc.jsx
import React, { useMemo, useState } from "react";

export default function ENHCalc() {
  // Station 1 (the reference)
  const [e1, setE1] = useState("");
  const [n1, setN1] = useState("");
  const [h1, setH1] = useState("");

  // Station 2 (how you want in first point)
  const [e2, setE2] = useState("");
  const [n2, setN2] = useState("");
  const [h2, setH2] = useState("");

  // helper: clamp length (visual) and allow only valid numbers
  const onlyNum = (v) => {
    // allow "-", ".", numbers; trim spaces
    const t = v.replace(/[^\d\.\-]/g, "");
    // prevent more than one dot or minus not at start
    const fixed = t
      .replace(/(?!^)-/g, "")     // keep only leading -
      .replace(/^(-?\d*)\./, "$1.") // first dot ok
      .replace(/\.(?=.*\.)/g, ""); // drop extra dots
    return fixed.slice(0, 6 + (fixed.includes(".") ? 1 : 0) + (fixed.startsWith("-") ? 1 : 0));
  };

  const fmt = (v) => (Number.isFinite(v) ? String(v) : "");

  const out = useMemo(() => {
    const E = Number(e2) - Number(e1);
    const N = Number(n2) - Number(n1);
    const H = Number(h2) - Number(h1);
    return {
      E: Number.isFinite(E) ? E : null,
      N: Number.isFinite(N) ? N : null,
      H: Number.isFinite(H) ? H : null,
    };
  }, [e1, n1, h1, e2, n2, h2]);

  const Row = ({ label, value, onChange, placeholder }) => (
    <div className="row" style={{ gap: 8 }}>
      <div style={{ width: 80, fontWeight: 600 }}>{label}</div>
      <input
        className="input"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(onlyNum(e.target.value))}
        placeholder={placeholder}
        style={{
          width: 120,  // ~ up to 6 digits
          fontWeight: 700,
          textAlign: "right",
        }}
      />
    </div>
  );

  const Out = ({ label, value }) => (
    <div className="row" style={{ gap: 8 }}>
      <div style={{ width: 80, fontWeight: 600 }}>{label}</div>
      <div
        className="input"
        style={{
          width: 120,
          fontWeight: 800,
          textAlign: "right",
          background: "#f8fafc",
        }}
      >
        {value == null ? "" : fmt(value)}
      </div>
    </div>
  );

  const clearAll = () => { setE1(""); setN1(""); setH1(""); setE2(""); setN2(""); setH2(""); };

  return (
    <div className="container" style={{ maxWidth: 520, marginTop: 12 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-title">ENH Difference</div>
        <div className="small" style={{ marginTop: -6 }}>
          Formula: <b>E₂ − E₁</b>, <b>N₂ − N₁</b>, <b>H₂ − H₁</b>
        </div>
      </div>

      {/* Station (first set) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-title">Station</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="E" value={e1} onChange={setE1} placeholder="E₁" />
          <Row label="N" value={n1} onChange={setN1} placeholder="N₁" />
          <Row label="H" value={h1} onChange={setH1} placeholder="H₁" />
        </div>
      </div>

      {/* How you want in First Point (second set) */}
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
