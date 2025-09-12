import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units: coordinates are in millimetres (mm). zoom = px per mm */
const UNIT_LABEL = "mm";

const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const distMm = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

// auto labels: A,B,…,Z,AA,AB
const labelFromIndex = (i) => {
  let s = ""; i += 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
  return s;
};

function drawLabelPill(ctx, x, y, text) {
  ctx.font = "bold 14px system-ui";
  const padX = 6, padY = 4;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = 22, r = 8;
  const bx = Math.round(x), by = Math.round(y - h);

  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + w - r, by);
  ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
  ctx.lineTo(bx + w, by + h - r);
  ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
  ctx.lineTo(bx + r, by + h);
  ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + padX, by + h - padY - 2);
}

function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, tempLine) {
  ctx.clearRect(0, 0, wCss, hCss);

  const step = Math.max(zoom * 1, 24);
  const originX = wCss/2 + tx, originY = hCss/2 + ty;

  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,hCss); ctx.stroke(); }
  for (let gy = originY % step; gy < hCss; gy += step) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(wCss,gy); ctx.stroke(); }

  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,hCss/2+ty); ctx.lineTo(wCss,hCss/2+ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss/2+tx,0); ctx.lineTo(wCss/2+tx,hCss); ctx.stroke();

  const W2S = (p) => ({ x: wCss/2 + p.x*zoom + tx, y: hCss/2 - p.y*zoom + ty });

  // normal lines
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2; ctx.font="13px system-ui"; ctx.fillStyle="#0f172a";
  lines.forEach(l=>{
    const a=points.find(p=>p.id===l.p1), b=points.find(p=>p.id===l.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.fillText(`${Math.round(l.lenMm)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6,(s1.y+s2.y)/2-6);
  });

  // temp red line (measure)
  if (tempLine) {
    const s1 = W2S({x:tempLine.x1,y:tempLine.y1});
    const s2 = W2S({x:tempLine.x2,y:tempLine.y2});
    ctx.strokeStyle="#ef4444"; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  angles.forEach(t=>{
    const a=points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb=W2S(b); drawLabelPill(ctx,sb.x+10,sb.y-10,`${t.deg}`);
  });

  points.forEach(p=>{
    const s=W2S(p); const r=6;
    ctx.lineWidth=2; ctx.strokeStyle="#fff";
    ctx.beginPath(); ctx.arc(s.x,s.y,r,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle="#ef4444"; ctx.beginPath(); ctx.arc(s.x,s.y,r-1,0,Math.PI*2); ctx.fill();
    ctx.font="13px system-ui"; ctx.lineWidth=3; ctx.strokeStyle="#fff";
    ctx.strokeText(p.label,s.x+8,s.y-8);
    ctx.fillStyle="#0f172a"; ctx.fillText(p.label,s.x+8,s.y-8);
  });
                        }
export default function Drawing2D() {
  const [points,setPoints]=useState([]);
  const [lines,setLines]=useState([]);
  const [angles,setAngles]=useState([]);
  const [E,setE]=useState(""), [N,setN]=useState(""), [title,setTitle]=useState("");

  const [mode,setMode]=useState("line");
  const [selected,setSelected]=useState([]);
  const [refLine,setRefLine]=useState(null);

  const [zoom,setZoom]=useState(60); const [tx,setTx]=useState(0),[ty,setTy]=useState(0);
  const [autoFit,setAutoFit]=useState(true);
  const [sval,setSval]=useState(0);

  const wrapRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
  const sizeRef=useRef({wCss:360,hCss:420});
  const pointers=useRef(new Map());

  const [tempLine,setTempLine]=useState(null);
  const [measure,setMeasure]=useState({open:false,value:null});
  const tempTimerRef=useRef(null);

  const nextLabel=()=>labelFromIndex(points.length);

  // restore from localStorage
  useEffect(()=>{ localStorage.removeItem("wmk_restore"); },[]);

  // resize/draw
  useEffect(()=>{
    const cvs=canvasRef.current, wrap=wrapRef.current;
    if(!cvs||!wrap) return;
    const applySize=()=>{
      const dpr=window.devicePixelRatio||1;
      const w=Math.max(320,Math.floor(wrap.clientWidth||360));
      const h=Math.min(Math.max(Math.floor(w*1.0),360),640);
      sizeRef.current={wCss:w,hCss:h};
      cvs.style.width=w+"px"; cvs.style.height=h+"px";
      cvs.width=Math.floor(w*dpr); cvs.height=Math.floor(h*dpr);
      const ctx=cvs.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctxRef.current=ctx;
      drawScene(ctx,w,h,zoom,tx,ty,points,lines,angles,tempLine);
    };
    applySize();
    window.addEventListener("resize",applySize);
    return ()=>window.removeEventListener("resize",applySize);
  },[points,lines,angles,zoom,tx,ty,tempLine]);

  // draw update
  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene(ctx,sizeRef.current.wCss,sizeRef.current.hCss,zoom,tx,ty,points,lines,angles,tempLine);
  },[points,lines,angles,zoom,tx,ty,tempLine]);

  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N); if(!isFinite(x)||!isFinite(y)) return;
    const id=safeId();
    const pt={id,label:nextLabel(),x,y};
    setPoints([...points,pt]); setE(""); setN("");
  };

  const onPointerDown=(e)=>{e.currentTarget.setPointerCapture?.(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,t:Date.now()});};
  const onPointerMove=(e)=>{const prev=pointers.current.get(e.pointerId); if(!prev) return;};
  const onPointerUp=(e)=>{
    const rect=e.currentTarget.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const world={x:(mx-sizeRef.current.wCss/2 - tx)/zoom,y:(sizeRef.current.hCss/2 - my + ty)/zoom};

    // pick nearest point
    let pick=null; let best=Infinity;
    for(const p of points){const d=Math.hypot(p.x-world.x,p.y-world.y); if(d<best&&d<=12/zoom){best=d;pick=p;}}
    if(!pick) return;

    setSelected(sel=>{
      const next=[...sel,pick.id];
      if(mode==="line"&&next.length===2){
        const a=points.find(x=>x.id===next[0]), b=points.find(x=>x.id===next[1]);
        if(a&&b) setLines(ls=>[...ls,{id:safeId(),p1:a.id,p2:b.id,lenMm:distMm(a,b)}]);
        return[];
      }
      if(mode==="angle"&&next.length===3){
        const [aId,bId,cId]=next;
        if(new Set(next).size===3){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId), c=points.find(x=>x.id===cId);
          if(a&&b&&c) setAngles(ag=>[...ag,{id:safeId(),a:a.id,b:b.id,c:c.id,deg:angleDeg(a,b,c)}]);
        }
        return[];
      }
      if(mode==="refLine"&&next.length===2){
        setRefLine({aId:next[0],bId:next[1]}); return[];
      }
      if(refLine&&mode==="refLine"&&next.length===1){
        if(pick.id===refLine.aId||pick.id===refLine.bId) return[];
        const a=points.find(p=>p.id===refLine.aId);
        const b=points.find(p=>p.id===refLine.bId);
        const c=pick;
        if(a&&b&&c){
          const vx=b.x-a.x, vy=b.y-a.y;
          const abLen=Math.hypot(vx,vy)||1;
          const t=((c.x-a.x)*vx+(c.y-a.y)*vy)/(abLen*abLen);
          const px=a.x+t*vx, py=a.y+t*vy;
          const EDist=Math.hypot(c.x-px,c.y-py);
          const NDist=t*abLen;
          setTempLine({x1:c.x,y1:c.y,x2:px,y2:py});
          const aLabel=a.label||"first pick";
          setMeasure({open:true,value:{E:`${EDist.toFixed(2)} ${UNIT_LABEL}`,N:`${NDist.toFixed(2)} ${UNIT_LABEL}`,fromLabel:aLabel}});
        }
        return[];
      }
      return next;
    });
  };

  const saveToFirebase=async()=>{
    await set(push(dbRef(db,"drawings")),{createdAt:Date.now(),title:title||"Untitled",state:{points,lines,angles}});
    alert("Saved");
  };
    }
return (
    <div className="grid">
      <div className="card" style={{padding:8,position:"relative"}}>
        <div ref={wrapRef} style={{width:"100%"}}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{display:"block",width:"100%",background:"#fff",borderRadius:12,border:"1px solid #e5e7eb",touchAction:"none",cursor:"crosshair"}}
          />
        </div>
        {/* Overlay for measure */}
        {measure.open&&(
          <div style={{position:"absolute",right:12,bottom:12,background:"rgba(15,23,42,0.96)",color:"#fff",border:"1px solid #334155",borderRadius:12,padding:"10px 12px",boxShadow:"0 8px 24px rgba(0,0,0,0.18)",display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"grid",gap:4}}>
              <div style={{fontSize:12,opacity:0.8}}>Perpendicular (E)</div>
              <div style={{fontSize:18,fontWeight:800,color:"#fca5a5"}}>{measure.value.E}</div>
              <div style={{fontSize:12,opacity:0.8,marginTop:6}}>Along Ref from <b>{measure.value.fromLabel}</b> (N)</div>
              <div style={{fontSize:18,fontWeight:800,color:"#67e8f9"}}>{measure.value.N}</div>
            </div>
            <button className="btn" onClick={()=>{setMeasure({open:false,value:null}); if(tempTimerRef.current) clearTimeout(tempTimerRef.current); tempTimerRef.current=setTimeout(()=>setTempLine(null),3000);}} style={{background:"#0ea5e9"}}>OK</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{marginBottom:8}}>
          <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} style={{flex:"1 1 260px"}}/>
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>
        <div className="row" style={{marginBottom:8}}>
          <input className="input" type="number" value={E} onChange={(e)=>setE(e.target.value)} placeholder={`E (${UNIT_LABEL})`} style={{width:110}}/>
          <input className="input" type="number" value={N} onChange={(e)=>setN(e.target.value)} placeholder={`N (${UNIT_LABEL})`} style={{width:110}}/>
          <button className="btn" onClick={addPoint}>Add (label {nextLabel()})</button>
        </div>
        <div className="row" style={{overflowX:"auto",paddingBottom:4}}>
          <button className="btn" onClick={()=>{setMode("line");setSelected([]);}} style={{background:mode==="line"?"#0ea5e9":"#64748b"}}>Line</button>
          <button className="btn" onClick={()=>{setMode("angle");setSelected([]);}} style={{background:mode==="angle"?"#0ea5e9":"#64748b"}}>Angle</button>
          <button className="btn" onClick={()=>{setMode("refLine");setSelected([]);setRefLine(null);}} style={{background:mode==="refLine"?"#0ea5e9":"#64748b"}}>📐 Ref line</button>
        </div>
      </div>
    </div>
  );
          }
