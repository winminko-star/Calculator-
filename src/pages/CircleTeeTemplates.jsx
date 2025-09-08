import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/**
 * Tee wrap templates with general orientation (Pitch + Yaw).
 * - Run axis = world Z.
 * - Branch axis = rotate default X-axis by:
 *      1) pitch (around Y)  -> tilt along run axis plane
 *      2) yaw   (around Z)  -> tilt sideways around run axis
 * - Axes intersect at origin. Radii in mm.
 * - We unwrap each cylinder's surface:
 *      u = radius * angle  (wrap distance along circumference)
 *      v = axial coordinate along that pipe (mm)
 * - We draw:
 *      • Run hole template  (unwrap of run)
 *      • Branch cut template (unwrap of branch end)
 *   With 30° stations: bottom shows u (number only), near-curve shows v (number only).
 */

const TAU = Math.PI * 2;
const toRad = (d) => (d * Math.PI) / 180;

// vector helpers
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a,b) => [ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ];
const norm = (a) => { const m=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/m,a[1]/m,a[2]/m]; };

// build branch axis unit vector u from pitch (around Y) then yaw (around Z)
function branchAxisFromPitchYaw(pitchDeg, yawDeg) {
  const p = toRad(pitchDeg); // rotate around Y
  const y = toRad(yawDeg);   // then around Z
  // start axis along +X
  let v = [1,0,0];
  // RotY(p)
  v = [ v[0]*Math.cos(p) + v[2]*Math.sin(p), v[1], -v[0]*Math.sin(p) + v[2]*Math.cos(p) ];
  // RotZ(y)
  v = [ v[0]*Math.cos(y) - v[1]*Math.sin(y), v[0]*Math.sin(y) + v[1]*Math.cos(y), v[2] ];
  return norm(v);
}

// orthonormal basis (n1,n2) perpendicular to axis u
function basisPerp(u){
  const up = Math.abs(u[1])<0.9 ? [0,1,0] : [1,0,0];
  const n1 = norm(cross(u, up));
  const n2 = norm(cross(u, n1));
  return { n1, n2 };
}

// Solve quadratic a t^2 + b t + c = 0; return best root by selector
function solveQuad(a,b,c, pick = "larger"){ // pick: "larger" | "smaller" | "absMin"
  const eps = 1e-9;
  if (Math.abs(a) < eps) { // linear
    if (Math.abs(b) < eps) return null;
    return -c / b;
  }
  const D = b*b - 4*a*c;
  if (D < -1e-9) return null;
  const sD = Math.sqrt(Math.max(0,D));
  const r1 = (-b + sD)/(2*a);
  const r2 = (-b - sD)/(2*a);
  if (pick === "smaller") return (r1 < r2 ? r1 : r2);
  if (pick === "absMin")  return (Math.abs(r1) < Math.abs(r2) ? r1 : r2);
  return (r1 > r2 ? r1 : r2);
}

/**
 * Compute unwrap polylines:
 *  - Branch unwrap: loop angle a ∈ [0,2π), solve s along branch axis s.t. point hits RUN cylinder (x^2+y^2=Rr^2)
 *  - Run unwrap:    loop angle b ∈ [0,2π), solve t along run axis s.t. point hits BRANCH cylinder (distance^2 to branch axis = Rb^2)
 */
