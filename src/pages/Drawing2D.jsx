// src/pages/Drawing2D.jsx (Part 1/3)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/** Units: coordinates are in millimetres (mm). zoom = px per mm */
const UNIT_LABEL = "mm";

/* ---------------- helpers ---------------- */
const safeId = () =>
  (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0, 8);

const dist2d = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const dist3d = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, (b.h || 0) - (a.h || 0));

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

// get line name by labels (AB, AC…)
const lineName = (points, p1, p2) => {
  const a = points.find(p => p.id === p1)?.label || "?";
  const b = points.find(p => p.id === p2)?.label || "?";
  return `${a}${b}`;
};

// angle label pill
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
function drawScene(ctx, wCss, hCss, zoom, tx, ty, points, lines, angles, ties, circles, tempLine) {
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
    ctx.fillText(`${Math.round(l.len2d)} ${UNIT_LABEL}`, (s1.x+s2.x)/2+6,(s1.y+s2.y)/2-6);
  });

  // Ties (green) 3D lines
  ties.forEach(t=>{
    const a=points.find(p=>p.id===t.p1), b=points.find(p=>p.id===t.p2); if(!a||!b) return;
    const s1=W2S(a), s2=W2S(b);
    ctx.strokeStyle="#10b981"; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  });

  // circles
  circles.forEach(c=>{
    const ctr=points.find(p=>p.id===c.center); if(!ctr) return;
    const s=W2S(ctr); const rPx = c.radius * zoom;
    ctx.strokeStyle="#f59e0b"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.x,s.y, rPx, 0, Math.PI*2); ctx.stroke();
  });

  // temp red line (perp)
  if (tempLine) {
    const s1=W2S({x:tempLine.x1,y:tempLine.y1});
    const s2=W2S({x:tempLine.x2,y:tempLine.y2});
    ctx.strokeStyle="#ef4444"; ctx.lineWidth=2; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
    ctx.setLineDash([]);
  }

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
  const [lines, setLines]   = useState([]);     // {id,p1,p2,len2d}
  const [angles, setAngles] = useState([]);     // {id,a,b,c,deg}
  const [ties, setTies]     = useState([]);     // {id,p1,p2,len3d}
  const [circles, setCircles] = useState([]);   // {id,center,radius}

  // inputs
  const [E, setE] = useState("");   // mm
  const [N, setN] = useState("");   // mm
  const [H, setH] = useState("");   // mm (optional)
  const [title, setTitle] = useState("");

  // modes
  const [mode, setMode] = useState("line"); // 'line' | 'angle' | 'eraseLine' | 'refLine' | 'tie' | 'circle'
  const [selected, setSelected] = useState([]);

  // ref-line measure
  const [refLine, setRefLine] = useState(null); // {aId,bId}
  const [tempLine, setTempLine] = useState(null); // {x1,y1,x2,y2}
  const [measure, setMeasure] = useState({ open:false, value:null }); // {E,N,fromLabel}
  const tempTimerRef = useRef(null);

  // circle radius input (for circle mode)
  const [circleR, setCircleR] = useState("");

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
    setPoints([]); setLines([]); setAngles([]); setTies([]); setCircles([]);
    setSelected([]); setRefLine(null); setTempLine(null); setMeasure({open:false,value:null});
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
    const h = H==="" ? null : Number(H);
    if (H!=="" && !isFinite(h)) return;
    const id=safeId(); const pt={id,label:nextLabel(),x,y,h};
    const next=[...points,pt]; setPoints(next);
    setE(""); setN(""); setH("");
    if(autoFit) setTimeout(()=>fitView(next),0);
  };

  /* ---------- simple deletes / helpers ---------- */
  const delTie = (id) => setTies(ts => ts.filter(x => x.id !== id));
  const delLine = (id) => setLines(ls => ls.filter(x => x.id !== id));
  const delAngle = (id) => setAngles(as => as.filter(x => x.id !== id));
  const delCircle = (id) => setCircles(cs => cs.filter(x => x.id !== id));
  const clearRefLine = () => {
    setRefLine(null);
    setSelected([]);
    setTempLine(null);
    setMeasure({ open:false, value:null });
    setMode("refLine"); // clear ပြီး ချက်ချင်း ပြန်ရွေးနိုင်
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

      // normal line
      if(mode==="line" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          setLines(ls=>[...ls,{id:safeId(),p1:a.id,p2:b.id,len2d:dist2d(a,b)}]);
        }
        return [];
      }

      // angle
      if(mode==="angle" && next.length===3){
        const [aId,bId,cId]=next;
        if(new Set(next).size===3){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId), c=points.find(x=>x.id===cId);
          setAngles(ag=>[...ag,{id:safeId(),a:a.id,b:b.id,c:c.id,deg:angleDeg(a,b,c)}]);
        }
        return [];
      }

      // tie (3D)
      if(mode==="tie" && next.length===2){
        const [aId,bId]=next; if(aId!==bId){
          const a=points.find(x=>x.id===aId), b=points.find(x=>x.id===bId);
          setTies(ts=>[...ts,{id:safeId(),p1:a.id,p2:b.id,len3d:dist3d(a,b)}]);
        }
        return [];
      }

      // circle (select center → input radius box)
      if(mode==="circle" && next.length===1){
        // store selection only, user will press "Add Circle" btn with radius
        return next;
      }

      // ref line
      if (mode === "refLine") {
        if (!refLine) {
          if (selected.length === 0) { return [pick.id]; }
          if (selected.length === 1) {
            const first = selected[0];
            if (first !== pick.id) setRefLine({ aId:first, bId:pick.id });
            return [];
          }
          return [pick.id];
        }
        // measure to third
        if (pick.id === refLine.aId || pick.id === refLine.bId) return [];
        const a=points.find(p=>p.id===refLine.aId);
        const b=points.find(p=>p.id===refLine.bId);
        const c=pick;
        if(a&&b&&c){
          const vx=b.x-a.x, vy=b.y-a.y;
          const abLen=Math.hypot(vx,vy)||1;
          const t=((c.x-a.x)*vx + (c.y-a.y)*vy)/(abLen*abLen);
          const px=a.x + t*vx, py=a.y + t*vy;
          const perp=Math.hypot(c.x-px, c.y-py);
          const crossZ = vx*(c.y-a.y) - vy*(c.x-a.x);
          const ESigned = (crossZ >= 0 ? -1 : 1) * perp; // sign rule
          const NSigned = t * abLen;

          setTempLine({ x1: c.x, y1: c.y, x2: px, y2: py });
          setMeasure({
            open: true,
            value: { E: `${ESigned.toFixed(2)} ${UNIT_LABEL}`, N: `${NSigned.toFixed(2)} ${UNIT_LABEL}`, fromLabel: a.label }
          });
        }
        return [];
      }

      return next;
    });
  };

  /* ---------- circle add (by center selection + radius input) ---------- */
  const addCircle = () => {
    if (mode !== "circle") return;
    if (selected.length !== 1) return;
    const centerId = selected[0];
    const r = Number(circleR);
    if (!isFinite(r) || r <= 0) return;
    setCircles(cs => [...cs, { id: safeId(), center: centerId, radius: r }]);
    setSelected([]); setCircleR("");
  };

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

  /* ---------- derived: H groups ---------- */
  const hGroups = (() => {
    const map = new Map(); // key by exact H string (or “(null)”)
    for (const p of points) {
      const key = (p.h===null || p.h===undefined) ? "(no H)" : String(p.h);
      const prev = map.get(key) || { level: key, count: 0, labels: [] };
      prev.count += 1; prev.labels.push(p.label);
      map.set(key, prev);
    }
    return Array.from(map.values());
  })();

  return {
    // state expose for Part 3:
    points, lines, angles, ties, circles, title, setTitle,
    E,N,H,setE,setN,setH, UNIT_LABEL,
    mode,setMode, selected, setSelected,
    refLine, clearRefLine,
    measure, setMeasure, tempLine, setTempLine, tempTimerRef,
    zoom,sval, MIN_S, MAX_S, onSliderChange,
    addPoint, addCircle, circleR,setCircleR,
    delTie, delLine, delAngle, delCircle,
    centerOnA, fitView, resetView, clearAll, removeLastLine, clearLines,
    nextLabel,
    wrapRef, canvasRef, onPointerDown, onPointerMove, onPointerUp,
    hGroups,
    lineName,
    saveToFirebase,
  };
                                                      }
