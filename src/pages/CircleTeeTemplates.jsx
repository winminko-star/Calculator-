import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const wrap01 = (a) => { const t = a % (2*Math.PI); return t < 0 ? t + 2*Math.PI : t; };

/* ===== Axis rotations (yaw→about X, pitch→about Y) ===== */
function axisVector(pitchDeg, yawDeg) {
  const p = rad(pitchDeg), y = rad(yawDeg);
  // v = Ry(pitch) * Rx(yaw) * [0,0,1]
  const vx = Math.sin(p) * Math.cos(y);
  const vy = -Math.sin(y);
  const vz = Math.cos(p) * Math.cos(y);
  const m = Math.hypot(vx, vy, vz) || 1;
  return { x: vx/m, y: vy/m, z: vz/m };
}

/* ===== Quadratic on run: |P×v| = Rb  →  (1-A^2)x^2 -2ARrD x + (Rr^2(1-D^2)-Rb^2)=0 ===== */
function solveRunX(Rr, Rb, v, th) {
  const A = v.x, B = v.y, C = v.z;
  const D = B * Math.sin(th) + C * Math.cos(th);

  const k1 = 1 - A*A;
  const k2 = -2 * A * Rr * D;
  const k3 = Rr*Rr * (1 - D*D) - Rb*Rb;

  // Degenerate: axis ~ parallel to run axis → k1≈0
  if (Math.abs(k1) < 1e-9) return null;

  const disc = k2*k2 - 4*k1*k3;
  if (disc < -1e-9) return null;
  const s = Math.sqrt(Math.max(0, disc));

  const x1 = (-k2 + s) / (2*k1);
  const x2 = (-k2 - s) / (2*k1);

  // template uses the boundary closer to center plane → choose min |x|
  const pick = (Math.abs(x1) <= Math.abs(x2)) ? x1 : x2;
  return pick;
}

/* ===== Build curves ===== */
function makeRunStencil(Rr, Rb, pitch, yaw, samples) {
  const v = axisVector(pitch, yaw);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const th = (i / samples) * 2 * Math.PI;
    const x = solveRunX(Rr, Rb, v, th);
    if (x == null) { pts.push(null); continue; }
    const u = Rr * th;      // unwrap along run circumference
    const h = Math.abs(x);  // axial distance as positive height
    pts.push({ u, v: h, th, x, _v: v }); // keep extras for branch mapping
  }
  return pts;
}

function orthoBasis(v) {
  // e1 = normalize(v × ref); use X-axis by default, else Y
  let cx = v.y*0 - v.z*0, cy = v.z*1 - v.x*0, cz = v.x*0 - v.y*1; // v × [1,0,0] = [0, vz, -vy]
  cx = 0; cy = v.z; cz = -v.y;
  let m = Math.hypot(cx, cy, cz);
  if (m < 1e-6) { // v ~ X-axis → use [0,1,0]
    cx = -v.z; cy = 0; cz = v.x; // v × [0,1,0] = [vz,0,-vx] (then swap sign to keep orientation)
    m = Math.hypot(cx, cy, cz);
  }
  const e1 = { x: cx/m, y: cy/m, z: cz/m };
  const e2 = { // e2 = v × e1
    x: v.y*e1.z - v.z*e1.y,
    y: v.z*e1.x - v.x*e1.z,
    z: v.x*e1.y - v.y*e1.x
  };
  return { e1, e2 };
}

function makeBranchStencilFromRun(runPts, Rr, Rb, pitch, yaw) {
  const v = axisVector(pitch, yaw);
  const { e1, e2 } = orthoBasis(v);
  const pts = [];
  for (const pr of runPts) {
    if (!pr) { pts.push(null); continue; }
    // 3D point on run surface
    const th = pr.th;
    const P = { x: pr.x, y: Rr*Math.sin(th), z: Rr*Math.cos(th) };
    // projection to branch axis
    const t = P.x*v.x + P.y*v.y + P.z*v.z;                 // distance along branch axis
    const W = { x: P.x - t*v.x, y: P.y - t*v.y, z: P.z - t*v.z }; // perpendicular foot
    const a = W.x*e1.x + W.y*e1.y + W.z*e1.z;
    const b = W.x*e2.x + W.y*e2.y + W.z*e2.z;
    const phi = wrap01(Math.atan2(b, a));                  // 0..2π
    const ub = Rb * phi;
    const vb = Math.abs(t);
    pts.push({ u: ub, v: vb });
  }
  return pts;
}

