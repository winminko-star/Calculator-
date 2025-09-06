import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove } from "firebase/database";
import { useNavigate } from "react-router-dom";

/** Zoom + Pan viewer (pinch / drag / wheel / buttons) */
function ZoomPanViewer({ src, height = 360, background = "#fff" }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  // transform
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const MIN = 0.2, MAX = 10;

  // fit image into box
  const fit = () => {
    const wrap = wrapRef.current, img = imgRef.current;
    if (!wrap || !img) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const { w, h } = natural; if (!w || !h) return;
    const s = Math.min(W / w, H / h);
    setScale(s); setTx((W - w * s) / 2); setTy((H - h * s) / 2);
  };

  const onImgLoad = (e) => {
    const i = e.currentTarget;
    setNatural({ w: i.naturalWidth, h: i.naturalHeight });
    setLoaded(true);
    setTimeout(fit, 0);
  };

  useEffect(() => {
    const r = new ResizeObserver(() => fit());
    if (wrapRef.current) r.observe(wrapRef.current);
    return () => r.disconnect();
  }, [natural.w, natural.h]);

  // pointer gesture
  const pointers = useRef(new Map());
  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      setTx(v => v + (e.clientX - prev.x));
      setTy(v => v + (e.clientY - prev.y));
    } else if (pts.length >= 2) {
      const [p1, p2] = pts;
      const dPrev = Math.hypot(p1.x - prev.x, p1.y - prev.y) || 1;
      const dNow  = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const wrap = wrapRef.current, rect = wrap.getBoundingClientRect();
      const mid = { x: (p1.x + p2.x)/2 - rect.left, y: (p1.y + p2.y)/2 - rect.top };

      setScale(s => {
        const ns = Math.min(MAX, Math.max(MIN, s * (dNow / dPrev)));
        const wx = (mid.x - tx) / s, wy = (mid.y - ty) / s;
        const afterX = wx * ns, afterY = wy * ns;
        setTx(v => v + (mid.x - (afterX + tx)));
        setTy(v => v + (mid.y - (afterY + ty)));
        return ns;
      });
    }
  };
  const onPointerUp = (e) => { pointers.current.delete(e.pointerId); };
  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const wrap = wrapRef.current, rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setScale(s => {
      const ns = Math.min(MAX, Math.max(MIN, s * delta));
      const wx = (mx - tx) / s, wy = (my - ty) / s;
      const afterX = wx * ns, afterY = wy * ns;
      setTx(v => v + (mx - (afterX + tx)));
      setTy(v => v + (my - (afterY + ty)));
      return ns;
    });
  };

  return (
    <div className="grid" style={{ gap: 6 }}>
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{
          width: "100%", height,
          border: "1px solid #e5e7eb", borderRadius: 12,
          overflow: "hidden", background,
          touchAction: "none", position: "relative",
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt="drawing"
          onLoad={onImgLoad}
          draggable={false}
          style={{
            userSelect: "none",
            pointerEvents: "none",
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            display: loaded ? "block" : "none",
            width: "auto", height: "auto",
          }}
          loading="lazy"
        />
        {!loaded && (
          <div className="small" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            Loading image…
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={() => setScale(s => Math.max(MIN, s * 0.8))}>－</button>
        <button className="btn" onClick={() => setScale(s => Math.min(MAX, s * 1.25))}>＋</button>
        <button className="btn" onClick={() => { setTx(0); setTy(0); setScale(1); }}>↺ Reset</button>
      </div>
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
        <div className="page-title">📁 All Saved Drawings</div>

        {items.length === 0 && <div className="small">No saved drawings yet.</div>}

        {items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 10, marginBottom: 10 }}>
            {/* full image (same view as saved) */}
            <ZoomPanViewer src={it.dataUrl} height={360} />

            <div className="small" style={{ marginTop: 8 }}>
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
