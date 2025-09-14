// src/pages/Levelling.jsx
import React, { useState, useEffect, useMemo } from "react";
import "../index.css";

export default function Levelling() {
  const [rows, setRows] = useState(
    Array.from({ length: 20 }, () => ({
      value: "",
      diff: "",
      isRef: false,
    }))
  );
  const [columns, setColumns] = useState(6);

  // Restore
  useEffect(() => {
    const raw = localStorage.getItem("levelling_data");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (Array.isArray(s.rows)) setRows(s.rows);
      if (s.columns) setColumns(s.columns);
    } catch {}
  }, []);

  // Save
  const handleSave = () => {
    localStorage.setItem("levelling_data", JSON.stringify({ rows, columns }));
    alert("Saved!");
  };

  const handleChange = (i, obj) => {
    const copy = [...rows];
    copy[i] = { ...copy[i], ...obj };
    setRows(copy);
  };

  const handleRef = (i) => {
    setRows(rows.map((r, idx) => ({ ...r, isRef: idx === i })));
  };

  const handleClear = () => {
    setRows(
      Array.from({ length: 20 }, (_, i) => ({
        value: "",
        diff: "",
        isRef: i === 0,
      }))
    );
  };

  // Calculation
  const results = useMemo(() => {
    const refRow = rows.find((r) => r.isRef);
    if (!refRow || refRow.value === "") return [];
    const refValue = parseFloat(refRow.value || "0");
    return rows.map((r) => {
      if (r.value === "") return null;
      const v = parseFloat(r.value || "0");
      const d = parseFloat(r.diff || "0");
      return v - refValue - d;
    });
  }, [rows]);

  // break into chunks
  const chunks = useMemo(() => {
    const c = Math.max(1, Number(columns) || 1);
    const list = [];
    for (let i = 0; i < results.length; i += c) {
      list.push(results.slice(i, i + c));
    }
    return list;
  }, [results, columns]);

  return (
    <div style={{ padding: 16 }}>
      <h2>📏 Levelling</h2>
      <p>
        Reference ကိုရွေးပါ။ <b>Value(row) − Value(ref) − Different(row)</b> ဖြုတ်ချက်။
        Value မရှိလျှင် “B” အဖြစ်ပြမယ်။
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setRows([...rows, { value: "", diff: "", isRef: false }])} className="btn">
          + Add input
        </button>
        <button onClick={handleClear} className="btn" style={{ background: "#334155" }}>
          🧹 Clear
        </button>
        <button onClick={handleSave} className="btn" style={{ background: "#0ea5e9" }}>
          💾 Save
        </button>
        <div style={{ marginLeft: "auto" }}>
          Columns{" "}
          <input
            type="number"
            value={columns}
            min={1}
            max={50}
            onChange={(e) => setColumns(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>
      </div>

      {/* Inputs */}
      <table className="levelling-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>No.</th>
            <th>Value</th>
            <th>Different</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <input
                  type="radio"
                  name="refRow"
                  checked={!!row.isRef}
                  onChange={() => handleRef(i)}
                />
              </td>
              <td style={{ fontWeight: 700 }}>{i + 1}</td>
              <td>
                <input
                  className="input"
                  type="number"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => handleChange(i, { value: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="input"
                  type="number"
                  placeholder="Different"
                  value={row.diff}
                  onChange={(e) => handleChange(i, { diff: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Results */}
      <div style={{ marginTop: 20 }}>
        <h3>✅ Results</h3>
        {chunks.map((chunk, rIdx) => (
          <div key={rIdx} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            {chunk.map((val, cIdx) => (
              <div
                key={cIdx}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: "4px 8px",
                  textAlign: "center",
                  fontWeight: 600,
                  minWidth: 60,
                }}
              >
                {rIdx * columns + cIdx + 1}
                <br />
                {val === null ? "B" : val.toFixed(3)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
                           }