/* ===== Drawer ===== */
function drawUnwrap(canvas, pts, stations, title, OD) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640, H = canvas.clientHeight || 220;
  canvas.width = Math.floor(W*dpr); canvas.height = Math.floor(H*dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H); ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  if (!pts?.length) { ctx.fillStyle="#64748b"; ctx.fillText("No data",12,22); return; }

  const pad = 18, Umax = 2*Math.PI*(OD/2);
  let minV=Infinity, maxV=-Infinity;
  pts.forEach(p=>{ if(p){minV=Math.min(minV,p.v); maxV=Math.max(maxV,p.v);} });
  if (!isFinite(minV)) { ctx.fillStyle="#64748b"; ctx.fillText("No domain",12,22); return; }
  const head = Math.max(2, 0.06*(maxV-minV||1)); minV-=head; maxV+=head;

  const X = (u)=> pad + (u)*(W-2*pad)/Math.max(1e-6,Umax);
  const Y = (v)=> H-pad - (v-minV)*(H-2*pad)/Math.max(1e-6,(maxV-minV));

  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  const stepU = Umax/12;
  for (let u=0; u<=Umax+1e-6; u+=stepU) { ctx.beginPath(); ctx.moveTo(X(u),pad); ctx.lineTo(X(u),H-pad); ctx.stroke(); }
  ctx.strokeStyle="#94a3b8"; ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);

  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui"; ctx.fillText(title, pad, pad-4);

  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5; ctx.beginPath();
  let first=true;
  pts.forEach(p=>{ if(!p){first=true;return;} const x=X(p.u), y=Y(p.v); if(first){ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y); });
  ctx.stroke();

  ctx.strokeStyle="#94a3b8"; ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();

  // stations
  ctx.textAlign="center"; ctx.font="bold 12px system-ui";
  (stations||[]).forEach(s=>{
    const u = clamp(s.u,0,Umax), v = s.v;
    const x = X(u); ctx.fillStyle="#0f172a"; ctx.fillText(String(Math.round(u)), x, H-pad+14);
    if (v!=null) {
      const y = Y(v)-8, text = String(Math.round(v));
      const tw = Math.ceil(ctx.measureText(text).width)+8, th=18, r=8, rx=x-tw/2, ry=y-th+4;
      ctx.fillStyle="rgba(255,255,255,0.92)"; ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(rx+r,ry); ctx.lineTo(rx+tw-r,ry); ctx.quadraticCurveTo(rx+tw,ry,rx+tw,ry+r);
      ctx.lineTo(rx+tw,ry+th-r); ctx.quadraticCurveTo(rx+tw,ry+th,rx+tw-r,ry+th);
      ctx.lineTo(rx+r,ry+th); ctx.quadraticCurveTo(rx,ry+th,rx,ry+th-r);
      ctx.lineTo(rx,ry+r); ctx.quadraticCurveTo(rx,ry,rx+r,ry); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#0f172a"; ctx.fillText(text, x, y);
    }
  });
}

