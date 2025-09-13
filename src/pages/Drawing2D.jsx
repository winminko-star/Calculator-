import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/* ================= Constants & helpers ================= */
const UNIT_LABEL = "mm";
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const dist2D = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const dist3D = (a, b) =>
  Math.hypot(b.x - a.x, b.y - a.y, (b.h ?? 0) - (a.h ?? 0));

const angleDeg = (a, b, c) => {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return +(Math.acos(cos) * 180 / Math.PI).toFixed(2);
};

const labelFromIndex = (i) => {
  let s = ""; i += 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
  return s;
};

// E,N of point c relative to ref A→B (FIRST=A)
function refEN(a, b, c) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const L2 = vx*vx + vy*vy || 1;
  const t = ((c.x - a.x)*vx + (c.y - a.y)*vy) / L2;     // along from A
  const px = a.x + t*vx, py = a.y + t*vy;
  const perp = Math.hypot(c.x - px, c.y - py);
  const crossZ = vx*(c.y - a.y) - vy*(c.x - a.x);
  const E = (crossZ >= 0 ? 1 : -1) * perp;              // + = left of A→B
  const N = t * Math.hypot(vx, vy);
  return { E, N, proj: { x: px, y: py } };
}

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

/* ================= Canvas renderer ================= */
function drawScene(ctx, wCss, hCss, zoom, tx, ty,
  points, lines, angles, circles, tieLines, tempRefLine
) {
  ctx.clearRect(0, 0, wCss, hCss);

  // grid
  const step = Math.max(zoom * 1, 24);
  const originX = wCss / 2 + tx, originY = hCss / 2 + ty;
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let gx = originX % step; gx < wCss; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hCss); ctx.stroke(); }
  for (let gy = originY % step; gy < hCss; gy += step) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(wCss, gy); ctx.stroke(); }

  // axes
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, hCss/2 + ty); ctx.lineTo(wCss, hCss/2 + ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wCss/2 + tx, 0); ctx.lineTo(wCss/2 + tx, hCss); ctx.stroke();

  const W2S = (p) => ({ x: wCss/2 + p.x*zoom + tx, y: hCss/2 - p.y*zoom + ty });

  // normal lines (blue)
  ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2; ctx.font="13px system-ui"; ctx.fillStyle="#0f172a";
  lines.forEach(l => {
    const a = points.find(p=>p.id===l.p1), b = points.find(p=>p.id===l.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    ctx.fillText(`${Math.round(l.len2D)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6, (s1.y+s2.y)/2-6);
  });

  // tie lines (green dashed, show 3D)
  tieLines.forEach(tl=>{
    const a = points.find(p=>p.id===tl.p1), b = points.find(p=>p.id===tl.p2);
    if (!a || !b) return;
    const s1 = W2S(a), s2 = W2S(b);
    ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2.5; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#065f46";
    ctx.fillText(`${Math.round(tl.len3D)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6, (s1.y+s2.y)/2-6);
  });

  // ref dashed red (temp perpendicular)
  if (tempRefLine) {
    const s1 = W2S({ x: tempRefLine.x1, y: tempRefLine.y1 });
    const s2 = W2S({ x: tempRefLine.x2, y: tempRefLine.y2 });
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // circles (indigo)
  circles.forEach(c => {
    const cent = points.find(p=>p.id===c.centerId);
    if (!cent) return;
    const s = W2S(cent);
    ctx.beginPath();
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.arc(s.x, s.y, Math.max(0.5, c.r * zoom), 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`R=${c.r} ${UNIT_LABEL}`, s.x + 8, s.y - 8);
  });

  // angle labels
  angles.forEach(t => {
    const a = points.find(p=>p.id===t.a), b = points.find(p=>p.id===t.b), c = points.find(p=>p.id===t.c);
    if (!a || !b || !c) return;
    const sb = W2S(b); drawLabelPill(ctx, sb.x+10, sb.y-10, `${t.deg}`);
  });

  // points
  points.forEach(p => {
    const s = W2S(p); const r = 6;
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(s.x, s.y, r-1, 0, Math.PI*2); ctx.fill();
    ctx.font = "13px system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
    ctx.strokeText(p.label, s.x+8, s.y-8);
    ctx.fillStyle = "#0f172a"; ctx.fillText(p.label, s.x+8, s.y-8);
  });
                                                 }
export default function Drawing2D() {
  // data
  const [points, setPoints]   = useState([]);       // {id,label,x,y,h?}
  const [lines, setLines]     = useState([]);       // {id,p1,p2,len2D,len3D}
  const [angles, setAngles]   = useState([]);
  const [circles, setCircles] = useState([]);       // {id, centerId, r}
  const [tieLines, setTieLines] = useState([]);     // {id,p1,p2,dx,dy,dh,len2D,len3D}

  // inputs
  const [E, setE] = useState(""); const [N, setN] = useState("");
  const [H, setH] = useState(""); const [title, setTitle] = useState("");
  const [R, setR] = useState(""); // radius for circle

  // modes
  const [mode, setMode] = useState("line"); // line | tieLine | angle | eraseLine | refLine | circle
  const [selected, setSelected] = useState([]);

  // ref-line
  const [refLine, setRefLine] = useState(null);     // {aId,bId}
  const [tempRefLine, setTempRefLine] = useState(null);
  const [measure, setMeasure] = useState({ open:false, value:null });
  const hideRefTimer = useRef(null);

  // view
  const BASE_ZOOM = 60, MIN_Z = 0.0005, MAX_Z = 2400;
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0);
  const [autoFit, setAutoFit] = useState(true);

  // scale slider
  const MIN_S=-200, MAX_S=80; const [sval,setSval]=useState(0);
  const sliderToZoom = (s)=>Math.min(MAX_Z,Math.max(MIN_Z,BASE_ZOOM*Math.pow(2,s/10)));
  const zoomToSlider = (z)=>Math.max(MIN_S,Math.min(MAX_S,Math.round(10*Math.log2((z||BASE_ZOOM)/BASE_ZOOM)*100)/100));
  useEffect(()=>setSval(zoomToSlider(zoom)),[zoom]);
  const onSliderChange=(v)=>{ const s=Number(v); setSval(s); setZoom(sliderToZoom(s)); };

  // canvas
  const wrapRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
  const sizeRef=useRef({wCss:360,hCss:420});
  const pointers=useRef(new Map());
  const nextLabel=()=>labelFromIndex(points.length);

  /* size/draw hook */
  useEffect(()=>{
    const cvs=canvasRef.current, wrap=wrapRef.current; if(!cvs||!wrap) return;
    const apply=()=>{
      const dpr=window.devicePixelRatio||1;
      const w=Math.max(320,Math.floor(wrap.clientWidth||360));
      const h=Math.min(Math.max(Math.floor(w*1.0),360),640);
      sizeRef.current={wCss:w,hCss:h};
      cvs.style.width=w+"px"; cvs.style.height=h+"px";
      cvs.width=Math.floor(w*dpr); cvs.height=Math.floor(h*dpr);
      const ctx=cvs.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctxRef.current=ctx;
      drawScene(ctx,w,h,zoom,tx,ty,points,lines,angles,circles,tieLines,tempRefLine);
    };
    apply();
    let t; const onR=()=>{ clearTimeout(t); t=setTimeout(()=>{ apply(); if(autoFit) fitView(points); },60); };
    window.addEventListener("resize",onR); window.addEventListener("orientationchange",onR);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize",onR); window.removeEventListener("orientationchange",onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoFit,points,zoom,tx,ty,tempRefLine,circles,tieLines]);

  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx) return;
    drawScene(ctx,sizeRef.current.wCss,sizeRef.current.hCss,zoom,tx,ty,points,lines,angles,circles,tieLines,tempRefLine);
  },[points,lines,angles,zoom,tx,ty,tempRefLine,circles,tieLines]);

  useEffect(()=>()=>hideRefTimer.current && clearTimeout(hideRefTimer.current),[]);

  /* view helpers */
  const fitView=(pts=points)=>{
    if(!pts.length) return;
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY;
    const { wCss,hCss }=sizeRef.current;

    if (w===0 && h===0) {
      const targetZ=Math.min(wCss,hCss)*0.5;
      const nz=Math.min(MAX_Z,Math.max(MIN_Z,targetZ));
      setZoom(nz); const p=pts[0]; setTx(-p.x*nz); setTy(+p.y*nz); return;
    }
    const pad=0.1*Math.max(w,h);
    const zX=(wCss*0.9)/(w+pad*2), zY=(hCss*0.9)/(h+pad*2);
    const nz=Math.min(MAX_Z,Math.max(MIN_Z,Math.min(zX,zY)));
    setZoom(nz); setSval(zoomToSlider(nz));
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2; setTx(-cx*nz); setTy(+cy*nz);
  };
  const resetView=()=>{ setZoom(BASE_ZOOM); setSval(0); setTx(0); setTy(0); };
  const clearLines=()=>setLines([]);
  const removeLastLine=()=>setLines(ls=>ls.slice(0,-1));
  const clearAll=()=>{
    setPoints([]); setLines([]); setAngles([]); setSelected([]);
    setRefLine(null); setTempRefLine(null); setMeasure({open:false,value:null});
    setCircles([]); setTieLines([]);
  };
  const centerOnA=()=>{ if(!points.length) return; const A=points[0]; const z=zoom; setTx(-A.x*z); setTy(+A.y*z); };
  useEffect(()=>{ if(autoFit) fitView(points); },[points]); // eslint-disable-line

  /* add / delete point */
  const addPoint=()=>{
    if(E===""||N==="") return;
    const x=Number(E), y=Number(N), h=H===""?undefined:Number(H);
    if(!isFinite(x)||!isFinite(y)) return;
    const id=safeId();
    const pt={id,label:nextLabel(),x,y,h};
    const next=[...points,pt]; setPoints(next);
    setE(""); setN(""); setH("");
    if(autoFit) setTimeout(()=>fitView(next),0);
  };

  const deletePoint=(id)=>{
    setPoints(ps=>ps.filter(p=>p.id!==id));
    setLines(ls=>ls.filter(l=>l.p1!==id && l.p2!==id));
    setAngles(as=>as.filter(a=>a.a!==id && a.b!==id && a.c!==id));
    setCircles(cs=>cs.filter(c=>c.centerId!==id));
    setTieLines(ts=>ts.filter(t=>t.p1!==id && t.p2!==id));
    if(refLine && (refLine.aId===id || refLine.bId===id)){
      setRefLine(null); setTempRefLine(null); setMeasure({open:false,value:null});
    }
  };

  const removeLineById=(id)=> setLines(ls=>ls.filter(l=>l.id!==id));
  const removeCircleById=(id)=> setCircles(cs=>cs.filter(c=>c.id!==id));
  const removeTieById=(id)=> setTieLines(ts=>ts.filter(t=>t.id!==id));

  /* gestures */
  const onPointerDown=(e)=>{
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId,{ x:e.clientX, y:e.clientY, t:Date.now() });
  };
  const onPointerMove=(e)=>{
    const prev=pointers.current.get(e.pointerId); if(!prev) return;
    pointers.current.set(e.pointerId,{ x:e.clientX, y:e.clientY, t:prev.t });
    const pts=[...pointers.current.values()];
    if(pts.length===1){ setTx(v=>v+(e.clientX-prev.x)); setTy(v=>v+(e.clientY-prev.y)); }
    else if(pts.length>=2){
      const [p1,p2]=pts;
      const distPrev=Math.hypot(p1.x-prev.x,p1.y-prev.y)||1;
      const distNow=Math.hypot(p1.x-p2.x,p1.y-p2.y)||1;
      const wrap=wrapRef.current, rect=wrap.getBoundingClientRect();
      const mid={ x:(p1.x+p2.x)/2-rect.left, y:(p1.y+p2.y)/2-rect.top };
      const { wCss:w, hCss:h }=sizeRef.current;
      setZoom(z=>{
        const nz=Math.min(MAX_Z,Math.max(MIN_Z, z*(distNow/distPrev) ));
        const wx=(mid.x - w/2 - tx)/z, wy=(h/2 - (mid.y - ty))/z;
        const sx=w/2 + wx*nz + tx, sy=h/2 - wy*nz + ty;
        setTx(v=>v+(mid.x - sx)); setTy(v=>v+(mid.y - sy));
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

    // erase-line (blue lines only)
    if(mode==="eraseLine"){
      const mmTol=12/zoom; let bestIdx=-1, bestD=Infinity;
      lines.forEach((ln,idx)=>{
        const a=points.find(p=>p.id===ln.p1), b=points.find(p=>p.id===ln.p2); if(!a||!b) return;
        const vx=b.x-a.x, vy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((world.x-a.x)*vx+(world.y-a.y)*vy)/(vx*vx+vy*vy||1)))||0;
        const cx=a.x+t*vx, cy=a.y+t*vy;
        const d=Math.hypot(world.x-cx,world.y-cy);
        if(d<bestD){ bestD=d; bestIdx=idx; }
      });
      if(bestIdx!==-1 && bestD<=mmTol) setLines(ls=>ls.filter((_,i)=>i!==bestIdx));
      return;
    }

    // pick nearest point
    const hitR=12/zoom; let pick=null, best=Infinity;
    for (const p of points){ const d=Math.hypot(p.x-world.x,p.y-world.y); if(d<best && d<=hitR){best=d; pick=p;} }
    if(!pick) return;

    setSelected(sel=>{
      const next=[...sel,pick.id];

      if(mode==="line" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          setLines(ls=>[...ls,{ id:safeId(), p1:a.id, p2:b.id, len2D:dist2D(a,b), len3D:dist3D(a,b) }]);
        }
        return [];
      }

      if(mode==="angle" && next.length===3){
        const [aId,bId,cId]=next;
        if(new Set(next).size===3){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId), c=points.find(x=>x.id===cId);
          setAngles(ag=>[...ag,{ id:safeId(), a:a.id, b:b.id, c:c.id, deg:angleDeg(a,b,c) }]);
        }
        return [];
      }

      if(mode==="refLine"){
        // 1) pick 2 pts → overwrite ref line (Change ကိုဖယ်ထားတော့ ဒီလိုပဲချိတ်)
        if (next.length === 2) {
          const [firstId, secondId] = next;
          if (firstId !== secondId) {
            setRefLine({ aId:firstId, bId:secondId });
            setSelected([]); setMeasure({open:false,value:null}); setTempRefLine(null);
          }
          return [];
        }
        // 2) ref line ရှိပြီး 3rd point ကိုနှိပ် → EN တိုင်း
        if (refLine) {
          if (pick.id===refLine.aId || pick.id===refLine.bId) return [];
          const a=points.find(p=>p.id===refLine.aId), b=points.find(p=>p.id===refLine.bId), c=pick;
          if(a&&b&&c){
            const {E,N,proj}=refEN(a,b,c);
            setTempRefLine({ x1:c.x, y1:c.y, x2:proj.x, y2:proj.y });
            setMeasure({ open:true, value:{ E:`${E.toFixed(2)} ${UNIT_LABEL}`, N:`${N.toFixed(2)} ${UNIT_LABEL}`, fromLabel:a.label }});
          }
          return [];
        }
        return next;
      }

      if(mode==="tieLine" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          const dx=b.x-a.x, dy=b.y-a.y, dh=(b.h??0)-(a.h??0);
          const l2=dist2D(a,b), l3=dist3D(a,b);
          setTieLines(ts=>[...ts,{ id:safeId(), p1:a.id, p2:b.id, dx,dy,dh, len2D:l2, len3D:l3 }]);
        }
        return [];
      }

      if(mode==="circle"){
        // select center (1 pick); press Add Circle with R
        return [pick.id];
      }

      return next;
    });
  };

  /* save */
  const saveToFirebase = async () => {
    const now = Date.now();
    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      title: title || "Untitled",
      unitLabel: UNIT_LABEL,
      state: { points, lines, angles, circles, tieLines, view: { zoom, tx, ty } },
      meta: {
        points: points.length, lines: lines.length,
        triples: angles.length, circles: circles.length, ties: tieLines.length
      },
    });
    alert("Saved");
  };

  /* derived helpers */
  const linesWithLabels = lines.map(l=>{
    const a=points.find(p=>p.id===l.p1), b=points.find(p=>p.id===l.p2);
    return { id:l.id, name:(a&&b)?`${a.label}${b.label}`:`${l.p1}-${l.p2}`, len2D:l.len2D, len3D:l.len3D };
  });
  const tieWithLabels = tieLines.map(t=>{
    const a=points.find(p=>p.id===t.p1), b=points.find(p=>p.id===t.p2);
    return { id:t.id, name:(a&&b)?`${a.label}${b.label}`:`${t.p1}-${t.p2}`, ...t };
  });

  const refA = refLine ? points.find(p=>p.id===refLine.aId) : null;
  const refB = refLine ? points.find(p=>p.id===refLine.bId) : null;

  /* circle add */
  const addCircle = () => {
    if (mode !== "circle" || !selected.length) return;
    const centerId = selected[0];
    const r = Number(R);
    if (!isFinite(r) || r <= 0) return;
    setCircles(cs => [...cs, { id: safeId(), centerId, r }]);
    setR("");
  };
  /* ===================== UI ===================== */
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

        {/* EN Measure Overlay */}
        {measure.open && (
          <div style={{
            position:"absolute", right:12, bottom:12,
            background:"rgba(15,23,42,0.96)", color:"#fff",
            border:"1px solid #334155", borderRadius:12, padding:"10px 12px",
            boxShadow:"0 8px 24px rgba(0,0,0,0.18)", display:"flex", alignItems:"center", gap:12
          }}>
            <div style={{ display:"grid", gap:4 }}>
              <div style={{ fontSize:12, opacity:0.8 }}>Perpendicular (E)</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#fca5a5" }}>{measure.value?.E}</div>
              <div style={{ fontSize:12, opacity:0.8, marginTop:6 }}>
                Along Ref from <b>{measure.value?.fromLabel}</b> (N)
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:"#67e8f9" }}>{measure.value?.N}</div>
            </div>
            <button
              className="btn"
              onClick={()=>{
                setMeasure({open:false,value:null});
                hideRefTimer.current && clearTimeout(hideRefTimer.current);
                hideRefTimer.current = setTimeout(()=> setTempRefLine(null), 3000);
              }}
              style={{ background:"#0ea5e9" }}
            >OK</button>
          </div>
        )}

        {/* Scale slider */}
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
            <span className="small">Scale (px/{UNIT_LABEL})</span>
            <span className="small">{Math.max(0.0001, Math.round(zoom*1000)/1000)} px/{UNIT_LABEL}</span>
          </div>
          <input type="range" min={MIN_S} max={MAX_S} step={0.01} value={sval}
                 onChange={(e)=>onSliderChange(e.target.value)} style={{ width:"100%" }} />
          <div className="row" style={{ justifyContent:"space-between", marginTop:4 }}>
            <span className="small">{MIN_S}</span><span className="small">0</span><span className="small">{MAX_S}</span>
          </div>
        </div>
      </div>

      {/* Toolbar – compact grid */}
      <div className="card" style={{ padding: 8 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
          <button className="btn" style={{ padding:6, fontSize:12, background:mode==="line"?"#0ea5e9":"#64748b" }}
                  onClick={()=>{ setMode("line"); setSelected([]); }}>Line</button>

          <button className="btn" style={{ padding:6, fontSize:12, background:mode==="tieLine"?"#0ea5e9":"#64748b" }}
                  onClick={()=>{ setMode("tieLine"); setSelected([]); }}>Tie line</button>

          <button className="btn" style={{ padding:6, fontSize:12, background:mode==="angle"?"#0ea5e9":"#64748b" }}
                  onClick={()=>{ setMode("angle"); setSelected([]); }}>Angle</button>

          <button className="btn" style={{ padding:6, fontSize:12, background:mode==="eraseLine"?"#0ea5e9":"#64748b" }}
                  onClick={()=>{ setMode("eraseLine"); setSelected([]); }}>Erase</button>

          <button className="btn" style={{ padding:6, fontSize:12, background:mode==="refLine"?"#0ea5e9":"#64748b" }}
                  onClick={()=>{ setMode("refLine"); setSelected([]); }}>Ref line</button>

          {refLine && (
            <>
              <span className="small" style={{ alignSelf:"center" }}>
                Ref: {points.find(p=>p.id===refLine.aId)?.label}–{points.find(p=>p.id===refLine.bId)?.label}
              </span>
              {/* Change ကိုဖယ်ထားပါ → ၂ မှတ်ပြန်ရွေးလို့ အစားထိုးသွားမယ် */}
              <button className="btn" style={{ padding:6, fontSize:12, background:"#ef4444" }}
                onClick={()=>{
                  setSelected([]); setMeasure({open:false,value:null}); setTempRefLine(null);
                  setRefLine(null);
                }}>Clear</button>
            </>
          )}

          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={centerOnA}>Find A</button>
          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={fitView}>Fit</button>
          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={resetView}>Reset</button>
          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={clearAll}>Clear All</button>
          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={removeLastLine}>Remove last</button>
          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={clearLines}>Clear lines</button>

          <label className="row" style={{ gap:6, alignItems:"center" }}>
            <input type="checkbox" checked={autoFit} onChange={(e)=>setAutoFit(e.target.checked)} />
            <span className="small">Auto fit</span>
          </label>

          {/* Circle controls */}
          <button className="btn" style={{ padding:6, fontSize:12, background:mode==="circle"?"#0ea5e9":"#64748b" }}
                  onClick={()=>{ setMode("circle"); setSelected([]); }}>Circle</button>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`R (${UNIT_LABEL})`} value={R} onChange={(e)=>setR(e.target.value)}
                 style={{ width:"100%", minWidth:0 }} />
          <button className="btn" style={{ padding:6, fontSize:12 }} onClick={addCircle}>
            Add Circle {selected.length ? `(center ${points.find(p=>p.id===selected[0])?.label || ""})` : ""}
          </button>
        </div>
      </div>

      {/* Title + Inputs */}
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Title (e.g. P83 pipe)" value={title}
                 onChange={(e)=>setTitle(e.target.value)} style={{ flex:"1 1 260px" }} />
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>
        <div className="row" style={{ marginBottom: 8, gap: 8 }}>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} style={{ width:100 }} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} style={{ width:100 }} />
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`H (level)`} value={H} onChange={(e)=>setH(e.target.value)} style={{ width:100 }} />
          <button className="btn" onClick={addPoint}>Add (label {nextLabel()})</button>
        </div>
      </div>

      {/* Points table */}
      <div className="card">
        <div className="page-title">Points</div>
        {points.length===0 && <div className="small">No points.</div>}
        {points.map(p=>{
          let enText = "";
          if (refA && refB) {
            const { E:EE, N:NN } = refEN(refA, refB, p);
            enText = `E: ${EE.toFixed(2)} ${UNIT_LABEL}, N: ${NN.toFixed(2)} ${UNIT_LABEL}`;
          }
          return (
            <div key={p.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <b>{p.label}</b> &nbsp;
                <span className="small">(E {p.x}, N {p.y}{typeof p.h==="number" ? `, H ${p.h}`:""})</span>
                {enText && <div className="small" style={{ color:"#0ea5e9" }}>{enText}</div>}
              </div>
              <button className="btn" style={{ background:"#ef4444" }} onClick={()=>deletePoint(p.id)}>🗑</button>
            </div>
          );
        })}
      </div>

      {/* H Table (group by level) */}
      <div className="card">
        <div className="page-title">H Levels</div>
        {points.filter(p=>typeof p.h==="number").length===0 && <div className="small">No H values.</div>}
        {(() => {
          const map = new Map(); // h -> count
          points.forEach(p => {
            if (typeof p.h === "number") map.set(p.h, (map.get(p.h)||0)+1);
          });
          const rows = Array.from(map.entries()).sort((a,b)=>a[0]-b[0]);
          return rows.map(([h, count]) => (
            <div key={h} className="row" style={{ justifyContent:"space-between" }}>
              <div>H = <b>{h}</b></div>
              <div className="small">Points: <b>{count}</b></div>
            </div>
          ));
        })()}
      </div>

      {/* Lines (blue) */}
      <div className="card">
        <div className="page-title">Lines</div>
        {linesWithLabels.length===0 && <div className="small">No lines yet.</div>}
        {linesWithLabels.map(l=>(
          <div key={l.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
            <div><b>{l.name}</b> &nbsp; 2D: <b>{Math.round(l.len2D)}</b> {UNIT_LABEL} / 3D: <b>{Math.round(l.len3D)}</b> {UNIT_LABEL}</div>
            <button className="btn" style={{ background:"#ef4444" }} onClick={()=>removeLineById(l.id)}>🗑</button>
          </div>
        ))}
      </div>

      {/* Tie lines (green) */}
      <div className="card">
        <div className="page-title">Tie Lines</div>
        {tieWithLabels.length===0 && <div className="small">No tie lines.</div>}
        {tieWithLabels.map(t=>(
          <div key={t.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <b>{t.name}</b> &nbsp;
              2D: <b>{Math.round(t.len2D)}</b> {UNIT_LABEL} /
              3D: <b>{Math.round(t.len3D)}</b> {UNIT_LABEL}
              <span className="small"> &nbsp; (dE {t.dx.toFixed(2)}, dN {t.dy.toFixed(2)}, dH {(t.dh??0).toFixed(2)})</span>
            </div>
            <button className="btn" style={{ background:"#ef4444" }} onClick={()=>removeTieById(t.id)}>🗑</button>
          </div>
        ))}
      </div>

      {/* Circles */}
      <div className="card">
        <div className="page-title">Circles</div>
        {circles.length===0 && <div className="small">No circles.</div>}
        {circles.map(c=>{
          const cent=points.find(p=>p.id===c.centerId);
          return (
            <div key={c.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
              <div><b>Center:</b> {cent?.label || c.centerId} &nbsp; <b>R:</b> {c.r} {UNIT_LABEL}</div>
              <button className="btn" style={{ background:"#ef4444" }} onClick={()=>removeCircleById(c.id)}>🗑</button>
            </div>
          );
        })}
      </div>

      {/* Angles */}
      <div className="card">
        <div className="page-title">Angles</div>
        {angles.length===0 && <div className="small">No angles yet.</div>}
        {angles.map(t=>(
          <div key={t.id} className="small">
            at <b>{t.b}</b> from {t.a},{t.b},{t.c} = <b>{t.deg}°</b>
          </div>
        ))}
      </div>
    </div>
  );
            }