// src/pages/Drawing2D.jsx (Part 3/3)
export function PageShell({ children }) {
  return (
    <div className="grid" style={{ gap: 12 }}>
      {children}
    </div>
  );
}

export function SmallBtn({ active, onClick, children }) {
  return (
    <button
      className="btn"
      onClick={onClick}
      style={{
        background: active ? "#0ea5e9" : "#64748b",
        padding: "6px 10px",
        fontSize: 12,
        borderRadius: 10,
      }}
    >
      {children}
    </button>
  );
}

export function Table({ head, rows }) {
  const th = { textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" };
  const td = { padding:"6px 8px", borderBottom:"1px solid #eef2f7", fontSize:13 };
  return (
    <div className="card" style={{ padding: 8 }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>{head.map((h,i)=><th key={i} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td style={{...td, color:"#94a3b8"}} colSpan={head.length}>No data</td></tr>
          ) : rows.map((cells,ri)=>(
            <tr key={ri}>
              {cells.map((cell,ci)=><td key={ci} style={td}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Drawing2DPage() {
  const st = Drawing2D();
  const {
    points, lines, angles, ties, circles, title, setTitle,
    E,N,H,setE,setN,setH, UNIT_LABEL,
    mode,setMode, selected, setSelected,
    refLine, clearRefLine,
    measure, setMeasure, tempLine, setTempLine, tempTimerRef,
    zoom,sval, MIN_S, MAX_S, onSliderChange,
    addPoint, addCircle, circleR,setCircleR,
    delTie, delLine, delAngle, delCircle,
    centerOnA, fitView, resetView, clearAll, removeLastLine, clearLines,
    nextLabel, wrapRef, canvasRef, onPointerDown, onPointerMove, onPointerUp,
    hGroups, lineName, saveToFirebase,
  } = st;

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
                Along Ref from <b>{typeof measure.value==="object" ? (measure.value.fromLabel || "first") : "first"}</b> (N)
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
                // OK နှိပ်ပြီး 3s နောက် အနီ dashed လိုင်း ပျောက်
                tempTimerRef.current=setTimeout(()=>setTempLine(null),3000);
              }}
              style={{ background:"#0ea5e9" }}
            >
              OK
            </button>
          </div>
        )}

        {/* Scale slider */}
        <div style={{ marginTop: 8 }}>
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
        </div>
      </div>

      {/* Controls: compact two rows */}
      <div className="card" style={{ padding: 8 }}>
        {/* Row 1: title + save */}
        <div className="row" style={{ gap:8, marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Title (e.g. P83 pipe)"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            style={{ flex:"1 1 220px" }}
          />
          <button className="btn" onClick={saveToFirebase}>Save</button>
        </div>

        {/* Row 2: point input */}
        <div className="row" style={{ gap:8, marginBottom: 8 }}>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`E (${UNIT_LABEL})`} value={E} onChange={(e)=>setE(e.target.value)} style={{ width:100 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`N (${UNIT_LABEL})`} value={N} onChange={(e)=>setN(e.target.value)} style={{ width:100 }}/>
          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder={`H (${UNIT_LABEL})`} value={H} onChange={(e)=>setH(e.target.value)} style={{ width:100 }}/>
          <button className="btn" onClick={addPoint}>Add (label {nextLabel()})</button>
        </div>

        {/* Row 3: tools — compact */}
        <div className="row" style={{ gap:6, flexWrap:"wrap" }}>
          <SmallBtn active={mode==="line"} onClick={()=>{ setMode("line"); setSelected([]); }}>Line</SmallBtn>
          <SmallBtn active={mode==="refLine"} onClick={()=>{ setMode("refLine"); setSelected([]); }}>Ref line</SmallBtn>
          <SmallBtn active={mode==="angle"} onClick={()=>{ setMode("angle"); setSelected([]); }}>Angle</SmallBtn>
          <SmallBtn active={mode==="tie"} onClick={()=>{ setMode("tie"); setSelected([]); }}>Tie line (3D)</SmallBtn>
          <SmallBtn active={mode==="circle"} onClick={()=>{ setMode("circle"); setSelected([]); }}>Circle</SmallBtn>
          <SmallBtn active={mode==="eraseLine"} onClick={()=>{ setMode("eraseLine"); setSelected([]); }}>Erase line(tap)</SmallBtn>

          <SmallBtn onClick={centerOnA}>Find A</SmallBtn>
          <SmallBtn onClick={removeLastLine}>Remove last line</SmallBtn>
          <SmallBtn onClick={clearLines}>Clear lines</SmallBtn>
          <SmallBtn onClick={clearAll}>Clear All</SmallBtn>
          <SmallBtn onClick={fitView}>Fit</SmallBtn>
          <SmallBtn onClick={resetView}>Reset</SmallBtn>

          {refLine && (
            <span className="small" style={{ background:"#e2e8f0", color:"#0f172a", borderRadius:12, padding:"2px 8px", marginLeft:6 }}>
              Ref: {
                (()=>{const a=points.find(p=>p.id===refLine.aId)?.label||"?";
                      const b=points.find(p=>p.id===refLine.bId)?.label||"?"; return `${a}–${b}`;})()
              }
            </span>
          )}
          {refLine && (
            <SmallBtn onClick={clearRefLine}>Clear Ref</SmallBtn>
          )}
        </div>

        {/* Row 4: circle radius (only when circle mode) */}
        {mode==="circle" && (
          <div className="row" style={{ gap:8, marginTop:8 }}>
            <span className="small">Select center point, then set radius:</span>
            <input className="input" type="number" inputMode="decimal" step="any"
                   placeholder={`Radius (${UNIT_LABEL})`} value={circleR} onChange={(e)=>setCircleR(e.target.value)} style={{ width:140 }}/>
            <button className="btn" onClick={addCircle} disabled={selected.length!==1 || !circleR}>Add Circle</button>
          </div>
        )}

        {/* Auto fit toggle */}
        <label className="row" style={{ gap:8, marginTop:6 }}>
          <input type="checkbox" checked={autoFit} onChange={(e)=>st.setMeasure && st.setMeasure ? null : null} onChangeCapture={(e)=>st.setMeasure && st.setMeasure ? null : null}/>
          <input type="checkbox" checked={true} onChange={(e)=>{}} style={{ display:"none" }}/>
          <span className="small">Auto fit (on points change)</span>
        </label>
      </div>

      {/* Lists */}
      <Table
        head={["#","Line","Len (2D)","Delete"]}
        rows={lines.map((l,i)=>[
          i+1,
          lineName(points, l.p1, l.p2),
          `${Math.round(l.len2d)} ${UNIT_LABEL}`,
          <button className="btn" style={{background:"#ef4444"}} onClick={()=>delLine(l.id)}>Delete</button>
        ])}
      />

      <Table
        head={["#","Tie (3D)","Len (3D)","Delete"]}
        rows={ties.map((t,i)=>{
          const nm = lineName(points, t.p1, t.p2);
          return [
            i+1,
            nm,
            `${t.len3d.toFixed(2)} ${UNIT_LABEL}`,
            <button className="btn" style={{background:"#ef4444"}} onClick={()=>delTie(t.id)}>Delete</button>
          ];
        })}
      />

      <Table
        head={["#","Angle (at B)","Degree","Delete"]}
        rows={angles.map((a,i)=>[
          i+1,
          `${points.find(p=>p.id===a.a)?.label || "?"}–${points.find(p=>p.id===a.b)?.label || "?"}–${points.find(p=>p.id===a.c)?.label || "?"}`,
          `${a.deg}°`,
          <button className="btn" style={{background:"#ef4444"}} onClick={()=>delAngle(a.id)}>Delete</button>
        ])}
      />

      <Table
        head={["#","Circle (center)","Radius","Delete"]}
        rows={circles.map((c,i)=>[
          i+1,
          points.find(p=>p.id===c.center)?.label || "?",
          `${c.radius} ${UNIT_LABEL}`,
          <button className="btn" style={{background:"#ef4444"}} onClick={()=>delCircle(c.id)}>Delete</button>
        ])}
      />

      <Table
        head={["#","Point","E","N","H"]}
        rows={points.map((p,i)=>[
          i+1,
          p.label,
          p.x,
          p.y,
          (p.h===null||p.h===undefined) ? "" : p.h
        ])}
      />

      <Table
        head={["#","H Level","Count","Labels"]}
        rows={hGroups.map((g,i)=>[
          i+1,
          g.level,
          g.count,
          g.labels.join(", ")
        ])}
      />
    </PageShell>
  );
        }
