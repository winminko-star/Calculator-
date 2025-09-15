// src/pages/Levelling.jsx
import React, { useMemo, useState } from "react";
import { getDatabase, ref as dbRef, push, set } from "firebase/database";

const num = (v) =>
  v === "" || v === null || v === undefined ? null : Number(v);

// pretty print: no trailing .00000, keep user's natural look
const pretty = (n) => {
  if (n === null || !Number.isFinite(n)) return "B";
  const rounded = Math.round(n * 1e9) / 1e9; // trim FP noise
  return String(rounded);
};

export default function Levelling() {
  const [rows, setRows] = useState(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      id: i + 1,
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
      { id: list.length + 1, value: "", diff: "", isRef: false },
    ]);

  const clearAll = () =>
    setRows((list) =>
      list.map((r, i) => ({
        id: i + 1,
        value: "",
        diff: "",
        isRef: i === 0,
      }))
    );

  // compute results (exact look: no forced decimals)
  const results = useMemo(() => {
    const noRef = !(refIdx >= 0) || refVal === null || Number.isNaN(refVal);
    return rows.map((r) => {
      const v = num(r.value);
      if (v === null || Number.isNaN(v) || noRef) return null;
      const d = num(r.diff) ?? 0;
      return v - refVal - (Number.isNaN(d) ? 0 : d);
    });
  }, [rows, refIdx, refVal]);

  // break results into rows of "cols" columns (container scrolls horizontally as needed)
  const chunks = useMemo(() => {
    const c = Math.max(1, Math.min(99, Number(cols) || 1));
    const out = [];
    for (let i = 0; i < results.length; i += c) out.push(results.slice(i, i + c));
    return out;
  }, [results, cols]);

  // save to Firebase (each save = new record)
  const saveResults = async () => {
    const title = prompt("Title for this levelling result?");
    if (title === null) return;

    const db = getDatabase();
    const now = Date.now();
    const payload = {
      title: (title || "").trim() || "(untitled)",
      createdAt: now,
      referenceIndex: refIdx >= 0 ? refIdx : 0,
      // ✅ keep chosen columns with the record (for Review layout/scroll)
      cols: Math.max(1, Math.min(99, Number(cols) || 6)),
      rows: rows.map((r, i) => ({
        name: String(i + 1),                       // auto 1..N
        value: r.value === "" ? null : Number(r.value),
        diff:  r.diff  === "" ? null : Number(r.diff),
        isRef: r.isRef,
      })),
      results: rows.map((r, i) => {
        const v = r.value === "" ? null : Number(r.value);
        const d = r.diff === "" ? 0 : Number(r.diff);
        const hasRef =
          refIdx >= 0 && rows[refIdx].value !== "" && !isNaN(Number(rows[refIdx].value));
        const ref = hasRef ? Number(rows[refIdx].value) : null;
        const value =
          v === null || ref === null || isNaN(v) || isNaN(ref)
            ? null
            : v - ref - (isNaN(d) ? 0 : d);
        return { name: String(i + 1), value, isRef: r.isRef };
      }),
    };

    const newRef = push(dbRef(db, "levellings"));
    await set(newRef, payload);
    alert("Saved ✅");
  };

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">📏 Levelling</div>
        <div className="small">
          Reference ကိုရွေးပြီး <b>Value(row) − Value(ref) − Different(row)</b> ဖြင့်တွက်ပါ။
          Value မရှိတဲ့ row တွေကို <b>B</b> လို့ပြထားမယ်။
        </div>
      </div>

      {/* controls + inputs */}
      <div className="card grid" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={addInput}>+ Add input</button>
          <button className="btn" style={{ background: "#334155" }} onClick={clearAll}>🧹 Clear</button>
          <button className="btn" style={{ background: "#0ea5e9" }} onClick={saveResults}>💾 Save</button>
          <label className="row" style={{ gap: 8, marginLeft: "auto" }}>
            <span className="small" style={{ fontWeight: 700 }}>Columns</span>
            <input
              className="input"
              style={{ width: 70 }}
              type="number"
              min={1}
              max={99}
              value={cols}
              onChange={(e) => setCols(e.target.value)}
            />
          </label>
        </div>

        {/* header */}
        <div
          className="small"
          style={{
            fontWeight: 700,
            display: "grid",
            gridTemplateColumns: "32px 40px 1fr 1fr",
            gap: 8,
          }}
        >
          <div>Ref</div>
          <div>No.</div>
          <div>Value</div>
          <div>Different</div>
        </div>

        {/* inputs (Value + Different on same row) */}
        {rows.map((r, i) => (
          <div
            key={r.id}
            style={{ display: "grid", gridTemplateColumns: "32px 40px 1fr 1fr", gap: 8, alignItems: "center" }}
          >
            <input
              type="radio"
              name="refRow"
              checked={!!r.isRef}
              onChange={() => setReference(i)}
              style={{ width: 18, height: 18 }}
            />
            <div style={{ fontWeight: 800, color: "#0f172a" }}>{i + 1}</div>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="Value"
              value={r.value}
              onChange={(e) => setRow(i, { value: e.target.value })}
            />
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="Different"
              value={r.diff}
              onChange={(e) => setRow(i, { diff: e.target.value })}
            />
          </div>
        ))}
      </div>

      {/* results – horizontally scrollable when many columns */}
      <div className="card grid" style={{ gap: 12 }}>
        <div className="page-title">✅ Results</div>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div
            style={{
              display: "grid",
              gridAutoRows: "minmax(64px, auto)",
              gridTemplateColumns: `repeat(${Math.max(1, Number(cols) || 1)}, minmax(84px, 1fr))`,
              gap: 10,
              minWidth: "min(100%, 100%)",
            }}
          >
            {results.map((val, idx) => (
              <div
                key={idx}
                className="card"
                style={{ padding: 8, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 10 }}
              >
                <div className="small" style={{ fontWeight: 800 }}>{idx + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                  {pretty(val)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
        }
