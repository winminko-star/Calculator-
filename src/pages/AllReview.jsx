import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove } from "firebase/database";

/** Zoom + Pan viewer (pinch / drag / wheel / buttons) */
function ZoomPanViewer({ src, height = 320, background = "#fff" }) {
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
    const { w, h } = natural;
    if (!w || !h) return;
    const s = Math.min(W / w, H / h);
    setScale(s);
    // center
    setTx((W - w * s) / 2);
    setTy((H - h * s) / 2);
  };

  // on image load
  const onImgLoad = (e) => {
    const i = e.currentTarget;
    setNatural({ w: i.naturalWidth, h: i.naturalHeight });
    setLoaded(true);
    // next tick → fit
    setTimeout(fit, 0);
  };

  // keep fitting when container resizes
  useEffect(() => {
    const r = new ResizeObserver(() => fit());
    if (wrapRef.current) r.observe(wrapRef.current);
    return () => r.disconnect();
  }, [natural.w, natural.h]);

  // pointer gesture (drag / pinch)
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
      // drag pan
      setTx((v) => v + (e.clientX - prev.x));
      setTy((v) => v + (e.clientY - prev.y));
    } else if (pts.length >= 2) {
      const [p1, p2] = pts;
      const prevKeys = [...pointers.current.keys()];
      const k1 = prevKeys[0], k2 = prevKeys[1];
      const p1Prev = pointers.current.get(k1) || p1;
      const p2Prev = pointers.current.get(k2) || p2;

      const dPrev = Math.hypot((p1Prev.x - p2Prev.x), (p1Prev.y - p2Prev.y)) || 1;
      const dNow = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      setScale((s) => {
        const ns = Math.min(MAX, Math.max(MIN, s * (dNow / dPrev)));
        // keep focal point stationary
        const wrap = wrapRef.current;
        const rect = wrap.getBoundingClientRect();
        const fx = mid.x - rect.left;
        const fy = mid.y - rect.top;
        const beforeX = (fx - tx) / s;
        const beforeY = (fy - ty) / s;
        const afterX = beforeX * ns;
        const afterY = beforeY * ns;
        setTx((v) => v + (fx - (afterX + tx)));
        setTy((v) => v + (fy - (afterY + ty)));
        return ns;
      });
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
  };

  // wheel zoom (desktop)
  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const wrap = wrapRef.current;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setScale((s) => {
      const ns = Math.min(MAX, Math.max(MIN, s * delta));
      const beforeX = (mx - tx) / s;
      const beforeY = (my - ty) / s;
      const afterX = beforeX * ns;
      const afterY = beforeY * ns;
      setTx((v) => v + (mx - (afterX + tx)));
      setTy((v) => v + (my - (afterY + ty)));
      return ns;
    });
  };

  const reset = () => { setScale(1); setTx(0); setTy(0); };
  const fitClick = () => fit();

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
          width: "100%",
          height,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background,
          touchAction: "none", // 🔑 for touch gestures
          position: "relative",
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
          }}
        />
        {!loaded && (
          <div className="small" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            Loading image…
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={() => setScale((s) => Math.max(MIN, s * 0.8))}>－</button>
        <button className="btn" onClick={() => setScale((s) => Math.min(MAX, s * 1.25))}>＋</button>
        <button className="btn" onClick={fitClick}>🧭 Fit</button>
        <button className="btn" onClick={reset}>↺ Reset</button>
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

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">📁 All Saved Drawings</div>

        {items.length === 0 && <div className="small">No saved drawings yet.</div>}

        {items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 10, marginBottom: 10 }}>
            {/* ⭐ New viewer with pinch-zoom + pan */}
            <ZoomPanViewer src={it.thumbUrl || it.dataUrl} height={320} />

            <div className="small" style={{ marginTop: 8 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} ·{" "}
              {(it.meta?.points ?? 0)} pts · {(it.meta?.lines ?? 0)} lines · {(it.meta?.triples ?? 0)} ∠
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
