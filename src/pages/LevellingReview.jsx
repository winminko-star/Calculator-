// src/pages/LevellingReview.jsx
import React, { useEffect, useRef, useState } from "react";
import { getDatabase, ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";

/* ---------- utils ---------- */
const fmtTime = (t) => new Date(t).toLocaleString();
const pretty = (v) => {
  if (v === null || v === undefined) return "B";
  const n = Number(v);
  if (!Number.isFinite(n)) return "B";
  // keep user-entered style (no forced decimals)
  const rounded = Math.round(n * 1e9) / 1e9;
  return String(rounded);
};

/* ---------- inline title editor (same UX as AllReview.jsx) ---------- */
function TitleRow({ item }) {
  const [val, setVal] = useState(item.title || "");
  const [saving, setSaving] = useState(false);

  const saveTitle = async () => {
    setSaving(true);
    try {
      const db = getDatabase();
      await dbSet(dbRef(db, `levellings/${item.id}/title`), val || "(untitled)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="row" style={{ gap: 8 }}>
      <input
        className="input"
        placeholder="Title"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        style={{ flex: "1 1 auto" }}
      />
      <button className="btn" onClick={saveTitle} disabled={saving}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </div>
  );
}

/* ---------- horizontal result strip (robust mobile scroll) ---------- */
function ResultStrip({ results, cols = 6 }) {
  // inline-block technique → reliable horizontal scroll even if body has overflow-x:hidden
  return (
    <div style={{ overflowX: "auto", paddingBottom: 4, marginTop: 10, WebkitOverflowScrolling: "touch" }}>
      <div style={{ whiteSpace: "nowrap", fontSize: 0 }}>
        {(results || []).map((r, idx) => (
          <div
            key={`cell-${idx}`}
            className="card"
            style={{
              display: "inline-block",
              verticalAlign: "top",
              width: 96,
              marginRight: 10,
              padding: 8,
              textAlign: "center",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: r?.isRef ? "#fff7ed" : "#fff",
              fontSize: 14,
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

/* ---------- main: LevellingReview (AllReview style listener) ---------- */
export default function LevellingReview() {
  const [items, setItems] = useState([]);
  const unsubRef = useRef(null);

  useEffect(() => {
    const db = getDatabase();
    const r = dbRef(db, "levellings");
    // live listener (like AllReview.jsx)
    const off = onValue(r, (snap) => {
      const list = [];
      snap.forEach((ch) => {
        const v = ch.val();
        if (!v) return;
        const id = ch.key;
        list.push({ id, ...v });
      });
      // newest first
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
        <div className="small">Results ကို အလျားဘက် scroll လုပ်နိုင်သလို Title ကိုတခါတည်း ပြင်/သိမ်း လို့ရပါတယ်။</div>
      </div>

      {items.length === 0 && <div className="card small">No saved levelling yet.</div>}

      {items.map((it) => {
        const safeKey = it.id ?? `${it.createdAt}-${Math.random()}`;
        // if saved, respect chosen columns; else fallback 6 (only used for meta/show)
        const cols = Math.max(1, Math.min(99, Number(it.cols) || 6));
        const results = Array.isArray(it.results) ? it.results : [];

        // meta quick counts
        const total = results.length;
        const blanks = results.filter(
          (r) => r?.value === null || r?.value === undefined || !Number.isFinite(Number(r?.value))
        ).length;

        return (
          <div key={safeKey} className="card" style={{ padding: 12 }}>
            {/* editable title */}
            <TitleRow item={it} />

            {/* meta */}
            <div className="small" style={{ marginTop: 6 }}>
              {fmtTime(it.createdAt || Date.now())} · {total} results · blanks {blanks} · ref #{(it.referenceIndex ?? 0) + 1}
            </div>

            {/* results preview (scrollable) */}
            <ResultStrip results={results} cols={cols} />

            {/* actions */}
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
