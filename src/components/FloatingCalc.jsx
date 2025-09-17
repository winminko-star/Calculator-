// src/components/FloatingCalc.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ---------- persist keys ---------- */
const LS_OPEN = "floatingCalc_open";
const LS_POS  = "floatingCalc_pos";
const LS_EXPR = "floatingCalc_expr";

/* ---------- simple-calc internals ---------- */
const keys = [
  ["AC", "DEL", "(", ")"],
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["0", ".", "+", "="],
];
const isOp = (ch) => "+-×÷".includes(ch);

function trimTrailingZeros(n){ return n.toFixed(12).replace(/\.?0+$/,""); }
function safeEval(source){
  if(!source) return null;
  try{
    let s = source.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-");
    if(!/^[0-9+\-*/().\s]*$/.test(s)) return null;
    const opens=(s.match(/\(/g)||[]).length, closes=(s.match(/\)/g)||[]).length;
    if(opens!==closes) return null;
    const val = Function(`"use strict";return(${s});`)();
    if(typeof val!=="number"||!isFinite(val)) return null;
    return trimTrailingZeros(val);
  }catch{ return null; }
}
const tryEval = (s) => { const v = safeEval(s); return v===null ? s : String(v); };

/* ---------- component ---------- */
export default function FloatingCalc(){
  const [open, setOpen] = useState(() => (localStorage.getItem(LS_OPEN) === "1"));
  const [pos, setPos]   = useState(() => {
    try{ return JSON.parse(localStorage.getItem(LS_POS)||"{}"); }catch{ return {}; }
  });
  const [expr, setExpr] = useState(() => localStorage.getItem(LS_EXPR) || "");
  const [flash, setFlash] = useState("");

  useEffect(()=>localStorage.setItem(LS_OPEN, open ? "1":"0"), [open]);
  useEffect(()=>localStorage.setItem(LS_EXPR, expr), [expr]);

  // default snap to right-middle once
  useEffect(()=>{
    if(pos.x==null || pos.y==null){
      const vw=window.innerWidth, vh=window.innerHeight, b=56, m=12;
      const x=vw-b-m, y=Math.max(m, Math.min(vh-b-m, vh/2-b/2));
      const p={x,y}; setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // drag setup
  const start = useRef({x:0,y:0, px:0, py:0});
  const dragging = useRef(false);

  const onDragStart = (e)=>{
    dragging.current = true;
    start.current = { x:e.clientX, y:e.clientY, px:pos.x||0, py:pos.y||0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e)=>{
    if(!dragging.current) return;
    const dx=e.clientX-start.current.x, dy=e.clientY-start.current.y;
    const vw=window.innerWidth, vh=window.innerHeight;
    const w=open ? Math.min(380, Math.max(300, vw*0.92)) : 56;
    const h=open ? 440 : 56;
    const m=8;
    const x=Math.max(m, Math.min(vw-w-m, (start.current.px||0)+dx));
    const y=Math.max(m, Math.min(vh-h-m, (start.current.py||0)+dy));
    setPos({x,y});
  };
  const onDragEnd = (e)=>{
    if(!dragging.current) return;
    dragging.current=false;
    localStorage.setItem(LS_POS, JSON.stringify({x:pos.x, y:pos.y}));
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // calculator logic (no focus stealing; buttons only)
  const push = (k)=>{
    setFlash(k); setTimeout(()=>setFlash(""), 120);
    if(k==="AC") return setExpr("");
    if(k==="DEL") return setExpr(s=>s.slice(0,-1));
    if(k==="=")  return setExpr(s=>tryEval(s));
    setExpr(s0=>{
      let s=s0;
      if(k==="−") k="-";
      if(isOp(k)){
        if(!s) return k==="-"? "-" : s;
        const prev=s[s.length-1];
        if(isOp(prev)){ if(!(k==="-" && prev==="(")) s=s.slice(0,-1); }
      }
      if(k==="."){
        const lastOp=Math.max(s.lastIndexOf("+"),s.lastIndexOf("-"),s.lastIndexOf("×"),s.lastIndexOf("÷"),s.lastIndexOf("("));
        const seg=s.slice(lastOp+1);
        if(seg.includes(".")) return s;
        if(!seg) return s+"0.";
      }
      if(k===")"){
        const o=(s.match(/\(/g)||[]).length, c=(s.match(/\)/g)||[]).length;
        if(o<=c) return s;
      }
      return s+k;
    });
  };

  const preview = useMemo(()=> {
    const v = safeEval(expr);
    return v===null? "" : v.toString();
  },[expr]);

  // container blocks NOTHING underneath by default
  const containerStyle = {
    position:"fixed", left:pos.x||0, top:pos.y||0, zIndex:9999,
    pointerEvents:"none",   // ✅ let clicks fall through except our inner boxes
  };

  const bubbleCommon = {
    pointerEvents:"auto",   // ✅ clickable
    border:"none", color:"#fff", fontWeight:800,
    boxShadow:"0 8px 20px rgba(2,132,199,0.45)",
    // drag targets handle all pointer moves; DO NOT disable page scroll globally
  };

  const ui = !open ? (
    // minimized bubble (drag target itself)
    <div style={containerStyle}>
      <button
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onClick={()=>setOpen(true)}
        aria-label="Open Calculator"
        style={{
          ...bubbleCommon,
          width:56, height:56, borderRadius:28,
          background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)",
          fontSize:26,
          touchAction:"none" /* drag only on the bubble */,
        }}
      >🧮</button>
    </div>
  ) : (
    // expanded panel; only the header is draggable
    <div style={containerStyle}>
      <div
        style={{
          pointerEvents:"auto",
          width:"min(92vw, 380px)",
          background:"linear-gradient(180deg,#e0f2fe 0%,#f8fafc 35%,#f1f5f9 100%)",
          borderRadius:16, boxShadow:"0 10px 28px rgba(0,0,0,0.20)",
          border:"1px solid #e5e7eb", overflow:"hidden",
        }}
        onMouseDown={(e)=>e.stopPropagation()}
        onTouchStart={(e)=>e.stopPropagation()}
      >
        {/* draggable header (drag target) */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          style={{
            cursor:"grab",
            background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)",
            color:"#fff", padding:8, display:"flex",
            alignItems:"center", justifyContent:"space-between",
            userSelect:"none", touchAction:"none" /* drag only on header */,
          }}
        >
          <div style={{ fontWeight:800 }}>🧮 Simple Calculator</div>
          <button
            onClick={()=>setOpen(false)}
            aria-label="Minimize"
            style={{
              width:36, height:36, borderRadius:10, border:"none",
              background:"rgba(255,255,255,0.18)", color:"#fff",
              fontSize:18, fontWeight:900,
            }}
          >×</button>
        </div>

        {/* display */}
        <div style={{ border:"none", background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)", color:"#fff" }}>
          <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:14, padding:12, margin:12 }}>
            <div style={{
              height:32, lineHeight:"32px", fontSize:18, letterSpacing:0.5,
              whiteSpace:"nowrap", overflowX:"auto", overflowY:"hidden", wordBreak:"keep-all",
            }}>{expr || "0"}</div>
            <div style={{
              marginTop:4, height:36, lineHeight:"36px", fontSize:22, fontWeight:800,
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            }}>{preview || "\u00A0"}</div>
          </div>
        </div>

        {/* keypad */}
        <div style={{ background:"#fff", borderTop:"1px solid #e5e7eb", padding:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {keys.flat().map((k)=>(
              <Key key={k} label={k} active={flash===k} onClick={()=>push(k)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // render in a portal so it never perturbs your page/forms
  return createPortal(ui, document.body);
}

function Key({ label, onClick, active }){
  const isAccent = ["=","+","−","×","÷"].includes(label);
  const bg = isAccent ? "#0ea5e9" : "#f1f5f9";
  const fg = isAccent ? "#fff" : "#0f172a";
  const bgActive = isAccent ? "#0284c7" : "#e2e8f0";
  return (
    <button
      onClick={(e)=>{ e.stopPropagation(); onClick(); }}
      className="btn"
      tabIndex={0} /* no autofocus; explicit only */
      style={{
        height:62, borderRadius:16, fontSize:22, fontWeight:800,
        background: active ? bgActive : bg, color: fg, border:"none",
        boxShadow:"0 4px 10px rgba(0,0,0,0.08)",
        transition:"background 120ms, transform 60ms",
        touchAction:"manipulation",
      }}
      onPointerDown={(e)=>{ e.currentTarget.style.transform="scale(0.98)"; }}
      onPointerUp={(e)=>{ e.currentTarget.style.transform="scale(1)"; }}
    >{label}</button>
  );
   }
