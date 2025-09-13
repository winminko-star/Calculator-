// src/pages/Drawing2D.jsx (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

const UNIT_LABEL = "mm";

// ids / math
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
const labelFromIndex = (i) => { let s=""; i+=1; while(i>0){ i--; s=String.fromCharCode(65+(i%26))+s; i=Math.floor(i/26);} return s; };
const lineName = (l, pts) => {
  const la = pts.find(p => p.id === l.p1)?.label || "?";
  const lb = pts.find(p => p.id === l.p2)?.label || "?";
  return `${la}${lb}`;
};

// angle pill
function drawLabelPill(ctx, x, y, text) {
  ctx.font = "bold 14px system-ui";
  const padX=6, padY=4, h=22, r=8;
  const w = Math.ceil(ctx.measureText(text).width) + padX*2;
  const bx = Math.round(x), by = Math.round(y - h);
  ctx.beginPath();
  ctx.moveTo(bx+r,by); ctx.lineTo(bx+w-r,by); ctx.quadraticCurveTo(bx+w,by,bx+w,by+r);
  ctx.lineTo(bx+w,by+h-r); ctx.quadraticCurveTo(bx+w,by+h,bx+w-r,by+h);
  ctx.lineTo(bx+r,by+h); ctx.quadraticCurveTo(bx,by+h,bx,by+h-r);
  ctx.lineTo(bx,by+r); ctx.quadraticCurveTo(bx,by,bx+r,by); ctx.closePath();
  ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2; ctx.fill(); ctx.stroke();
  ctx.fillStyle="#0f172a"; ctx.fillText(text, bx+padX, by+h-padY-2);
}

