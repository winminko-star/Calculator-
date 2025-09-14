// src/pages/Levelling.jsx
import React, { useState, useEffect } from "react";
import "../index.css";

export default function Levelling() {
  const [rows, setRows] = useState([
    { value: "", diff: "", isRef: false },
  ]);
  const [columns, setColumns] = useState(6);

  // ✅ Restore from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("wmk_restore");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      setRows(Array.isArray(s.rows) ? s.rows : []);
      setColumns(s.columns ?? 6);
    } catch {}
    localStorage.removeItem("wmk_restore");
  }, []);

  // ✅ Save to localStorage
  const handleSave = () => {
    const data = { rows, columns };
    localStorage.setItem("levelling_data", JSON.stringify(data));
    alert("Saved!");
  };

  const handleAdd = () => {
    setRows([...rows, { value: "", diff: "", isRef: false }]);
  };

  const handleClear = () => {
    setRows([{ value: "", diff: "", isRef: false }]);
  };

  const handleChange = (i, obj) => {
    const copy = [...rows];
    copy[i] = { ...copy[i], ...obj };
    setRows(copy);
  };

  const handleRef = (i) => {
    const copy = rows.map((r, idx) => ({
      ...r,
      isRef: idx === i,
    }));
    setRows(copy);
  };

  // ✅ Calculation
  const results = (() => {
    const refRow = rows.find((r) => r.isRef);
    if (!refRow) return [];
    const refValue = parseFloat(refRow.value || "0");
    return rows.map((r) => {
      const v = parseFloat(r.value || "0");
      const d = parseFloat(r.diff || "0");
      return v - refValue - d;
    });
  })();

  return (
    <div style={{ padding: 16 }}>
      <h2>📏 Levelling</h2>
      <p>
        Reference ကိုရွေးပါ။ Value(row) – Value(ref) – Different(row) ဖြုတ်ချက်
        တိုက်ရိုက်တွက်မယ်။ Value မရှိလျှင် “B”.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleAdd} className="btn">+ Add input</button>
        <button onClick={handleClear} className="btn">🧹 Clear</button>
        <button onClick={handleSave} className="btn">💾 Save</button>
        <div style={{ marginLeft: "auto" }}>
          Columns{" "}
          <input
            type="number"
            value={columns}
            min={1}
            max={50} // ✅ ကြိုက်သလောက် ထားလို့ရ
            onChange={(e) => setColumns(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, auto)`, gap: 12 }}>
          {/* Header */}
          <div><b>Ref</b></div>
          <div><b>No.</b></div>
          <div><b>Value</b></div>
          <div><b>Different</b></div>

          {/* Rows */}
          {rows.map((row, i) => (
            <React.Fragment key={i}>
              <div>
                <input
                  type="radio"
                  name="refRow"
                  checked={!!row.isRef}
                  onChange={() => handleRef(i)}
                />
              </div>
              <div style={{ fontWeight: 700, color: "#000" }}>{i + 1}</div>
              <div>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => handleChange(i, { value: e.target.value })}
                  style={{ width: 100 }}
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder="Different"
                  value={row.diff}
                  onChange={(e) => handleChange(i, { diff: e.target.value })}
                  style={{ width: 100 }}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: 20 }}>
        <h3>Results</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, auto)`,
            gap: 12,
          }}
        >
          {results.map((r, i) => (
            <div key={i} style={{ fontWeight: 600 }}>
              {isNaN(r) ? "B" : r.toFixed(3)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
    }
