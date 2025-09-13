// src/pages/Drawing2D.jsx (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units: coordinates are in millimetres (mm). zoom = px per mm */
const UNIT_LABEL = "mm";

/* ---------------- helpers ---------------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const dist2D = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const dist3D = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, (b.h || 0) - (a.h || 0));

const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

// auto labels: A,B,…,Z,AA,AB…
const labelFromIndex = (i) => {
  let s = ""; i += 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
  return s;
};

// rounded label pill
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
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + padX, by + h - padY - 2);
}

/* --------------- renderer --------------- */
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, tempLine, tieLines, circles) {
  ctx.clearRect(0, 0, wCss, hCss);

  // grid
  const step = Math.max(zoom * 1, 24);
  const originX = wCss/2 + tx, originY = hCss/2 + ty;

  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,hCss); ctx.stroke(); }
  for (let gy = originY % step; gy < hCss; gy += step){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(wCss,gy); ctx.stroke(); }

  // axes
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,hCss/2+ty); ctx.lineTo(wCss,hCss/2+ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss/2+tx,0); ctx.lineTo(wCss/2+tx,hCss); ctx.stroke();

  const W2S = (p) => ({ x: wCss/2 + p.x*zoom + tx, y: hCss/2 - p.y*zoom + ty });

  // normal lines + length (2D)
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2; ctx.font="13px system-ui"; ctx.fillStyle="#0f172a";
  lines.forEach(l=>{
    const a=points.find(p=>p.id===l.p1), b=points.find(p=>p.id===l.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.fillText(`${Math.round(l.lenMm)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6,(s1.y+s2.y)/2-6);
  });

  // tie lines (green dashed)
  tieLines.forEach(t=>{
    const a=points.find(p=>p.id===t.p1), b=points.find(p=>p.id===t.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.setLineDash([8,6]); ctx.strokeStyle="#22c55e"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  });

  // temp red line (perp)
  if (tempLine) {
    const s1=W2S({x:tempLine.x1,y:tempLine.y1});
    const s2=W2S({x:tempLine.x2,y:tempLine.y2});
    ctx.strokeStyle="#ef4444"; ctx.lineWidth=2; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // circles
  circles.forEach(c=>{
    const center = points.find(p=>p.id===c.centerId); if(!center) return;
    const s=W2S(center);
    ctx.beginPath();
    ctx.strokeStyle="#64748b"; ctx.lineWidth=2;
    ctx.arc(s.x, s.y, Math.max(1, c.r*zoom), 0, Math.PI*2);
    ctx.stroke();
  });

  // angle pills
  angles.forEach(t=>{
    const a=points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
    if(!a||!b||!c) return;
    const sb=W2S(b); drawLabelPill(ctx,sb.x+10,sb.y-10,`${t.deg}`);
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
export default function Drawing2D() {
  // data
  const [points, setPoints] = useState([]);
  const [lines,  setLines ] = useState([]);     // {id,p1,p2,lenMm}
  const [angles, setAngles] = useState([]);     // {id,a,b,c,deg}
  const [tieLines, setTieLines] = useState([]); // {id,p1,p2,dist}
  const [circles, setCircles] = useState([]);   // {id,centerId,r}

  // inputs
  const [E, setE] = useState("");
  const [N, setN] = useState("");
  const [H, setH] = useState("");
  const [title, setTitle] = useState("");
  const [radius, setRadius] = useState("");

  // modes
  // line | tie | angle | eraseLine | refLine | circle
  const [mode, setMode] = useState("line");
  const [selected, setSelected] = useState([]);

  // ref-line measure
  const [refLine, setRefLine] = useState(null);        // {aId,bId}
  const [tempLine, setTempLine] = useState(null);      // {x1,y1,x2,y2}
  const [measure, setMeasure] = useState({open:false, value:null}); // {E,N,fromLabel}
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

  // next label (C1, C2… protection)
  const nextLabel = () => {
    let base = labelFromIndex(points.length);
    if (!points.some(p => p.label === base)) return base;
    let i = 1;
    while (points.some(p => p.label === `${base}${i}`)) i++;
    return `${base}${i}`;
  };

  /* ---------- size / draw ---------- */
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
      drawScene(ctx,w,h,zoom,tx,ty,points,lines,angles,tempLine,tieLines,circles);
    };
    apply();
    let t; const onR=()=>{ clearTimeout(t); t=setTimeout(()=>{ apply(); if(autoFit) fitView(points); },60); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoFit,points,zoom,tx,ty,tempLine,tieLines,circles]);

  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene(ctx,sizeRef.current.wCss,sizeRef.current.hCss,zoom,tx,ty,points,lines,angles,tempLine,tieLines,circles);
  },[points,lines,angles,zoom,tx,ty,tempLine,tieLines,circles]);

  useEffect(()=>()=>{ if(tempTimerRef.current) clearTimeout(tempTimerRef.current); },[]);

  /* ---------- view helpers ---------- */
  const fitView=(pts=points)=>{
    if(!pts.length) return;
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY;
    const {wCss,hCss}=sizeRef.current;

    if (w===0 && h===0) {
      const targetZ=Math.min(wCss,hCss)*0.5;
      const nz=Math.min(MAX_Z,Math.max(MIN_Z,targetZ));
      setZoom(nz); const p=pts[0]; setTx(-p.x*nz); setTy(+p.y*nz); return;
    }

    const pad=0.1*Math.max(w,h);
    const zX=(wCss*0.9)/(w+pad*2); const zY=(hCss*0.9)/(h+pad*2);
    const nz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(zX,zY)));
    setZoom(nz); setSval(zoomToSlider(nz));
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    setTx(-cx*nz); setTy(+cy*nz);
  };
  const resetView=()=>{ setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearLines=()=>setLines([]);
  const removeLastLine=()=>setLines(ls=>ls.slice(0,-1));
  const clearAll=()=>{
    setPoints([]); setLines([]); setAngles([]); setSelected([]);
    setRefLine(null); setTempLine(null); setMeasure({open:false,value:null});
    setTieLines([]); setCircles([]); setH("");
  };
  const centerOnA=()=>{
    if(!points.length) return;
    const A=points[0]; const z=zoom; setTx(-A.x*z); setTy(+A.y*z);
  };
  useEffect(()=>{ if(autoFit) fitView(points); },[points]); // eslint-disable-line

  /* ---------- add point ---------- */
  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N), h = H==="" ? null : Number(H);
    if(!isFinite(x)||!isFinite(y) || (H!=="" && !isFinite(h))) return;
    const id=safeId();
    const pt={id,label:nextLabel(),x,y,h};
    const next=[...points,pt]; setPoints(next);
    setE(""); setN(""); // H ကို မစလို့လည်းရ
    if(autoFit) setTimeout(()=>fitView(next),0);
  };

  /* ---------- gestures ---------- */
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
          setLines(ls=>[...ls,{id:safeId(),p1:a.id,p2:b.id,lenMm:dist2D(a,b)}]);
        }
        return [];
      }

      if(mode==="tie" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          setTieLines(ts=>[...ts,{id:safeId(),p1:a.id,p2:b.id,dist:dist3D(a,b)}]);
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

      if(mode==="circle"){
        // select a center only (1 tap); press "Add Circle" button to finalize
        return [pick.id];
      }

      if(mode==="refLine"){
        // Step 1: choose two points for ref line (FIRST → SECOND)
        if(!refLine && next.length===2){ setRefLine({aId:next[0], bId:next[1]}); return []; }

        // Step 2: with ref set, tap third point to measure (signed E & N)
        if(refLine){
          if(pick.id===refLine.aId || pick.id===refLine.bId) return [];
          const a=points.find(p=>p.id===refLine.aId); // first pick
          const b=points.find(p=>p.id===refLine.bId); // second pick
          const c=pick;
          if(a&&b&&c){
            const vx=b.x-a.x, vy=b.y-a.y;
            const abLen=Math.hypot(vx,vy)||1;

            // projection param from FIRST (a) toward SECOND (b)
            const t=((c.x-a.x)*vx + (c.y-a.y)*vy)/(abLen*abLen);
            const px=a.x + t*vx, py=a.y + t*vy;

            // magnitude of perpendicular
            const perp=Math.hypot(c.x-px, c.y-py);
            // sign of E by cross product: left of A→B = +, right = −
            const crossZ = vx*(c.y-a.y) - vy*(c.x-a.x);
            const ESigned = (crossZ >= 0 ? -1 : 1) * perp;

            // N signed along A→B from FIRST pick
            const NSigned = t * abLen;

            // temp red line
            setTempLine(null);
            setTempLine({ x1:c.x, y1:c.y, x2:px, y2:py });

            // overlay
            const aLabel=a.label || "first pick";
            setMeasure({
              open:true,
              value:{
                E: `${ESigned.toFixed(2)} ${UNIT_LABEL}`,
                N: `${NSigned.toFixed(2)} ${UNIT_LABEL}`,
                fromLabel: aLabel
              }
            });
          }
          return [];
        }
      }

      return next;
    });
  };

  /* ---------- save (DB only) ---------- */
  const saveToFirebase = async () => {
    const now = Date.now();
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, tieLines, circles, view: { zoom, tx, ty } },
      meta: { points: points.length, lines: lines.length, angles: angles.length, ties: tieLines.length, circles: circles.length },
    });
    alert("Saved");
  };

  // helpers
  const labelById = (id) => points.find(p=>p.id===id)?.label || id;
  const deleteTie = (id) => setTieLines(ts=>ts.filter(t=>t.id!==id));
  const deleteAngle = (id) => setAngles(as=>as.filter(a=>a.id!==id));
  const addCircle = () => {
    if (mode!=="circle") return;
    const centerId = selected[0];
    const r = Number(radius);
    if (!centerId || !isFinite(r) || r<=0) return;
    setCircles(cs=>[...cs, { id: safeId(), centerId, r }]);
    setSelected([]);
    setRadius("");
  };

  // Level table (group by equal H)
  const levelRows = (() => {
    const map = new Map(); // hValue -> count
    points.forEach(p=>{
      if (p.h===null || p.h===undefined) return;
      const key = String(p.h);
      map.set(key, (map.get(key)||0) + 1);
    });
    return [...map.entries()].map(([h,count])=>({ h: Number(h), count }));
  })();

  return { // expose for Part 3/3
    points, lines, angles, tieLines, circles,
    E,N,H, setE,setN,setH, addPoint,
    mode,setMode, selected, setSelected,
    refLine, setRefLine, measure, setMeasure, tempLine, setTempLine, tempTimerRef,
    zoom,sval,MIN_S,MAX_S,onSliderChange,autoFit,setAutoFit,
    wrapRef,canvasRef,onPointerDown,onPointerMove,onPointerUp,
    centerOnA,fitView,resetView,clearAll,removeLastLine,clearLines,
    title,setTitle, saveToFirebase,
    labelById, deleteTie, deleteAngle,
    radius,setRadius, addCircle,
    levelRows,
  };
         }
// src/pages/Drawing2D.jsx (Part 3/3)
function RowDivider() {
  return <div style={{ height: 8 }} />;
}

export function PageShell({ children }) {
  return (
    <div className="grid" style={{ gap: 12 }}>
      {children}
    </div>
  );
}

export default function Drawing2DPage() {
  const st = Drawing2D();
  const {
    points, lines, angles, tieLines, circles,
    E,N,H, setE,setN,setH, addPoint,
    mode,setMode, selected, setSelected,
    refLine, setRefLine, measure, setMeasure, tempLine, setTempLine, tempTimerRef,
    zoom,sval,MIN_S,MAX_S,onSliderChange,autoFit,setAutoFit,
    wrapRef,canvasRef,onPointerDown,onPointerMove,onPointerUp,
    centerOnA,fitView,resetView,clearAll,removeLastLine,clearLines,
    title,setTitle, saveToFirebase,
    labelById, deleteTie, deleteAngle,
    radius,setRadius, addCircle,
    levelRows,
  } = st;

  /* -------------------- UI -------------------- */
  return (
    <PageShell>
      {/* Canvas */}
      <div className="card" style={{ padding: 8, position: "relative" }}>
        <div ref={wrapRef} style={{ width: "100%" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              display:"block", width:"100%", background:"#fff",
              borderRadius:12, border:"1px solid #e5e7eb",
              touchAction:"none", cursor:"crosshair"
            }}
          />
        </div>

        {/* Measure Overlay (E + N) */}
        {measure.open && (
          <div
            style={{
              position:"absolute",
              right:12, bottom:12,
              background:"rgba(15,23,42,0.96)",
              color:"#fff",
              border:"1px solid #334155",
              borderRadius:12,
              padding:"10px 12px",
              boxShadow:"0 8px 24px rgba(0,0,0,0.18)",
              display:"flex", alignItems:"center", gap:12, zIndex:5
            }}
          >
            <div style={{ display:"grid", gap:4 }}>
              <div style={{ fontSize:12, opacity:0.8 }}>Perpendicular (E)</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#fca5a5" }}>
                {typeof measure.value==="object" ? measure.value.E : measure.value}
              </div>

              <div style={{ fontSize:12, opacity:0.8, marginTop:6 }}>
                Along Ref from <b>{typeof measure.value==="object" ? (measure.value.fromLabel || "first pick") : "first pick"}</b> (N)
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:"#67e8f9" }}>
                {typeof measure.value==="object" && measure.value.N}
              </div>
            </div>

            <button
              className="btn"
              onClick={()=>{
                setMeasure({ open:false, value:null });
                if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
                tempTimerRef.current=setTimeout(()=>setTempLine(null),3000); // 3s later hide red line
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
            <span className="small">Scale (px/{UNIT_LABEL})</span>
            <span className="small">
              {Math.max(0.0001, Math.round(zoom*1000)/1000)} px/{UNIT_LABEL}
            </span>
          </div>
          <input
            type="range"
            min={MIN_S}
            max={MAX_S}
            step={0.01}
            value={sval}
            onChange={(e)=>onSliderChange(e.target.value)}
            style={{ width:"100%" }}
          />
          <div className="row" style={{ justifyContent:"space-between", marginTop:4 }}>
            <span className="small">{MIN_S}</span>
            <span className="small">0</span>
            <span className="small">{MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Toolbar (compact 2 rows) */}
      <div className="card">
        <div className="row" style={{ flexWrap:"wrap", gap:10 }}>
          <button className="btn" onClick={()=>{ setMode("line"); setSelected([]); }}
            style={{ background: mode==="line" ? "#0ea5e9" : "#64748b" }}>Line</button>

          <button className="btn" onClick={()=>{ setMode("tie"); setSelected([]); }}
            style={{ background: mode==="tie" ? "#0ea5e9" : "#64748b" }}>Tie line</button>

          <button className="btn" onClick={()=>{ setMode("angle"); setSelected([]); }}
            style={{ background: mode==="angle" ? "#0ea5e9" : "#64748b" }}>Angle</button>

          <button className="btn" onClick={()=>{ setMode("eraseLine"); setSelected([]); }}
            style={{ background: mode==="eraseLine" ? "#0ea5e9" : "#64748b" }}>Erase</button>

          <button className="btn" onClick={()=>{ setMode("refLine"); setSelected([]); }}
            style={{ background: mode==="refLine" ? "#0ea5e9" : "#64748b" }}>Ref line</button>

          <button className="btn" onClick={centerOnA}>Find A</button>
          <button className="btn" onClick={fitView}>Fit</button>
          <button className="btn" onClick={resetView}>Reset</button>
          <button className="btn" onClick={clearAll}>Clear All</button>
          <button className="btn" onClick={removeLastLine}>Remove last</button>
          <button className="btn" onClick={clearLines}>Clear lines</button>

          {refLine && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <span className="small" style={{ background:"#e2e8f0", color:"#0f172a", borderRadius:12, padding:"4px 8px" }}>
                Ref:&nbsp;
                {labelById(refLine.aId)}–{labelById(refLine.bId)}
              </span>
              <button className="btn" onClick={()=>{ setRefLine(null); setSelected([]); setMode("refLine"); setTempLine(null); setMeasure({open:false,value:null}); }} style={{ background:"#ef4444" }}>Clear</button>
            </div>
          )}
        </div>
      </div>

      {/* Title + ENH + Circle */}
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Title (e.g. P83 pipe)"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            style={{ flex:"1 1 260px" }}
          />
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>

        <div className="row" style={{ gap:8 }}>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="H (level)" value={H} onChange={(e)=>setH(e.target.value)} style={{ width:110 }}/>
          <button className="btn" onClick={addPoint}>Add (label {labelFromIndex(points.length)})</button>
        </div>

        <RowDivider />

        <div className="row" style={{ gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <button className="btn" onClick={()=>{ setMode("circle"); setSelected([]); }}
            style={{ background: mode==="circle" ? "#0ea5e9" : "#64748b" }}>Circle</button>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="R (mm)" value={radius} onChange={(e)=>setRadius(e.target.value)} style={{ width:120 }}/>
          <button className="btn" onClick={addCircle}>Add Circle</button>
          <label className="row" style={{ gap:8, marginLeft:"auto" }}>
            <input type="checkbox" checked={autoFit} onChange={(e)=>setAutoFit(e.target.checked)} />
            <span className="small">Auto fit</span>
          </label>
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines yet.</div>}
        {lines.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between" }}>
            <div>
              {/* AB — CD ပုံစံ */}
              {labelById(l.p1)} — {labelById(l.p2)} &nbsp;
              <b>{Math.round(l.lenMm)} {UNIT_LABEL}</b>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Tie distances (ENH)</div>
        {tieLines.length===0 && <div className="small">No ties yet.</div>}
        {tieLines.map(t=>(
          <div key={t.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
            <div>{labelById(t.p1)} — {labelById(t.p2)} : <b>{t.dist.toFixed(2)} {UNIT_LABEL}</b></div>
            <button className="btn" style={{ background:"#ef4444" }} onClick={()=>deleteTie(t.id)}>Delete</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length===0 && <div className="small">No angles yet.</div>}
        {angles.map(t=>{
          const la = labelById(t.a), lb = labelById(t.b), lc = labelById(t.c);
          return (
            <div key={t.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
              <div className="small">∠{la}{lb}{lc} = <b>{t.deg}°</b></div>
              <button className="btn" style={{ background:"#ef4444" }} onClick={()=>deleteAngle(t.id)}>Delete</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="page-title">Level table (by H)</div>
        {levelRows.length===0 && <div className="small">No H levels yet.</div>}
        {levelRows.length>0 && (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" }}>H (level)</th>
                <th style={{ textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {levelRows.map(r=>(
                <tr key={r.h}>
                  <td style={{ padding:"8px 10px", borderBottom:"1px solid #f1f5f9" }}>{r.h}</td>
                  <td style={{ padding:"8px 10px", borderBottom:"1px solid #f1f5f9" }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {circles.length>0 && (
        <div className="card">
          <div className="page-title">Circles</div>
          {circles.map(c=>(
            <div key={c.id} className="small">
              Center {labelById(c.centerId)}, R = <b>{c.r} {UNIT_LABEL}</b>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
                }
