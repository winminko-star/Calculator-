// src/pages/LevellingReview.jsx
import React, { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue, remove } from "firebase/database";

const fmtTime = (t) => new Date(t).toLocaleString();

// "B" logic: null/undefined/NaN => "B", otherwise user's natural string
const pretty = (v) => {
  if (v === null || v === undefined) return "B";
  const n = Number(v);
  if (!Number.isFinite(n)) return "B";
  // avoid fp-noise like 1.2000000003
  const rounded = Math.round(n * 1e9) / 1e9;
  return String(rounded);
};

export default function LevellingReview() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const r = dbRef(db, "levellings");
    const off = onValue(r, (snap) => {
      const list = [];
      snap.forEach((ch) => list.push({ id: ch.key, ...ch.val() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(list);
    });
    return () => off();
  }, []);

  const delItem = async (id) => {
    if (!confirm("Delete this saved levelling?")) return;
    const db = getDatabase();
    await remove(dbRef(db, `levellings/${id}`));
  };

  return (
    <div className="container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="page-title">📁 Levelling – All Saved</div>
        <div className="small">
          Column/Row layout ကို result grid အဖြစ်ပြထားပါတယ်။
        </div>
      </div>

      {items.map((it) => {
        const cols = Math.max(1, Math.min(99, Number(it.cols) || 6));
        return (
          <div key={it.id || it.createdAt} className="card" style={{ display: "block" }}>
            {/* header row */}
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="page-title">📌 {it.title || "(untitled)"}</div>
              <div className="small">{fmtTime(it.createdAt || Date.now())}</div>
            </div>

            {/* reference info */}
            <div className="small" style={{ marginTop: 6 }}>
              Reference: #{(it.referenceIndex ?? 0) + 1}
            </div>

            {/* results grid (h-scrollable) */}
            <div style={{ overflowX: "auto", marginTop: 10, paddingBottom: 4 }}>
              <div
                style={{
                  display: "grid",
                  gridAutoRows: "minmax(64px, auto)",
                  gridTemplateColumns: `repeat(${cols}, minmax(84px, 1fr))`,
                  gap: 10,
                  minWidth: cols * 90, // force grid width so horizontal scroll works
                }}
              >
                {(it.results || []).map((r, idx) => (
                  <div
                    key={idx}
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
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{pretty(r?.value)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* actions */}
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ background: "#e11d48" }} onClick={() => delItem(it.id)}>
                🗑 Delete
              </button>
            </div>
          </div>
        );
      })}

      {!items.length && <div className="card small">No saved levelling yet.</div>}
    </div>
  );
    }
