// src/pages/AllReview.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";
import { useNavigate } from "react-router-dom";

/* ---------- small: inline title editor ---------- */
function TitleRow({ item }) {
const [val, setVal] = useState(item.title || "");
const [saving, setSaving] = useState(false);

const saveTitle = async () => {
setSaving(true);
try {
await dbSet(dbRef(db, drawings/${item.id}/title), val || "Untitled");
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

/* ---------- preview canvas (points/lines only) ---------- */
function drawPreview(canvas, state) {
if (!canvas) return;
const dpr = window.devicePixelRatio || 1;
const W = Math.max(320, canvas.clientWidth || 520);
const H = 220;

canvas.width = Math.floor(W * dpr);
canvas.height = Math.floor(H * dpr);
const ctx = canvas.getContext("2d");
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

ctx.clearRect(0, 0, W, H);
ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, W, H);

const points = Array.isArray(state?.points) ? state.points : [];
const lines = Array.isArray(state?.lines) ? state.lines : [];

// grid
ctx.strokeStyle = "#eef2f7";
for (let x = 0; x < W; x += 20) {
ctx.beginPath();
ctx.moveTo(x, 0);
ctx.lineTo(x, H);
ctx.stroke();
}
for (let y = 0; y < H; y += 20) {
ctx.beginPath();
ctx.moveTo(0, y);
ctx.lineTo(W, y);
ctx.stroke();
}

if (!points.length) return;

// fit to canvas
const xs = points.map((p) => p.x),
ys = points.map((p) => p.y);
const minX = Math.min(...xs),
maxX = Math.max(...xs);
const minY = Math.min(...ys),
maxY = Math.max(...ys);
const pad = 12;
const sx = (W - 2 * pad) / Math.max(1e-6, maxX - minX || 1);
const sy = (H - 2 * pad) / Math.max(1e-6, maxY - minY || 1);
const s = Math.min(sx, sy);
const X = (x) => pad + (x - minX) * s;
const Y = (y) => H - pad - (y - minY) * s;

// lines
ctx.strokeStyle = "#0ea5e9";
ctx.lineWidth = 2;
lines.forEach((l) => {
const a = points.find((p) => p.id === l.p1);
const b = points.find((p) => p.id === l.p2);
if (!a || !b) return;
ctx.beginPath();
ctx.moveTo(X(a.x), Y(a.y));
ctx.lineTo(X(b.x), Y(b.y));
ctx.stroke();
});

// points
points.forEach((p) => {
ctx.fillStyle = "#ef4444";
ctx.strokeStyle = "#fff";
ctx.lineWidth = 2;
ctx.beginPath();
ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
ctx.stroke();
ctx.fill();

ctx.font = "12px system-ui";  
ctx.fillStyle = "#0f172a";  
ctx.fillText(p.label || "", X(p.x) + 6, Y(p.y) - 6);

});
}

function CanvasPreview({ state }) {
const ref = useRef(null);
useEffect(() => {
drawPreview(ref.current, state);
}, [state]);
return (
<canvas
ref={ref}
style={{
width: "100%",
height: 220,
background: "#fff",
border: "1px solid #e5e7eb",
borderRadius: 12,
}}
/>
);
}

/* ---------- main page: 2D drawings only ---------- */
export default function AllReview() {
const [items, setItems] = useState([]);
const navigate = useNavigate();

useEffect(() => {
const un = onValue(dbRef(db, "drawings"), (snap) => {
const now = Date.now();
const arr = [];
snap.forEach((child) => {
const v = child.val();
const id = child.key;
if (v.expiresAt && v.expiresAt < now) {
remove(dbRef(db, drawings/${id}));
return;
}
arr.push({ id, ...v });
});
arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
setItems(arr);
});
return () => un();
}, []);

const openIn2D = (it) => {
// ✅ accept records that have at least one point (lines optional)
const pts = it?.state?.points;
const payload =
it?.state && Array.isArray(pts) && pts.length > 0 ? it.state : null;

if (!payload) {  
  alert(  
    "This record has no points data. Please save again from 2D after adding points."  
  );  
  return;  
}  
try {  
  localStorage.setItem("wmk_restore", JSON.stringify(payload));  
} catch {}  
navigate("/drawing2d");

};

const del = async (id) => {
if (!confirm("Delete this drawing?")) return;
await remove(dbRef(db, drawings/${id}));
};

return (
<div className="grid">
<div className="card">
<div className="page-title">📁 All Saved 2D Drawings</div>
{items.length === 0 && <div className="small">No drawings yet.</div>}

{items.map((it) => (  
      <div key={it.id} className="card" style={{ padding: 12, marginBottom: 10 }}>  
        <TitleRow item={it} />  

        <div className="small" style={{ marginTop: 6 }}>  
          {new Date(it.createdAt || Date.now()).toLocaleString()} ·{" "}  
          {it.meta?.points ?? 0} pts · {it.meta?.lines ?? 0} lines ·{" "}  
          {it.meta?.angles ?? it.meta?.triples ?? 0} ∠ ·{" "}  
          {it.meta?.ties ?? 0} ties · {it.meta?.circles ?? 0} circles · unit{" "}  
          {it.unitLabel || "mm"}  
        </div>  

        <div style={{ marginTop: 10 }}>  
          <CanvasPreview state={it.state} />  
        </div>  

        <div className="row" style={{ marginTop: 8 }}>  
          <button className="btn" onClick={() => openIn2D(it)}>  
            ✏️ Open in 2D  
          </button>  
          <button  
            className="btn"  
            onClick={() => del(it.id)}  
            style={{ background: "#ef4444" }}  
          >  
            🗑 Delete  
          </button>  
        </div>  
      </div>  
    ))}  
  </div>  
</div>

);
}

  
