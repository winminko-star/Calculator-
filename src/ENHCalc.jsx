import React, { useMemo, useState } from "react";

export default function ENHCalc() {
  // Station (first set)
  const [sE, setSE] = useState("");
  const [sN, setSN] = useState("");
  const [sH, setSH] = useState("");

  // How you want in First Point (second set)
  const [fE, setFE] = useState("");
  const [fN, setFN] = useState("");
  const [fH, setFH] = useState("");

  // helper: to number (allow empty)
  const num = (v) => (v === "" || v === "-" ? NaN : Number(v));

  // answers (E-E, N-N, H-H)
  const ans = useMemo(() => {
    const aE = num(sE) - num(fE);
    const aN = num(sN) - num(fN);
    const aH = num(sH) - num(fH);
    const fmt = (x) => (isNaN(x) ? "" : (+x.toFixed(3)).toString());
    return { e: fmt(aE), n: fmt(aN), h: fmt(aH) };
  }, [sE, sN, sH, fE, fN, fH]);

  const clearAll = () => {
    setSE(""); setSN(""); setSH("");
    setFE(""); setFN(""); setFH("");
  };

  const boxStyle = { width: 120, maxWidth: 120 };

  const RowInputs = ({ values, setters, idPrefix }) => (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
      <label className="small" style={{ width: 20 }}>E</label>
      <input
        id={`${idPrefix}-e`}
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={values[0]}
        onChange={(e) => setters[0](e.target.value)}
        style={boxStyle}
        placeholder="e.g. 123.4"
      />
      <label className="small" style={{ width: 20 }}>N</label>
      <input
        id={`${idPrefix}-n`}
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={values[1]}
        onChange={(e) => setters[1](e.target.value)}
        style={boxStyle}
        placeholder="e.g. -56"
      />
      <label className="small" style={{ width: 20 }}>H</label>
      <input
        id={`${idPrefix}-h`}
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={values[2]}
        onChange={(e) => setters[2](e.target.value)}
        style={boxStyle}
        placeholder="e.g. 7.89"
      />
    </div>
  );

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <div className="card">
        <div className="page-title">📊 ENH Difference Calculator</div>
        <div className="small" style={{ marginTop: 4 }}>
          Formula — <b>E − E</b>, <b>N − N</b>, <b>H − H</b> ⇒ Answer
        </div>
      </div>

      {/* 1) Station */}
      <div className="card">
        <div className="page-title">Station</div>
        <RowInputs
          idPrefix="st"
          values={[sE, sN, sH]}
          setters={[setSE, setSN, setSH]}
        />
      </div>

      {/* 2) How you want in First Point */}
      <div className="card">
        <div className="page-title">How you want in First Point</div>
        <RowInputs
          idPrefix="fp"
          values={[fE, fN, fH]}
          setters={[setFE, setFN, setFH]}
        />
      </div>

      {/* 3) Result */}
      <div className="card">
        <div className="page-title">New Station</div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <label className="small" style={{ width: 20 }}>E</label>
          <input className="input" readOnly value={ans.e} style={boxStyle} />
          <label className="small" style={{ width: 20 }}>N</label>
          <input className="input" readOnly value={ans.n} style={boxStyle} />
          <label className="small" style={{ width: 20 }}>H</label>
          <input className="input" readOnly value={ans.h} style={boxStyle} />
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={clearAll} style={{ background: "#64748b" }}>
            🧹 Clear
          </button>
        </div>
      </div>
    </div>
  );
    }