/* ===== Page ===== */
export default function CircleTee() {
  const [title, setTitle]   = useState("");
  const [runOD, setRunOD]   = useState("200");
  const [brOD, setBrOD]     = useState("50");
  const [stepDeg, setStep]  = useState("30");     // station spacing
  const [samples, setSmp]   = useState("360");    // curve smoothness

  // NEW — tilts (deg)
  const [degRun, setDegRun] = useState("0");      // pitch
  const [degSide, setDegSide]=useState("0");      // yaw

  const Rr = clamp(Number(runOD)/2||0,0,1e9);
  const Rb = clamp(Number(brOD)/2||0,0,1e9);
  const N  = clamp(Math.floor(Number(samples)||0), 60, 1080);
  const STEP = clamp(Math.floor(Number(stepDeg)||0), 5, 90);
  const pitch = Number(degRun)||0, yaw = Number(degSide)||0;

  const runPts = useMemo(()=>makeRunStencil(Rr,Rb,pitch,yaw,N),[Rr,Rb,pitch,yaw,N]);
  const brPts  = useMemo(()=>makeBranchStencilFromRun(runPts,Rr,Rb,pitch,yaw),[runPts,Rr,Rb,pitch,yaw]);

  const stationsRun = useMemo(()=>{
    const Cr = 2*Math.PI*Rr; const v = axisVector(pitch,yaw);
    const arr=[]; for(let d=0; d<=360; d+=STEP){ const th=rad(d);
      const x = solveRunX(Rr,Rb,v,th); if (x==null){arr.push({u: (d/360)*Cr, v:null}); continue;}
      arr.push({ u:(d/360)*Cr, v:Math.abs(x) });
    } return arr;
  },[Rr,Rb,pitch,yaw,STEP]);

  const stationsBr = useMemo(()=>{
    const Cb=2*Math.PI*Rb;
    // branch stations use φ=d directly (simple, for labels)
    const arr=[]; for(let d=0; d<=360; d+=STEP){
      // find matching index in runPts (approx)
      const idx = Math.round((d/360)*(runPts.length-1));
      const pr = runPts[idx]; if(!pr){ arr.push({u:(d/360)*Cb, v:null}); continue; }
      const pb = brPts[idx];  if(!pb){ arr.push({u:(d/360)*Cb, v:null}); continue; }
      arr.push({ u: pb.u, v: pb.v });
    } return arr;
  },[Rb,STEP,runPts,brPts]);

  const cRun = useRef(null);
  const cBr  = useRef(null);

  useEffect(()=>{ drawUnwrap(cRun.current, runPts, stationsRun, "Run hole stencil (cut-out)", Number(runOD)); },[runPts, stationsRun, runOD]);
  useEffect(()=>{ drawUnwrap(cBr.current,  brPts,  stationsBr,  "Branch cut stencil (wrap on branch)", Number(brOD)); },[brPts, stationsBr, brOD]);

  const clearAll = () => { setTitle(""); setRunOD(""); setBrOD(""); setStep("30"); setSmp("360"); setDegRun("0"); setDegSide("0"); };
  const saveToFirebase = async () => {
    const now = Date.now();
    await dbSet(push(dbRef(db,"teeTemplates")), {
      title: title || "Untitled",
      createdAt: now, expiresAt: now + 90*24*60*60*1000,
      inputs: { runOD:Number(runOD)||0, branchOD:Number(brOD)||0, stepDeg:STEP, samples:N, pitch: pitch, yaw: yaw },
      run: runPts.map(p=>p&&({u:p.u,v:p.v})),
      branch: brPts.map(p=>p&&({u:p.u,v:p.v})),
      stations: { run: stationsRun, branch: stationsBr }
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card" style={{ display:"grid", gap:10 }}>
        <div className="page-title">🧩 Pipe Tee Templates (with Pitch/Yaw)</div>

        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/>
        <input className="input" type="number" inputMode="numeric" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)}/>
        <input className="input" type="number" inputMode="numeric" placeholder="Branch OD (mm)" value={brOD} onChange={e=>setBrOD(e.target.value)}/>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <input className="input" type="number" inputMode="numeric" placeholder="Pitch (deg run)" value={degRun} onChange={e=>setDegRun(e.target.value)} style={{flex:"1 1 140px"}}/>
          <input className="input" type="number" inputMode="numeric" placeholder="Yaw (deg side)"  value={degSide} onChange={e=>setDegSide(e.target.value)} style={{flex:"1 1 140px"}}/>
        </div>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <input className="input" type="number" inputMode="numeric" placeholder="Station step (deg)" value={stepDeg} onChange={e=>setStep(e.target.value)} style={{flex:"1 1 140px"}}/>
          <input className="input" type="number" inputMode="numeric" placeholder="Samples" value={samples} onChange={e=>setSmp(e.target.value)} style={{flex:"1 1 140px"}}/>
        </div>

        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn">⟳ Update</button>
          <button className="btn" onClick={saveToFirebase}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background:"#64748b" }}>🧹 Clear</button>
        </div>
      </div>

      <div className="card" style={{ display:"grid", gap:10 }}>
        <canvas ref={cRun} style={{ width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }}/>
        <canvas ref={cBr}  style={{ width:"100%", height:220, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" }}/>
      </div>

      <div className="card small">
        <div className="page-title">Dimensions (quick check)</div>
        <div>
          Run C ≈ <b>{(2*Math.PI*Rr).toFixed(2)}</b> mm · Branch C ≈ <b>{(2*Math.PI*Rb).toFixed(2)}</b> mm ·
          Pitch <b>{pitch}°</b> · Yaw <b>{yaw}°</b> · Step <b>{STEP}°</b>
        </div>
        <div style={{ marginTop:6, color:"#334155" }}>
          0°→360° ကို station step နဲ့ အောက်တန်း u(mm) သတ်မှတ်ပြီး၊ pill label v(mm) ကို တိုင်းရိုက်ကူးရေး—Run stencil ကို run pipe ပေါ်၊ Branch stencil ကို branch pipe ပေါ် **ပတ်ပြီး ကပ်ကာ** curve ယူပါ။ Pitch/Yaw သည့် အနေအထားပြောင်းတွေ လိုက်ပြီး waveform က အလိုလိုပြောင်းသွားပါလိမ့်မယ်။
        </div>
      </div>
    </div>
  );
    }
