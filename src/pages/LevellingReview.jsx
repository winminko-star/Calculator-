// src/pages/LevellingReview.jsx
import React, { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue, remove } from "firebase/database";

const fmtTime = (t) => new Date(t).toLocaleString();
const showVal = (v) => (v === null || v === undefined ? "B" : String(v));

export default function LevellingReview() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const r = dbRef(db, "levellings");
    const off = onValue(r, (snap) => {
      const list = [];
      snap.forEach((ch) => list.push({ id: ch.key, ...ch.val() }));
      // newest first (no reverse glitches)
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
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">📁 Levelling – All Saved</div>
        <div className="small">
          Input ထည့်သလိုပဲ ပြထားပါတယ်။ Value မရှိတဲ့နေရာတွေကို <b>B</b> လို့ပြထားပါတယ်။
        </div>
      </div>

      {items.map((it) => (
        <div key={it.id} className="card grid" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="page-title">📌 {it.title || "(untitled)"}</div>
            <div className="small">{fmtTime(it.createdAt)}</div>
          </div>

          <div className="small">Reference: #{(it.referenceIndex ?? 0) + 1}</div>

          {/* Results – simple list, shows exactly as saved */}
          <div className="grid" style={{ gap: 6 }}>
            {Array.isArray(it.results) && it.results.length > 0 ? (
              it.results.map((r, idx) => (
                <div key={idx} className="row" style={{ gap: 10, alignItems: "center" }}>
                  <div
                    className="card"
                    style={{
                      padding: 6,
                      minWidth: 60,
                      textAlign: "center",
                      background: r.isRef ? "#fff7ed" : "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                    }}
                  >
                    <div className="small" style={{ fontWeight: 700 }}>
                      {r?.name ?? idx + 1}
                    </div>
                  </div>
                  <div className="small" style={{ fontWeight: 800 }}>
                    {showVal(r?.value)}
                  </div>
                </div>
              ))
            ) : (
              <div className="small">No results in this record.</div>
            )}
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn" style={{ background: "#e11d48" }} onClick={() => delItem(it.id)}>
              🗑 Delete
            </button>
          </div>
        </div>
      ))}

      {!items.length && <div className="card small">No saved levelling yet.</div>}
    </div>
  );
        }
