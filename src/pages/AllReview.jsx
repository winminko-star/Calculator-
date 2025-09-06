import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove } from "firebase/database";

function ZoomBox({ src, height = 260 }) {
  const [scale, setScale] = useState(1);
  return (
    <div style={{
      width: "100%", height,
      border: "1px solid #e5e7eb", borderRadius: 12,
      overflow: "auto", background: "#fff"
    }}>
      <div style={{ width: `${scale*100}%`, minWidth: "100%" }}>
        <img
          src={src}
          alt="drawing"
          style={{ width: "100%", display: "block", userSelect: "none", pointerEvents: "none" }}
          loading="lazy"
        />
      </div>
      <div className="row" style={{ position: "sticky", bottom: 6, gap: 6, justifyContent: "center" }}>
        <button className="btn" onClick={() => setScale(s => Math.max(0.5, s * 0.8))}>－</button>
        <button className="btn" onClick={() => setScale(1)}>1x</button>
        <button className="btn" onClick={() => setScale(s => Math.min(4, s * 1.25))}>＋</button>
      </div>
    </div>
  );
}

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
        if (v.expiresAt && v.expiresAt < now) { remove(dbRef(db, `drawings/${id}`)); return; }
        rows.push({ id, ...v });
      });
      rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setItems(rows);
    });
    return () => unsub();
  }, []);

  const del = async (id) => { if (!confirm("Delete this drawing?")) return; await remove(dbRef(db, `drawings/${id}`)); };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">📁 All Saved Drawings</div>
        {items.length === 0 && <div className="small">No saved drawings yet.</div>}

        {items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 10, marginBottom: 10 }}>
            <ZoomBox src={it.thumbUrl || it.dataUrl} height={280} />

            <div className="small" style={{ marginTop: 8 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} · {(it.meta?.points ?? 0)} pts · {(it.meta?.lines ?? 0)} lines · {(it.meta?.triples ?? 0)} ∠
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
