// src/pages/Levelling.jsx
import React, { useMemo, useState } from "react";
import { getDatabase, ref as dbRef, push, set } from "firebase/database";

// ---------- helpers ----------
const num = (v) =>
  v === "" || v === null || v === undefined ? null : Number(v);

function RowInput({ index, row, onChange, onRef }) {
  const { name, value, diff, isRef } = row;
  return (
    <div className="row" style={{ alignItems: "center", gap: 8 }}>
      <input
        type="radio"
        name="refRow"
        checked={!!isRef}
        onChange={() => onRef(index)}
        style={{ width: 18, height: 18 }}
      />
      <input
        className="input"
        style={{ flex: 0.5, minWidth: 60 }}
        placeholder={`Name (${index + 1})`}
        value={name}
        onChange={(e) => onChange(index, { name: e.target.value })}
      />
      <input
        className="input"
        style={{ width: 120 }}
        type="number"
        inputMode="decimal"
        step="any"
        placeholder="Value"
        value={value}
        onChange={(e) => onChange(index, { value: e.target.value })}
      />
      <input
        className="input"
        style={{ width: 120 }}
        type="number"
        inputMode="decimal"
        step="any"
        placeholder="Different"
        value={diff}
        onChange={(e) => onChange(index, { diff: e.target.value })}
      />
    </div>
  );
}

export default function Levelling() {
  const [rows, setRows] = useState(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      id: i + 1,
      name: "",
      value: "",
      diff: "",
      isRef: i === 0,
    }))
  );
  const [cols, setCols] = useState(6);

  const refIdx = rows.findIndex((r) => r.isRef);
  const refVal = num(rows[refIdx]?.value);

  const setRow = (i, patch) =>
    setRows((list) => {
      const copy = [...list];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });

  const setReference = (i) =>
    setRows((list) => list.map((r, idx) => ({ ...r, isRef: idx === i })));

  const addInput = () =>
    setRows((list) => [
      ...list,
      { id: list.length + 1, name: "", value: "", diff: "", isRef: false },
    ]);

  const clearAll = () =>
    setRows((list) =>
      list.map((r, i) => ({
        id: i + 1,
        name: "",
        value: "",
        diff: "",
        isRef: i === 0,
      }))
    );

  // compute results
  const results = useMemo(() => {
    const noRef = !(refIdx >= 0) || refVal === null || Number.isNaN(refVal);

    return rows.map((r, i) => {
      const nm = r.name?.trim() ? r.name.trim() : String(i + 1);
      const v = num(r.value);
      const d = num(r.diff) ?? 0;

      if (v === null || Number.isNaN(v) || noRef)
        return { name: nm, value: null, isRef: r.isRef };

      const base = v - refVal;
      const final = base - (Number.isNaN(d) ? 0 : d);
      return { name: nm, value: final, isRef: r.isRef };
    });
  }, [rows, refIdx, refVal]);

  // break into grid
  const gridRows = useMemo(() => {
    const c = Math.max(1, Math.min(12, Number(cols) || 1));
    const chunks = [];
    for (let i = 0; i < results.length; i += c) {
      chunks.push(results.slice(i, i + c));
    }
    return { chunks, c };
  }, [results, cols]);

  // save
  const saveResults = async () => {
    const title = prompt("Title for this levelling result?");
    if (!title) return;
    const db = getDatabase();
    const now = Date.now();
    const payload = {
      title,
      createdAt: now,
      referenceIndex: refIdx,
      rows: rows.map((r, i) => ({
        name: r.name?.trim() ? r.name.trim() : String(i + 1),
        value: r.value === "" ? null : Number(r.value),
        diff: r.diff === "" ? null : Number(r.diff),
        isRef: r.isRef,
      })),
      results: results.map((x) => ({
        name: x.name,
        value: Number.isFinite(x.value) ? x.value : null,
        isRef: x.isRef,
      })),
    };
    await set(push(dbRef(db, "levellings")), payload);
    alert("Saved ✅");
  };

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">📏 Levelling</div>
        <div className="small">
          Reference ကိုရွေးပြီး{" "}
          <b>Value(row) − Value(ref) − Different(row)</b> ဖြင့်တွက်ထားပါတယ်။ 
          Value မရှိလျှင် “B”.
        </div>
      </div>

      {/* inputs */}
      <div className="card grid" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={addInput}>+ Add input</button>
          <button className="btn" style={{ background: "#334155" }} onClick={clearAll}>
            🧹 Clear
          </button>
          <button className="btn" style={{ background: "#0ea5e9" }} onClick={saveResults}>
            💾 Save
          </button>
          <label
            className="row"
            style={{ gap: 8, alignItems: "center", marginLeft: "auto" }}
          >
            <span className="small" style={{ fontWeight: 600 }}>Columns</span>
            <input
              className="input"
              style={{ width: 90 }}
              type="number"
              min={1}
              max={12}
              value={cols}
              onChange={(e) => setCols(e.target.value)}
            />
          </label>
        </div>

        <div
          className="small"
          style={{
            fontWeight: 700,
            display: "grid",
            gridTemplateColumns: "24px 0.5fr 120px 120px",
            gap: 8,
          }}
        >
          <div>Ref</div>
          <div>Name</div>
          <div>Value</div>
          <div>Different</div>
        </div>

        {rows.map((row, i) => (
          <RowInput
            key={row.id}
            index={i}
            row={row}
            onChange={setRow}
            onRef={setReference}
          />
        ))}
      </div>

      {/* results */}
      <div className="card grid" style={{ gap: 12 }}>
        <div className="page-title">✅ Results</div>
        <div className="results-scroll">
          {gridRows.chunks.map((chunk, rIdx) => (
            <div key={rIdx} className="row results-row">
              {chunk.map((cell, cIdx) => (
                <div
                  key={cIdx}
                  className="card results-cell"
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    textAlign: "center",
                    background: cell.isRef ? "#fff7ed" : "#fff",
                  }}
                >
                  <div className="small" style={{ fontWeight: 700 }}>
                    {cell.name}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {cell.value === null ? "B" : cell.value.toString()}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
                }
