// src/pages/ENSeriesCalc.jsx
import React, { useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/* ---------------- Small helpers ---------------- */
const rid = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);
const toNum = (v) =>
  v === "" || v === "-" || v === "." ? "" : Number(v);

function dist2D(a, b) {
  const dx = (b.E ?? 0) - (a.E ?? 0);
  const dy = (b.N ?? 0) - (a.N ?? 0);
  return Math.hypot(dx, dy);
}
function bearingDeg(a, b) {
  const dx = (b.E ?? 0) - (a.E ?? 0);
  const dy = (b.N ?? 0) - (a.N ?? 0);
  // survey style: 0° = East, 90° = North
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return +deg.toFixed(2);
}

/* ---------------- Custom keypad ---------------- */
function NumPad({ onKey }) {
  const K = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    ["0", ".", "-"],
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
      }}
    >
      {K.flat().map((k) => (
        <button key={k} className="btn" onClick={() => onKey(k)}>
          {k}
        </button>
      ))}
      <button className="btn" onClick={() => onKey("del")}>
        ⌫
      </button>
      <button className="btn" onClick={() => onKey("clr")}>
        Clear
      </button>
      <button className="btn" onClick={() => onKey("tab")}>
        ↦ Next
      </button>
    </div>
  );
}

/* ---------------- Row (E,N,H) with keypad ---------------- */
function ENRow({ idx, row, onChange, focusToken, setFocusToken, nextFocus }) {
  const eRef = useRef(null),
    nRef = useRef(null),
    hRef = useRef(null);

  const setField = (field, raw) => {
    const v = toNum(raw);
    onChange(idx, { ...row, [field]: v });
  };

  const applyKey = (ref, field, key) => {
    const el = ref.current;
    if (!el) return;
    let val = String(el.value ?? "");
    if (key === "del") val = val.slice(0, -1);
    else if (key === "clr") val = "";
    else if (key === "tab") {
      // move focus to next field in this row, then next row
      if (field === "E") nRef.current?.focus();
      else if (field === "N") hRef.current?.focus();
      else nextFocus?.(); // tell parent to focus next row
      return;
    } else {
      val += key;
    }
    if (val.length > 12) return;
    el.value = val;
    setField(field, val);
    el.focus();
    setFocusToken(`${idx}-${field}`);
  };

  const tokenBase = `${idx}-`;
  const active = (name) => focusToken === `${tokenBase}${name}`;

  return (
    <div className="card" style={{ padding: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>No.{idx + 1}</div>

      <div className="row" style={{ gap: 8 }}>
        {/* E */}
        <div style={{ flex: "1 1 0" }}>
          <div className="small">E</div>
          <input
            ref={eRef}
            className="input"
            inputMode="numeric"
            placeholder="E"
            defaultValue={row.E ?? ""}
            onFocus={() => setFocusToken(`${idx}-E`)}
            onChange={(e) => setField("E", e.target.value)}
          />
        </div>

        {/* N */}
        <div style={{ flex: "1 1 0" }}>
          <div className="small">N</div>
          <input
            ref={nRef}
            className="input"
            inputMode="numeric"
            placeholder="N"
            defaultValue={row.N ?? ""}
            onFocus={() => setFocusToken(`${idx}-N`)}
            onChange={(e) => setField("N", e.target.value)}
          />
        </div>

        {/* H + Height preview (moved under H field) */}
        <div style={{ flex: "1 1 0" }}>
          <div className="small">
            H <span className="small" style={{ color: "#64748b" }}>
              (height)
            </span>
          </div>
          <input
            ref={hRef}
            className="input"
            inputMode="numeric"
            placeholder="H"
            defaultValue={row.H ?? ""}
            onFocus={() => setFocusToken(`${idx}-H`)}
            onChange={(e) => setField("H", e.target.value)}
          />
          <div className="small" style={{ marginTop: 4 }}>
            Ht: <b>{Number(row.H ?? 0) || 0}</b> mm
          </div>
        </div>
      </div>

      {(active("E") || active("N") || active("H")) && (
        <div style={{ marginTop: 8 }}>
          <NumPad
            onKey={(k) => {
              const f =
                active("E") ? "E" : active("N") ? "N" : active("H") ? "H" : "E";
              const ref = f === "E" ? eRef : f === "N" ? nRef : hRef;
              applyKey(ref, f, k);
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- Main page ---------------- */
export default function ENSeriesCalc() {
  const [count, setCount] = useState(4); // number of rows
  const [rows, setRows] = useState(
    Array.from({ length: 4 }, () => ({ E: "", N: "", H: "" }))
  );
  const [focusToken, setFocusToken] = useState(null);

  // Special join input (e.g., "3,6")
  const [joinText, setJoinText] = useState("");
  const joins = useMemo(() => {
    return joinText
      .split(/[, ]+/)
      .map((t) => parseInt(t, 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= rows.length);
  }, [joinText, rows.length]);

  // resize rows when count changes
  const applyCount = (n) => {
    const c = Math.max(1, Math.min(200, Number(n) || 1));
    setCount(c);
    setRows((r) => {
      const next = r.slice(0, c);
      while (next.length < c) next.push({ E: "", N: "", H: "" });
      return next;
    });
  };

  const updateRow = (idx, r) =>
    setRows((arr) => arr.map((x, i) => (i === idx ? r : x)));

  /* ---- Computations: chain segments + special joins ---- */
  const segments = useMemo(() => {
    const base = [];
    for (let i = 0; i < rows.length - 1; i++) {
      base.push({ a: i + 1, b: i + 2, kind: "chain" });
    }
    const extras = [];
    if (joins.length >= 2) {
      for (let i = 0; i < joins.length - 1; i++) {
        extras.push({ a: joins[i], b: joins[i + 1], kind: "join" });
      }
    }
    const all = [...base, ...extras];

    return all.map((seg) => {
      const A = rows[seg.a - 1] || {};
      const B = rows[seg.b - 1] || {};
      const d = dist2D(A, B);
      const brg = bearingDeg(A, B);
      const dH = (B.H ?? 0) - (A.H ?? 0);
      return { ...seg, dist: +d.toFixed(1), bearing: brg, dH: +dH.toFixed(1) };
    });
  }, [rows, joins]);

  const save = async () => {
    const now = Date.now();
    const id = rid();
    await dbSet(dbRef(db, `en-series/${id}`), {
      id,
      createdAt: now,
      inputs: { rows, joinText, count },
      result: segments,
      meta: { points: rows.length, joins: joins.length },
      expiresAt: now + 90 * 24 * 60 * 60 * 1000,
      title: `ENH series (${rows.length} pts)`,
    });
    alert("Saved ✅");
  };

  const clearAll = () => {
    setRows(Array.from({ length: count }, () => ({ E: "", N: "", H: "" })));
    setJoinText("");
    setFocusToken(null);
  };

  /* ---- render ---- */
  return (
    <div className="grid">
      {/* Header controls */}
      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: "0 0 120px" }}>
            <div className="small">Input Numbers</div>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={count}
              onChange={(e) => applyCount(e.target.value)}
            />
          </div>

          <div style={{ flex: "1 1 auto" }}>
            <div className="small">Add Special Join (e.g. 3,6,9)</div>
            <input
              className="input"
              placeholder="3,6"
              value={joinText}
              onChange={(e) => setJoinText(e.target.value)}
            />
            <div className="small" style={{ marginTop: 4, color: "#64748b" }}>
              Selected: {joins.join(" → ") || "—"}
            </div>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <button className="btn" onClick={clearAll}>
              ALL CLEAR
            </button>
            <button className="btn" onClick={save}>
              Save (All Review)
            </button>
          </div>
        </div>
      </div>

      {/* Rows */}
      {rows.map((r, i) => (
        <ENRow
          key={i}
          idx={i}
          row={r}
          onChange={updateRow}
          focusToken={focusToken}
          setFocusToken={setFocusToken}
          nextFocus={() => {
            // focus next row E
            const nextIdx = Math.min(rows.length - 1, i + 1);
            setFocusToken(`${nextIdx}-E`);
          }}
        />
      ))}

      {/* Results */}
      <div className="card">
        <div className="page-title">Results</div>
        {segments.length === 0 && (
          <div className="small">Need at least two valid points.</div>
        )}
        {segments.map((s, i) => (
          <div
            key={i}
            className="row"
            style={{
              justifyContent: "space-between",
              borderBottom: "1px dashed #e5e7eb",
              padding: "6px 0",
            }}
          >
            <div>
              {s.kind === "chain" ? "Series" : "Join"} {s.a} → {s.b}
            </div>
            <div className="small">
              dEN:{" "}
              <b>
                {((rows[s.b - 1].E ?? 0) - (rows[s.a - 1].E ?? 0)).toFixed(1)}
              </b>
              ,{" "}
              <b>
                {((rows[s.b - 1].N ?? 0) - (rows[s.a - 1].N ?? 0)).toFixed(1)}
              </b>{" "}
              (mm) · Dist: <b>{s.dist} mm</b> · Brg: <b>{s.bearing}°</b> · dH:{" "}
              <b>{s.dH} mm</b>
            </div>
          </div>
        ))}
      </div>

      {/* Level preview (heights list) */}
      <div className="card">
        <div className="page-title">Level (Heights)</div>
        <div className="small">
          {rows.map((r, i) => (
            <div key={i}>
              {i + 1}. Ht = <b>{Number(r.H ?? 0) || 0}</b> mm
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
