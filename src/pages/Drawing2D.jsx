// src/pages/Drawing2D.jsx  (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units: coordinates are in millimetres (mm). zoom = px per mm */
const UNIT_LABEL = "mm";

/* ---------------- helpers ---------------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const distMm = (a, b) => Math.hypot(b.x - a.x, b.y - a.y); // mm

const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  // smaller angle 0..180
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

// auto labels: A, B, ..., Z, AA, AB, ...
const labelFromIndex = (i) => {
  let s = "";
  i += 1;
  while (i > 0) {
    i--;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
};

// rounded label pill for angles
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
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + padX, by + h - padY - 2);
}

/* --------------- renderer --------------- */
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, tempLine, circles) {
  ctx.clearRect(0, 0, wCss, hCss);

  // grid
  const step = Math.max(zoom * 1, 24);
  const originX = wCss / 2 + tx;
  const originY = hCss / 2 + ty;

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, hCss);
    ctx.stroke();
  }
  for (let gy = originY % step; gy < hCss; gy += step) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(wCss, gy);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, hCss / 2 + ty);
  ctx.lineTo(wCss, hCss / 2 + ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wCss / 2 + tx, 0);
  ctx.lineTo(wCss / 2 + tx, hCss);
  ctx.stroke();

  const W2S = (p) => ({
    x: wCss / 2 + p.x * zoom + tx,
    y: hCss / 2 - p.y * zoom + ty,
  });

  // lines
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.font = "13px system-ui";
  ctx.fillStyle = "#0f172a";
  lines.forEach((l) => {
    const a = points.find((p) => p.id === l.p1),
      b = points.find((p) => p.id === l.p2);
    if (!a || !b) return;
    const s1 = W2S(a),
      s2 = W2S(b);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    ctx.fillText(
      `${Math.round(l.lenMm)} ${UNIT_LABEL}`,
      (s1.x + s2.x) / 2 + 6,
      (s1.y + s2.y) / 2 - 6
    );
  });

  // circles
  circles.forEach((c) => {
    const cs = W2S({ x: c.cx, y: c.cy });
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cs.x, cs.y, c.r * zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`R=${c.r} ${UNIT_LABEL}`, cs.x + 6, cs.y - 6);
  });

  // temp red line (perp)
  if (tempLine) {
    const s1 = W2S({ x: tempLine.x1, y: tempLine.y1 });
    const s2 = W2S({ x: tempLine.x2, y: tempLine.y2 });
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // angle pills
  angles.forEach((t) => {
    const a = points.find((p) => p.id === t.a),
      b = points.find((p) => p.id === t.b),
      c = points.find((p) => p.id === t.c);
    if (!a || !b || !c) return;
    const sb = W2S(b);
    drawLabelPill(ctx, sb.x + 10, sb.y - 10, `${t.deg}`);
  });

  // points
  points.forEach((p) => {
    const s = W2S(p);
    const r = 6;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(s.x, s.y, r - 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "13px system-ui";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(p.label, s.x + 8, s.y - 8);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(p.label, s.x + 8, s.y - 8);
  });
    }
// src/pages/Drawing2D.jsx  (Part 2/3)
function useDrawing2D() {
  // data
  const [points, setPoints]   = useState([]);     // {id,label,x,y,h}
  const [lines, setLines]     = useState([]);     // {id,p1,p2,lenMm}
  const [angles, setAngles]   = useState([]);     // {id,a,b,c,deg}
  const [circles, setCircles] = useState([]);     // {id,cx,cy,r}

  // inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [H, setH] = useState("");
  const [title, setTitle] = useState("");

  // circle inputs
  const [cE, setCE] = useState("");
  const [cN, setCN] = useState("");
  const [cR, setCR] = useState("");

  // modes / selection
  const [mode, setMode] = useState("line"); // 'line' | 'angle' | 'eraseLine' | 'refLine'
  const [selected, setSelected] = useState([]);

  // ref-line measure
  const [refLine, setRefLine] = useState(null);   // {aId,bId}
  const [tempLine, setTempLine] = useState(null); // {x1,y1,x2,y2}
  const [measure, setMeasure] = useState({ open:false, value:null });
  const tempTimerRef = useRef(null);

  // view
  const BASE_ZOOM = 60, MIN_Z = 0.0005, MAX_Z = 2400;
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0);
  const [autoFit, setAutoFit] = useState(true);

  // scale slider (log2)
  const MIN_S=-200, MAX_S=80;
  const [sval,setSval]=useState(0);
  const sliderToZoom = (s)=>Math.min(MAX_Z,Math.max(MIN_Z,BASE_ZOOM*Math.pow(2,s/10)));
  const zoomToSlider = (z)=>Math.max(MIN_S,Math.min(MAX_S,Math.round(10*Math.log2((z||BASE_ZOOM)/BASE_ZOOM)*100)/100));
  useEffect(()=>{ setSval(zoomToSlider(zoom)); },[zoom]);
  const onSliderChange = (v)=>{ const s=Number(v); setSval(s); setZoom(sliderToZoom(s)); };

  // canvas + pointers
  const wrapRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
  const sizeRef=useRef({wCss:360,hCss:420});
  const pointers=useRef(new Map());

  const nextLabel=()=>labelFromIndex(points.length);
  const getLabel=(id)=>points.find(p=>p.id===id)?.label || id;

  /* size / draw */
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
      drawScene(ctx,w,h,zoom,tx,ty,points,lines,angles,tempLine,circles);
    };
    apply();
    let t; const onR=()=>{ clearTimeout(t); t=setTimeout(()=>{ apply(); if(autoFit) fitView(points); },60); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoFit,points,zoom,tx,ty,tempLine,circles]);

  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene(ctx,sizeRef.current.wCss,sizeRef.current.hCss,zoom,tx,ty,points,lines,angles,tempLine,circles);
  },[points,lines,angles,zoom,tx,ty,tempLine,circles]);

  useEffect(()=>()=>{ if(tempTimerRef.current) clearTimeout(tempTimerRef.current); },[]);

  /* view helpers */
  const fitView=(pts=points)=>{
    if(!pts.length) return;
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY;
    const {wCss,hCss}=sizeRef.current;

    if (w===0 && h===0) {
      const nz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(wCss,hCss)*0.5));
      setZoom(nz); const p=pts[0]; setTx(-p.x*nz); setTy(+p.y*nz); return;
    }
    const pad=0.1*Math.max(w,h);
    const nz=Math.min(MAX_Z,Math.max(MIN_Z, Math.min((wCss*0.9)/(w+pad*2),(hCss*0.9)/(h+pad*2))));
    setZoom(nz); setSval(zoomToSlider(nz));
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2; setTx(-cx*nz); setTy(+cy*nz);
  };
  const resetView=()=>{ setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearLines=()=>setLines([]);
  const removeLastLine=()=>setLines(ls=>ls.slice(0,-1));
  const clearAll=()=>{
    setPoints([]); setLines([]); setAngles([]); setSelected([]);
    setRefLine(null); setTempLine(null); setMeasure({open:false,value:null}); setCircles([]);
  };
  const centerOnA=()=>{
    if(!points.length) return;
    const A=points[0]; const z=zoom; setTx(-A.x*z); setTy(+A.y*z);
  };
  useEffect(()=>{ if(autoFit) fitView(points); },[points]); // eslint-disable-line

  /* add point (with H) */
  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N);
    if(!isFinite(x)||!isFinite(y)) return;
    const h = H==="" ? 0 : Number(H);
    if(!isFinite(h)) return;

    const pt={ id:safeId(), label:nextLabel(), x, y, h };
    const next=[...points,pt]; setPoints(next);
    setE(""); setN(""); setH("");
    if(autoFit) setTimeout(()=>fitView(next),0);
  };

  /* add circle */
  const addCircle = ()=>{
    if (cE===""||cN===""||cR==="") return;
    const cx=Number(cE), cy=Number(cN), r=Math.abs(Number(cR));
    if(!isFinite(cx)||!isFinite(cy)||!isFinite(r)||r<=0) return;
    setCircles(cs=>[...cs, { id:safeId(), cx, cy, r }]);
    setCE(""); setCN(""); setCR("");
  };

  /* gestures */
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
        const nz=Math.min(MAX_Z,Math.max(MIN_Z, z*(distNow/distPrev)));
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

    // erase-line
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
        // choose ref line
        if(!refLine && next.length===2){ setRefLine({aId:next[0], bId:next[1]}); return []; }
        // measure to 3rd pick
        if(refLine){
          if(pick.id===refLine.aId || pick.id===refLine.bId) return [];
          const a=points.find(p=>p.id===refLine.aId);
          const b=points.find(p=>p.id===refLine.bId);
          const c=pick; if(a&&b&&c){
            const vx=b.x-a.x, vy=b.y-a.y;
            const abLen=Math.hypot(vx,vy)||1;
            const t=((c.x-a.x)*vx + (c.y-a.y)*vy)/(abLen*abLen);
            const px=a.x + t*vx, py=a.y + t*vy;
            const perp=Math.hypot(c.x-px, c.y-py);
            const crossZ = vx*(c.y-a.y) - vy*(c.x-a.x);
            const ESigned = (crossZ >= 0 ? -perp : +perp);
            const NSigned = t * abLen;

            setTempLine({ x1:c.x, y1:c.y, x2:px, y2:py });
            setMeasure({
              open:true,
              value:{
                E: `${ESigned.toFixed(2)} ${UNIT_LABEL}`,
                N: `${NSigned.toFixed(2)} ${UNIT_LABEL}`,
                fromLabel: a.label || "first pick"
              }
            });
          }
          return [];
        }
      }

      return next;
    });
  };

  /* save (DB only, no image) */
  const saveToFirebase = async () => {
    const now = Date.now();
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, circles, view: { zoom, tx, ty } },
      meta: { points: points.length, lines: lines.length, angles: angles.length, circles: circles.length },
    });
    alert("Saved");
  };

  /* H level summary */
  const levelSummary = (() => {
    const map = new Map();
    points.forEach(p=>{
      const key=String(p.h ?? 0);
      if(!map.has(key)) map.set(key,{ h:p.h ?? 0, count:0, labels:[] });
      const o=map.get(key); o.count++; o.labels.push(p.label);
    });
    return Array.from(map.values()).sort((a,b)=>a.h-b.h);
  })();

  return {
    // refs
    wrapRef, canvasRef,

    // inputs
    E,N,H,setE,setN,setH, addPoint, nextLabel,

    // modes + selections
    mode,setMode, selected, setSelected,

    // view & actions
    fitView, resetView, clearAll, centerOnA, removeLastLine, clearLines,
    autoFit,setAutoFit, MIN_S, MAX_S, sval, onSliderChange, zoom,

    // title & save
    title,setTitle, saveToFirebase,

    // circle inputs + action
    cE,cN,cR,setCE,setCN,setCR, addCircle,

    // data
    points,lines,angles,circles, getLabel,

    // gestures
    onPointerDown,onPointerMove,onPointerUp,

    // ref/measure
    refLine,setRefLine, tempLine, setTempLine, measure, setMeasure,

    // level table
    levelSummary,
  };
    }
