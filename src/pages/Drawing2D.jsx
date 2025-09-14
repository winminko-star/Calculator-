// src/pages/Drawing2D.jsx (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { ref as dbRef, push, set } from "firebase/database";
import { db } from "../firebase";

/** units */
const UNIT_LABEL = "mm";

/* ---------- helpers ---------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const dist2D = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const dist3D = (a, b) =>
  Math.hypot(b.x - a.x, b.y - a.y, (b.h || 0) - (a.h || 0));

const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

// A, B, …, AA, AB …
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

const lineName = (a, b) => (a || "?") + (b || "?");

// pill
function drawLabelPill(ctx, x, y, text, color = "#0ea5e9") {
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
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillText(text, bx + padX, by + h - padY - 2);
}

/* ---------- renderer ---------- */
function drawScene(
  ctx, wCss, hCss, zoom, tx, ty,
  points, lines, angles, ties, circles, tempLine
) {
  ctx.clearRect(0, 0, wCss, hCss);

  const originX = wCss / 2 + tx, originY = hCss / 2 + ty;
  const step = Math.max(zoom * 1, 24);

  // grid
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke();
  }
  for (let gy = originY % step; gy < hCss; gy += step) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke();
  }

  // axes
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, hCss / 2 + ty); ctx.lineTo(wCss, hCss / 2 + ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss / 2 + tx, 0); ctx.lineTo(wCss / 2 + tx, hCss); ctx.stroke();

  const W2S = (p) => ({ x: wCss/2 + p.x*zoom + tx, y: hCss/2 - p.y*zoom + ty });

  // normal lines (blue) + **length labels on canvas**
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2;
  ctx.font = "13px system-ui"; ctx.fillStyle = "#0f172a";
  lines.forEach((l) => {
    const a = points.find(p => p.id === l.p1), b = points.find(p => p.id === l.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();

    // label: "AB 123 mm"
    const midX = (s1.x + s2.x) / 2, midY = (s1.y + s2.y) / 2;
    const name = lineName(a.label, b.label);
    const len = Math.round(dist2D(a, b));
    const txt = `${name} ${len} ${UNIT_LABEL}`;
    // small white halo for contrast
    ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
    ctx.strokeText(txt, midX + 8, midY - 6);
    ctx.lineWidth = 1; ctx.fillStyle = "#0f172a";
    ctx.fillText(txt, midX + 8, midY - 6);
  });

  // tie lines (green dashed)
  ctx.strokeStyle = "green"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
  ties.forEach((t) => {
    const a = points.find(p => p.id === t.p1), b = points.find(p => p.id === t.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  });
  ctx.setLineDash([]);

  // temp red line (perp)
  if (tempLine) {
    const s1 = W2S({ x: tempLine.x1, y: tempLine.y1 });
    const s2 = W2S({ x: tempLine.x2, y: tempLine.y2 });
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // circles (purple)
  ctx.strokeStyle = "purple"; ctx.lineWidth = 2;
  circles.forEach((c) => {
    const center = points.find(p => p.id === c.centerId);
    if (!center) return;
    const sc = W2S(center);
    ctx.beginPath(); ctx.arc(sc.x, sc.y, c.r * zoom, 0, Math.PI * 2); ctx.stroke();
  });

  // angle pills
  angles.forEach((t) => {
    const b = points.find(p => p.id === t.b);
    if (!b) return;
    const sb = W2S(b);
    drawLabelPill(ctx, sb.x + 10, sb.y - 10, `${t.deg}°`);
  });

  // points
  points.forEach((p) => {
    const s = W2S(p); const r = 6;
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(s.x, s.y, r - 1, 0, Math.PI * 2); ctx.fill();

    ctx.font = "13px system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
    ctx.strokeText(p.label, s.x + 8, s.y - 8);
    ctx.fillStyle = "#0f172a"; ctx.fillText(p.label, s.x + 8, s.y - 8);
  });
  }
// src/pages/Drawing2D.jsx (Part 2/3)
export default function Drawing2D() {
  /* data */
  const [points, setPoints]   = useState([]);  // {id,label,x,y,h}
  const [lines, setLines]     = useState([]);  // {id,p1,p2}
  const [angles, setAngles]   = useState([]);  // {id,a,b,c,deg}
  const [ties, setTies]       = useState([]);  // {id,p1,p2,e,n,h,total}
  const [circles, setCircles] = useState([]);  // {id,centerId,r}

  /* inputs */
  const [E, setE] = useState("");  // mm
  const [N, setN] = useState("");  // mm
  const [H, setH] = useState("");  // mm
  const [circleR, setCircleR] = useState(""); // **NEW** optional radius for Circle mode
  const [title, setTitle] = useState("");

  /* modes / selections */
  const [mode, setMode] = useState("line");      // line|angle|eraseLine|refLine|tie|circle
  const [selected, setSelected] = useState([]);  // selected point ids
  const [refLine, setRefLine] = useState(null);  // {aId,bId}

  /* measure overlay (ref line E/N) */
  const [measure, setMeasure] = useState({ open:false, value:null }); // {E,N,fromLabel}
  const [tempLine, setTempLine] = useState(null); // {x1,y1,x2,y2}
  const tempTimerRef = useRef(null);

  /* view */
  const BASE_ZOOM = 60, MIN_Z = 0.0005, MAX_Z = 2400;
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0);
  const [autoFit, setAutoFit] = useState(true);

  const MIN_S=-200, MAX_S=80;
  const [sval, setSval] = useState(0);
  const sliderToZoom = (s)=>Math.min(MAX_Z, Math.max(MIN_Z, BASE_ZOOM*Math.pow(2, s/10)));
  const zoomToSlider = (z)=>Math.max(MIN_S, Math.min(MAX_S, Math.round(10*Math.log2((z||BASE_ZOOM)/BASE_ZOOM)*100)/100));
  useEffect(()=>{ setSval(zoomToSlider(zoom)); },[zoom]);
  const onSliderChange = (v)=>{ const s=Number(v); setSval(s); setZoom(sliderToZoom(s)); };

  /* canvas & pointers */
  const wrapRef = useRef(null), canvasRef = useRef(null), ctxRef = useRef(null);
  const sizeRef = useRef({ wCss:360, hCss:420 });
  const pointers = useRef(new Map());

  const nextLabel = () => labelFromIndex(points.length);

  /* draw / resize */
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
      drawScene(ctx,w,h,zoom,tx,ty,points,lines,angles,ties,circles,tempLine);
    };
    apply();
    let t; const onR=()=>{ clearTimeout(t); t=setTimeout(()=>{ apply(); if(autoFit) fitView(points); },60); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoFit,points,lines,angles,ties,circles,zoom,tx,ty,tempLine]);

  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene(ctx,sizeRef.current.wCss,sizeRef.current.hCss,zoom,tx,ty,points,lines,angles,ties,circles,tempLine);
  },[points,lines,angles,ties,circles,zoom,tx,ty,tempLine]);

  useEffect(()=>()=>{ if (tempTimerRef.current) clearTimeout(tempTimerRef.current); },[]);

  /* view helpers */
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
    const zX=(wCss*0.9)/(w+pad*2);
    const zY=(hCss*0.9)/(h+pad*2);
    const nz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(zX,zY)));
    setZoom(nz); setSval(zoomToSlider(nz));
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    setTx(-cx*nz); setTy(+cy*nz);
  };
  const resetView=()=>{ setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearLines=()=>setLines([]);
  const removeLastLine=()=>setLines(ls=>ls.slice(0,-1));
  const clearAll=()=>{
    setPoints([]); setLines([]); setAngles([]); setTies([]); setCircles([]);
    setSelected([]); setRefLine(null); setTempLine(null); setMeasure({open:false,value:null});
  };
  const centerOnA=()=>{
    if(!points.length) return;
    const A=points[0]; const z=zoom; setTx(-A.x*z); setTy(+A.y*z);
  };
  useEffect(()=>{ if(autoFit) fitView(points); },[points]); // eslint-disable-line

  /* add point (ENH) */
  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N);
    const hVal = H==="" ? 0 : Number(H);
    if(!isFinite(x)||!isFinite(y)||!isFinite(hVal)) return;
    const id=safeId(); const pt={id,label:nextLabel(),x,y,h:hVal};
    const next=[...points,pt]; setPoints(next);
    setE(""); setN(""); setH(""); if(autoFit) setTimeout(()=>fitView(next),0);
  };

  /* ref line helpers */
  const clearRefLine=()=>{
    setRefLine(null); setTempLine(null);
    setMeasure({open:false,value:null});
    setSelected([]); setMode("refLine");
  };

  /* gestures */
  const onPointerDown=(e)=>{
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY,t:Date.now()});
  };
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
        const wx=(mid.x - w/2 - tx)/z;
        const wy=(h/2 - (mid.y - ty))/z;
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

    // erase line (tap near segment)
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
      const ids=[...sel,pick.id];

      if(mode==="line" && ids.length===2){
        const [aId,bId]=ids; if(aId!==bId) setLines(ls=>[...ls,{id:safeId(),p1:aId,p2:bId}]);
        return [];
      }

      if(mode==="angle" && ids.length===3){
        if(new Set(ids).size===3){
          const [aId,bId,cId]=ids;
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId), c=points.find(x=>x.id===cId);
          setAngles(ag=>[...ag,{id:safeId(),a:a.id,b:b.id,c:c.id,deg:angleDeg(a,b,c)}]);
        }
        return [];
      }

      if(mode==="refLine"){
        // two picks set/overwrite ref; third ⇒ E/N measure from FIRST pick
        if(!refLine && ids.length===2){ setRefLine({aId:ids[0], bId:ids[1]}); return []; }
        if(refLine && ids.length===2){ setRefLine({aId:ids[0], bId:ids[1]}); return []; }
        if(refLine){
          if(pick.id===refLine.aId || pick.id===refLine.bId) return [];
          const a=points.find(p=>p.id===refLine.aId), b=points.find(p=>p.id===refLine.bId), c=pick;
          const vx=b.x-a.x, vy=b.y-a.y; const abLen=Math.hypot(vx,vy)||1;
          const t=((c.x-a.x)*vx+(c.y-a.y)*vy)/(abLen*abLen);
          const px=a.x+t*vx, py=a.y+t*vy;
          const perp=Math.hypot(c.x-px,c.y-py);
          const crossZ=vx*(c.y-a.y) - vy*(c.x-a.x);
          const ESigned=(crossZ>=0 ? -1 : 1) * perp; // per your sign rule
          const NSigned=t*abLen;

          setTempLine(null); setTempLine({x1:c.x,y1:c.y,x2:px,y2:py});
          setMeasure({ open:true, value:{ E:`${ESigned.toFixed(2)} ${UNIT_LABEL}`, N:`${NSigned.toFixed(2)} ${UNIT_LABEL}`, fromLabel:a.label||"first"} });
          return [];
        }
        return ids;
      }

      if(mode==="tie" && ids.length===2){
        const [aId,bId]=ids;
        if(aId!==bId){
          const a=points.find(p=>p.id===aId), b=points.find(p=>p.id===bId);
          const e=+(b.x-a.x).toFixed(2), n=+(b.y-a.y).toFixed(2), h=+((b.h||0)-(a.h||0)).toFixed(2);
          const total=+dist3D(a,b).toFixed(2);
          setTies(ts=>[...ts,{id:safeId(),p1:a.id,p2:b.id,e,n,h,total}]);
        }
        return [];
      }

      if(mode==="circle"){
        // **NEW**: if radius typed, center only >= create directly
        const R = Number(circleR);
        if(ids.length===1 && isFinite(R) && R>0){
          const center=points.find(p=>p.id===ids[0]);
          if(center){ setCircles(cs=>[...cs,{id:safeId(),centerId:center.id,r:+R.toFixed(2)}]); }
          return [];
        }
        // original: center + rim
        if(ids.length===2){
          const center=points.find(p=>p.id===ids[0]);
          const rim=points.find(p=>p.id===ids[1]);
          if(center && rim){
            const r=+dist2D(center,rim).toFixed(2);
            setCircles(cs=>[...cs,{id:safeId(),centerId:center.id,r}]);
          }
          return [];
        }
        return ids;
      }

      return ids;
    });
  };

  /* save (Firebase) */
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

  /* derived */
  const linesView = lines.map((l) => {
    const a = points.find(p => p.id === l.p1), b = points.find(p => p.id === l.p2);
    return { ...l, name: lineName(a?.label, b?.label), len: (a&&b)? Math.round(dist2D(a,b)) : 0 };
  });

  const hGroups = (() => {
    const mp = new Map();
    points.forEach(p=>{
      const key=(+(p.h||0)).toFixed(2);
      const list=mp.get(key)||[]; list.push(p); mp.set(key,list);
    });
    return Array.from(mp.entries()).map(([h,arr])=>({ h:+h, count:arr.length, labels:arr.map(p=>p.label).join(", ") }));
  })();
  /* -------------------- UI -------------------- */
  const th = { textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" };
  const td = { padding:"6px 10px", borderBottom:"1px solid #f1f5f9", fontSize:13, color:"#0f172a" };

  return (
  <div
    className="grid page-narrow"
    style={{ gap: 12, maxWidth: 430, margin: "0 auto", width: "100%" }}
  >
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
              display: "block", width: "100%", background: "#fff",
              borderRadius: 12, border: "1px solid #e5e7eb",
              touchAction: "none", cursor: "crosshair",
            }}
          />
        </div>

        {/* Measure Overlay */}
        {measure.open && (
          <div
            style={{
              position: "absolute", right: 12, bottom: 12,
              background: "rgba(15,23,42,0.96)", color: "#fff",
              border: "1px solid #334155", borderRadius: 12, padding: "10px 12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Perpendicular (E)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fca5a5" }}>{measure.value?.E}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                Along Ref from <b>{measure.value?.fromLabel}</b> (N)
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#67e8f9" }}>{measure.value?.N}</div>
            </div>

            <button
              className="btn"
              onClick={()=>{
                setMeasure({ open:false, value:null });
                if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
                tempTimerRef.current=setTimeout(()=>setTempLine(null),3000); // 3s hide red line
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
          <input type="range" min={MIN_S} max={MAX_S} step={0.01} value={sval} onChange={(e)=>onSliderChange(e.target.value)} style={{ width:"100%" }} />
          <div className="row" style={{ justifyContent:"space-between", marginTop:4 }}>
            <span className="small">{MIN_S}</span><span className="small">0</span><span className="small">{MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="row" style={{ gap:8 }}>
          <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} style={{ flex:"1 1 220px" }} />
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>

        <div className="row" style={{ gap:8 }}>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} style={{ width:100 }} />
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} style={{ width:100 }} />
          <input className="input" type="number" inputMode="decimal" step="any" placeholder={`H (${UNIT_LABEL})`} value={H} onChange={(e)=>setH(e.target.value)} style={{ width:100 }} />
          <button className="btn" onClick={addPoint}>Add (label {nextLabel()})</button>
        </div>

        {/* Toolbar – compact/wrap */}
        <div className="row" style={{ gap:6, flexWrap:"wrap" }}>
          <button className="btn" onClick={()=>{ setMode("line"); setSelected([]); }} style={{ background: mode==="line" ? "#0ea5e9" : "#64748b" }}>Line</button>
          <button className="btn" onClick={()=>{ setMode("angle"); setSelected([]); }} style={{ background: mode==="angle" ? "#0ea5e9" : "#64748b" }}>Angle</button>
          <button className="btn" onClick={()=>{ setMode("eraseLine"); setSelected([]); }} style={{ background: mode==="eraseLine" ? "#0ea5e9" : "#64748b" }}>Erase line (tap)</button>

          <button className="btn" onClick={()=>{ setMode("refLine"); setSelected([]); }} style={{ background: mode==="refLine" ? "#0ea5e9" : "#64748b" }}>📐 Ref line</button>
          {refLine && (
            <>
              <span className="small" style={{ background:"#e2e8f0", color:"#0f172a", borderRadius:12, padding:"4px 8px" }}>
                Ref: {points.find(p=>p.id===refLine.aId)?.label}–{points.find(p=>p.id===refLine.bId)?.label}
              </span>
              <button className="btn" style={{ background:"#ef4444" }} onClick={clearRefLine}>Clear</button>
            </>
          )}

          <button className="btn" onClick={()=>{ setMode("tie"); setSelected([]); }} style={{ background: mode==="tie" ? "#0ea5e9" : "#64748b" }}>Tie line</button>

          <button className="btn" onClick={()=>{ setMode("circle"); setSelected([]); }} style={{ background: mode==="circle" ? "#0ea5e9" : "#64748b" }}>Circle</button>
          {/* **NEW** Circle R input */}
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder={`R (${UNIT_LABEL})`}
            value={circleR}
            onChange={(e)=>setCircleR(e.target.value)}
            style={{ width:90 }}
          />

          <button className="btn" onClick={centerOnA}>Find A</button>
          <button className="btn" onClick={fitView}>Fit</button>
          <button className="btn" onClick={resetView}>Reset</button>
          <button className="btn" onClick={removeLastLine}>Remove last line</button>
          <button className="btn" onClick={clearLines}>Clear lines</button>
          <button className="btn" onClick={clearAll}>Clear All</button>

          <label className="row" style={{ gap:8, marginLeft:6 }}>
            <input type="checkbox" checked={autoFit} onChange={(e)=>setAutoFit(e.target.checked)} />
            <span className="small">Auto fit</span>
          </label>
        </div>
      </div>

      {/* Points (ENH) */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">Points (ENH)</div>
        {points.length===0 && <div className="small">No points.</div>}
        {points.length>0 && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr><th style={th}>Label</th><th style={th}>E</th><th style={th}>N</th><th style={th}>H</th><th style={th}></th></tr>
              </thead>
              <tbody>
                {points.map(p=>(
                  <tr key={p.id}>
                    <td style={td}>{p.label}</td>
                    <td style={td}>{p.x}</td>
                    <td style={td}>{p.y}</td>
                    <td style={td}>{p.h || 0}</td>
                    <td style={td}>
                      <button className="btn" style={{ background:"#ef4444" }} onClick={()=>setPoints(arr=>arr.filter(x=>x.id!==p.id))}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">Lines</div>
        {lines.length===0 && <div className="small">No lines.</div>}
        {lines.length>0 && linesView.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between" }}>
            <div className="small"><b>{l.name}</b> &nbsp; {l.len} {UNIT_LABEL}</div>
            <button className="btn" style={{ background:"#ef4444" }} onClick={()=>setLines(ls=>ls.filter(x=>x.id!==l.id))}>Del</button>
          </div>
        ))}
      </div>

      {/* Angles */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">Angles</div>
        {angles.length===0 && <div className="small">No angles.</div>}
        {angles.length>0 && angles.map(a=>(
          <div key={a.id} className="row" style={{ justifyContent:"space-between" }}>
            <div className="small">
              at <b>{points.find(p=>p.id===a.b)?.label || "?"}</b> &nbsp;
              {angleDeg(points.find(p=>p.id===a.a)||{x:0,y:0}, points.find(p=>p.id===a.b)||{x:0,y:0}, points.find(p=>p.id===a.c)||{x:0,y:0})}°
            </div>
            <button className="btn" style={{ background:"#ef4444" }} onClick={()=>setAngles(ag=>ag.filter(x=>x.id!==a.id))}>Del</button>
          </div>
        ))}
      </div>

      {/* Tie lines */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">Tie lines (ENH)</div>
        {ties.length===0 && <div className="small">No ties.</div>}
        {ties.length>0 && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr><th style={th}>Name</th><th style={th}>E</th><th style={th}>N</th><th style={th}>H</th><th style={th}>Total</th><th style={th}></th></tr>
              </thead>
              <tbody>
                {ties.map(t=>{
                  const a=points.find(p=>p.id===t.p1), b=points.find(p=>p.id===t.p2);
                  return (
                    <tr key={t.id}>
                      <td style={td}><b>{lineName(a?.label,b?.label)}</b></td>
                      <td style={td}>{t.e}</td>
                      <td style={td}>{t.n}</td>
                      <td style={td}>{t.h}</td>
                      <td style={td}>{t.total}</td>
                      <td style={td}>
                        <button className="btn" style={{ background:"#ef4444" }} onClick={()=>setTies(ts=>ts.filter(x=>x.id!==t.id))}>Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Circles */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">Circles</div>
        {circles.length===0 && <div className="small">No circles.</div>}
        {circles.length>0 && circles.map((c,idx)=>(
          <div key={c.id} className="row" style={{ justifyContent:"space-between" }}>
            <div className="small">
              <b>C{idx+1}</b> @ {points.find(p=>p.id===c.centerId)?.label || "?"}
              &nbsp; R = {c.r} {UNIT_LABEL}
            </div>
            <button className="btn" style={{ background:"#ef4444" }} onClick={()=>setCircles(cs=>cs.filter(x=>x.id!==c.id))}>Del</button>
          </div>
        ))}
      </div>

      {/* H groups */}
      <div className="card" style={{ display:"grid", gap:8 }}>
        <div className="page-title">H Levels (grouped)</div>
        {hGroups.length===0 && <div className="small">No data.</div>}
        {hGroups.length>0 && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr><th style={th}>H ({UNIT_LABEL})</th><th style={th}>Count</th><th style={th}>Labels</th></tr>
              </thead>
              <tbody>
                {hGroups.map(g=>(
                  <tr key={g.h}>
                    <td style={td}>{g.h.toFixed(2)}</td>
                    <td style={td}>{g.count}</td>
                    <td style={td}>{g.labels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
