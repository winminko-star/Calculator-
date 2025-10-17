// ===== CanvasENH.jsx — PART 1/3 =====
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ref, push } from "firebase/database";
import { db } from "../firebase";

export default function CanvasENH() {
  // rows count (string for free typing)
  const [count, setCount] = useState(4);
  const [countStr, setCountStr] = useState("4");

  // ENH rows (blank by default)
  const [values, setValues] = useState(["", "", "", ""]);
  const [specialJoins, setSpecialJoins] = useState([]); // [{a,b}]
  const [sjInput, setSjInput] = useState("");
  const [closeShape, setCloseShape] = useState(true);

  // custom keyboard
  const [showKeyboard, setShowKeyboard] = useState(false);
  // which input is using the keyboard: 'row' | 'count' | 'sj' | null
  const [kbMode, setKbMode] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null); // only for 'row'

  // canvas + responsive container
  const canvasRef = useRef(null);
  const canvasBoxRef = useRef(null);

  useEffect(() => { setCountStr(String(count)); }, [count]);

  // ---- load from review (auto draw) ----
  useEffect(() => {
    const raw = localStorage.getItem("ENH_REVIEW_LOAD");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const n = data.count ?? 4;
        setCount(n);
        setValues(Array.from({ length: n }, (_, i) => data.values?.[i] ?? ""));
        setSpecialJoins(data.specialJoins || []);
        setCloseShape(!!data.closeShape);
      } catch {}
      localStorage.removeItem("ENH_REVIEW_LOAD");
      setTimeout(() => { syncCanvasSize(); draw(); }, 150);
    }
  }, []);

  // ---- count apply (parse/clamp HERE only) ----
  const applyCount = () => {
    let n = parseInt(countStr, 10);
    if (!Number.isFinite(n)) n = 3;
    n = Math.max(3, Math.min(100, n));
    setCount(n);
    setValues(prev => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  };

  const updateRow = (i, s) => setValues(v => v.map((x,k)=> k===i ? s : x));

  // ---- Special Join add/remove ----
  const addSJ = () => {
    const arr = sjInput.split(",").map(s => Number(s.trim()));
    if (arr.length !== 2 || !Number.isInteger(arr[0]) || !Number.isInteger(arr[1])) {
      alert("Special Join format: a,b"); return;
    }
    setSpecialJoins(p => [...p, { a: arr[0], b: arr[1] }]);
    setSjInput("");
  };
  const removeSJ = (idx) => setSpecialJoins(p => p.filter((_,i)=>i!==idx));

  // ---- parse / math ----
  const parsePoints = () => {
    const pts = [];
    for (let i = 0; i < values.length; i++) {
      const t = (values[i] || "").trim();
      if (!t) continue;
      const a = t.split(",").map(s => Number(s.trim()));
      if (a.length < 2 || a.some(x => Number.isNaN(x))) continue;
      const [E, N, H = 0] = a;
      pts.push({ id: i + 1, E, N, H });
    }
    return pts;
  };
  const dist = (A,B) => Math.hypot(B.E - A.E, B.N - A.N);
  const vec  = (A,B) => ({ x: B.E - A.E, y: B.N - A.N });
  function angleDeg(prev, center, next) {
    const v1 = vec(center, prev), v2 = vec(center, next);
    const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (d === 0) return null;
    let c = (v1.x * v2.x + v1.y * v2.y) / d;
    c = Math.max(-1, Math.min(1, c));
    return Math.acos(c) * 180 / Math.PI; // 0..180
  }

  // ---- responsive canvas ----
  function syncCanvasSize() {
    const box = canvasBoxRef.current, cv = canvasRef.current;
    if (!box || !cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, Math.min(box.clientWidth - 24, 1200));
    const h = Math.round(w * 0.68); // keep ~1000x680
    cv.style.width  = `${w}px`;
    cv.style.height = `${h}px`;
    cv.width  = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    const cx = cv.getContext("2d");
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  useEffect(() => {
    syncCanvasSize();
    const onR = () => { syncCanvasSize(); draw(); };
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  // ===== CanvasENH.jsx — PART 2/3 =====
function draw() {
  const cv = canvasRef.current; if (!cv) return;
  const cx = cv.getContext("2d");
  cx.clearRect(0, 0, cv.width, cv.height);

  const pts = parsePoints();
  if (pts.length < 2) return;

  // fit into current CSS size
  const width  = parseFloat(cv.style.width)  || 800;
  const height = parseFloat(cv.style.height) || 540;

  const pad = Math.max(40, Math.round(Math.min(width, height) * 0.08));
  const minE = Math.min(...pts.map(p => p.E));
  const maxE = Math.max(...pts.map(p => p.E));
  const minN = Math.min(...pts.map(p => p.N));
  const maxN = Math.max(...pts.map(p => p.N));
  const w = maxE - minE || 1, h = maxN - minN || 1;
  const scale = Math.min((width - 2*pad) / w, (height - 2*pad) / h);

  const toXY = (p) => ({
    x: pad + (p.E - minE) * scale,
    y: height - (pad + (p.N - minN) * scale) // invert Y
  });

  // styles
  cx.lineWidth = 2;
  cx.strokeStyle = "#38bdf8";
  cx.font = "14px ui-monospace,monospace";

  // connections
  const cons = [];
  for (let i = 0; i < pts.length - 1; i++) cons.push([pts[i], pts[i + 1]]);
  if (closeShape && pts.length >= 3) cons.push([pts.at(-1), pts[0]]);
  specialJoins.forEach(({a,b})=>{
    const A = pts.find(p => p.id === a), B = pts.find(p => p.id === b);
    if (A && B) cons.push([A,B]);
  });

  // lines + length label
  cons.forEach(([A,B])=>{
    const a = toXY(A), b = toXY(B);
    cx.beginPath(); cx.moveTo(a.x,a.y); cx.lineTo(b.x,b.y); cx.stroke();

    const L = Math.round(dist(A,B));
    cx.fillStyle = "#e5e7eb";
    cx.fillText(`${L} mm`, (a.x+b.x)/2 + 6, (a.y+b.y)/2 - 6);
  });

  // points
  pts.forEach(P=>{
    const p = toXY(P);
    cx.fillStyle = "#e2e8f0";
    cx.beginPath(); cx.arc(p.x, p.y, 4, 0, Math.PI*2); cx.fill();
    cx.fillStyle = "#93c5fd";
    cx.fillText(`${P.id}`, p.x + 8, p.y + 12);
  });

  // angles (series)
  cx.fillStyle = "#fde047";
  if (pts.length >= 3) {
    for (let i=1; i<pts.length-1; i++) {
      const d = angleDeg(pts[i-1], pts[i], pts[i+1]);
      if (d != null) {
        const p = toXY(pts[i]);
        cx.fillText(`${d.toFixed(0)}°`, p.x + 8, p.y - 10);
      }
    }
    if (closeShape) {
      const d1 = angleDeg(pts.at(-2), pts.at(-1), pts[0]);
      const d0 = angleDeg(pts.at(-1), pts[0], pts[1]);
      if (d1 != null) { const p = toXY(pts.at(-1)); cx.fillText(`${d1.toFixed(0)}°`, p.x + 8, p.y - 10); }
      if (d0 != null) { const p = toXY(pts[0]);     cx.fillText(`${d0.toFixed(0)}°`, p.x + 8, p.y - 10); }
    }
  }
}

// auto redraw when inputs change
useEffect(() => { draw(); }, [values, specialJoins, closeShape]);

const saveReview = () => {
  const pw = prompt("Enter password to save:");
  if (pw !== "007") {
    alert("❌ Wrong password");
    return;
  }

  const snap = { ts: Date.now(), count, values, specialJoins, closeShape };
  push(ref(db, "enh_reviews"), snap)
    .then(()=>alert("✅ Saved"))
    .catch(err=>alert("❌ " + err.message));
};

const clearAll = () => {
  setValues(Array(count).fill(""));
  setSpecialJoins([]);
  draw();
};

// custom keyboard input (supports row / count / sj)
const pressKey = (k) => {
  if (!kbMode) return;

  if (k === "DEL") {
    if (kbMode === "row" && activeIndex != null) {
      setValues(v => v.map((s,i)=> i===activeIndex ? s.slice(0,-1) : s));
    } else if (kbMode === "count") {
      setCountStr(s => s.slice(0,-1));
    } else if (kbMode === "sj") {
      setSjInput(s => s.slice(0,-1));
    }
    return;
  }
  if (k === "OK") {
    setShowKeyboard(false);
    if (kbMode === "row") setActiveIndex(null);
    setKbMode(null);
    return;
  }

  if (kbMode === "row" && activeIndex != null) {
    if ("0123456789-.,".includes(k)) {
      setValues(v => v.map((s,i)=> i===activeIndex ? (s + k) : s));
    }
  } else if (kbMode === "count") {
    if ("0123456789".includes(k)) setCountStr(s => s + k);
  } else if (kbMode === "sj") {
    if ("0123456789,".includes(k)) setSjInput(s => s + k);
  }
};

// Levels table (group by H)
const levels = useMemo(() => {
  const m = new Map();
  parsePoints().forEach(p => {
    const list = m.get(p.H) || [];
    list.push(p.id);
    m.set(p.H, list);
  });
  return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]); // [[H,[ids]]...]
}, [values]);
  // ===== CanvasENH.jsx — PART 3/3 =====
  const card  = { background:"#f8fafc", padding:16, borderRadius:12, boxShadow:"0 2px 6px rgba(2,6,23,.08)" };
  const btn   = (bg,col="#fff") => ({ padding:"8px 12px", borderRadius:8, border:0, background:bg, color:col, fontWeight:700, cursor:"pointer" });
  const input = { padding:"8px 10px", border:"1px solid #cbd5e1", borderRadius:8, outline:"none", background:"#fff" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:16, padding:12, fontFamily:"system-ui, sans-serif" }}>
      {/* LEFT */}
      <div style={card}>
        <h2 style={{ margin:0, marginBottom:8, color:"#0f172a" }}>Input</h2>

        {/* Count (custom keyboard) */}
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
          <input
            type="text"
            value={countStr}
            readOnly
            onFocus={() => { setKbMode('count'); setShowKeyboard(true); }}
            placeholder="rows"
            style={{ ...input, width:80, cursor:"pointer",
                     borderColor: kbMode==='count' ? "#0ea5e9" : "#cbd5e1",
                     boxShadow: kbMode==='count' ? "0 0 0 3px rgba(14,165,233,.25)" : "none",
                     backgroundColor: kbMode==='count' ? "#e0f2fe" : "#fff" }}
          />
          <button style={btn("#0ea5e9")} onClick={applyCount}>Apply</button>
        </div>

        {/* Rows (highlight when active) */}
        {values.map((v,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ width:52, color:"#475569" }}>No.{i+1}:</div>
            <input
              readOnly
              placeholder="E,N,H"
              value={v}
              onFocus={() => { setKbMode('row'); setActiveIndex(i); setShowKeyboard(true); }}
              style={{
                ...input, width:230, cursor:"pointer",
                borderColor: activeIndex===i && kbMode==='row' ? "#0ea5e9" : "#cbd5e1",
                boxShadow: activeIndex===i && kbMode==='row' ? "0 0 0 3px rgba(14,165,233,.25)" : "none",
                backgroundColor: activeIndex===i && kbMode==='row' ? "#e0f2fe" : "#fff",
                transition:"all .15s"
              }}
            />
            <button style={btn("#e2e8f0", "#0f172a")} onClick={()=>updateRow(i,"")}>×</button>
          </div>
        ))}

        <div style={{ height:1, background:"#e2e8f0", margin:"10px 0" }} />

        {/* Special Join (custom keyboard) */}
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <div style={{ width:92, color:"#475569" }}>Special Join</div>
          <input
            value={sjInput}
            readOnly
            onFocus={() => { setKbMode('sj'); setShowKeyboard(true); }}
            placeholder="e.g. 3,6"
            style={{ ...input, flex:1, cursor:"pointer",
                     borderColor: kbMode==='sj' ? "#0ea5e9" : "#cbd5e1",
                     boxShadow: kbMode==='sj' ? "0 0 0 3px rgba(14,165,233,.25)" : "none",
                     backgroundColor: kbMode==='sj' ? "#e0f2fe" : "#fff" }}
          />
          <button style={btn("#22c55e")} onClick={addSJ}>Add</button>
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
          {specialJoins.map((sj,i)=>(
            <span key={i} style={{ background:"#e2e8f0", color:"#0f172a", borderRadius:999, padding:"4px 10px", fontWeight:600 }}>
              {sj.a} ↔ {sj.b}
              <button onClick={()=>removeSJ(i)} style={{ ...btn("transparent", "#0f172a"), padding:0, marginLeft:6 }}>×</button>
            </span>
          ))}
        </div>

        <label style={{ display:"inline-flex", gap:6, alignItems:"center", color:"#0f172a", fontWeight:600 }}>
          <input type="checkbox" checked={closeShape} onChange={(e)=>setCloseShape(e.target.checked)} /> Close shape
        </label>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
          <button style={btn("#3b82f6")} onClick={() => { syncCanvasSize(); draw(); }}>Draw</button>
          <button style={btn("#f97316")} onClick={clearAll}>Clear</button>
          <button style={btn("#10b981")} onClick={saveReview}>Save Review</button>
          <button style={btn("#64748b")} onClick={()=>{
            const url = canvasRef.current.toDataURL("image/png");
            const a = document.createElement("a"); a.href = url; a.download = "enh-canvas.png"; a.click();
          }}>Save PNG</button>
        </div>

        {/* Levels table */}
        <div style={{ marginTop:14 }}>
          <h3 style={{ margin:"12px 0 6px 0" }}>Levels (H)</h3>
          <div style={{ border:"1px solid #e2e8f0", borderRadius:8, overflow:"hidden", background:"#fff" }}>
            {levels.length === 0 ? (
              <div style={{ padding:8, color:"#64748b" }}>No H values</div>
            ) : levels.map(([H, ids]) => (
              <div key={H} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderBottom:"1px solid #e2e8f0" }}>
                <div>H = <b>{H}</b></div>
                <div>Points: {ids.join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: canvas (responsive box) */}
      <div style={card} ref={canvasBoxRef}>
        <h2 style={{ margin:0, marginBottom:8 }}>Canvas</h2>
        <canvas ref={canvasRef} style={{ width:"100%", height:"auto", display:"block", border:"1px dashed #94a3b8", borderRadius:12, background:"#0b1220" }} />
      </div>

      {/* Custom Keyboard */}
      {showKeyboard && (
        <div style={{
          position:"fixed", left:0, right:0, bottom:0, background:"#111827", padding:12,
          display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, boxShadow:"0 -8px 20px rgba(0,0,0,.25)"
        }}>
          {(
            kbMode === "count"
              ? ["7","8","9","DEL","4","5","6","", "1","2","3","", "0","OK"]
              : kbMode === "sj"
                ? ["7","8","9","DEL","4","5","6",",","1","2","3","","0",",","OK"]
                : /* row */ ["7","8","9","DEL","4","5","6","-","1","2","3",",",".","0","OK"]
          ).map((k,idx)=> k ? (
            <button key={idx} onClick={()=>pressKey(k)}
              style={{
                gridColumn: k==="OK" ? "span 2" : "auto",
                padding:"16px 0", border:0, borderRadius:10,
                background: k==="OK" ? "#22c55e" : (k==="DEL" ? "#ef4444" : "#0ea5e9"),
                color:"#fff", fontSize:18, fontWeight:800
              }}>
              {k}
            </button>
          ) : <span key={idx} />)}
        </div>
      )}
    </div>
  );
}
  
