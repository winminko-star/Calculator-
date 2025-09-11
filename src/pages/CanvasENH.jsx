// ===== CanvasENH.jsx — PART 1/3 =====
import React, { useEffect, useRef, useState } from "react";
import { ref, push } from "firebase/database";
import { db } from "../firebase";

export default function CanvasENH() {
  const [count, setCount] = useState(4);
  const [values, setValues] = useState([
    "0,0,0",
    "2000,0,0",
    "2000,1500,0",
    "0,1500,0"
  ]);
  const [specialJoins, setSpecialJoins] = useState([]);
  const [sjInput, setSjInput] = useState("");
  const [closeShape, setCloseShape] = useState(true);
  const canvasRef = useRef(null);

  // ✅ Load from localStorage if ENH_REVIEW_LOAD exists
  useEffect(() => {
    const raw = localStorage.getItem("ENH_REVIEW_LOAD");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setCount(data.count);
        setValues(data.values);
        setSpecialJoins(data.specialJoins || []);
        setCloseShape(!!data.closeShape);
      } catch {}
      localStorage.removeItem("ENH_REVIEW_LOAD");
      setTimeout(() => draw(), 200); // auto draw
    }
  }, []);

  // input update
  const applyCount = () => {
    setValues((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push("");
      return next;
    });
  };
  const updateValue = (idx, val) =>
    setValues((prev) => prev.map((v, i) => (i === idx ? val : v)));

  const addSJ = () => {
    const t = sjInput.trim();
    if (!t) return;
    const arr = t.split(",").map((s) => Number(s.trim()));
    if (arr.length !== 2 || !Number.isInteger(arr[0]) || !Number.isInteger(arr[1])) {
      alert("Special Join format: a,b (numbers)");
      return;
    }
    setSpecialJoins((p) => [...p, { a: arr[0], b: arr[1] }]);
    setSjInput("");
  };
  const removeSJ = (i) =>
    setSpecialJoins((p) => p.filter((_, k) => k !== i));
  const clearAll = () => {
    setValues(Array.from({ length: count }, () => ""));
    setSpecialJoins([]);
    draw();
  };

  // parse points
  const parsePoints = () => {
    const pts = [];
    for (let i = 0; i < values.length; i++) {
      const t = (values[i] || "").trim();
      if (!t) continue;
      const a = t.split(",").map((s) => Number(s.trim()));
      if (a.length < 2 || a.some((x) => Number.isNaN(x))) continue;
      const [E, N, H = 0] = a;
      pts.push({ id: i + 1, E, N, H });
    }
    return pts;
  };
  const dist = (A, B) => Math.hypot(B.E - A.E, B.N - A.N);
  const vec = (A, B) => ({ x: B.E - A.E, y: B.N - A.N });
  function angleDeg(prev, center, next) {
    const v1 = vec(center, prev), v2 = vec(center, next);
    const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (d === 0) return null;
    let c = (v1.x * v2.x + v1.y * v2.y) / d;
    c = Math.max(-1, Math.min(1, c));
    return (Math.acos(c) * 180) / Math.PI;
    }
  // ===== CanvasENH.jsx — PART 2/3 =====
  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    cx.clearRect(0, 0, cv.width, cv.height);

    const pts = parsePoints();
    if (pts.length < 2) return;

    const pad = 80;
    const minE = Math.min(...pts.map((p) => p.E));
    const maxE = Math.max(...pts.map((p) => p.E));
    const minN = Math.min(...pts.map((p) => p.N));
    const maxN = Math.max(...pts.map((p) => p.N));
    const w = maxE - minE || 1;
    const h = maxN - minN || 1;
    const scale = Math.min((cv.width - 2 * pad) / w, (cv.height - 2 * pad) / h);
    const toXY = (p) => ({
      x: pad + (p.E - minE) * scale,
      y: cv.height - (pad + (p.N - minN) * scale),
    });

    cx.lineWidth = 2;
    cx.strokeStyle = "#38bdf8";
    cx.fillStyle = "#e5e7eb";
    cx.font = "12px monospace";

    const cons = [];
    for (let i = 0; i < pts.length - 1; i++) cons.push([pts[i], pts[i + 1]]);
    if (closeShape && pts.length >= 3) cons.push([pts.at(-1), pts[0]]);
    specialJoins.forEach(({ a, b }) => {
      const A = pts.find((p) => p.id === a);
      const B = pts.find((p) => p.id === b);
      if (A && B) cons.push([A, B]);
    });

    cons.forEach(([A, B]) => {
      const a = toXY(A), b = toXY(B);
      cx.beginPath();
      cx.moveTo(a.x, a.y);
      cx.lineTo(b.x, b.y);
      cx.stroke();
      const L = Math.round(dist(A, B));
      cx.fillText(`${L} mm`, (a.x + b.x) / 2 + 6, (a.y + b.y) / 2 - 6);
    });

    if (pts.length >= 3) {
      for (let i = 1; i < pts.length - 1; i++) {
        const d = angleDeg(pts[i - 1], pts[i], pts[i + 1]);
        if (d != null) {
          const p = toXY(pts[i]);
          cx.fillText(`${d.toFixed(0)}°`, p.x + 8, p.y - 8);
        }
      }
      if (closeShape) {
        const d1 = angleDeg(pts.at(-2), pts.at(-1), pts[0]);
        const d0 = angleDeg(pts.at(-1), pts[0], pts[1]);
        if (d1 != null) {
          const p = toXY(pts.at(-1));
          cx.fillText(`${d1.toFixed(0)}°`, p.x + 8, p.y - 8);
        }
        if (d0 != null) {
          const p = toXY(pts[0]);
          cx.fillText(`${d0.toFixed(0)}°`, p.x + 8, p.y - 8);
        }
      }
    }

    pts.forEach((P) => {
      const p = toXY(P);
      cx.beginPath();
      cx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      cx.fill();
      cx.fillText(`${P.id}`, p.x + 8, p.y + 12);
    });
  }

  useEffect(() => { draw(); }, [values, specialJoins, closeShape]);

  const saveReviewData = () => {
    const snap = { ts: Date.now(), count, values, specialJoins, closeShape };
    push(ref(db, "enh_reviews"), snap)
      .then(() => alert("✅ Data saved to Firebase"))
      .catch((err) => alert("Error: " + err.message));
  };
  // ===== CanvasENH.jsx — PART 3/3 =====
  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, padding: 12 }}>
      <div>
        <h2>Input</h2>
        <input type="number" value={count} min={3}
               onChange={(e)=>setCount(Number(e.target.value)||3)} />
        <button onClick={applyCount}>Apply</button>

        {values.map((v,i)=>(
          <div key={i}>
            No.{i+1} <input value={v} onChange={(e)=>updateValue(i,e.target.value)} placeholder="E,N,H" />
          </div>
        ))}

        <div>
          Special Join <input value={sjInput} onChange={(e)=>setSjInput(e.target.value)} placeholder="e.g. 3,6"/>
          <button onClick={addSJ}>Add</button>
        </div>
        <div>
          {specialJoins.map((sj,i)=>(
            <span key={i}>[{sj.a}↔{sj.b}] <button onClick={()=>removeSJ(i)}>x</button></span>
          ))}
        </div>

        <label><input type="checkbox" checked={closeShape}
                      onChange={(e)=>setCloseShape(e.target.checked)}/> Close shape</label>
        <div>
          <button onClick={draw}>Draw</button>
          <button onClick={clearAll}>Clear</button>
          <button onClick={saveReviewData}>💾 Save Review</button>
          <button onClick={()=>{
            const url=canvasRef.current.toDataURL("image/png");
            const a=document.createElement("a"); a.href=url; a.download="enh-canvas.png"; a.click();
          }}>Save PNG</button>
        </div>
      </div>

      <div>
        <h2>Canvas</h2>
        <canvas ref={canvasRef} width={1000} height={680}
                style={{border:"1px dashed gray", background:"#0b1220"}}/>
      </div>
    </div>
  );
    }
