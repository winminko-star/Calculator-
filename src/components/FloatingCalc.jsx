// src/components/FloatingCalc.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ========== localStorage keys ========== */
const LS_OPEN = "floating_open";
const LS_POS  = "floating_pos";
const LS_EXPR = "floating_expr";
const LS_TRI  = "floating_tri";

/* ========== helpers ========== */
const BUBBLE = 32;
const MARGIN = 12;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const fmt = (x)=>Number.isFinite(x)? Number(x).toFixed(6).replace(/\.?0+$/,"").replace(/^-0$/,"0") : "NaN";
const nOrNaN = (v)=>{ const n=Number(v); return Number.isFinite(n)? n : NaN; };

/* Sanitizer: Myanmar digits, degree sign, spaces, etc. */
const MM2LAT = { "၀":"0","၁":"1","၂":"2","၃":"3","၄":"4","၅":"5","၆":"6","၇":"7","၈":"8","၉":"9" };
function toNumberLoose(v) {
  if (v == null) return NaN;
  let s = String(v).trim();
  s = s.replace(/[၀၁၂၃၄၅၆၇၈၉]/g, d => MM2LAT[d]); // Myanmar → Latin
  s = s.replace(/[^\d.eE+\-]/g, "");                 // remove °, units, spaces
  if (!s || /^[-+.]$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* ========== calculator internals ========== */
const KEYS=[["AC","DEL","(",")"],["7","8","9","÷"],["4","5","6","×"],["1","2","3","−"],["0",".","+","="]];
const isOp=(ch)=>"+-×÷".includes(ch);
const trimZeros=(n)=>n.toFixed(12).replace(/\.?0+$/,"");
function safeEval(source){
  if(!source) return null;
  try{
    let s=source.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-");
    if(!/^[0-9+\-*/().\s]*$/.test(s)) return null;
    const o=(s.match(/\(/g)||[]).length,c=(s.match(/\)/g)||[]).length; if(o!==c) return null;
    // eslint-disable-next-line no-new-func
    const v=Function(`"use strict";return(${s});`)();
    if(typeof v!=="number"||!isFinite(v)) return null;
    return trimZeros(v);
  }catch{ return null; }
}
const tryEval=(s)=>{ const v=safeEval(s); return v===null? s : String(v); };

/* ========== AUTO Triangle Solver ========== */
/**
 * Accepts any combo of:
 * a, b, c, h, bL, bR, apexDeg, apexL, apexR
 * Ties: b = bL + bR, apexDeg = apexL + apexR
 * Supports SSS / SAS(apex) / right-half (a&bL or c&bR → H)
 */
function solveTriangleAuto(s0){
  // clone
  let A=s0.a, B=s0.b, C=s0.c, H=s0.h;
  let bL=s0.bL, bR=s0.bR;
  let apexDeg=s0.apexDeg, apexL=s0.apexL, apexR=s0.apexR;
  let baseL=NaN, baseR=NaN;

  const has=(x)=>Number.isFinite(x);
  const rad=(d)=>d*Math.PI/180;
  const deg=(r)=>r*180/Math.PI;
  const clamp1=(x)=>Math.max(-1,Math.min(1,x));

  /* Tie 1: base split */
  if(!has(B) && has(bL) && has(bR)) B = bL + bR;
  if(has(B) && has(bL) && !has(bR)) bR = B - bL;
  if(has(B) && has(bR) && !has(bL)) bL = B - bR;

  /* Tie 2: apex split */
  if(!has(apexDeg) && has(apexL) && has(apexR)) apexDeg = apexL + apexR;
  if(has(apexDeg) && has(apexL) && !has(apexR)) apexR = apexDeg - apexL;
  if(has(apexDeg) && has(apexR) && !has(apexL)) apexL = apexDeg - apexR;

  /* NEW: derive H from one side + its base half (Pythagoras) */
  if (!has(H)) {
    if (has(A) && has(bL)) {
      const t = A*A - bL*bL; if (t >= 0) H = Math.sqrt(t);
    }
    if (!has(H) && has(C) && has(bR)) {
      const t = C*C - bR*bR; if (t >= 0) H = Math.sqrt(t);
    }
  }

  /* Case SSS */
  if(has(A) && has(B) && has(C) && A+B>C && A+C>B && B+C>A){
    const ap = Math.acos(clamp1((A*A+C*C-B*B)/(2*A*C)));
    const bl = Math.acos(clamp1((B*B+C*C-A*A)/(2*B*C)));
    const br = Math.PI - ap - bl;
    const s=(A+B+C)/2, area=Math.sqrt(Math.max(0,s*(s-A)*(s-B)*(s-C)));
    H = (2*area)/B;
    bL = (A*A - C*C + B*B)/(2*B); bR = B - bL; // split
    const apL = Math.atan2(bL,H), apR = Math.atan2(bR,H);
    apexDeg = deg(apL+apR); apexL = deg(apL); apexR = deg(apR);
    baseL = deg(bl); baseR = deg(br);
    return pack(A,B,C,H,apexDeg,apexL,apexR,baseL,baseR,bL,bR);
  }

  /* Case SAS with apex (a,c,apexDeg) */
  if(has(A) && has(C) && has(apexDeg)){
    const ap = rad(apexDeg);
    const b2 = A*A + C*C - 2*A*C*Math.cos(ap);
    if(b2>0){
      B = Math.sqrt(b2);
      const area = 0.5*A*C*Math.sin(ap);
      H = (2*area)/B;
      const bl = Math.asin(clamp1(A*Math.sin(ap)/B));
      const br = Math.PI - ap - bl;
      baseL = deg(bl); baseR = deg(br);
      bL = (A*A - C*C + B*B)/(2*B); bR = B - bL;
      apexL = deg(Math.atan2(bL,H)); apexR = deg(Math.atan2(bR,H));
      return pack(A,B,C,H,apexDeg,apexL,apexR,baseL,baseR,bL,bR);
    }
  }

  /* Case: altitude known + any split → sides + apex split */
  if(has(H) && (has(bL) || has(bR))){
    if(!has(A) && has(bL)) A = Math.sqrt(bL*bL + H*H);
    if(!has(C) && has(bR)) C = Math.sqrt(bR*bR + H*H);
    if(has(bL)) apexL = deg(Math.atan2(bL,H));
    if(has(bR)) apexR = deg(Math.atan2(bR,H));
    if(!has(apexDeg) && (has(apexL)||has(apexR))) apexDeg = (apexL||0)+(apexR||0);
    if (!has(B) && has(bL) && has(bR)) B = bL + bR;
  }

  /* After fills, if SSS satisfied, re-solve for angles/height clean */
  if(has(A) && has(B) && has(C) && A+B>C && A+C>B && B+C>A){
    return solveTriangleAuto({ a:A,b:B,c:C,h:H, bL,bR, apexDeg, apexL, apexR });
  }

  /* If still partial: B & H & (A|C) ⇒ estimate split then fill */
  if(has(B) && has(H) && (has(A) || has(C))){
    if(has(A) && !has(bL)) bL = Math.sqrt(Math.max(0,A*A - H*H));
    if(has(C) && !has(bR)) bR = Math.sqrt(Math.max(0,C*C - H*H));
    if(has(bL) && !has(bR)) bR = B - bL;
    if(has(bR) && !has(bL)) bL = B - bR;
    if(has(bL) && has(bR)){
      if(!has(A)) A = Math.sqrt(bL*bL + H*H);
      if(!has(C)) C = Math.sqrt(bR*bR + H*H);
      apexL = deg(Math.atan2(bL,H)); apexR = deg(Math.atan2(bR,H)); apexDeg = apexL + apexR;
    }
  }

  return pack(A,B,C,H,apexDeg,apexL,apexR,baseL,baseR,bL,bR);

  function pack(a,b,c,h,apexDeg_,apexL_,apexR_,baseL_,baseR_,bL_,bR_){
    return { a,b,c,h, apexDeg:apexDeg_, apexL:apexL_, apexR:apexR_, baseL:baseL_, baseR:baseR_, bL:bL_, bR:bR_ };
  }
}

/* ========== main floating component ========== */
export default function FloatingCalc(){
  const [open,setOpen]=useState(()=>localStorage.getItem(LS_OPEN)==="1");
  const [tab,setTab]=useState("calc");

  // position
  const [pos,setPos]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem(LS_POS)||"{}"); }catch{ return {}; }
  });
  const panelRef=useRef(null); const start=useRef({x:0,y:0,px:0,py:0}); const dragging=useRef(false);

  // calc
  const [expr,setExpr]=useState(()=>localStorage.getItem(LS_EXPR)||"");
  const [flash,setFlash]=useState("");

  // triangle state
  const [tri,setTri]=useState(()=>{
    try{
      const s=JSON.parse(localStorage.getItem(LS_TRI)||"{}");
      return {
        a:nOrNaN(s.a), b:nOrNaN(s.b), c:nOrNaN(s.c), h:nOrNaN(s.h),
        bL:nOrNaN(s.bL), bR:nOrNaN(s.bR),
        apexDeg:nOrNaN(s.apexDeg), apexL:nOrNaN(s.apexL), apexR:nOrNaN(s.apexR),
      };
    }catch{
      return { a:NaN,b:NaN,c:NaN,h:NaN,bL:NaN,bR:NaN,apexDeg:NaN,apexL:NaN,apexR:NaN };
    }
  });
  // track which fields user typed (don't overwrite those)
  const [touched, setTouched] = useState({});

  useEffect(()=>localStorage.setItem(LS_OPEN, open?"1":"0"),[open]);
  useEffect(()=>localStorage.setItem(LS_EXPR, expr),[expr]);
  useEffect(()=>localStorage.setItem(LS_TRI, JSON.stringify(tri)),[tri]);

  const getPanelSize=()=>{
    if(!open) return {w:BUBBLE,h:BUBBLE};
    const r=panelRef.current?.getBoundingClientRect();
    return { w:r?.width||Math.min(window.innerWidth*0.92,380), h:r?.height||600 };
  };
  const clampPos=(x,y)=>{
    const {w,h}=getPanelSize(); const vw=window.innerWidth, vh=window.innerHeight;
    return { x:clamp(x,MARGIN,vw-w-MARGIN), y:clamp(y,MARGIN,vh-h-MARGIN) };
  };

  useEffect(()=>{
    if(pos.x==null||pos.y==null){
      const {w,h}=getPanelSize(); const vw=window.innerWidth, vh=window.innerHeight;
      const p={ x:vw-w-MARGIN, y:clamp((vh-h)/2,MARGIN,vh-h-MARGIN) };
      setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    const t=setTimeout(()=>{ const p=clampPos(pos.x||0,pos.y||0); setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p)); },0);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open]);
  useEffect(()=>{
    const onR=()=>{ const p=clampPos(pos.x||0,pos.y||0); setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p)); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pos.x,pos.y,open]);

  const onDragStart=(e)=>{ dragging.current=true; start.current={x:e.clientX,y:e.clientY,px:pos.x||0,py:pos.y||0}; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onDragMove=(e)=>{ if(!dragging.current) return; const dx=e.clientX-start.current.x,dy=e.clientY-start.current.y; setPos(clampPos(start.current.px+dx,start.current.py+dy)); };
  const onDragEnd =(e)=>{ if(!dragging.current) return; dragging.current=false; const p=clampPos(pos.x||0,pos.y||0); setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p)); e.currentTarget.releasePointerCapture?.(e.pointerId); };

  const push=(k)=>{ setFlash(k); setTimeout(()=>setFlash(""),120);
    if(k==="AC") return setExpr("");
    if(k==="DEL") return setExpr(s=>s.slice(0,-1));
    if(k==="=")   return setExpr(s=>tryEval(s));
    setExpr(s0=>{
      let s=s0; if(k==="−") k="-";
      if(isOp(k)){ if(!s) return k==="-"? "-" : s; const prev=s[s.length-1]; if(isOp(prev)){ if(!(k==="-"&&prev==="(")) s=s.slice(0,-1); } }
      if(k==="."){ const last=Math.max(s.lastIndexOf("+"),s.lastIndexOf("-"),s.lastIndexOf("×"),s.lastIndexOf("÷"),s.lastIndexOf("(")); const seg=s.slice(last+1); if(seg.includes(".")) return s; if(!seg) return s+"0."; }
      if(k===")"){ const o=(s.match(/\(/g)||[]).length,c=(s.match(/\)/g)||[]).length; if(o<=c) return s; }
      return s+k;
    });
  };
  const preview=useMemo(()=>{ const v=safeEval(expr); return v===null? "" : v.toString(); },[expr]);

  const solved=useMemo(()=>solveTriangleAuto(tri),[tri]);

  /* write-back: solver result -> tri (only fields NOT touched by user) */
  useEffect(() => {
    const s = solved;
    const keys = ["a","b","c","h","bL","bR","apexDeg","apexL","apexR"];
    let changed = false;
    const next = { ...tri };
    for (const k of keys) {
      const v = s[k];
      if (Number.isFinite(v) && !touched[k]) {
        if (!Number.isFinite(next[k]) || Math.abs(next[k] - v) > 1e-9) {
          next[k] = v; changed = true;
        }
      }
    }
    if (changed) setTri(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  useEffect(()=>{ if(open) setTouched({}); },[open]);

  /* ---------- render ---------- */
  const containerStyle={ position:"fixed", left:pos.x||0, top:pos.y||0, zIndex:9999, pointerEvents:"none" };

  if(!open){
    return createPortal(
      <div style={containerStyle}>
        <button
          onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
          onClick={()=>{ setTab("calc"); setOpen(true); }}
          aria-label="Open Tools"
          style={{
            pointerEvents:"auto", width:BUBBLE, height:BUBBLE, borderRadius:BUBBLE/2,
            border:"none", color:"#fff", fontWeight:800, fontSize:18,
            background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)",
            boxShadow:"0 8px 20px rgba(2,132,199,0.45)", touchAction:"none",
          }}
        >🧮</button>
      </div>, document.body
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
          borderRadius:16, boxShadow:"0 10px 28px rgba(0,0,0,0.20)", border:"1px solid #e5e7eb", overflow:"hidden",
        }}
        onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()}
      >
        {/* header (drag handle) */}
        <div
          onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
          style={{ cursor:"grab", background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)",
            color:"#fff", padding:8, display:"flex", alignItems:"center", justifyContent:"space-between",
            userSelect:"none", touchAction:"none" }}
        >
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <strong>Floating Tools</strong>
            <div style={{display:"flex",gap:6,marginLeft:8}}>
              <TabBtn label="Calc" active={tab==="calc"} onClick={()=>setTab("calc")}/>
              <TabBtn label="Triangle" active={tab==="tri"} onClick={()=>setTab("tri")}/>
            </div>
          </div>
          <button onClick={()=>setOpen(false)} aria-label="Minimize"
            style={{ width:28,height:28,borderRadius:8,border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",fontWeight:900 }}>×</button>
        </div>

        {tab==="calc" ? (
          <div>
            <div style={{ border:"none", background:"linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)", color:"#fff" }}>
              <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:14, padding:12, margin:12 }}>
                <div style={{ height:32,lineHeight:"32px",fontSize:18,whiteSpace:"nowrap",overflowX:"auto",overflowY:"hidden" }}>{expr||"0"}</div>
                <div style={{ marginTop:4,height:36,lineHeight:"36px",fontSize:22,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{preview||"\u00A0"}</div>
              </div>
            </div>
            <div style={{ background:"#fff", borderTop:"1px solid #e5e7eb", padding:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {KEYS.flat().map(k=><Key key={k} label={k} active={flash===k} onClick={()=>push(k)} />)}
              </div>
            </div>
          </div>
        ) : (
          /* ▶▶ CONTINUE with Part 2 below: TrianglePane + Mini ◀◀ */
          <TrianglePane tri={tri} setTri={setTri} solved={solved} setTouched={setTouched} />
        )}
      </div>
    </div>, document.body
  );
}

/* small UI */
function TabBtn({label,active,onClick}){
  return <button onClick={(e)=>{e.stopPropagation();onClick();}}
    style={{border:"none",padding:"4px 10px",borderRadius:999,fontSize:12,fontWeight:700,
      background:active?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.25)",color:active?"#0ea5e9":"#fff"}}>{label}</button>;
}
function Key({label,onClick,active}){
  const accent=["=","+","−","×","÷"].includes(label);
  return (
    <button onClick={(e)=>{e.stopPropagation();onClick();}} className="btn" tabIndex={0}
      style={{height:52,borderRadius:14,fontSize:18,fontWeight:800,
        background:active?(accent?"#0284c7":"#e2e8f0"):(accent?"#0ea5e9":"#f1f5f9"),
        color:accent?"#fff":"#0f172a",border:"none",boxShadow:"0 4px 10px rgba(0,0,0,0.08)",
        transition:"background 120ms, transform 60ms",touchAction:"manipulation"}}
      onPointerDown={(e)=>{e.currentTarget.style.transform="scale(0.98)";}}
      onPointerUp={(e)=>{e.currentTarget.style.transform="scale(1)";}}
    >{label}</button>
  );
                }
/* ========== Triangle Pane (CENTERED stage + compact inputs) ========== */
function TrianglePane({ tri, setTri, solved, setTouched }){
  const show=(u,s)=>Number.isFinite(u)? String(u) : (Number.isFinite(s)? fmt(s) : "");
  const setField=(k)=>(e)=>{
    const raw = e.target.value;
    const n = toNumberLoose(raw);
    setTri(p=>({...p,[k]: Number.isFinite(n) ? n : NaN }));
    setTouched(t=>({ ...t, [k]: true }));
  };

  // centered stage
  const STAGE_W = 280, STAGE_H = 220;
  const baseY = STAGE_H - 28, apexY = 20;
  const leftX = 30, rightX = STAGE_W - 30;
  const apexX = STAGE_W / 2, midX = (leftX + rightX) / 2;

  return (
    <div style={{ padding:12, background:"#fff" }}>
      <div style={{ border:"1px dashed #e5e7eb", borderRadius:12, background:"#f8fafc", padding:12 }}>
        {/* centered stage */}
        <div style={{ position:"relative", width:STAGE_W, height:STAGE_H+120, margin:"0 auto" }}>
          <svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
            <line x1={leftX} y1={baseY} x2={rightX} y2={baseY} stroke="#94a3b8" strokeWidth="2" />
            <line x1={leftX} y1={baseY} x2={apexX} y2={apexY} stroke="#0ea5e9" strokeWidth="3" />
            <line x1={rightX} y1={baseY} x2={apexX} y2={apexY} stroke="#0ea5e9" strokeWidth="3" />
            <line x1={midX} y1={baseY} x2={apexX} y2={apexY} stroke="#22c55e" strokeDasharray="4 4" strokeWidth="2" />
            <path d={`M ${midX} ${baseY} h 10 v -10`} fill="none" stroke="#22c55e" strokeWidth="1.5" />
          </svg>

          {/* Apex total & split */}
          <Mini label="Apex (°)"
            style={{ left:`${apexX}px`, top:`${apexY-18}px`, transform:"translate(-50%,-100%)" }}
            value={show(tri.apexDeg, solved.apexDeg)} onChange={setField("apexDeg")} />
          <Mini label="L°"
            style={{ left:`${apexX-42}px`, top:`${apexY+8}px`, transform:"translate(-100%,0)" }}
            value={show(tri.apexL, solved.apexL)} onChange={setField("apexL")} />
          <Mini label="R°"
            style={{ left:`${apexX+42}px`, top:`${apexY+8}px` }}
            value={show(tri.apexR, solved.apexR)} onChange={setField("apexR")} />

          {/* Sides */}
          <Mini label="a"
            style={{ left:`${leftX-8}px`, top:`${(apexY+baseY)/2}px`, transform:"translate(-100%,-50%)" }}
            value={show(tri.a, solved.a)} onChange={setField("a")} />
          <Mini label="c"
            style={{ left:`${rightX+8}px`, top:`${(apexY+baseY)/2}px`, transform:"translate(0,-50%)" }}
            value={show(tri.c, solved.c)} onChange={setField("c")} />

          {/* Height */}
          <Mini label="h"
            style={{ left:`${midX}px`, top:`${(apexY+baseY)/2}px`, transform:"translate(-50%,-50%)" }}
            value={show(tri.h, solved.h)} onChange={setField("h")} />

          {/* Base total & split */}
          <Mini label="b (Σ)"
            style={{ left:`${midX}px`, top:`${baseY+16}px`, transform:"translate(-50%,0)" }}
            value={show(tri.b, solved.b)} onChange={setField("b")} />
          <Mini label="bL"
            style={{ left:`${leftX}px`, top:`${baseY+16}px`, transform:"translate(-100%,0)" }}
            value={show(tri.bL, solved.bL)} onChange={setField("bL")} />
          <Mini label="bR"
            style={{ left:`${rightX}px`, top:`${baseY+16}px` }}
            value={show(tri.bR, solved.bR)} onChange={setField("bR")} />

          {/* Base angles (read-only) */}
          <Mini label="L (°)" readOnly
            style={{ left:`${leftX-2}px`, top:`${baseY+48}px`, transform:"translate(-100%,0)" }}
            value={show(NaN, solved.baseL)} />
          <Mini label="R (°)" readOnly
            style={{ left:`${rightX+2}px`, top:`${baseY+48}px` }}
            value={show(NaN, solved.baseR)} />
        </div>
      </div>

      <div style={{ fontSize:11, color:"#64748b", marginTop:8, lineHeight:1.4 }}>
        • Auto: a, b / bL / bR, h, Apex° သို့မဟုတ် Apex L/R — solvable ဖြစ်တာနဲ့ input box ထဲကိုပဲ auto ပြန်ဖြည့်တယ်။  
        • Ties: <code>b = bL + bR</code>, <code>Apex° = L° + R°</code>. မလုံလောက်ရင် ဗလာ/NaN။
      </div>
    </div>
  );
}

/* compact mini input */
function Mini({label,value,onChange,readOnly=false,style}){
  return (
    <div style={{ position:"absolute", width:48, ...style, textAlign:"center" }}>
      <div style={{ fontSize:9, color:"#334155", marginBottom:1 }}>{label}</div>
      <input
        type="text" inputMode="decimal"
        value={value ?? ""} onChange={onChange} readOnly={readOnly} placeholder="0"
        style={{
          height:22, borderRadius:6, padding:"0 2px", width:"100%",
          border:"1px solid #cbd5e1",
          background: readOnly ? "#f1f5f9" : "#fff",
          textAlign:"center", fontSize:12
        }}
      />
    </div>
  );
            }
