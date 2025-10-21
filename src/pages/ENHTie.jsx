// src/pages/ENHTiePro.jsx
import React, { useMemo, useState } from "react";

/** Custom-keypad ENH Tie Distance (mm) — no mobile keyboard popping */
export default function ENHTiePro() {
  // six fields as strings (so we can control sign/decimal editing)
  const [vals, setVals] = useState({
    e1: "", n1: "", h1: "",
    e2: "", n2: "", h2: "",
  });
  const [active, setActive] = useState(null); // "e1" | "n1" | ...

  const setField = (k, v) => setVals((s) => ({ ...s, [k]: v }));

  // ---------- keypad handlers ----------
  const insertChar = (ch) => {
    if (!active) return;
    let cur = vals[active] ?? "";

    if (ch === ".") {
      if (cur.includes(".")) return;           // only one decimal
      if (!cur) cur = "0";                     // ".5" => "0.5"
      setField(active, cur + ".");
      return;
    }

    // digits
    if (/[0-9]/.test(ch)) {
      if (cur === "0") cur = "";               // no leading zero spam
      // limit length (excluding leading "-")
      const coreLen = cur.replace("-", "").length;
      if (coreLen >= 12) return;
      setField(active, cur + ch);
      return;
    }
  };

  const toggleSign = () => {
    if (!active) return;
    let cur = vals[active] ?? "";
    if (!cur) { setField(active, "-"); return; }
    if (cur === "-") { setField(active, ""); return; }
    if (cur.startsWith("-")) setField(active, cur.slice(1));
    else setField(active, "-" + cur);
  };

  const backspace = () => {
    if (!active) return;
    const cur = vals[active] ?? "";
    setField(active, cur.slice(0, -1));
  };

  const clearField = () => {
    if (!active) return;
    setField(active, "");
  };

  const clearAll = () => {
    setVals({ e1: "", n1: "", h1: "", e2: "", n2: "", h2: "" });
  };

  // ---------- parse & compute ----------
  const num = (s) => {
    if (s === "-" || s === "." || s === "-.") return NaN;
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  };

  const x1 = num(vals.e1), y1 = num(vals.n1), z1 = num(vals.h1);
  const x2 = num(vals.e2), y2 = num(vals.n2), z2 = num(vals.h2);

  const result = useMemo(() => {
    if ([x1,y1,z1,x2,y2,z2].some((v)=>Number.isNaN(v))) {
      return { dE:"", dN:"", dH:"", tie:"", azE:"", azN:"", slopeDeg:"", slopePct:"", dist:"" };
    }
    const dE = x2 - x1;
    const dN = y2 - y1;
    const dH = z2 - z1;

    const tie  = Math.hypot(dE, dN);                 // plan distance
    const dist = Math.hypot(dE, dN, dH);             // 3D distance

    // azimuth from East axis, CCW positive (0..360)
    let azE = Math.atan2(dN, dE) * 180 / Math.PI;
    if (azE < 0) azE += 360;

    // azimuth from North axis, CW positive (0..360) — common surveyor style
    // (equivalently 90° - azE, normalized)
    let azN = 90 - azE;
    if (azN < 0) azN += 360;
    if (azN >= 360) azN -= 360;

    // slope angle from horizontal using tie + height
    const slopeDeg = Math.atan2(dH, tie || 0) * 180 / Math.PI;  // signed
    const slopePct = tie === 0 ? "" : ((dH / tie) * 100);

    const f3 = (x)=>Number.isFinite(x)? x.toFixed(3) : "";
    const f2 = (x)=>Number.isFinite(x)? x.toFixed(2) : "";

    return {
      dE: f3(dE),
      dN: f3(dN),
      dH: f3(dH),
      tie: f3(tie),
      azE: f2(azE),
      azN: f2(azN),
      slopeDeg: f2(slopeDeg),
      slopePct: tie===0? "" : f2(slopePct),
      dist: f3(dist),
    };
  }, [x1,y1,z1,x2,y2,z2]);

  // ---------- small UI pieces ----------
  const Box = ({ k, label }) => {
    const isActive = active === k;
    return (
      <button
        type="button"
        onClick={() => setActive(k)}
        className="input"
        style={{
          width: 110, textAlign: "right",
          border: isActive ? "2px solid #0ea5e9" : "1px solid #e5e7eb",
          background: "#fff",
          fontWeight: 700,
          padding: "10px 12px",
        }}
      >
        <div className="small" style={{ textAlign: "left", color: "#64748b", fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ minHeight: 20 }}>
          {vals[k] || <span style={{ color:"#94a3b8" }}>—</span>}
        </div>
      </button>
    );
  };

  const Row = ({ title, children }) => (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="page-subtitle">{title}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <h2 className="page-title">📏 ENH Tie (custom keypad • mm)</h2>

      {/* Station A */}
      <Row title="Station A">
        <Box k="e1" label="E₁ (mm)" />
        <Box k="n1" label="N₁ (mm)" />
        <Box k="h1" label="H₁ (mm)" />
      </Row>

      {/* Station B */}
      <Row title="Station B">
        <Box k="e2" label="E₂ (mm)" />
        <Box k="n2" label="N₂ (mm)" />
        <Box k="h2" label="H₂ (mm)" />
      </Row>

      {/* Result */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="page-subtitle">Result</div>
        <div className="row">ΔE = <b>{result.dE}</b> mm</div>
        <div className="row">ΔN = <b>{result.dN}</b> mm</div>
        <div className="row">ΔH = <b>{result.dH}</b> mm</div>
        <hr style={{ border: "none", borderTop: "1px dashed #e5e7eb", margin: "8px 0" }} />
        <div className="row">Tie (plan) = <b>{result.tie}</b> mm</div>
        <div className="row">Azimuth (from East) = <b>{result.azE}</b> °</div>
        <div className="row">Azimuth (from North) = <b>{result.azN}</b> °</div>
        <div className="row">Slope angle (horiz) = <b>{result.slopeDeg}</b> °</div>
        <div className="row">Slope % = <b>{result.slopePct}</b></div>
        <div className="row" style={{ marginTop: 6, fontSize: 18 }}>
          3D Distance = <b>{result.dist}</b> mm
        </div>
      </div>

      {/* Keypad */}
      <div className="card" style={{ position: "sticky", bottom: 8 }}>
        <div className="page-subtitle">Keypad</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {["7","8","9","←","4","5","6","±","1","2","3","C","0",".","AC","OK"].map((key) => {
            const onTap = () => {
              if (key === "←") return backspace();
              if (key === "±") return toggleSign();
              if (key === ".") return insertChar(".");
              if (key === "C") return clearField();
              if (key === "AC") return clearAll();
              if (key === "OK") { setActive(null); return; }
              // digit
              insertChar(key);
            };
            return (
              <button
                key={key}
                type="button"
                onClick={onTap}
                className="btn"
                style={{
                  fontSize: 18, fontWeight: 800,
                  padding: "12px 0",
                  background: key === "OK" ? "#0ea5e9" :
                              key === "AC" ? "#ef4444" :
                              "#1f2937",
                  color: "#fff",
                  borderRadius: 12,
                }}
              >
                {key}
              </button>
            );
          })}
        </div>
        <div className="small" style={{ marginTop: 8, color:"#64748b" }}>
          Tip: Field ကိုနှိပ်ပြီး အပေါ်ကလေးပြောင်းကာ အောက်က keypad နဲ့သာ ရိုက်ပါ (mobile keyboard မဖွင့်ပါ).
        </div>
      </div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
      }