// src/pages/Drawing2D.jsx  (Part 3/3)
function PageShell({ children }) {
  return <div className="grid">{children}</div>;
}

export default function Drawing2DPage() {
  const st = useDrawing2D();

  const th = { textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" };
  const td = { padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:13 };

  return (
    <div className="grid">
      {/* Canvas */}
      <div className="card" style={{ padding: 8, position: "relative" }}>
        <div ref={st.wrapRef} style={{ width: "100%" }}>
          <canvas
            ref={st.canvasRef}
            onPointerDown={st.onPointerDown}
            onPointerMove={st.onPointerMove}
            onPointerUp={st.onPointerUp}
            onPointerCancel={st.onPointerUp}
            style={{
              display:"block", width:"100%", background:"#fff",
              borderRadius:12, border:"1px solid #e5e7eb",
              touchAction:"none", cursor:"crosshair"
            }}
          />
        </div>

        {/* Measure Overlay */}
        {st.measure.open && (
          <div
            style={{
              position:"absolute", right:12, bottom:12,
              background:"rgba(15,23,42,0.96)", color:"#fff",
              border:"1px solid #334155", borderRadius:12, padding:"10px 12px",
              boxShadow:"0 8px 24px rgba(0,0,0,0.18)", display:"flex", alignItems:"center", gap:12
            }}
          >
            <div style={{ display:"grid", gap:4 }}>
              <div style={{ fontSize:12, opacity:0.8 }}>Perpendicular (E)</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#fca5a5" }}>
                {typeof st.measure.value==="object" ? st.measure.value.E : st.measure.value}
              </div>

              <div style={{ fontSize:12, opacity:0.8, marginTop:6 }}>
                Along Ref from <b>{typeof st.measure.value==="object" ? (st.measure.value.fromLabel || "first pick") : "first pick"}</b> (N)
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:"#67e8f9" }}>
                {typeof st.measure.value==="object" && st.measure.value.N}
              </div>
            </div>

            <button
              className="btn"
              onClick={()=>{
                st.setMeasure({ open:false, value:null });
                if (st.tempLine) setTimeout(()=>st.setTempLine(null), 3000);
              }}
              style={{ background:"#0ea5e9" }}
            >
              OK
            </button>
          </div>
        )}

        {/* Scale slider */}
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
            <span className="small">Scale (px/mm)</span>
            <span className="small">{Math.max(0.0001, Math.round(st.zoom*1000)/1000)} px/{UNIT_LABEL}</span>
          </div>
          <input type="range" min={st.MIN_S} max={st.MAX_S} step={0.01}
                 value={st.sval} onChange={(e)=>st.onSliderChange(e.target.value)} style={{ width:"100%" }}/>
          <div className="row" style={{ justifyContent:"space-between", marginTop:4 }}>
            <span className="small">{st.MIN_S}</span><span className="small">0</span><span className="small">{st.MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title (e.g. P83 pipe)" value={st.title}
                 onChange={(e)=>st.setTitle(e.target.value)} style={{ flex:"1 1 260px" }}/>
          <button className="btn" onClick={st.saveToFirebase}>Save</button>
        </div>

        {/* ENH inputs */}
        <div className="row" style={{ marginBottom: 8, gap:8, flexWrap:"wrap" }}>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`E (${UNIT_LABEL})`} value={st.E} onChange={(e)=>st.setE(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`N (${UNIT_LABEL})`} value={st.N} onChange={(e)=>st.setN(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="H (level)" value={st.H} onChange={(e)=>st.setH(e.target.value)} style={{ width:110 }}/>
          <button className="btn" onClick={st.addPoint}>Add (label {st.nextLabel()})</button>
        </div>

        {/* Toolbar (ordered + horizontal scroll) */}
        <div className="row" style={{ overflowX:"auto", paddingBottom:4, gap:8, whiteSpace:"nowrap" }}>
          <button className="btn" onClick={()=>{ st.setMode("line"); st.setSelected([]); }}
            style={{ background: st.mode==="line" ? "#0ea5e9" : "#64748b" }}>Line</button>

          <button className="btn" onClick={()=>{ st.setMode("refLine"); st.setSelected([]); }}
            style={{ background: st.mode==="refLine" ? "#0ea5e9" : "#64748b" }}>📐 Ref line</button>

          <button className="btn" onClick={()=>{ st.setMode("angle"); st.setSelected([]); }}
            style={{ background: st.mode==="angle" ? "#0ea5e9" : "#64748b" }}>Angle</button>

          <button className="btn" onClick={()=>{ st.setMode("eraseLine"); st.setSelected([]); }}
            style={{ background: st.mode==="eraseLine" ? "#0ea5e9" : "#64748b" }}>Erase Line (tap)</button>

          <button className="btn" onClick={st.centerOnA}>Find A</button>
          <button className="btn" onClick={st.removeLastLine}>Remove last line</button>
          <button className="btn" onClick={st.clearLines}>Clear lines</button>
          <button className="btn" onClick={st.clearAll} style={{ background:"#ef4444" }}>Clear All</button>
          <button className="btn" onClick={st.fitView}>Fit</button>
          <button className="btn" onClick={st.resetView}>Reset</button>

          {st.refLine && (
            <span className="small" style={{ background:"#e2e8f0", color:"#0f172a", borderRadius:12, padding:"4px 8px" }}>
              Ref: {st.getLabel(st.refLine.aId)}–{st.getLabel(st.refLine.bId)}
            </span>
          )}

          <label className="row" style={{ gap:8, marginLeft:8 }}>
            <input type="checkbox" checked={st.autoFit} onChange={(e)=>st.setAutoFit(e.target.checked)} />
            <span className="small">Auto fit</span>
          </label>
        </div>

        {/* Circle tool */}
        <div className="row" style={{ marginTop:8, gap:8, flexWrap:"wrap" }}>
          <span className="small" style={{ minWidth:80, color:"#64748b" }}>Add Circle</span>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Center E" value={st.cE} onChange={(e)=>st.setCE(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Center N" value={st.cN} onChange={(e)=>st.setCN(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`Radius (${UNIT_LABEL})`} value={st.cR} onChange={(e)=>st.setCR(e.target.value)} style={{ width:110 }}/>
          <button className="btn" onClick={st.addCircle}>Add Circle</button>
        </div>
      </div>

      {/* Lines list → AB style */}
      <div className="card">
        <div className="page-title">Lines</div>
        {st.lines.length===0 && <div className="small">No lines yet.</div>}
        {st.lines.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between" }}>
            <div>
              <b>{st.getLabel(l.p1)}–{st.getLabel(l.p2)}</b> &nbsp;
              <b>{Math.round(l.lenMm)} {UNIT_LABEL}</b>
            </div>
          </div>
        ))}
      </div>

      {/* Angles */}
      <div className="card">
        <div className="page-title">Angles</div>
        {st.angles.length===0 && <div className="small">No angles yet.</div>}
        {st.angles.map(t=>(
          <div key={t.id} className="small">
            at <b>{st.getLabel(t.b)}</b> from <b>{st.getLabel(t.a)}</b>-<b>{st.getLabel(t.b)}</b>-<b>{st.getLabel(t.c)}</b> = <b>{t.deg}°</b>
          </div>
        ))}
      </div>

      {/* H Levels */}
      <div className="card">
        <div className="page-title">Levels (H)</div>
        {st.points.length===0 && <div className="small">No points.</div>}
        {st.points.length>0 && (
          <>
            <div style={{ overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:10 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    <th style={th}>Label</th><th style={th}>E</th><th style={th}>N</th><th style={th}>H</th>
                  </tr>
                </thead>
                <tbody>
                  {st.points.map(p=>(
                    <tr key={p.id}>
                      <td style={td}><b>{p.label}</b></td>
                      <td style={td}>{p.x}</td>
                      <td style={td}>{p.y}</td>
                      <td style={td}>{p.h ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:10 }}>
              <div className="small" style={{ color:"#64748b", marginBottom:6 }}>Same level summary</div>
              {st.levelSummary.map((g,i)=>(
                <div key={i} className="small">H = <b>{g.h}</b> → <b>{g.count}</b> pt(s) • {g.labels.join(", ")}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
          }
