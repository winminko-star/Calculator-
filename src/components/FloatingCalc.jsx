// src/components/FloatingCalc.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ---------- localStorage keys ---------- */
const LS_OPEN = "floating_open";
const LS_POS  = "floating_pos";
const LS_TAB  = "floating_tab";     // "calc" | "tri"
const LS_EXPR = "floating_expr";    // calculator expression
const LS_TRI  = "floating_tri";     // triangle inputs {mode,a,b,c,h}

/* ---------- UI helpers ---------- */
const BUBBLE = 32;   // minimized bubble size
const MARGIN = 12;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmt = (x) => {
  if (!Number.isFinite(x)) return "NaN";
  const s = Number(x).toFixed(6).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

/* ---------- Calculator internals ---------- */
const KEYS = [
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
    const o=(s.match(/\(/g)||[]).length, c=(s.match(/\)/g)||[]).length;
    if(o!==c) return null;
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict";return(${s});`)();
    if(typeof val!=="number"||!isFinite(val)) return null;
    return trimTrailingZeros(val);
  }catch{ return null; }
}
const tryEval = (s) => { const v = safeEval(s); return v===null ? s : String(v); };

/* ---------- Triangle solver ---------- */
/**
 * modes:
 *  - "iso" : isosceles (a==c). Inputs: any 2 of (a, b, h) → compute the third.
 *  - "sss" : general by three sides a,b,c. (triangle inequality required)
 * Outputs (apex/baseL/baseR) are derived by law-of-cosines.
 * For UI, we show results in the same input boxes where applicable;
 * read-only boxes are for angles.
 */
function solveTriangle(state){
  const has = (x)=>Number.isFinite(x);
  let { mode, a, b, c, h } = state;
  let A=a, B=b, C=c, H=h;
  let apex=NaN, baseL=NaN, baseR=NaN;

  if (mode==="iso"){
    // a == c
    if (has(B) && has(H)){
      A = C = Math.sqrt((B/2)**2 + H**2);
    } else if (has(A) && has(B)){
      const t = A*A - (B/2)**2;
      H = t>=0 ? Math.sqrt(t) : NaN;
      C = A;
    } else if (has(A) && has(H)){
      const t = A*A - H*H;
      B = t>=0 ? 2*Math.sqrt(t) : NaN;
      C = A;
    }

    if (has(B) && has(H)){
      const rad = 2*Math.atan2(B/2, H);
      apex = rad*180/Math.PI;
      baseL = baseR = (180 - apex)/2;
    } else if (has(A) && has(B)){
      const cosApex = (2*A*A - B*B)/(2*A*A);
      if (cosApex<=1 && cosApex>=-1){
        apex = Math.acos(cosApex)*180/Math.PI;
        baseL = baseR = (180 - apex)/2;
      }
    }
    return { a:A, b:B, c:C, h:H, apex, baseL, baseR };
  }

  // SSS
  if (has(A) && has(B) && has(C) && A+B>C && A+C>B && B+C>A){
    const cosApex = (A*A + C*C - B*B)/(2*A*C);
    apex = (cosApex<=1 && cosApex>=-1) ? Math.acos(cosApex)*180/Math.PI : NaN;

    const cosLeft  = (B*B + C*C - A*A)/(2*B*C);
    const cosRight = (A*A + B*B - C*C)/(2*A*B);
    baseL = (cosLeft<=1 && cosLeft>=-1) ? Math.acos(cosLeft)*180/Math.PI : NaN;
    baseR = (cosRight<=1 && cosRight>=-1) ? Math.acos(cosRight)*180/Math.PI : NaN;

    const s = (A+B+C)/2;
    const area = Math.sqrt(Math.max(0, s*(s-A)*(s-B)*(s-C)));
    const HB = has(B) && area>0 ? (2*area)/B : NaN;
    return { a:A, b:B, c:C, h:HB, apex, baseL, baseR };
  }
  return { a:A, b:B, c:C, h:H, apex, baseL, baseR };
}