// renderer (lines/angles/circles + tempLine)
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, circles, tempLine) {
  ctx.clearRect(0,0,wCss,hCss);

  const step=Math.max(zoom*1,24);
  const originX=wCss/2+tx, originY=hCss/2+ty;

  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for(let gx=originX%step; gx<wCss; gx+=step){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,hCss); ctx.stroke(); }
  for(let gy=originY%step; gy<hCss; gy+=step){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(wCss,gy); ctx.stroke(); }

  ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(0,hCss/2+ty); ctx.lineTo(wCss,hCss/2+ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss/2+tx,0); ctx.lineTo(wCss/2+tx,hCss); ctx.stroke();

  const W2S = (p)=>({ x:wCss/2 + p.x*zoom + tx, y:hCss/2 - p.y*zoom + ty });

  // lines + length
  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2; ctx.font="13px system-ui"; ctx.fillStyle="#0f172a";
  lines.forEach(l=>{
    const a=points.find(p=>p.id===l.p1), b=points.find(p=>p.id===l.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.fillText(`${Math.round(l.lenMm)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6,(s1.y+s2.y)/2-6);
  });

  // temp red dashed
  if (tempLine) {
    const s1=W2S({x:tempLine.x1,y:tempLine.y1});
    const s2=W2S({x:tempLine.x2,y:tempLine.y2});
    ctx.strokeStyle="#ef4444"; ctx.lineWidth=2; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // circles
  circles.forEach((c,idx)=>{
    const center=points.find(p=>p.id===c.centerId); if(!center) return;
    const s=W2S(center);
    ctx.strokeStyle="#22d3ee"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1,c.r*zoom), 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle="#0f172a"; ctx.font="bold 13px system-ui";
    ctx.fillText(`C${idx+1}`, s.x+8, s.y-8);
  });

  // angles
  angles.forEach(t=>{
    const a=points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb=W2S(b); drawLabelPill(ctx, sb.x+10, sb.y-10, `${t.deg}`);
  });

  // points
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
// src/pages/Drawing2D.jsx (Part 2/3)
function useDrawing2D() {
  // data
  const [points, setPoints] = useState([]);
  const [lines, setLines]   = useState([]);
  const [angles, setAngles] = useState([]);
  const [hRows, setHRows]   = useState([]);
  const [ties, setTies]     = useState([]);
  const [circles, setCircles] = useState([]);

  // inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [H, setH] = useState("");
  const [title, setTitle] = useState("");

  // mode/select
  const [mode, setMode] = useState("line"); // line | angle | eraseLine | refLine | tie | circle
  const [selected, setSelected] = useState([]);
  const [refLine, setRefLine] = useState(null); // {aId,bId}
  const [tempLine, setTempLine] = useState(null);
  const [measure, setMeasure]   = useState({ open:false, value:null });
  const [circleR, setCircleR]   = useState("");

  // view
  const BASE_ZOOM=60, MIN_Z=0.0005, MAX_Z=2400;
  const [zoom,setZoom]=useState(BASE_ZOOM);
  const [tx,setTx]=useState(0), [ty,setTy]=useState(0);
  const [autoFit,setAutoFit]=useState(true);
  const MIN_S=-200, MAX_S=80;
  const [sval,setSval]=useState(0);
  const sliderToZoom=(s)=>Math.min(MAX_Z,Math.max(MIN_Z,BASE_ZOOM*Math.pow(2,s/10)));
  const zoomToSlider=(z)=>Math.max(MIN_S,Math.min(MAX_S,Math.round(10*Math.log2((z||BASE_ZOOM)/BASE_ZOOM)*100)/100));
  useEffect(()=>{ setSval(zoomToSlider(zoom)); },[zoom]);
  const onSliderChange=(v)=>{ const s=Number(v); setSval(s); setZoom(sliderToZoom(s)); };

  // canvas
  const wrapRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
  const sizeRef=useRef({wCss:360,hCss:420});
  const pointers=useRef(new Map());
  const tempTimerRef=useRef(null);

  const nextLabel=()=>labelFromIndex(points.length);

  // size/draw
  useEffect(()=>{
    const cvs=canvasRef.current, wrap=wrapRef.current; if(!cvs||!wrap) return;
    const apply=()=>{
      const dpr=window.devicePixelRatio||1;
      const w=Math.max(320,Math.floor(wrap.clientWidth||360));
      const h=Math.min(Math.max(Math.floor(w*1.0),360),640);
      sizeRef.current={wCss:w,hCss:h};
      cvs.style.width=w+"px"; cvs.style.height=h+"px";
      cvs.width=Math.floor(w*dpr); cvs.height=Math.floor(h*dpr);
      const ctx=cvs.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctxRef.current=ctx;
      drawScene(ctx,w,h,zoom,tx,ty,points,lines,angles,circles,tempLine);
    };
    apply();
    let t; const onR=()=>{ clearTimeout(t); t=setTimeout(()=>{ apply(); if(autoFit) fitView(points); },60); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line
  },[autoFit,points,zoom,tx,ty,tempLine,circles,angles,lines]);

  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene(ctx,sizeRef.current.wCss,sizeRef.current.hCss,zoom,tx,ty,points,lines,angles,circles,tempLine);
  },[points,lines,angles,zoom,tx,ty,circles,tempLine]);

  useEffect(()=>()=>{ if(tempTimerRef.current) clearTimeout(tempTimerRef.current); },[]);

  // view helpers
  const fitView=(pts=points)=>{
    if(!pts.length) return;
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY;
    const {wCss,hCss}=sizeRef.current;
    if(w===0 && h===0){ const nz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(wCss,hCss)*0.5)); setZoom(nz); const p=pts[0]; setTx(-p.x*nz); setTy(+p.y*nz); return; }
    const pad=0.1*Math.max(w,h);
    const zX=(wCss*0.9)/(w+pad*2), zY=(hCss*0.9)/(h+pad*2);
    const nz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(zX,zY)));
    setZoom(nz); setSval(zoomToSlider(nz)); const cx=(minX+maxX)/2, cy=(minY+maxY)/2; setTx(-cx*nz); setTy(+cy*nz);
  };
  const resetView=()=>{ setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearLines=()=>setLines([]);
  const removeLastLine=()=>setLines(ls=>ls.slice(0,-1));
  const clearAll=()=>{
    setPoints([]); setLines([]); setAngles([]); setSelected([]);
    setRefLine(null); setTempLine(null); setMeasure({open:false,value:null});
    setHRows([]); setTies([]); setCircles([]);
  };
  const centerOnA=()=>{ if(!points.length) return; const A=points[0]; const z=zoom; setTx(-A.x*z); setTy(+A.y*z); };
  useEffect(()=>{ if(autoFit) fitView(points); },[points]); // eslint-disable-line

  // add point (+ optional H)
  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N); if(!isFinite(x)||!isFinite(y)) return;
    const id=safeId(), label=nextLabel();
    const pt={id,label,x,y};
    const next=[...points,pt]; setPoints(next);
    if(H!=="" && isFinite(Number(H))) setHRows(rows=>[...rows,{id:safeId(), label, h:Number(H)}]);
    setE(""); setN(""); setH(""); if(autoFit) setTimeout(()=>fitView(next),0);
  };

  // pointer handlers
  const onPointerDown=(e)=>{ e.currentTarget.setPointerCapture?.(e.pointerId); pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,t:Date.now()}); };
  const onPointerMove=(e)=>{
    const prev=pointers.current.get(e.pointerId); if(!prev) return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,t:prev.t});
    const pts=[...pointers.current.values()];
    if(pts.length===1){ setTx(v=>v+(e.clientX-prev.x)); setTy(v=>v+(e.clientY-prev.y)); }
    else if(pts.length>=2){
      const [p1,p2]=pts;
      const distPrev=Math.hypot(p1.x-prev.x,p1.y-prev.y)||1;
      const distNow=Math.hypot(p1.x-p2.x,p1.y-p2.y)||1;
      const wrap=wrapRef.current, rect=wrap.getBoundingClientRect();
      const mid={x:(p1.x+p2.x)/2-rect.left, y:(p1.y+p2.y)/2-rect.top};
      const {wCss:w,hCss:h}=sizeRef.current;
      setZoom(z=>{
        const nz=Math.min(MAX_Z,Math.max(MIN_Z,z*(distNow/distPrev)));
        const wx=((mid.x-(w/2)-tx))/z, wy=((h/2)-(mid.y-ty))/z;
        const sx=w/2 + wx*nz + tx, sy=h/2 - wy*nz + ty;
        setTx(v=>v+(mid.x-sx)); setTy(v=>v+(mid.y-sy));
        return nz;
      });
    }
  };
  const onPointerUp=(e)=>{
    const down=pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if(!down || Date.now()-down.t>200 || pointers.current.size!==0) return;

    const rect=e.currentTarget.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const world={ x:(mx-sizeRef.current.wCss/2 - tx)/zoom, y:(sizeRef.current.hCss/2 - my + ty)/zoom };

    // erase line by tap
    if(mode==="eraseLine"){
      const mmTol=12/zoom; let bestIdx=-1, bestD=Infinity;
      lines.forEach((ln,idx)=>{
        const a=points.find(p=>p.id===ln.p1), b=points.find(p=>p.id===ln.p2); if(!a||!b) return;
        const vx=b.x-a.x, vy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((world.x-a.x)*vx+(world.y-a.y)*vy)/(vx*vx+vy*vy||1)));
        const cx=a.x+t*vx, cy=a.y+t*vy;
        const d=Math.hypot(world.x-cx,world.y-cy);
        if(d<bestD){ bestD=d; bestIdx=idx; }
      });
      if(bestIdx!==-1 && bestD<=mmTol) setLines(ls=>ls.filter((_,i)=>i!==bestIdx));
      return;
    }

    // pick nearest point
    const hitR=12/zoom; let pick=null, best=Infinity;
    for(const p of points){ const d=Math.hypot(p.x-world.x,p.y-world.y); if(d<best && d<=hitR){best=d; pick=p;} }
    if(!pick) return;

    setSelected(sel=>{
      const next=[...sel,pick.id];

      if(mode==="line" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          setLines(ls=>[...ls,{id:safeId(),p1:a.id,p2:b.id,lenMm:distMm(a,b)}]);
        }
        return [];
      }

      if(mode==="angle" && next.length===3){
        const [aId,bId,cId]=next;
        if(new Set(next).size===3){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId), c=points.find(x=>x.id===cId);
          setAngles(ag=>[...ag,{id:safeId(),a:a.id,b:b.id,c:c.id,deg:angleDeg(a,b,c)}]);
        }
        return [];
      }

      if(mode==="refLine"){
        if(!refLine && next.length===2){ setRefLine({aId:next[0], bId:next[1]}); return []; }
        if(refLine){
          if(pick.id===refLine.aId || pick.id===refLine.bId) return [];
          const a=points.find(p=>p.id===refLine.aId), b=points.find(p=>p.id===refLine.bId), c=pick;
          const vx=b.x-a.x, vy=b.y-a.y, abLen=Math.hypot(vx,vy)||1;
          const t=((c.x-a.x)*vx + (c.y-a.y)*vy)/(abLen*abLen);
          const px=a.x+t*vx, py=a.y+t*vy;
          const perp=Math.hypot(c.x-px,c.y-py);
          const crossZ=vx*(c.y-a.y) - vy*(c.x-a.x);
          const ESigned=(crossZ>=0?-1:1)*perp; // sign per your preference
          const NSigned=t*abLen;
          setTempLine({x1:c.x,y1:c.y,x2:px,y2:py});
          setMeasure({open:true,value:{E:`${ESigned.toFixed(2)} ${UNIT_LABEL}`,N:`${NSigned.toFixed(2)} ${UNIT_LABEL}`,fromLabel:a.label}});
          return [];
        }
      }

      if(mode==="tie" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          const E=b.x-a.x, N=b.y-a.y;
          setTies(ts=>[...ts,{id:safeId(),aId,bId,E,N}]);
          setTempLine({x1:a.x,y1:a.y,x2:b.x,y2:b.y});
          if(tempTimerRef.current) clearTimeout(tempTimerRef.current);
          tempTimerRef.current=setTimeout(()=>setTempLine(null),3000);
        }
        return [];
      }

      if(mode==="circle" && next.length===1){
        const r=Number(circleR);
        if(isFinite(r) && r>0){ setCircles(cs=>[...cs,{id:safeId(),centerId:next[0],r}]); setCircleR(""); }
        return [];
      }

      return next;
    });
  };

  // save
  const saveToFirebase = async ()=>{
    const now=Date.now();
    await set(push(dbRef(db,"drawings")),{
      createdAt:now,
      title:title||"Untitled",
      unitLabel:UNIT_LABEL,
      state:{ points, lines, angles, circles, view:{zoom,tx,ty} },
      meta:{ points:points.length, lines:lines.length, triples:angles.length, circles:circles.length },
    });
    alert("Saved");
  };

  // delete
  const delPoint=(id)=>{
    setPoints(ps=>ps.filter(p=>p.id!==id));
    setLines(ls=>ls.filter(l=>l.p1!==id && l.p2!==id));
    setAngles(ag=>ag.filter(a=>a.a!==id && a.b!==id && a.c!==id));
    setHRows(r=>r.filter(x=>x.label!==points.find(p=>p.id===id)?.label));
    setTies(ts=>ts.filter(t=>t.aId!==id && t.bId!==id));
    setCircles(cs=>cs.filter(c=>c.centerId!==id));
  };

  const groupedH = hRows.reduce((acc,row)=>{ acc[row.h]=(acc[row.h]||0)+1; return acc; },{});

  return {
    // canvas
    wrapRef, canvasRef, onPointerDown,onPointerMove,onPointerUp,
    // inputs
    E,N,H,title,setE,setN,setH,setTitle, addPoint,
    // view
    zoom,sval,onSliderChange,MIN_S,MAX_S, autoFit,setAutoFit,
    fitView, resetView, centerOnA, clearAll, clearLines, removeLastLine,
    // data
    points, lines, angles, ties, circles, hRows, groupedH,
    lineName, delPoint,
    // modes
    mode,setMode, selected,setSelected,
    // ref
    refLine,setRefLine, measure,setMeasure, tempLine,setTempLine, tempTimerRef,
    // circle
    circleR,setCircleR,
    // save
    saveToFirebase
  };
                             }
// src/pages/Drawing2D.jsx (Part 3/3)
export default function Drawing2DPage(){
  const st = useDrawing2D();
  const {
    // canvas
    wrapRef, canvasRef, onPointerDown,onPointerMove,onPointerUp,
    // inputs
    E,N,H,title,setE,setN,setH,setTitle, addPoint,
    // view
    zoom,sval,onSliderChange,MIN_S,MAX_S, autoFit,setAutoFit,
    // data
    points, lines, angles, ties, circles, hRows, groupedH,
    lineName, delPoint,
    // actions
    mode,setMode, fitView, resetView, centerOnA, clearAll, clearLines, removeLastLine,
    // ref
    refLine,setRefLine, measure,setMeasure, tempLine,setTempLine, tempTimerRef,
    // circle
    circleR,setCircleR,
    // save
    saveToFirebase
  } = st;

  const btn = (active)=>({ background: active ? "#0ea5e9" : "#64748b" });
  const th = { textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" };
  const td = { padding:"8px 10px", borderBottom:"1px solid #eef2f7", fontSize:14 };

  return (
    <div className="grid">
      {/* Canvas */}
      <div className="card" style={{ padding: 8, position: "relative" }}>
        <div ref={wrapRef} style={{ width: "100%" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ display:"block", width:"100%", background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", touchAction:"none", cursor:"crosshair" }}
          />
        </div>

        {/* Ref overlay */}
        {measure.open && (
          <div style={{ position:"absolute", right:12, bottom:12, background:"rgba(15,23,42,0.96)", color:"#fff", border:"1px solid #334155", borderRadius:12, padding:"10px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.18)", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"grid", gap:4 }}>
              <div style={{ fontSize:12, opacity:0.8 }}>Perpendicular (E)</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#fca5a5" }}>{measure.value?.E}</div>
              <div style={{ fontSize:12, opacity:0.8, marginTop:6 }}>Along Ref from <b>{measure.value?.fromLabel}</b> (N)</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#67e8f9" }}>{measure.value?.N}</div>
            </div>
            <button className="btn" onClick={()=>{
              setMeasure({open:false,value:null});
              if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
              tempTimerRef.current=setTimeout(()=>setTempLine(null),3000);
            }} style={{ background:"#0ea5e9" }}>OK</button>
          </div>
        )}

        {/* Scale slider */}
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
            <span className="small">Scale (px/{UNIT_LABEL})</span>
            <span className="small">{Math.max(0.0001, Math.round(zoom*1000)/1000)} px/{UNIT_LABEL}</span>
          </div>
          <input type="range" min={MIN_S} max={MAX_S} step={0.01} value={sval} onChange={(e)=>onSliderChange(e.target.value)} style={{ width:"100%" }}/>
          <div className="row" style={{ justifyContent:"space-between", marginTop:4 }}>
            <span className="small">{MIN_S}</span><span className="small">0</span><span className="small">{MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Toolbar rows */}
      <div className="card">
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn" style={btn(mode==="line")}     onClick={()=>setMode("line")}>Line</button>
          <button className="btn" style={btn(mode==="tie")}      onClick={()=>setMode("tie")}>Tie line</button>
          <button className="btn" style={btn(mode==="angle")}    onClick={()=>setMode("angle")}>Angle</button>
          <button className="btn" style={btn(mode==="eraseLine")}onClick={()=>setMode("eraseLine")}>Erase</button>
          <button className="btn" style={btn(mode==="refLine")}  onClick={()=>setMode("refLine")}>Ref line</button>
          {refLine && (
            <span className="small" style={{ background:"#e2e8f0", color:"#0f172a", borderRadius:12, padding:"4px 8px" }}>
              Ref: {
                (()=>{const a=points.find(p=>p.id===refLine.aId)?.label||"?";
                      const b=points.find(p=>p.id===refLine.bId)?.label||"?"; return `${a}–${b}`;})()
              }
            </span>
          )}
        </div>

        <div className="row" style={{ gap:8, marginTop:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={centerOnA}>Find A</button>
          <button className="btn" onClick={fitView}>Fit</button>
          <button className="btn" onClick={resetView}>Reset</button>
          <button className="btn" onClick={clearAll}>Clear All</button>
          <button className="btn" onClick={removeLastLine}>Remove last</button>
          <button className="btn" onClick={clearLines}>Clear lines</button>
          <label className="row" style={{ gap:8, marginLeft:8 }}>
            <input type="checkbox" checked={autoFit} onChange={(e)=>setAutoFit(e.target.checked)}/>
            <span className="small">Auto fit</span>
          </label>
        </div>
      </div>

      {/* Inputs + Circle */}
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title (e.g. P83 pipe)" value={title} onChange={(e)=>setTitle(e.target.value)} style={{ flex:"1 1 260px" }}/>
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>

        <div className="row" style={{ gap:8, marginBottom:8 }}>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="H (level)" value={H} onChange={(e)=>setH(e.target.value)} style={{ width:110 }}/>
          <button className="btn" onClick={addPoint}>Add (label {labelFromIndex(points.length)})</button>
        </div>

        <div className="row" style={{ gap:8 }}>
          <button className="btn" style={btn(mode==="circle")} onClick={()=>setMode("circle")}>Circle</button>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="R (mm)" value={circleR} onChange={(e)=>setCircleR(e.target.value)} style={{ width:120 }}/>
          <span className="small">Pick center point (C1, C2 …)</span>
        </div>
      </div>

      {/* Points ENH */}
      <div className="card">
        <div className="page-title">Points (E,N,H)</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <th style={th}>Label</th><th style={th}>E</th><th style={th}>N</th><th style={th}>H</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {points.map(p=>{
              const hr = (st.hRows.find(r=>r.label===p.label)?.h) ?? "";
              return (
                <tr key={p.id}>
                  <td style={td}><b>{p.label}</b></td>
                  <td style={td}>{p.x}</td>
                  <td style={td}>{p.y}</td>
                  <td style={td}>{hr}</td>
                  <td style={td}><button className="btn" style={{background:"#ef4444"}} onClick={()=>st.delPoint(p.id)}>Delete</button></td>
                </tr>
              );
            })}
            {points.length===0 && <tr><td style={td} colSpan={5} className="small">No points yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Lines */}
      <div className="card">
        <div className="page-title">Lines</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Length ({UNIT_LABEL})</th><th style={th}></th></tr></thead>
          <tbody>
            {lines.map(l=>(
              <tr key={l.id}>
                <td style={td}><b>{lineName(l, points)}</b></td>
                <td style={td}>{Math.round(l.lenMm)}</td>
                <td style={td}><button className="btn" style={{background:"#ef4444"}} onClick={()=>st.setLines(ls=>ls.filter(x=>x.id!==l.id))}>Delete</button></td>
              </tr>
            ))}
            {lines.length===0 && <tr><td style={td} colSpan={3} className="small">No lines yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Tie distances */}
      <div className="card">
        <div className="page-title">Tie distances (E,N)</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr><th style={th}>From→To</th><th style={th}>E</th><th style={th}>N</th><th style={th}></th></tr></thead>
          <tbody>
            {ties.map(t=>{
              const a=points.find(p=>p.id===t.aId)?.label||"?";
              const b=points.find(p=>p.id===t.bId)?.label||"?";
              return (
                <tr key={t.id}>
                  <td style={td}><b>{a}→{b}</b></td>
                  <td style={td}>{t.E.toFixed(2)}</td>
                  <td style={td}>{t.N.toFixed(2)}</td>
                  <td style={td}><button className="btn" style={{background:"#ef4444"}} onClick={()=>st.setTies(ts=>ts.filter(x=>x.id!==t.id))}>Delete</button></td>
                </tr>
              );
            })}
            {ties.length===0 && <tr><td style={td} colSpan={4} className="small">No tie distances.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* H summary */}
      <div className="card">
        <div className="page-title">H summary</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr><th style={th}>Level</th><th style={th}>Count</th></tr></thead>
          <tbody>
            {Object.keys(st.groupedH).length===0 && <tr><td style={td} colSpan={2} className="small">No H entries.</td></tr>}
            {Object.entries(st.groupedH).map(([lvl,cnt])=>(
              <tr key={lvl}><td style={td}>{lvl}</td><td style={td}>{cnt}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Circles */}
      <div className="card">
        <div className="page-title">Circles</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Center</th><th style={th}>R (mm)</th><th style={th}></th></tr></thead>
        <tbody>
          {circles.map((c,i)=>(
            <tr key={c.id}>
              <td style={td}><b>C{i+1}</b></td>
              <td style={td}>{points.find(p=>p.id===c.centerId)?.label||"?"}</td>
              <td style={td}>{c.r}</td>
              <td style={td}><button className="btn" style={{background:"#ef4444"}} onClick={()=>st.setCircles(cs=>cs.filter(x=>x.id!==c.id))}>Delete</button></td>
            </tr>
          ))}
          {circles.length===0 && <tr><td style={td} colSpan={4} className="small">No circles.</td></tr>}
        </tbody>
        </table>
      </div>
    </div>
  );
    }
