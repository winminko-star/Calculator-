// src/pages/ENHCalc.jsx
import React, { useMemo, useRef, useState } from "react";

/* ---------------- small helpers ---------------- */
const parseNum = (s) => {
  if (s == null) return null;
  const t = String(s).trim().replace(",", "."); // allow comma
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const fmt = (v) => (v == null ? "" : String(Math.round(v * 1000) / 1000));

/* one input row — UNCONTROLLED (keyboard won't dismiss) */
const Row = React.memo(function Row({
  label,
  placeholder,
  valueRef,
  onValue,
}) {
  return (
    <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
      <div style={{ width: 24, fontWeight: 700 }}>{label}</div>
      <input
        ref={valueRef}
        className="input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        defaultValue=""
        onInput={(e) => onValue(e.currentTarget.value)}
        style={{
          width: 160,            // ~၆လုံးစာအရွယ်
          textAlign: "right",
          fontWeight: 700,
        }}
      />
    </div>
  );
});

/* ---------------- main page ---------------- */
export default function ENHCalc() {
  // refs (for clearing DOM values)
  const e1Ref = useRef(null), n1Ref = useRef(null), h1Ref = useRef(null);
  const e2Ref = useRef(null), n2Ref = useRef(null), h2Ref = useRef(null);

  // state strings (calculation only; inputs themselves are uncontrolled)
  const [e1, setE1] = useState("");  const [n1, setN1] = useState("");  const [h1, setH1] = useState("");
  const [e2, setE2] = useState("");  const [n2, setN2] = useState("");  const [h2, setH2] = useState("");

  // E-E, N-N, H-H
  const ans = useMemo(() => {
    const E1 = parseNum(e1), E2 = parseNum(e2);
    const N1 = parseNum(n1), N2 = parseNum(n2);
    const H1 = parseNum(h1), H2 = parseNum(h2);
    return {
      E: E1 == null || E2 == null ? null : (E1) - (E2),
      N: N1 == null || N2 == null ? null : (N1) - (N2),
      H: H1 == null || H2 == null ? null : (H1) - (H2),
    };
  }, [e1, e2, n1, n2, h1, h2]);

  const clearAll = () => {
    setE1(""); setN1(""); setH1("");
    setE2(""); setN2(""); setH2("");
    [e1Ref, n1Ref, h1Ref, e2Ref, n2Ref, h2Ref].forEach(r => {
      if (r.current) r.current.value = "";
    });
    e1Ref.current?.focus();
  };

  return (
    <div className="container" style={{ marginTop: 12 }}>
      {/* Station */}
      <div className="card">
        <div className="page-title">Station</div>
        <Row label="E" placeholder="E₁" valueRef={e1Ref} onValue={setE1} />
        <Row label="N" placeholder="N₁" valueRef={n1Ref} onValue={setN1} />
        <Row label="H" placeholder="H₁" valueRef={h1Ref} onValue={setH1} />
      </div>

      {/* First Point (desired) */}
      <div className="card">
        <div className="page-title">How you want in First Point</div>
        <Row label="E" placeholder="E₂" valueRef={e2Ref} onValue={setE2} />
        <Row label="N" placeholder="N₂" valueRef={n2Ref} onValue={setN2} />
        <Row label="H" placeholder="H₂" valueRef={h2Ref} onValue={setH2} />
      </div>

      {/* Result */}
      <div className="card">
        <div className="page-title">New Station</div>
        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ width: 24, fontWeight: 700 }}>E</div>
          <input className="input" readOnly value={fmt(ans.E)} style={{ width: 160, textAlign: "right", fontWeight: 700 }} />
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ width: 24, fontWeight: 700 }}>N</div>
          <input className="input" readOnly value={fmt(ans.N)} style={{ width: 160, textAlign: "right", fontWeight: 700 }} />
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <div style={{ width: 24, fontWeight: 700 }}>H</div>
          <input className="input" readOnly value={fmt(ans.H)} style={{ width: 160, textAlign: "right", fontWeight: 700 }} />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={clearAll}>🧹 Clear</button>
        </div>
      </div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
        }
