import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove, update } from "firebase/database";

export default function AllReview() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const r = dbRef(db, "drawings");
    const unsub = onValue(r, (snap) => {
      const now = Date.now();
      const rows = [];
      snap.forEach((c) => {
        const v = c.val();
        const id = c.key;
        // auto-purge (client-side) if expired
        if (v.expiresAt && v.expiresAt < now) {
          remove(dbRef(db, `drawings/${id}`));
          return;
        }
        rows.push({ id, ...v });
      });
      // newest first
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(rows);
    });
    return () => unsub();
  }, []);

  const del = async (id) => {
    if (!confirm("Delete this drawing?")) return;
    await remove(dbRef(db, `drawings/${id}`));
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">📁 All Saved Drawings</div>

        {items.length === 0 && <div className="small">No saved drawings yet.</div>}

        {items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 10, marginBottom: 10 }}>
            <div
              style={{
                width: "100%",
                height: 260,                 // ★ fixed height for phone
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={it.thumbUrl || it.dataUrl}
                alt="drawing"
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",     // ★ no crop, fit nicely
                  display: "block",
                }}
              />
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} ·{" "}
              {(it.meta?.points ?? 0)} pts · {(it.meta?.lines ?? 0)} lines · {(it.meta?.triples ?? 0)} ∠
            </div>

            <button className="btn" onClick={() => del(it.id)} style={{ marginTop: 8, background: "#0284c7" }}>
              🗑 Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
                       }
