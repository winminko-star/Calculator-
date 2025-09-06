// src/pages/AllReview.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove } from "firebase/database";

export default function AllReview() {
  const [drawings, setDrawings] = useState([]);

  useEffect(() => {
    const ref = dbRef(db, "drawings");
    return onValue(ref, (snap) => {
      if (!snap.exists()) {
        setDrawings([]);
        return;
      }
      const arr = Object.entries(snap.val()).map(([key, val]) => ({
        key,
        ...val,
      }));
      const now = Date.now();
      // auto-delete expired
      arr.forEach((row) => {
        if (row.expiresAt && row.expiresAt < now) {
          remove(dbRef(db, `drawings/${row.key}`));
        }
      });
      setDrawings(arr.filter((r) => !r.expiresAt || r.expiresAt >= now));
    });
  }, []);

  const handleDelete = async (row) => {
    await remove(dbRef(db, `drawings/${row.key}`));
    alert("Deleted ✅");
  };

  return (
    <div className="card">
      <div className="page-title">🗂️ All Saved Drawings</div>
      {drawings.length === 0 && <p>No drawings saved.</p>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {drawings.map((row) => (
          <div key={row.key} className="card" style={{ padding: 10 }}>
            <a href={row.dataUrl} target="_blank" rel="noreferrer">
              <img
                src={row.dataUrl}
                alt="drawing"
                style={{ width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </a>
            <div className="small">
              {new Date(row.createdAt).toLocaleString()}
              <br />
              {row.meta?.points} pts • {row.meta?.lines} lines • {row.meta?.triples} ∠
            </div>
            <button className="btn" onClick={() => handleDelete(row)}>
              🗑 Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
