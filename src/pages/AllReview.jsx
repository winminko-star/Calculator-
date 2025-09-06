import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";
import { useNavigate } from "react-router-dom";

function TitleRow({ item }) {
  const [val, setVal] = useState(item.title || "");
  const [saving, setSaving] = useState(false);

  const saveTitle = async () => {
    setSaving(true);
    try {
      await dbSet(dbRef(db, `drawings/${item.id}/title`), val || "Untitled");
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
        onChange={(e)=>setVal(e.target.value)}
        style={{ flex: "1 1 auto" }}
      />
      <button className="btn" onClick={saveTitle} disabled={saving}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </div>
  );
}

export default function AllReview() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const r = dbRef(db, "drawings");
    const unsub = onValue(r, (snap) => {
      const now = Date.now();
      const rows = [];
      snap.forEach((c) => {
        const v = c.val(); const id = c.key;
        if (v.expiresAt && v.expiresAt < now) { remove(dbRef(db, `drawings/${id}`)); return; }
        rows.push({ id, ...v });
      });
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(rows);
    });
    return () => unsub();
  }, []);

  const del = async (id) => {
    if (!confirm("Delete this record?")) return;
    await remove(dbRef(db, `drawings/${id}`));
  };

  const openIn2D = (it) => {
    if (!it.state) {
      alert("This item has no raw data. Save again from 2D to enable editing.");
      return;
    }
    localStorage.setItem("wmk_restore", JSON.stringify(it.state));
    navigate("/drawing2d");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">📁 All Saved (Title Only)</div>

        {items.length === 0 && <div className="small">No saved items yet.</div>}

        {items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
            {/* Title edit/save */}
            <TitleRow item={it} />

            <div className="small" style={{ marginTop: 6 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} ·{" "}
              {(it.meta?.points ?? 0)} pts · {(it.meta?.lines ?? 0)} lines · {(it.meta?.triples ?? 0)} ∠
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => openIn2D(it)}>✏️ Open in 2D</button>
              <button className="btn" onClick={() => del(it.id)} style={{ background: "#ef4444" }}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
        }
