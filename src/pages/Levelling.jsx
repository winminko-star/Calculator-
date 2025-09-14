// src/pages/Levelling.jsx
import React, { useState, useEffect } from "react";
import "../index.css";

export default function Levelling() {
  const [rows, setRows] = useState([
    { value: "", diff: "", isRef: false },
  ]);
  const [columns, setColumns] = useState(6);

  // Restore
  useEffect(() => {
    const raw = localStorage.getItem("levelling_data");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      setRows(Array.isArray(s.rows) ? s.rows : []);
      setColumns(s.columns ?? 6);
    } catch {}
  }, []);

  // Save
  const handleSave = () => {
    localStorage.setItem(
      "levelling_data",
      JSON.stringify({ rows, columns })
    );
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
    setRows(rows.map((r, idx) => ({ ...r, isRef: idx === i })));
  };

  // Calculation
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
        Reference ကိုရွေးပါ။ <b>Value(row) – Value(ref) – Different(row)</b> ဖြုတ်ချက်။
        Value မရှိလျှင် “B” အဖြစ်ပြမယ်။
      </p>

      {/* Controls */}
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
            max={50} // ကြိုက်သလောက်ထား
            onChange={(e) => setColumns(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
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
                    onChange={(e) =>
                      handleChange(i, { value: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    placeholder="Different"
                    value={row.diff}
                    onChange={(e) =>
                      handleChange(i, { diff: e.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results */}
      <div style={{ marginTop: 20 }}>
        <h3>✅ Results</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, auto)`,
            gap: 12,
          }}
        >
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ccc",
                borderRadius: 6,
                padding: "4px 8px",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              {i + 1}
              <br />
              {isNaN(r) ? "B" : r.toFixed(3)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
    }
