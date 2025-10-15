// src/components/FloatingCircleCalc.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

/* ---------- persist keys ---------- */
const LS_OPEN = "circleCalc_open";
const LS_POS  = "circleCalc_pos";
const LS_POINTS = "circleCalc_points";

/* ---------- helpers ---------- */
const BUBBLE = 32;      // minimized size
const MARGIN = 12;      // edge padding

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ---------- component ---------- */
export default function FloatingCircleCalc() {
  const [open, setOpen] = useState(() => localStorage.getItem(LS_OPEN) === "1");
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_POS) || "{}"); } 
    catch { return {}; }
  });
  const [points, setPoints] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_POINTS) || '[{"x":"","y":""},{"x":"","y":""},{"x":"","y":""},{"x":"","y":""}]'); }
    catch { return [{x:"",y:""},{x:"",y:""},{x:"",y:""},{x:"",y:""}]; }
  });
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(""); // optional button flash

  const panelRef = useRef(null);
  const start = useRef({x:0,y:0, px:0, py:0});
  const dragging = useRef(false);

  /* ---------- persist state ---------- */
  useEffect(() => localStorage.setItem(LS_OPEN, open?"1":"0"), [open]);
  useEffect(() => localStorage.setItem(LS_POINTS, JSON.stringify(points)), [points]);

  /* ---------- panel size & clamp ---------- */
  function getPanelSize(openNow=open) {
    if(!openNow) return {w:BUBBLE,h:BUBBLE};
    const r=panelRef.current?.getBoundingClientRect();
    return { w: r?.width || 320, h: r?.height || 380 };
  }
  function clampPos(x,y, openNow=open){
    const {w,h}=getPanelSize(openNow);
    return { x: clamp(x, MARGIN, window.innerWidth-w-MARGIN), y: clamp(y, MARGIN, window.innerHeight-h-MARGIN) };
  }

  /* ---------- default position ---------- */
  useEffect(()=>{
    if(pos.x==null||pos.y==null){
      const {w,h}=getPanelSize(false);
      const x = window.innerWidth - w - MARGIN;
      const y = clamp((window.innerHeight-h)/2, MARGIN, window.innerHeight-h-MARGIN);
      const p={x,y}; setPos(p); localStorage.setItem(LS_POS, JSON.stringify(p));
    }
  }, []);

  /* ---------- clamp on open change ---------- */
  useEffect(()=>{
    const t=setTimeout(()=>{
      const fixed=clampPos(pos.x||0,pos.y||0, open);
      setPos(fixed);
      localStorage.setItem(LS_POS, JSON.stringify(fixed));
    },0);
    return ()=>clearTimeout(t);
  }, [open]);

  /* ---------- window resize ---------- */
  useEffect(()=>{
    const onResize=()=>{ const fixed=clampPos(pos.x||0,pos.y||0); setPos(fixed); localStorage.setItem(LS_POS,JSON.stringify(fixed)); };
    window.addEventListener("resize",onResize);
    window.addEventListener("orientationchange",onResize);
    return ()=>{ window.removeEventListener("resize",onResize); window.removeEventListener("orientationchange",onResize); };
  }, [pos.x,pos.y]);

  /* ---------- drag handlers ---------- */
  const onDragStart=(e)=>{
    dragging.current=true;
    start.current={x:e.clientX, y:e.clientY, px:pos.x||0, py:pos.y||0};
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove=(e)=>{
    if(!dragging.current) return;
    const dx=e.clientX-start.current.x, dy=e.clientY-start.current.y;
    const next=clampPos(start.current.px+dx,start.current.py+dy);
    setPos(next);
  };
  const onDragEnd=(e)=>{
    if(!dragging.current) return;
    dragging.current=false;
    const fixed=clampPos(pos.x||0,pos.y||0);
    setPos(fixed);
    localStorage.setItem(LS_POS, JSON.stringify(fixed));
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  /* ---------- point handling ---------- */
  const handleChange=(i,field,value)=>{
    const newPts=[...points]; newPts[i][field]=value; setPoints(newPts);
  };

  /* ---------- calculation ---------- */
  const calcCircle=(mode)=>{
    const pts = points.filter(p=>p.x&&p.y).map(p=>[parseFloat(p.x),parseFloat(p.y)]);
    if(pts.length<3) return alert("Please enter at least 3 points!");
    let cx=0, cy=0, r=0;

    if(mode==="rounded"){
      const [A,B,C]=pts;
      const D=2*(A[0]*(B[1]-C[1])+B[0]*(C[1]-A[1])+C[0]*(A[1]-B[1]));
      if(D===0) return alert("Points are collinear!");
      cx=((A[0]**2+A[1]**2)*(B[1]-C[1])+(B[0]**2+B[1]**2)*(C[1]-A[1])+(C[0]**2+C[1]**2)*(A[1]-B[1]))/D;
      cy=((A[0]**2+A[1]**2)*(C[0]-B[0])+(B[0]**2+B[1]**2)*(A[0]-C[0])+(C[0]**2+C[1]**2)*(B[0]-A[0]))/D;
      r=Math.sqrt((A[0]-cx)**2+(A[1]-cy)**2);
    } else {
      const n=pts.length;
      const sum=pts.reduce((a,[x,y])=>{ a.x+=x;a.y+=y; a.r+=Math.sqrt((x-cx)**2+(y-cy)**2); return a; }, {x:0,y:0,r:0});
      cx=sum.x/n; cy=sum.y/n;
      r=pts.reduce((acc,[x,y])=>acc+Math.sqrt((x-cx)**2+(y-cy)**2),0)/n;
    }
    setResult({cx,cy,r,circumference:2*Math.PI*r});
  };

  const preview = useMemo(()=>result?`Center: (${result.cx.toFixed(2)},${result.cy.toFixed(2)}) R:${result.r.toFixed(2)}`:"", [result]);

  /* ---------- UI ---------- */
  const containerStyle={position:"fixed", left:pos.x||0, top:pos.y||0, zIndex:9999, pointerEvents:"none"};
  const bubbleCommon={pointerEvents:"auto", border:"none", color:"#fff", fontWeight:800, boxShadow:"0 6px 18px rgba(0,0,0,0.25)"};

  const ui = !open? (
    <div style={containerStyle}>
      <button
        onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
        onClick={()=>setOpen(true)}
        style={{...bubbleCommon,width:BUBBLE,height:BUBBLE,borderRadius:BUBBLE/2,fontSize:18,background:"linear-gradient(180deg,#16a34a 0%,#4ade80 100%)",touchAction:"none"}}
        aria-label="Open Circle Calc"
      >⭕</button>
    </div>
  ):(
    <div style={containerStyle}>
      <div
        ref={panelRef}
        style={{pointerEvents:"auto", width:"min(92vw, 340px)", background:"linear-gradient(180deg,#f0fdf4 0%,#ecfccb 100%)", borderRadius:16, boxShadow:"0 10px 28px rgba(0,0,0,0.25)", border:"1px solid #d1fae5", padding:12}}
        onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}
      >
        {/* header */}
        <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
          style={{cursor:"grab", background:"#16a34a", color:"#fff", padding:8, display:"flex", justifyContent:"space-between", alignItems:"center", userSelect:"none", touchAction:"none"}}>
          <div style={{fontWeight:800}}>⚙️ Circle Center Calc</div>
          <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:10,border:"none",background:"#ef4444",color:"#fff", fontWeight:800}}>×</button>
        </div>

        {/* points */}
        {points.map((p,i)=>(
          <div key={i} style={{display:"flex",gap:6,marginTop:6}}>
            <input type="number" placeholder={`X${i+1}`} value={p.x} onChange={e=>handleChange(i,"x",e.target.value)}
              style={{flex:1,padding:6,borderRadius:8,border:"1px solid #d1d5db"}} />
            <input type="number" placeholder={`Y${i+1}`} value={p.y} onChange={e=>handleChange(i,"y",e.target.value)}
              style={{flex:1,padding:6,borderRadius:8,border:"1px solid #d1d5db"}} />
          </div>
        ))}

        {/* buttons */}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>calcCircle("rounded")} style={{flex:1,background:"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:6,fontWeight:800}}>Rounded</button>
          <button onClick={()=>calcCircle("bestfit")} style={{flex:1,background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:6,fontWeight:800}}>Best Fit</button>
        </div>

        {/* result */}
        {result && (
          <div style={{marginTop:10,background:"#d9f99d",padding:8,borderRadius:8,fontSize:14}}>
            <div>Center X: {result.cx.toFixed(3)}</div>
            <div>Center Y: {result.cy.toFixed(3)}</div>
            <div>Radius: {result.r.toFixed(3)}</div>
            <div>Circumference: {result.circumference.toFixed(3)}</div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(ui, document.body);
  }