function computeTemplates(runOD, branchOD, pitch, yaw, samples=720) {
  const Rr = Math.max(1, +runOD/2);
  const Rb = Math.max(1, +branchOD/2);
  const u = branchAxisFromPitchYaw(pitch, yaw); // branch axis dir
  const { n1, n2 } = basisPerp(u);              // branch ring basis

  // Branch unwrap polyline: ptsB = {u: Rb*a, v: s}  where s solves x^2+y^2=Rr^2
  const ptsB = [];
  for (let i=0;i<=samples;i++){
    const a = (i/samples)*TAU;
    const q = [ Rb*Math.cos(a)*n1[0] + Rb*Math.sin(a)*n2[0],
                Rb*Math.cos(a)*n1[1] + Rb*Math.sin(a)*n2[1],
                Rb*Math.cos(a)*n1[2] + Rb*Math.sin(a)*n2[2] ];
    // point p = q + s*u
    // run cylinder eq: x^2 + y^2 = Rr^2
    const ux = u[0], uy = u[1];
    const qx = q[0], qy = q[1];
    const a2 = ux*ux + uy*uy;
    const b2 = 2*(ux*qx + uy*qy);
    const c2 = qx*qx + qy*qy - Rr*Rr;
    const sSol = solveQuad(a2, b2, c2, "larger"); // pick outer
    if (sSol == null) { ptsB.push(null); continue; }
    ptsB.push({ u: Rb*a, v: sSol });
  }

  // Run unwrap polyline: ptsR = {u: Rr*b, v: t}  where dist^2 to branch axis = Rb^2
  // Run param point: p = [Rr cos b, Rr sin b, t]
  const ptsR = [];
  for (let i=0;i<=samples;i++){
    const b = (i/samples)*TAU;
    const cx = Rr*Math.cos(b), cy = Rr*Math.sin(b);
    // distance^2 to branch axis for p is: |p|^2 - (u·p)^2 = Rb^2
    // p = (cx,cy,t): |p|^2 = cx^2 + cy^2 + t^2 = Rr^2 + t^2
    // u·p = ux*cx + uy*cy + uz*t = B + A t
    const A = u[2];
    const B = u[0]*cx + u[1]*cy;
    // (Rr^2 + t^2) - (B + A t)^2 = Rb^2
    // => (1 - A^2) t^2 - 2AB t + (Rr^2 - B^2 - Rb^2) = 0
    const qa = (1 - A*A);
    const qb = -2*A*B;
    const qc = (Rr*Rr - B*B - Rb*Rb);
    const tSol = solveQuad(qa,qb,qc,"larger");
    if (tSol == null) { ptsR.push(null); continue; }
    ptsR.push({ u: Rr*b, v: tSol });
  }

  // 30° stations
  const stations = [];
  for (let d=0; d<=360; d+=30){
    const a = toRad(d), b = a;
    // branch s
    {
      const q = [ Rb*Math.cos(a)*n1[0] + Rb*Math.sin(a)*n2[0],
                  Rb*Math.cos(a)*n1[1] + Rb*Math.sin(a)*n2[1],
                  Rb*Math.cos(a)*n1[2] + Rb*Math.sin(a)*n2[2] ];
      const ux=u[0], uy=u[1], qx=q[0], qy=q[1];
      const A=ux*ux+uy*uy, B=2*(ux*qx+uy*qy), C=qx*qx+qy*qy-Rr*Rr;
      const sSol = solveQuad(A,B,C,"larger");
      stations.push({
        deg:d,
        uBranch:+(Rb*a).toFixed(3),
        vBranch:sSol==null?null:+(+sSol).toFixed(3)
      });
    }
  }
  for (let d=0; d<=360; d+=30){
    const b = toRad(d);
    const cx = Rr*Math.cos(b), cy = Rr*Math.sin(b);
    const A = u[2], B = u[0]*cx + u[1]*cy;
    const qa = (1 - A*A), qb = -2*A*B, qc = (Rr*Rr - B*B - Rb*Rb);
    const tSol = solveQuad(qa,qb,qc,"larger");
    const st = stations[d/30];
    st.uRun = +(Rr*b).toFixed(3);
    st.vRun = tSol==null?null:+(+tSol).toFixed(3);
  }

  return { ptsB, ptsR, stations, Rr, Rb };
}

