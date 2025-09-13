// src/pages/Drawing2D.jsx  (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units */
const UNIT_LABEL = "mm";

/* ---------------- helpers ---------------- */
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

// auto labels: A,B,…,Z,AA…
const labelFromIndex = (i) => {
  let s = ""; i += 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
  return s;
};

// for lists: show AB / AC
const lineName = (points, p1Id, p2Id) => {
  const a = points.find(p => p.id === p1Id)?.label || "?";
  const b = points.find(p => p.id === p2Id)?.label || "?";
  return `${a}${b}`;
};

// small angle label pill
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

/* ---------------- renderer ---------------- */
function drawScene(opts) {
  const {
    ctx, wCss, hCss, zoom, tx, ty,
    points, lines, angles, showAngleLabels,
    tempRed, ties, circles
  } = opts;

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

  // normal lines (blue)
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2; ctx.font="13px system-ui"; ctx.fillStyle="#0f172a";
  lines.forEach(l=>{
    const a=points.find(p=>p.id===l.p1), b=points.find(p=>p.id===l.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.fillText(`${Math.round(l.lenMm)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6,(s1.y+s2.y)/2-6);
  });

  // tie lines (green)
  ties.forEach(t=>{
    const a=points.find(p=>p.id===t.p1), b=points.find(p=>p.id===t.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.strokeStyle="#22c55e"; ctx.lineWidth = 2; ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  });

  // circles
  circles.forEach((c, idx)=>{
    const ctr = points.find(p=>p.id===c.centerId);
    if(!ctr) return;
    const s=W2S(ctr);
    ctx.strokeStyle="#6366f1"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.x, s.y, c.r*zoom, 0, Math.PI*2); ctx.stroke();
    // label C1 / C2
    ctx.fillStyle="#0f172a"; ctx.font="bold 13px system-ui";
    ctx.fillText(`C${idx+1}`, s.x + 8, s.y - 8);
  });

  // temp red perpendicular
  if (tempRed) {
    const s1=W2S({x:tempRed.x1,y:tempRed.y1});
    const s2=W2S({x:tempRed.x2,y:tempRed.y2});
    ctx.strokeStyle="#ef4444"; ctx.lineWidth=2; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // angle pills
  if (showAngleLabels) {
    angles.forEach(t=>{
      const a=points.find(p=>p.id===t.a), b=points.find(p=>p.id===t.b), c=points.find(p=>p.id===t.c);
      if(!a||!b||!c) return;
      const sb=W2S(b); drawLabelPill(ctx,sb.x+10,sb.y-10,`${t.deg}°`);
    });
  }

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

  return { W2S };
}
// src/pages/Drawing2D.jsx  (Part 2/3)
export default function Drawing2DPage() {
  // data
  const [points, setPoints]   = useState([]);   // {id,label,x,y,h?}
  const [lines, setLines]     = useState([]);   // {id,p1,p2,lenMm}
  const [angles, setAngles]   = useState([]);   // {id,a,b,c,deg}
  const [ties, setTies]       = useState([]);   // {id,p1,p2,E,N,H,D}
  const [circles, setCircles] = useState([]);   // {id,centerId,r}

  // inputs
  const [E, setE] = useState("");   // mm
  const [N, setN] = useState("");   // mm
  const [H, setH] = useState("");   // level (optional)
  const [title, setTitle] = useState("");

  // circle input
  const [circleR, setCircleR] = useState("");

  // modes / selection
  const [mode, setMode] = useState("line"); // 'line' | 'angle' | 'eraseLine' | 'refLine' | 'tie' | 'circle'
  const [selected, setSelected] = useState([]);

  // ref-line measure (FIRST -> SECOND)
  const [refLine, setRefLine] = useState(null); // {aId,bId}
  const [tempRed, setTempRed] = useState(null); // {x1,y1,x2,y2}
  const [measure, setMeasure] = useState({ open:false, value:null }); // {E,N,fromLabel}
  const tempTimerRef = useRef(null);

  // angle label toggle
  const [showAngleLabels, setShowAngleLabels] = useState(true);

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
      drawScene({
        ctx, wCss:w, hCss:h, zoom, tx, ty,
        points, lines, angles, showAngleLabels,
        tempRed, ties, circles,
      });
    };
    apply();
    let t; const onR=()=>{ clearTimeout(t); t=setTimeout(()=>{ apply(); if(autoFit) fitView(points); },60); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoFit,points,lines,angles,ties,circles,zoom,tx,ty,tempRed,showAngleLabels]);

  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene({
      ctx, wCss:sizeRef.current.wCss, hCss:sizeRef.current.hCss, zoom, tx, ty,
      points, lines, angles, showAngleLabels,
      tempRed, ties, circles,
    });
  },[points,lines,angles,ties,circles,zoom,tx,ty,tempRed,showAngleLabels]);

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
    setTies([]); setCircles([]); clearRefLine();
  };
  const centerOnA=()=>{
    if(!points.length) return;
    const A=points[0]; const z=zoom; setTx(-A.x*z); setTy(+A.y*z);
  };
  useEffect(()=>{ if(autoFit) fitView(points); },[points]); // eslint-disable-line

  /* ---------- add point ---------- */
  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N); if(!isFinite(x)||!isFinite(y)) return;
    const id=safeId(); const pt={id,label:nextLabel(),x,y};
    if (H !== "" && isFinite(Number(H))) pt.h = Number(H);
    const next=[...points,pt]; setPoints(next);
    setE(""); setN(""); setH(""); if(autoFit) setTimeout(()=>fitView(next),0);
  };

  /* ---------- circle ---------- */
  const addCircle = ()=>{
    if (!selected.length || circleR==="") return;
    const center = points.find(p=>p.id===selected[selected.length-1]); if(!center) return;
    const r = Math.abs(Number(circleR)); if(!isFinite(r) || r<=0) return;
    setCircles(cs=>[...cs,{ id:safeId(), centerId:center.id, r }]);
    setCircleR(""); setSelected([]);
  };
  const delCircle = (id)=> setCircles(cs=>cs.filter(c=>c.id!==id));

  /* ---------- ref line helpers ---------- */
  const clearRefLine = ()=>{
    setRefLine(null); setTempRed(null);
    setMeasure({ open:false, value:null });
    if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
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

      if(mode==="tie" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          const dE = b.x - a.x, dN = b.y - a.y;
          const dH = (Number(b.h)||0) - (Number(a.h)||0);
          const D  = Math.hypot(dE, dN, dH);
          setTies(ts=>[...ts,{ id:safeId(), p1:a.id, p2:b.id, E:dE, N:dN, H:dH, D }]);
        }
        return [];
      }

      if(mode==="circle"){
        // select center then use Add Circle button
        return [pick.id]; // keep 1 latest
      }

      if(mode==="refLine"){
        // Step 1: choose two points for ref line (FIRST → SECOND)
        if(!refLine && next.length===2){ setRefLine({aId:next[0], bId:next[1]}); return []; }

        // Step 2: with ref set, tap third point to measure
        if(refLine){
          if(pick.id===refLine.aId || pick.id===refLine.bId) return [];
          const a=points.find(p=>p.id===refLine.aId); // first pick
          const b=points.find(p=>p.id===refLine.bId); // second pick
          const c=pick;
          if(a&&b&&c){
            const vx=b.x-a.x, vy=b.y-a.y;
            const abLen=Math.hypot(vx,vy)||1;

            // projection from FIRST
            const t=((c.x-a.x)*vx + (c.y-a.y)*vy)/(abLen*abLen);
            const px=a.x + t*vx, py=a.y + t*vy;

            // perpendicular magnitude and sign: left of A→B = +
            const perp=Math.hypot(c.x-px, c.y-py);
            const crossZ = vx*(c.y-a.y) - vy*(c.x-a.x);
            const ESigned = (crossZ >= 0 ? 1 : -1) * perp;
            const NSigned = t * abLen;

            setTempRed(null);
            setTempRed({ x1:c.x, y1:c.y, x2:px, y2:py });

            setMeasure({
              open:true,
              value:{
                E: `${ESigned.toFixed(2)} ${UNIT_LABEL}`,
                N: `${NSigned.toFixed(2)} ${UNIT_LABEL}`,
                fromLabel: points.find(p=>p.id===refLine.aId)?.label || "A"
              }
            });
          }
          return [];
        }
      }

      return next;
    });
  };

  /* ---------- delete helpers ---------- */
  const delTie    = (id) => setTies(ts => ts.filter(t=>t.id!==id));
  const delLine   = (id) => setLines(ls=>ls.filter(l=>l.id!==id));
  const delAngle  = (id) => setAngles(as=>as.filter(a=>a.id!==id));

  /* ---------- save (DB only) ---------- */
  const saveToFirebase = async () => {
    const now = Date.now();
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, ties, circles, view: { zoom, tx, ty } },
      meta: { points: points.length, lines: lines.length, angles: angles.length, ties: ties.length, circles: circles.length },
    });
    alert("Saved");
  };
  // src/pages/Drawing2D.jsx  (Part 3/3)
  /* -------------------- UI -------------------- */
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
              position:"absolute", right:12, bottom:12,
              background:"rgba(15,23,42,0.96)", color:"#fff",
              border:"1px solid #334155", borderRadius:12,
              padding:"10px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.18)",
              display:"flex", alignItems:"center", gap:12
            }}
          >
            <div style={{ display:"grid", gap:4 }}>
              <div style={{ fontSize:12, opacity:0.8 }}>Perpendicular (E)</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#fca5a5" }}>
                {measure.value?.E}
              </div>

              <div style={{ fontSize:12, opacity:0.8, marginTop:6 }}>
                Along Ref from <b>{measure.value?.fromLabel}</b> (N)
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:"#67e8f9" }}>
                {measure.value?.N}
              </div>
            </div>

            <button
              className="btn"
              onClick={()=>{
                setMeasure({ open:false, value:null });
                if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
                tempTimerRef.current=setTimeout(()=>setTempRed(null),3000); // 3s later hide dashed red
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
            <span className="small">{Math.max(0.0001, Math.round(zoom*1000)/1000)} px/{UNIT_LABEL}</span>
          </div>
          <input type="range" min={MIN_S} max={MAX_S} step={0.01} value={sval} onChange={(e)=>onSliderChange(e.target.value)} style={{ width:"100%" }}/>
          <div className="row" style={{ justifyContent:"space-between", marginTop:4 }}>
            <span className="small">{MIN_S}</span><span className="small">0</span><span className="small">{MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Toolbar – two rows compact */}
      <div className="card" style={{ paddingTop: 10 }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={()=>{ setMode("line"); setSelected([]); }}     style={{ background: mode==="line" ? "#0ea5e9" : "#64748b" }}>Line</button>
          <button className="btn" onClick={()=>{ setMode("tie"); setSelected([]); }}      style={{ background: mode==="tie" ? "#0ea5e9" : "#64748b" }}>Tie line</button>
          <button className="btn" onClick={()=>{ setMode("angle"); setSelected([]); }}    style={{ background: mode==="angle" ? "#0ea5e9" : "#64748b" }}>Angle</button>
          <button className="btn" onClick={()=>{ setMode("eraseLine"); setSelected([]); }}style={{ background: mode==="eraseLine" ? "#0ea5e9" : "#64748b" }}>Erase</button>
          <button className="btn" onClick={()=>{ setMode("refLine"); setSelected([]); }}  style={{ background: mode==="refLine" ? "#0ea5e9" : "#64748b" }}>Ref line</button>
          <button className="btn" onClick={centerOnA}>Find A</button>
          <button className="btn" onClick={fitView}>Fit</button>
          <button className="btn" onClick={resetView}>Reset</button>
          <button className="btn" onClick={clearAll}>Clear All</button>
          <button className="btn" onClick={removeLastLine}>Remove last</button>
          <button className="btn" onClick={clearLines}>Clear lines</button>
          <label className="row" style={{ gap:8 }}>
            <input type="checkbox" checked={autoFit} onChange={(e)=>setAutoFit(e.target.checked)} />
            <span className="small">Auto fit</span>
          </label>
          <label className="row" style={{ gap:8 }}>
            <input type="checkbox" checked={showAngleLabels} onChange={(e)=>setShowAngleLabels(e.target.checked)} />
            <span className="small">Show ∠ labels</span>
          </label>
        </div>

        {/* Inputs */}
        <div className="row" style={{ marginTop: 10, gap:8, flexWrap:"wrap" }}>
          <input className="input" placeholder="Title (e.g. P83 pipe)" value={title} onChange={(e)=>setTitle(e.target.value)} style={{ flex:"1 1 240px" }}/>
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>

        <div className="row" style={{ marginTop: 8, gap:8, flexWrap:"wrap" }}>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} style={{ width:110 }}/>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="H (level)" value={H} onChange={(e)=>setH(e.target.value)} style={{ width:110 }}/>
          <button className="btn" onClick={addPoint}>Add (label {nextLabel()})</button>
        </div>

        {/* Circle controls */}
        <div className="row" style={{ marginTop: 8, gap:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={()=>{ setMode("circle"); setSelected([]); }} style={{ background: mode==="circle" ? "#0ea5e9" : "#64748b" }}>Circle</button>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="R (mm)" value={circleR} onChange={(e)=>setCircleR(e.target.value)} style={{ width:120 }}/>
          <button className="btn" onClick={addCircle}>Add Circle</button>
          {refLine && (
            <button className="btn" onClick={clearRefLine} style={{ background:"#ef4444" }}>Clear Ref</button>
          )}
        </div>
      </div>

      {/* Lists */}
      <div className="card">
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines yet.</div>}
        {lines.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between" }}>
            <div><b>{lineName(points,l.p1,l.p2)}</b> — {Math.round(l.lenMm)} {UNIT_LABEL}</div>
            <button className="btn" onClick={()=>delLine(l.id)} style={{ background:"#ef4444" }}>Delete</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Tie distances (green)</div>
        {ties.length===0 && <div className="small">No ties yet.</div>}
        {ties.map(t=>(
          <div key={t.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
            <div className="small">
              <b>{lineName(points,t.p1,t.p2)}</b> :
              &nbsp;E {t.E.toFixed(2)}, N {t.N.toFixed(2)}, H {t.H.toFixed(2)}, D {t.D.toFixed(2)} {UNIT_LABEL}
            </div>
            <button className="btn" onClick={()=>delTie(t.id)} style={{ background:"#ef4444" }}>Delete</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length===0 && <div className="small">No angles yet.</div>}
        {angles.map(t=>(
          <div key={t.id} className="row" style={{ justifyContent:"space-between" }}>
            <div className="small">
              ∠{lineName(points,t.a,t.b)}-{lineName(points,t.b,t.c)} = <b>{t.deg}°</b>
            </div>
            <button className="btn" onClick={()=>delAngle(t.id)} style={{ background:"#ef4444" }}>Delete</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-title">Circles</div>
        {circles.length===0 && <div className="small">No circles.</div>}
        {circles.map((c, idx)=>(
          <div key={c.id} className="row" style={{ justifyContent:"space-between" }}>
            <div className="small">
              <b>C{idx+1}</b> @ {points.find(p=>p.id===c.centerId)?.label || "?"}
              &nbsp; R = {c.r} {UNIT_LABEL}
            </div>
            <button className="btn" onClick={()=>delCircle(c.id)} style={{ background:"#ef4444" }}>Delete</button>
          </div>
        ))}
      </div>

      {/* H level groups */}
      <div className="card">
        <div className="page-title">H Levels</div>
        {(() => {
          const groups = new Map(); // H -> [labels]
          points.forEach(p=>{
            if (typeof p.h === "number") {
              const arr = groups.get(p.h) || [];
              arr.push(p.label); groups.set(p.h, arr);
            }
          });
          if (groups.size === 0) return <div className="small">No H values.</div>;
          return (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left", padding:"6px 8px" }}>H</th>
                  <th style={{ textAlign:"left", padding:"6px 8px" }}>Labels</th>
                  <th style={{ textAlign:"left", padding:"6px 8px" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([h, labels])=>(
                  <tr key={h}>
                    <td style={{ padding:"6px 8px" }}>{h}</td>
                    <td style={{ padding:"6px 8px" }}>{labels.join(", ")}</td>
                    <td style={{ padding:"6px 8px" }}>{labels.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
        }
