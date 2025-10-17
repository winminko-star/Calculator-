// src/pages/NotePad.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  ref as dbRef,
  push,
  set as dbSet,
  update as dbUpdate,
  remove as dbRemove,
  onValue,
} from "firebase/database";

export default function NotePad() {
  const [notes, setNotes] = useState([]); // [{id,title,body,createdAt,updatedAt}]
  const [loading, setLoading] = useState(true);

  // form state
  const [id, setId] = useState(null); // null => new note
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const isEditing = useMemo(() => id !== null, [id]);

  useEffect(() => {
    const un = onValue(dbRef(db, "notes"), (snap) => {
      const arr = [];
      snap.forEach((c) => {
        arr.push({ id: c.key, ...(c.val() || {}) });
      });
      // newest first
      arr.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setNotes(arr);
      setLoading(false);
    });
    return () => un();
  }, []);

  const resetForm = () => {
    setId(null);
    setTitle("");
    setBody("");
  };

  const startNew = () => {
    resetForm();
    // optional: focus title — rely on browser default
  };

  const saveNew = async () => {
  const pwd = prompt("Enter password to save:");
  if (pwd !== "007") return alert("❌ Wrong password");

  const t = (title || "").trim();
  const b = (body || "").trim();
  if (!t && !b) return alert("Write something first.");
  const now = Date.now();
  const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
  await dbSet(push(dbRef(db, "notes")), {
    title: t || "Untitled",
    body: b,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });
  resetForm();
};

const saveEdit = async () => {
  const pwd = prompt("Enter password to update:");
  if (pwd !== "007") return alert("❌ Wrong password");

  if (!id) return;
  const t = (title || "").trim();
  const b = (body || "").trim();
  if (!t && !b) return alert("Write something first.");
  const now = Date.now();
  await dbUpdate(dbRef(db, `notes/${id}`), {
    title: t || "Untitled",
    body: b,
    updatedAt: now,
  });
  resetForm();
};

  const loadForEdit = (n) => {
    setId(n.id);
    setTitle(n.title || "");
    setBody(n.body || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (nid) => {
  const pwd = prompt("Enter password to delete:");
  if (pwd !== "007") return alert("❌ Wrong password");
  if (!confirm("Delete this note?")) return;
  await dbRemove(dbRef(db, `notes/${nid}`));
  if (id === nid) resetForm();
};

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <h2 className="page-title">🗒️ Note Pad</h2>

      {/* Editor Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: "1 1 auto" }}
          />
          {isEditing ? (
            <button className="btn" onClick={saveEdit} style={{ marginLeft: 8 }}>
              💾 Update
            </button>
          ) : (
            <button className="btn" onClick={saveNew} style={{ marginLeft: 8 }}>
              ➕ Save
            </button>
          )}
          <button className="btn" onClick={startNew} style={{ marginLeft: 8, background: "#64748b" }}>
            ✨ New
          </button>
          {isEditing && (
            <button
              className="btn"
              onClick={() => del(id)}
              style={{ marginLeft: 8, background: "#ef4444" }}
            >
              🗑 Delete
            </button>
          )}
        </div>

        <textarea
          className="input"
          placeholder="Write text or numbers here…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          style={{ width: "100%", fontFamily: "system-ui, ui-sans-serif, Apple Color Emoji" }}
        />

        <div className="small" style={{ marginTop: 8, color: "#64748b" }}>
          Notes are stored in Firebase Realtime Database at <code>/notes</code>.
        </div>
      </div>

      {/* List Card */}
      <div className="card">
        <div className="page-subtitle">Saved Notes</div>
        {loading && <div className="small">Loading…</div>}
        {!loading && notes.length === 0 && <div className="small">No notes yet.</div>}

        <div style={{ display: "grid", gap: 8 }}>
          {notes.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>{n.title || "Untitled"}</div>
                <div className="small" style={{ color: "#64748b" }}>
                  {new Date(n.updatedAt || n.createdAt || Date.now()).toLocaleString()}
                </div>
              </div>
              {n.body && (
                <div
                  className="small"
                  style={{
                    marginTop: 6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {n.body}
                </div>
              )}

              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => loadForEdit(n)}>
                  ✏️ Edit
                </button>
                <button
                  className="btn"
                  onClick={() => del(n.id)}
                  style={{ background: "#ef4444", marginLeft: 8 }}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
         }
