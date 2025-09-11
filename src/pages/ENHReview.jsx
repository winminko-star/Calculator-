// src/pages/ENHReview.jsx
import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function ENHReview() {
  const [reviews, setReviews] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const r = ref(db, "enh_reviews");
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      setReviews(arr.sort((a, b) => b.ts - a.ts));
    });
    return () => unsub();
  }, []);

  const del = (id) => remove(ref(db, "enh_reviews/" + id));

  const loadToCanvas = (review) => {
    localStorage.setItem("ENH_REVIEW_LOAD", JSON.stringify(review));
    navigate("/enh-canvas"); // auto-draw handled in CanvasENH
  };

  return (
    <div style={{ padding: 20, background: "#0f172a", color: "#eee", minHeight: "100vh" }}>
      <h2>ENH Reviews</h2>
      {reviews.length === 0 && <p>No saved reviews</p>}
      {reviews.map((r) => (
        <div key={r.id} style={{ border: "1px solid #334155", margin: "8px 0", padding: 8 }}>
          <div>{new Date(r.ts).toLocaleString()}</div>
          <div>Rows: {r.count}, Close: {String(r.closeShape)}</div>
          <div>
            {r.values.map((v, i) => <div key={i}>No.{i+1}: {v}</div>)}
          </div>
          {r.specialJoins?.length > 0 && (
            <div>Joins: {r.specialJoins.map(j => `${j.a}-${j.b}`).join(", ")}</div>
          )}
          <button onClick={() => loadToCanvas(r)}>▶ Load to Canvas</button>
          <button onClick={() => del(r.id)}>🗑 Delete</button>
        </div>
      ))}
    </div>
  );
}