/* ---------- Main Floating ---------- */
export default function FloatingCalc(){
  const [open, setOpen] = useState(()=>localStorage.getItem(LS_OPEN)==="1");
  const [tab,  setTab ] = useState(()=>localStorage.getItem(LS_TAB) || "calc");

  // position
  const [pos, setPos] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem(LS_POS)||"{}"); }catch{ return {}; }
  });
  const panelRef = useRef(null);
  const start = useRef({x:0,y:0, px:0, py:0});
  const dragging = useRef(false);

  // calc state
  const [expr, setExpr] = useState(()=>localStorage.getItem(LS_EXPR) || "");
  const [flash, setFlash] = useState("");

  // triangle state
  const [tri, setTri] = useState(()=>{
    try{
      const s = JSON.parse(localStorage.getItem(LS_TRI) || "{}");
      return {
        mode: s.mode || "iso",
        a: nOrNaN(s.a), b: nOrNaN(s.b), c: nOrNaN(s.c), h: nOrNaN(s.h),
      };
    }catch{
      return { mode:"iso", a:NaN, b:NaN, c:NaN, h:NaN };
    }
  });

  /* persist */
  useEffect(()=>localStorage.setItem(LS_OPEN, open ? "1":"0"), [open]);
  useEffect(()=>localStorage.setItem(LS_TAB, tab), [tab]);
  useEffect(()=>localStorage.setItem(LS_EXPR, expr), [expr]);
  useEffect(()=>localStorage.setItem(LS_TRI, JSON.stringify(tri)), [tri]);

  /* size + clamp */
  function getPanelSize(){
    if (!open) return { w:BUBBLE, h:BUBBLE };
    const r = panelRef.current?.getBoundingClientRect();
    const w = r?.width  || Math.min(window.innerWidth*0.92, 380);
    const h = r?.height || 540;
    return { w, h };
  }
  function clampPos(x, y){
    const { w, h } = getPanelSize();
    const vw = window.innerWidth, vh = window.innerHeight;
    return { x: clamp(x, MARGIN, vw-w-MARGIN), y: clamp(y, MARGIN, vh-h-MARGIN) };
  }

  // default right-middle
  useEffect(()=>{
    if (pos.x==null || pos.y==null){
      const { w, h } = getPanelSize();
      const vw=window.innerWidth, vh=window.innerHeight;
      const x = vw - w - MARGIN;
      const y = clamp((vh-h)/2, MARGIN, vh-h-MARGIN);
      const p={x,y}; setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // re-clamp
  useEffect(()=>{
    const t=setTimeout(()=>{
      const fixed = clampPos(pos.x||0, pos.y||0);
      setPos(fixed); localStorage.setItem(LS_POS, JSON.stringify(fixed));
    },0);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open]);

  useEffect(()=>{
    const onResize=()=>{
      const fixed = clampPos(pos.x||0, pos.y||0);
      setPos(fixed); localStorage.setItem(LS_POS, JSON.stringify(fixed));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return ()=>{
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pos.x,pos.y,open]);

  /* drag handlers */
  const onDragStart=(e)=>{
    dragging.current = true;
    start.current = { x:e.clientX, y:e.clientY, px:pos.x||0, py:pos.y||0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove=(e)=>{
    if(!dragging.current) return;
    const dx=e.clientX-start.current.x, dy=e.clientY-start.current.y;
    setPos(clampPos((start.current.px||0)+dx,(start.current.py||0)+dy));
  };
  const onDragEnd=(e)=>{
    if(!dragging.current) return;
    dragging.current=false;
    const fixed = clampPos(pos.x||0, pos.y||0);
    setPos(fixed); localStorage.setItem(LS_POS, JSON.stringify(fixed));
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  /* calculator actions */
  const push=(k)=>{
    setFlash(k); setTimeout(()=>setFlash(""), 120);
    if(k==="AC") return setExpr("");
    if(k==="DEL") return setExpr(s=>s.slice(0,-1));
    if(k==="=")  return setExpr(s=>tryEval(s));
    setExpr(s0=>{
      let s=s0; if(k==="−") k="-";
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

  /* triangle derived */
  const solved = useMemo(()=>solveTriangle(tri), [tri]);

  /* render */
  const containerStyle = {
    position:"fixed", left:pos.x||0, top:pos.y||0, zIndex:9999, pointerEvents:"none",
  };

  if (!open){
    return createPortal(
      <div style={containerStyle}>
        <button
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onClick={()=>setOpen(true)}
          aria-label="Open Tools"
          style={{
            pointerEvents:"auto",
            width:BUBBLE, height:BUBBLE, borderRadius:BUBBLE/2,
            border:"none", color:"#fff", fontWeight:800, fontSize:18,
            background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)",
            boxShadow:"0 8px 20px rgba(2,132,199,0.45)",
            touchAction:"none",
          }}
        >🧮</button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={containerStyle}>
      <div
        ref={panelRef}
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
        {/* Header */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          style={{
            cursor:"grab",
            background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)",
            color:"#fff", padding:8,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            userSelect:"none", touchAction:"none",
          }}
        >
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <strong>Floating Tools</strong>
            <div style={{ display:"flex", gap:6, marginLeft:8 }}>
              <TabBtn label="Calc"     active={tab==="calc"} onClick={()=>setTab("calc")} />
              <TabBtn label="Triangle" active={tab==="tri"}  onClick={()=>setTab("tri")} />
            </div>
          </div>
          <button
            onClick={()=>setOpen(false)}
            aria-label="Minimize"
            style={{ width:28, height:28, borderRadius:8, border:"none",
              background:"rgba(255,255,255,0.18)", color:"#fff", fontWeight:900 }}
          >×</button>
        </div>

        {tab==="calc" ? (
          <div>
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
                {KEYS.flat().map((k)=>(
                  <Key key={k} label={k} active={flash===k} onClick={()=>push(k)} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <TrianglePane tri={tri} setTri={setTri} solved={solved} />
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------- UI pieces ---------- */
function TabBtn({label, active, onClick}){
  return (
    <button
      onClick={(e)=>{ e.stopPropagation(); onClick(); }}
      style={{
        border:"none",
        padding:"4px 10px",
        borderRadius:999,
        fontSize:12,
        fontWeight:700,
        background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
        color: active ? "#0ea5e9" : "#fff",
      }}
    >{label}</button>
  );
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
      tabIndex={0}
      style={{
        height:52, borderRadius:14, fontSize:18, fontWeight:800,
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

/* ---------- Triangle pane (with SVG sketch) ---------- */
function TrianglePane({ tri, setTri, solved }){
  // show: user value if provided, else solved value (if finite)
  const show = (userVal, solvedVal) =>
    Number.isFinite(userVal) ? String(userVal) : (Number.isFinite(solvedVal) ? fmt(solvedVal) : "");

  const setField = (k)=>(e)=>{
    const v = e.target.value.trim();
    if (v === "") { setTri(p=>({ ...p, [k]: NaN })); return; } // clear → auto mode
    const n = Number(v.replace(/,/g,""));
    setTri(p=>({ ...p, [k]: Number.isFinite(n) ? n : NaN }));
  };
  const setMode = (m)=> setTri(p=>({ ...p, mode:m }));

  // simple SVG triangle preview (isosceles-ish proportions)
  const svgW = 220, svgH = 160;
  const baseY = svgH - 20, apexY = 20, leftX = 30, rightX = svgW - 30, apexX = svgW/2;
  const midX = (leftX + rightX)/2;

  return (
    <div style={{ padding:12, background:"#fff" }}>
      {/* Mode select */}
      <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
        <label style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>Mode:</label>
        <select
          value={tri.mode}
          onChange={(e)=>setMode(e.target.value)}
          style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"4px 8px" }}
        >
          <option value="iso">Isosceles (a=c)</option>
          <option value="sss">General (SSS)</option>
        </select>
      </div>

      {/* Sketch + fields */}
      <div style={{
        position:"relative",
        border:"1px dashed #e5e7eb", borderRadius:12, background:"#f8fafc",
        padding:"12px 8px 14px",
      }}>
        {/* SVG figure */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            {/* base */}
            <line x1={leftX} y1={baseY} x2={rightX} y2={baseY} stroke="#94a3b8" strokeWidth="2" />
            {/* sides */}
            <line x1={leftX} y1={baseY} x2={apexX} y2={apexY} stroke="#0ea5e9" strokeWidth="2.5" />
            <line x1={rightX} y1={baseY} x2={apexX} y2={apexY} stroke="#0ea5e9" strokeWidth="2.5" />
            {/* height */}
            <line x1={midX} y1={baseY} x2={apexX} y2={apexY} stroke="#22c55e" strokeDasharray="4 4" strokeWidth="2" />
            {/* right angle marker at foot (approx) */}
            <path d={`M ${midX} ${baseY} h 12 v -12`} fill="none" stroke="#22c55e" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Apex angle (read-only) */}
        <Row center>
          <Field label="Apex (°)" value={show(NaN, solved.apex)} readOnly />
        </Row>

        {/* Left & Right sides */}
        <Row>
          <Field
            label="a (left)"
            value={show(tri.a, solved.a)}
            onChange={setField("a")}
            disabled={tri.mode==="iso" && Number.isFinite(tri.c)}
          />
          <Field
            label="c (right)"
            value={show(tri.c, solved.c)}
            onChange={setField("c")}
            disabled={tri.mode==="iso"} // isosceles => a=c (fill a / b / h)
          />
        </Row>

        {/* Height to base */}
        <Row center>
          <Field label="h (to base)" value={show(tri.h, solved.h)} onChange={setField("h")} />
        </Row>

        {/* Base length */}
        <Row center>
          <Field label="b (base)" value={show(tri.b, solved.b)} onChange={setField("b")} />
        </Row>

        {/* Base angles (read-only) */}
        <Row>
          <Field label="Base L (°)" value={show(NaN, solved.baseL)} readOnly />
          <Field label="Base R (°)" value={show(NaN, solved.baseR)} readOnly />
        </Row>
      </div>

      <div style={{ fontSize:11, color:"#64748b", marginTop:8 }}>
        • Isosceles (a=c): a/b/h ထဲက **၂ခု** ဖြည့်ရင် ကျန်တစ်ခု auto ထွက်မယ်။ • SSS: a,b,c ဖြည့်ရင် angle တွေ auto ထွက်မယ်။ မလုံလောက်/မကျေ မျှတရင် field တွေက **NaN** ဖြစ်မယ်။
      </div>
    </div>
  );
}

/* small layout helpers */
function Row({ children, center=false }){
  return (
    <div style={{
      display:"grid",
      gridTemplateColumns: center ? "1fr" : "1fr 1fr",
      gap:10, justifyItems: center ? "center" : "stretch", marginBottom:8
    }}>{children}</div>
  );
}
function Field({ label, value, onChange, readOnly=false, disabled=false }){
  return (
    <div style={{ display:"grid", gap:4, minWidth:120 }}>
      <div style={{ fontSize:12, color:"#334155" }}>{label}</div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        style={{
          height:36, borderRadius:10, padding:"0 10px",
          border:"1px solid #e5e7eb", background: readOnly? "#f1f5f9" : "#fff",
        }}
      />
    </div>
  );
}

/* utils */
function nOrNaN(v){ const n=Number(v); return Number.isFinite(n)? n : NaN; }
