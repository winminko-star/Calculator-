// src/pages/ENHReview.jsx
import React, { useEffect, useState } from "react";
import { ref, onValue, remove, update } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function ENHReview() {
  const [reviews, setReviews] = useState([]);
  const [titleDrafts, setTitleDrafts] = useState({}); // id -> string
  const navigate = useNavigate();

  // ---- load all reviews ----
  useEffect(() => {
    const r = ref(db, "enh_reviews");
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      const sorted = arr.sort((a, b) => b.ts - a.ts);
      setReviews(sorted);
      // sync drafts
      const drafts = {};
      sorted.forEach((x) => { drafts[x.id] = x.title || ""; });
      setTitleDrafts(drafts);
    });
    return () => unsub();
  }, []);

  const del = async (id) => {
    if (!confirm("Delete this review?")) return;
    await remove(ref(db, "enh_reviews/" + id));
  };

  const loadToCanvas = (review) => {
    localStorage.setItem("ENH_REVIEW_LOAD", JSON.stringify(review));
    navigate("/enh-canvas"); // auto-draw handled in CanvasENH
  };

  const saveTitle = async (id) => {
    const title = (titleDrafts[id] || "").trim();
    await update(ref(db, "enh_reviews/" + id), { title });
    alert("✅ Title saved");
  };

  // ---- styles (inline) ----
  const page = { padding: 16, background: "#0f172a", minHeight: "100vh", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 };
  const card = { background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,.25)" };
  const sep = { height: 1, background: "#1f2937", margin: "8px 0" };
  const btn = (bg, col = "#fff") => ({ padding: "8px 12px", borderRadius: 8, border: 0, background: bg, color: col, fontWeight: 700, cursor: "pointer" });
  const chip = { display: "inline-block", padding: "4px 10px", borderRadius: 999, background: "#1f2937", color: "#cbd5e1", fontWeight: 600, marginRight: 6, marginBottom: 6 };
  const small = { color: "#94a3b8", fontSize: 12 };
  const input = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#0b1220", color: "#e5e7eb", outline: "none" };
  const label = { fontSize: 12, color: "#9ca3af", marginBottom: 4 };

  return (
    <div style={page}>
      <div style={header}>
        <h2 style={{ margin: 0 }}>ENH Reviews</h2>
        <button onClick={() => navigate("/enh-canvas")} style={btn("#0ea5e9")}>➕ New / Go to Canvas</button>
      </div>

      {reviews.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>No saved reviews</p>
      ) : (
        <div style={grid}>
          {reviews.map((r) => (
            <div key={r.id} style={card}>
              {/* Title (optional, editable here) */}
              <div style={{ marginBottom: 8 }}>
                <div style={label}>Title (optional)</div>
                <input
                  style={input}
                  placeholder="e.g. Foundation Grid A-B Level"
                  value={titleDrafts[r.id] ?? ""}
                  onChange={(e) => setTitleDrafts((t) => ({ ...t, [r.id]: e.target.value }))}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveTitle(r.id)} style={btn("#22c55e")}>Save Title</button>
                  <button onClick={() => loadToCanvas({ ...r, title: titleDrafts[r.id] ?? r.title })} style={btn("#3b82f6")}>▶ Load to Canvas</button>
                  <button onClick={() => del(r.id)} style={btn("#ef4444")}>🗑 Delete</button>
                </div>
              </div>

              <div style={sep} />

              {/* Meta */}
              <div style={{ marginBottom: 6 }}>
                <div style={small}>{new Date(r.ts).toLocaleString()}</div>
                <div style={small}>Rows: <b style={{ color: "#e5e7eb" }}>{r.count}</b> · Close shape: <b style={{ color: "#e5e7eb" }}>{String(r.closeShape)}</b></div>
                {r.title && <div style={{ marginTop: 4 }}>📄 <b>{r.title}</b></div>}
              </div>

              {/* Values */}
              <div style={{ marginTop: 8 }}>
                <div style={label}>E,N,H values</div>
                <div style={{ maxHeight: 140, overflow: "auto", background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: 8 }}>
                  {r.values?.map((v, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #1f2937", padding: "4px 0" }}>
                      <span style={{ color: "#93c5fd" }}>No.{i + 1}</span>
                      <span style={{ color: "#e5e7eb" }}>{v || <em style={{ color: "#64748b" }}>—</em>}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Joins */}
              {Array.isArray(r.specialJoins) && r.specialJoins.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={label}>Special Joins</div>
                  <div>
                    {r.specialJoins.map((j, idx) => (
                      <span key={idx} style={chip}>{j.a} ↔ {j.b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
    }