function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawTemplate(canvas, pts, title, R, stations, which){
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 280;
  canvas.width = Math.floor(W*dpr);
  canvas.height= Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);

  const pad=18;
  const minU=0, maxU=2*Math.PI*R;

  const valid = pts.filter(Boolean);
  if(!valid.length){
    ctx.fillStyle="#64748b"; ctx.font="14px system-ui";
    ctx.fillText("Out of domain for given inputs.", 12, 22);
    return;
  }

  let minV=Infinity, maxV=-Infinity;
  valid.forEach(p=>{ minV=Math.min(minV,p.v); maxV=Math.max(maxV,p.v); });
  const vPad=Math.max(2,0.06*Math.max(1,maxV-minV));
  minV-=vPad; maxV+=vPad;

  const X = (u)=> pad + (u-minU)*(W-2*pad)/(maxU-minU);
  const Y = (v)=> H - pad - (v-minV)*(H-2*pad)/(maxV-minV);

  // grid each 30°
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  const stepU = (2*Math.PI*R)/12;
  for(let u=minU; u<=maxU+1e-6; u+=stepU){
    ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H-pad); ctx.stroke();
  }
  // border
  ctx.strokeStyle="#94a3b8";
  ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);

  // title
  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui";
  ctx.fillText(title, pad, pad-4);

  // polyline
  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5;
  ctx.beginPath();
  let first=true;
  pts.forEach(p=>{
    if(!p){ first=true; return; }
    const x=X(p.u), y=Y(p.v);
    if(first){ ctx.moveTo(x,y); first=false; } else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // stations: bottom u + near-curve v (numbers only)
  ctx.font="bold 12px system-ui"; ctx.textAlign="center"; ctx.fillStyle="#0f172a";
  stations.forEach(st=>{
    const u = which==="run" ? st.uRun : st.uBranch;
    const v = which==="run" ? st.vRun : st.vBranch;
    if(u==null) return;
    const x=X(u);
    ctx.fillText(String(Math.round(u)), x, H - pad + 14);
    if(v!=null){
      const y=Y(v)-8, text=String(Math.round(v));
      const tw=Math.ceil(ctx.measureText(text).width)+8, th=18, r=8, rx=x-tw/2, ry=y-th+4;
      ctx.fillStyle="rgba(255,255,255,0.9)";
      ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
      roundedRect(ctx,rx,ry,tw,th,r); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#0f172a";
      ctx.fillText(text,x,y);
    }
  });

  // baseline
  ctx.strokeStyle="#94a3b8";
  ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
}

export default function CircleTeeTemplates(){
  const [title,setTitle] = useState("");
  const [runOD,setRunOD] = useState(200);
  const [brOD,setBrOD]  = useState(50);
  const [pitch,setPitch]= useState(0);  // deg: along-run tilt (0=perpendicular)
  const [yaw,setYaw]    = useState(0);  // deg: sideways tilt
  const [samples,setSamples]=useState(720);

  const cvRun = useRef(null);
  const cvBr  = useRef(null);
  const last  = useRef(null);

  const recompute = ()=>{
    const { ptsB, ptsR, stations, Rr, Rb } =
      computeTemplates(runOD, brOD, pitch, yaw, samples);
    last.current = { ptsB, ptsR, stations, Rr, Rb,
      inputs: { runOD, branchOD: brOD, pitch, yaw, samples, title } };
    requestAnimationFrame(()=>{
      drawTemplate(cvRun.current, ptsR, "Run hole template", Rr, stations, "run");
      drawTemplate(cvBr.current,  ptsB, "Branch cut template", Rb, stations, "branch");
    });
  };

  useEffect(()=>{ recompute(); /* eslint-disable-next-line */ },[]);
  useEffect(()=>{ recompute(); /* eslint-disable-next-line */ },[runOD,brOD,pitch,yaw,samples]);

  const onSave = async ()=>{
    const now = Date.now();
    const expiresAt = now + 90*24*60*60*1000;
    const data = last.current;
    if(!data){ alert("Nothing to save"); return; }
    await set(push(dbRef(db,"teeTemplates")), {
      type: "tee-template-orient-v1",
      createdAt: now, expiresAt,
      title: title || "Untitled",
      inputs: { runOD, branchOD: brOD, pitch, yaw, samples },
      run: data.ptsR, branch: data.ptsB, stations: data.stations
    });
    alert("Saved ✅");
  };

  const quick = (label)=>{
    if(label==="Perpendicular"){ setPitch(0); setYaw(0); }
    if(label==="Pitch 20°"){ setPitch(20); setYaw(0); }
    if(label==="Yaw 20°"){ setPitch(0); setYaw(20); }
    if(label==="Oblique 20°/15°"){ setPitch(20); setYaw(15); }
  };

  return (
    <div className="grid container">
      <div className="card">
        <div className="page-title">Pipe Tee — Wrap Templates (Pitch/Yaw)</div>
        <div className="row" style={{flexWrap:"wrap", gap:10}}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
          <div className="small">Run OD</div>
          <input className="input" type="number" inputMode="decimal" value={runOD} onChange={e=>setRunOD(+e.target.value||0)} />
          <div className="small">Branch OD</div>
          <input className="input" type="number" inputMode="decimal" value={brOD} onChange={e=>setBrOD(+e.target.value||0)} />

          <div className="small">Pitch (deg)</div>
          <input className="input" type="number" inputMode="decimal" value={pitch} onChange={e=>setPitch(+e.target.value||0)} />
          <div className="small">Yaw (deg)</div>
          <input className="input" type="number" inputMode="decimal" value={yaw} onChange={e=>setYaw(+e.target.value||0)} />

          <div className="small">Smooth</div>
          <input className="input" type="number" value={samples}
            onChange={e=>setSamples(Math.max(240, Math.min(2880, +e.target.value||720)))} />
          <button className="btn" onClick={()=>quick("Perpendicular")}>⊥</button>
          <button className="btn" onClick={()=>quick("Pitch 20°")}>Pitch 20°</button>
          <button className="btn" onClick={()=>quick("Yaw 20°")}>Yaw 20°</button>
          <button className="btn" onClick={()=>quick("Oblique 20°/15°")}>20°/15°</button>

          <button className="btn" onClick={recompute}>⟳ Update</button>
          <button className="btn" onClick={onSave}>💾 Save</button>
        </div>
      </div>

      <div className="card">
        <div className="page-title">Run hole template (wrap on run)</div>
        <canvas ref={cvRun} style={{width:"100%", height:280, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff"}}/>
      </div>

      <div className="card">
        <div className="page-title">Branch cut template (wrap on branch)</div>
        <canvas ref={cvBr} style={{width:"100%", height:280, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff"}}/>
      </div>
    </div>
  );
  }
