// src/pages/LevellingReview.jsx
import React, { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue, remove } from "firebase/database";

const fmtTime = (t) => new Date(t).toLocaleString();

export default function LevellingReview() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const r = dbRef(db, "levellings");
    const off = onValue(r, (snap) => {
      const list = [];
      snap.forEach((ch) => list.push({ id: ch.key, ...ch.val() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(list.reverse()); // newest first
    });
    return () => off();
  }, []);

  const delItem = async (id) => {
    if (!confirm("Delete this saved levelling?")) return;
    const db = getDatabase();
    await remove(dbRef(db, `levellings/${id}`));
  };

  // safe print for numbers
  const showVal = (v) => {
    if (v === null || v === undefined) return "B";
    if (typeof v === "number" && !isNaN(v)) {
      // user ထည့်ထားသလို natural ပြချင်လို့ string ပြောင်း
      const str = String(v);
      return str;
    }
    return String(v);
  };

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">📁 Levelling – All Saved</div>
        <div className="small">
          Column/Row layout မပါ—calculated results + meta တင်ပြထားပါတယ်။
        </div>
      </div>

      {items.map((it) => (
        <div key={it.id} className="card grid" style={{ gap: 10 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <div className="page-title">📌 {it.title || "(untitled)"}</div>
            <div className="small">{fmtTime(it.createdAt)}</div>
          </div>

          {/* Reference info */}
          <div className="small">Reference: #{(it.referenceIndex ?? 0) + 1}</div>

          {/* Results list */}
          <div className="grid" style={{ gap: 6 }}>
            {it.results?.map((r, idx) => (
              <div
                key={idx}
                className="row"
                style={{ gap: 8, alignItems: "center" }}
              >
                <div
                  className="card"
                  style={{
                    padding: 6,
                    minWidth: 64,
                    textAlign: "center",
                    background: r.isRef ? "#fff7ed" : "#fff",
                  }}
                >
                  <div
                    className="small"
                    style={{ fontWeight: 700 }}
                  >{r.name}</div>
                </div>
                <div
                  className="small"
                  style={{ fontWeight: 700 }}
                >
                  {showVal(r.value)}
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              style={{ background: "#e11d48" }}
              onClick={() => delItem(it.id)}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      ))}

      {!items.length && <div className="card small">No saved levelling yet.</div>}
    </div>
  );
}
