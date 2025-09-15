// src/pages/LevellingReview.jsx
import React, { useEffect, useRef, useState } from "react";
import { getDatabase, ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";

/* ---------- utils ---------- */
const fmtTime = (t) => new Date(t).toLocaleString();
const pretty = (v) => {
  if (v === null || v === undefined) return "B";
  const n = Number(v);
  if (!Number.isFinite(n)) return "B";
  const rounded = Math.round(n * 1e9) / 1e9;
  return String(rounded);
};

/* ---------- inline title editor ---------- */
function TitleRow({ item }) {
  const [val, setVal] = useState(item.title || "");
  const [saving, setSaving] = useState(false);
  const saveTitle = async () => {
    setSaving(true);
    try {
      const db = getDatabase();
      await dbSet(dbRef(db, `levellings/${item.id}/title`), val || "(untitled)");
    } finally { setSaving(false); }
  };
  return (
    <div className="row" style={{ gap: 8 }}>
      <input className="input" placeholder="Title" value={val}
             onChange={(e)=>setVal(e.target.value)} style={{ flex:"1 1 auto" }}/>
      <button className="btn" onClick={saveTitle} disabled={saving}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </div>
  );
}

/* ---------- RESULTS: grid that follows `cols` ---------- */
function ResultGrid({ results = [], cols = 6 }) {
  const c = Math.max(1, Math.min(99, Number(cols) || 6));
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: `repeat(${c}, minmax(84px, 1fr))`,
        }}
      >
        {results.map((r, idx) => (
          <div
            key={`cell-${idx}`}
            className="card"
            style={{
              padding: 8,
              textAlign: "center",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: r?.isRef ? "#fff7ed" : "#fff",
            }}
          >
            <div className="small" style={{ fontWeight: 700 }}>
              {r?.name ?? idx + 1}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {pretty(r?.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- main ---------- */
export default function LevellingReview() {
  const [items, setItems] = useState([]);
  const unsubRef = useRef(null);

  useEffect(() => {
    const db = getDatabase();
    const r = dbRef(db, "levellings");
    const off = onValue(r, (snap) => {
      const list = [];
      snap.forEach((ch) => { const v = ch.val(); if (v) list.push({ id: ch.key, ...v }); });
      list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setItems(list);
    });
    unsubRef.current = off;
    return () => off && off();
  }, []);

  const delItem = async (id) => {
    if (!confirm("Delete this saved levelling?")) return;
    const db = getDatabase();
    await remove(dbRef(db, `levellings/${id}`));
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">📁 Levelling – All Saved</div>
        <div className="small">
          Results ကို Columns အရ စာရင်းဝင်အောင် grid နဲ့ပြထားပါတယ် (Levelling page နဲ့တူ).
        </div>
      </div>

      {items.length === 0 && <div className="card small">No saved levelling yet.</div>}

      {items.map((it) => {
        const key = it.id ?? `${it.createdAt}-${Math.random()}`;
        const cols = Math.max(1, Math.min(99, Number(it.cols) || 6)); // if not saved, fallback 6
        const results = Array.isArray(it.results) ? it.results : [];
        const blanks = results.filter(r => r?.value === null || r?.value === undefined || !Number.isFinite(Number(r?.value))).length;

        return (
          <div key={key} className="card" style={{ padding: 12 }}>
            <TitleRow item={it} />
            <div className="small" style={{ marginTop: 6 }}>
              {fmtTime(it.createdAt || Date.now())} · {results.length} results · blanks {blanks} · ref #{(it.referenceIndex ?? 0) + 1}
            </div>

            {/* ✅ grid follows saved `cols` */}
            <ResultGrid results={results} cols={cols} />

            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn" style={{ background: "#e11d48" }} onClick={() => delItem(it.id)}>
                🗑 Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
