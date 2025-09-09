// src/pages/AllReview.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";
import { useNavigate } from "react-router-dom";

/* ---------- Inline title editor ---------- */
function TitleRow({ item, path }) {
  const [val, setVal] = useState(item.title || "");
  const [saving, setSaving] = useState(false);

  const saveTitle = async () => {
    setSaving(true);
    try {
      await dbSet(dbRef(db, `${path}/${item.id}/title`), val || "Untitled");
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
        onChange={(e) => setVal(e.target.value)}
        style={{ flex: "1 1 auto" }}
      />
      <button className="btn" onClick={saveTitle} disabled={saving}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </div>
  );
}

/* ---------- Optional tiny 2D preview (safe-guarded) ---------- */
function draw2DThumb(canvas, thumb) {
  if (!canvas) return;
  const pts = Array.isArray(thumb?.points) ? thumb.points : null;
  const segs = Array.isArray(thumb?.lines) ? thumb.lines : null;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 300;
  const H = canvas.clientHeight || 160;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // no data → show hint and return
  if (!pts || !pts.length || !segs || !segs.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui";
    ctx.fillText("No preview", 10, 18);
    return;
  }

  // bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const pad = 10;
  const sx = (W - pad*2) / Math.max(1e-6, maxX - minX);
  const sy = (H - pad*2) / Math.max(1e-6, maxY - minY);
  const s = Math.min(sx, sy);
  const X = x => pad + (x - minX) * s;
  const Y = y => H - pad - (y - minY) * s;

  // grid (light)
  ctx.strokeStyle = "#eef2f7";
  for (let x = pad; x <= W - pad; x += 20) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke(); }
  for (let y = pad; y <= H - pad; y += 20) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }

  // segments
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  segs.forEach(([i, j]) => {
    const a = pts[i], b = pts[j];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.stroke();
  });

  // points
  ctx.fillStyle = "#0f172a";
  pts.forEach(p => {
    const r = 2.5;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), r, 0, Math.PI*2);
    ctx.fill();
  });
}

function Thumb({ thumb }) {
  const ref = useRef(null);
  useEffect(() => { draw2DThumb(ref.current, thumb); }, [thumb]);
  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height: 160, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}
    />
  );
}

/* ---------- Main: 2D drawings only ---------- */
export default function AllReview() {
  const [drawings, setDrawings] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const un = onValue(dbRef(db, "drawings"), (snap) => {
      const now = Date.now();
      const arr = [];
      snap.forEach((c) => {
        const v = c.val(); const id = c.key;
        if (v?.expiresAt && v.expiresAt < now) { remove(dbRef(db, `drawings/${id}`)); return; }
        arr.push({ id, ...v });
      });
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setDrawings(arr);
    });
    return () => un();
  }, []);

  const del = async (id) => {
    if (!confirm("Delete this drawing?")) return;
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
        <div className="page-title">📁 All Saved 2D Drawings</div>
        {drawings.length === 0 && <div className="small">No drawings yet.</div>}

        {drawings.map((it) => (
          <div key={it.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
            <TitleRow item={it} path="drawings" />

            <div className="small" style={{ marginTop: 6 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} ·{" "}
              {it.meta?.points ?? 0} pts · {it.meta?.lines ?? 0} lines · {it.meta?.triples ?? 0} ∠
            </div>

            {/* optional small preview if item.thumb exists */}
            {it.thumb && (
              <div style={{ marginTop: 10 }}>
                <Thumb thumb={it.thumb} />
              </div>
            )}

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => openIn2D(it)}>✏️ Open in 2D</button>
              <button className="btn" onClick={() => del(it.id)} style={{ background: "#ef4444" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
