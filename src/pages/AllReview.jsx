// src/pages/AllReview.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";
import { useNavigate } from "react-router-dom";

/* ---------------- Title inline editor ---------------- */
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

/* ---------------- Canvas preview (unwrap u,v) ---------------- */
function drawUnwrapPreview(canvas, pts, title, OD, stations, which) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(320, canvas.clientWidth || 640);
  const H = canvas.clientHeight || 200;

  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  if (!Array.isArray(pts) || pts.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui";
    ctx.fillText("No data", 12, 22);
    return;
  }

  // accept both formats: {u,v} or {xDeg,y}
  const normalized = pts
    .map((p) => {
      if (!p) return null;
      if (typeof p.u === "number" && typeof p.v === "number") return { u: p.u, v: p.v };
      if (typeof p.xDeg === "number" && typeof p.y === "number" && typeof OD === "number") {
        const R = Math.max(1, OD / 2);
        return { u: (p.xDeg / 360) * (2 * Math.PI * R), v: p.y };
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui";
    ctx.fillText("Unsupported data format", 12, 22);
    return;
  }

  const R = Math.max(1, (OD || 0) / 2);
  const minU = 0;
  const maxU = 2 * Math.PI * R;

  let minV = Infinity,
    maxV = -Infinity;
  normalized.forEach((p) => {
    minV = Math.min(minV, p.v);
    maxV = Math.max(maxV, p.v);
  });
  if (!isFinite(minV) || !isFinite(maxV)) {
    minV = 0;
    maxV = 1;
  }
  const pad = 16;
  const vMargin = Math.max(2, 0.06 * Math.max(1, maxV - minV));
  minV -= vMargin;
  maxV += vMargin;

  const X = (u) => pad + ((u - minU) * (W - 2 * pad)) / Math.max(1e-6, maxU - minU);
  const Y = (v) => H - pad - ((v - minV) * (H - 2 * pad)) / Math.max(1e-6, maxV - minV);

  // grid (vertical each 30° around run)
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  const stepU = (2 * Math.PI * R) / 12;
  for (let u = minU; u <= maxU + 1e-6; u += stepU) {
    ctx.beginPath();
    ctx.moveTo(X(u), pad);
    ctx.lineTo(X(u), H - pad);
    ctx.stroke();
  }
  // border
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  // title
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 14px system-ui";
  ctx.fillText(title || "", pad, pad - 4);

  // curve
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  normalized.forEach((p, i) => {
    const x = X(p.u),
      y = Y(p.v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // stations annotation (numbers only)
  if (Array.isArray(stations) && stations.length) {
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    stations.forEach((st) => {
      const u =
        which === "run"
          ? st.uRun ?? st.u   // accept either naming
          : st.uBranch ?? st.u;
      const v =
        which === "run"
          ? st.vRun ?? st.v
          : st.vBranch ?? st.v;
      if (typeof u !== "number") return;
      const x = X(u);
      ctx.fillText(String(Math.round(u)), x, H - pad + 14);
      if (typeof v === "number") {
        const y = Y(v) - 8;
        const text = String(Math.round(v));
        const w = Math.ceil(ctx.measureText(text).width) + 8;
        const h = 18,
          r = 8,
          rx = x - w / 2,
          ry = y - h + 4;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx + r, ry);
        ctx.lineTo(rx + w - r, ry);
        ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + r);
        ctx.lineTo(rx + w, ry + h - r);
        ctx.quadraticCurveTo(rx + w, ry + h, rx + w - r, ry + h);
        ctx.lineTo(rx + r, ry + h);
        ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - r);
        ctx.lineTo(rx, ry + r);
        ctx.quadraticCurveTo(rx, ry, rx + r, ry);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.fillText(text, x, y);
      }
    });
  }

  // baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(pad, H - pad);
  ctx.lineTo(W - pad, H - pad);
  ctx.stroke();
}

/* ---------------- Main page ---------------- */
export default function AllReview() {
  const [drawings, setDrawings] = useState([]); // /drawings
  const [tees, setTees] = useState([]); // /teeTemplates
  const navigate = useNavigate();

  useEffect(() => {
    const un1 = onValue(dbRef(db, "drawings"), (snap) => {
      const now = Date.now();
      const arr = [];
      snap.forEach((c) => {
        const v = c.val();
        const id = c.key;
        if (v.expiresAt && v.expiresAt < now) {
          remove(dbRef(db, `drawings/${id}`));
          return;
        }
        arr.push({ id, ...v });
      });
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setDrawings(arr);
    });

    const un2 = onValue(dbRef(db, "teeTemplates"), (snap) => {
      const now = Date.now();
      const arr = [];
      snap.forEach((c) => {
        const v = c.val();
        const id = c.key;
        if (v.expiresAt && v.expiresAt < now) {
          remove(dbRef(db, `teeTemplates/${id}`));
          return;
        }
        arr.push({ id, ...v });
      });
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTees(arr);
    });

    return () => {
      un1();
      un2();
    };
  }, []);

  const del = async (path, id) => {
    if (!confirm("Delete this record?")) return;
    await remove(dbRef(db, `${path}/${id}`));
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
      {/* ===== 2D DRAWINGS ===== */}
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

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => openIn2D(it)}>
                ✏️ Open in 2D
              </button>
              <button className="btn" onClick={() => del("drawings", it.id)} style={{ background: "#ef4444" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ===== TEE TEMPLATES ===== */}
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>
        {tees.length === 0 && <div className="small">No templates yet.</div>}
        {tees.map((it) => (
          <TeeCard key={it.id} it={it} onDelete={() => del("teeTemplates", it.id)} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Tee card ---------------- */
function TeeCard({ it, onDelete }) {
  const cRun = useRef(null);
  const cBr = useRef(null);

  // support both old/new schemas
  const inputs = it.inputs || {};
  const runOD = inputs.runOD ?? inputs.Rr ? (inputs.Rr ? inputs.Rr * 2 : inputs.runOD) : undefined;
  const branchOD =
    inputs.branchOD ?? inputs.Rb ? (inputs.Rb ? inputs.Rb * 2 : inputs.branchOD) : undefined;

  const runPts = it.run || it.data?.run || it.data?.Run || [];
  const brPts = it.branch || it.data?.branch || it.data?.Branch || [];
  const stations = it.stations || it.data?.stations || [];

  useEffect(() => {
    drawUnwrapPreview(cRun.current, runPts, "Run hole template", runOD, stations, "run");
    drawUnwrapPreview(cBr.current, brPts, "Branch cut template", branchOD, stations, "branch");
  }, [runPts, brPts, runOD, branchOD, stations]);

  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <TitleRow item={it} path="teeTemplates" />

      <div className="small" style={{ marginTop: 6 }}>
        {new Date(it.createdAt || Date.now()).toLocaleString()} · Run OD {runOD ?? "?"} · Branch OD{" "}
        {branchOD ?? "?"} · Pitch {inputs.pitch ?? inputs.degRun ?? 0}° · Yaw{" "}
        {inputs.yaw ?? inputs.degSide ?? 0}° · step {inputs.step ?? inputs.samples ?? "?"}
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <canvas
          ref={cRun}
          style={{ width: "100%", height: 200, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}
        />
        <canvas
          ref={cBr}
          style={{ width: "100%", height: 200, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}
        />
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={onDelete} style={{ background: "#ef4444" }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
