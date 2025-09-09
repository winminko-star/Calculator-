// src/pages/PipeTeeTemplates.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/* ========================= Math helpers ========================= */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const add = (a,b)=>[a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub = (a,b)=>[a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mul = (a,s)=>[a[0]*s, a[1]*s, a[2]*s];
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b)=>[ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ];
const norm = (a)=>Math.hypot(a[0],a[1],a[2]) || 1;
const unit = (a)=>{ const n=norm(a); return [a[0]/n, a[1]/n, a[2]/n]; };

function basisFor(d) {
  const k = [0,0,1];
  let e1 = cross(d, k);
  if (norm(e1) < 1e-8) e1 = cross(d, [1,0,0]); // parallel fallback
  e1 = unit(e1);
  const e2 = cross(d, e1);
  return { e1, e2 };
}

/** Solve intersection curve of two cylinders:
 * RUN axis = +Z, radius Rr; BRANCH axis unit 'd' (pitch/yaw), radius Rb
 * Returns:
 *  - run:   {u, v, deg} with u along RUN circumference (mm), v = height mm (shifted so min=0)
 *  - branch:{u, v, deg} with u along BRANCH circumference (mm), v = height mm (shifted so min=0)
 */
function solveTee({ runOD, branchOD, pitchDeg, yawDeg, stepFineDeg=1, seamStepDeg=30 }) {
  const Rr = Math.max(0.1, runOD/2);
  const Rb = Math.max(0.1, branchOD/2);
  const k = [0,0,1];

  // branch axis direction from pitch/yaw
  const pitch = (pitchDeg||0) * RAD;     // 0 => parallel to RUN; 90 => perpendicular
  const yaw   = (yawDeg||0)   * RAD;     // rotate around RUN axis
  const inPlane = [Math.cos(yaw), Math.sin(yaw), 0];
  const d = unit( add( mul(inPlane, Math.sin(pitch)), mul(k, Math.cos(pitch)) ) ); // axis

  const { e1, e2 } = basisFor(d);
  const run = [];
  const branch = [];

  // sample 0..360° on RUN
  for (let a=0; a<=360+1e-6; a+=stepFineDeg) {
    const φ = a*RAD;
    const p0 = [Rr*Math.cos(φ), Rr*Math.sin(φ), 0]; // point on RUN skin

    // Quadratic for z, so that distance to BRANCH axis equals Rb
    const alpha = dot(d,k);                 // d·k
    const B = sub(p0, mul(d, dot(d, p0))); // p0 - d(d·p0)
    const A = sub(k,  mul(d, alpha));      // k - d(d·k)
    const qa = dot(A,A);
    const qb = 2*dot(A,B);
    const qc = dot(B,B) - Rb*Rb;
    const disc = qb*qb - 4*qa*qc;
    if (disc < 0) { run.push(null); branch.push(null); continue; }

    const z1 = (-qb - Math.sqrt(disc)) / (2*qa);
    const z2 = (-qb + Math.sqrt(disc)) / (2*qa);
    const z  = Math.abs(z1) < Math.abs(z2) ? z1 : z2; // nearer physical

    const p = add(p0, mul(k, z));          // world point on curve

    // unwrap on RUN
    const uRun = Math.PI*runOD * (a/180);  // 0..C
    run.push({ u:uRun, v:z, deg:a });

    // unwrap on BRANCH
    const s = dot(p, d);                   // axial distance along branch
    const q = sub(p, mul(d, s));           // radial vector in branch X-section
    const phi = Math.atan2(dot(q, e2), dot(q, e1));
    const phi01 = phi < 0 ? phi + 2*Math.PI : phi;
    const uBr = Math.PI*branchOD * (phi01/Math.PI/2); // 0..C
    branch.push({ u:uBr, v:s, deg:a });
  }

  // baseline shift → min(v) = 0 for both
  const shiftRun = Math.min(...run.filter(Boolean).map(p=>p.v));
  const shiftBr  = Math.min(...branch.filter(Boolean).map(p=>p.v));
  const runS = run.map(p=>p ? ({...p, v:p.v - shiftRun}) : null);
  const brS  = branch.map(p=>p ? ({...p, v:p.v - shiftBr}) : null);

  // stations every seamStepDeg on RUN angle (deg)
  const Crun = Math.PI*runOD;
  const Cbr  = Math.PI*branchOD;
  const stations = [];
  for (let a=0; a<=360; a+=seamStepDeg) {
    const uR = Crun * (a/360);
    // nearest samples
    const pr = nearestByU(runS, uR);
    // For BRANCH, take the point on curve having same original angle 'deg'
    const pb = nearestByDeg(brS, a);
    stations.push({
      deg: a,
      uRun: Math.round(uR),
      vRun: pr ? Math.round(pr.v) : null,
      uBranch: pb ? Math.round(pb.u) : null,
      vBranch: pb ? Math.round(pb.v) : null
    });
  }

  return { run: runS, branch: brS, stations, Crun, Cbr };
}

function nearestByU(arr, u) {
  let best=null, bd=1e9;
  for (const p of arr) { if (!p) continue; const d=Math.abs(p.u-u); if (d<bd){bd=d;best=p;} }
  return best;
}
function nearestByDeg(arr, a) {
  let best=null, bd=1e9;
  for (const p of arr) { if (!p) continue; const d=Math.abs(p.deg-a); if (d<bd){bd=d;best=p;} }
  return best;
}

/* ========================= Canvas drawer ========================= */
function drawUV(canvas, pts, title, Cmm, stations) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W*dpr);
  canvas.height = Math.floor(H*dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  const valid = (pts||[]).filter(Boolean);
  if (!valid.length) {
    ctx.fillStyle="#64748b"; ctx.font="14px system-ui";
    ctx.fillText("No domain", 12, 20); return;
  }
  const pad = 18;
  const minU = 0, maxU = Math.max(1, Cmm||1);
  let minV = Math.min(...valid.map(p=>p.v));
  let maxV = Math.max(...valid.map(p=>p.v));
  const vr = Math.max(2, 0.06*(maxV-minV||1));
  minV -= vr; maxV += vr;

  const X = u => pad + (u-minU)*(W-2*pad)/Math.max(1e-6,(maxU-minU));
  const Y = v => H-pad - (v-minV)*(H-2*pad)/Math.max(1e-6,(maxV-minV));

  // grid each 30°
  const stepU = (Cmm||0)/12;
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for (let u=minU; u<=maxU+1e-6; u+=stepU) { ctx.beginPath(); ctx.moveTo(X(u), pad); ctx.lineTo(X(u), H-pad); ctx.stroke(); }
  // border
  ctx.strokeStyle="#94a3b8"; ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);

  // title
  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui"; ctx.fillText(title||"", pad, pad-4);

  // curve
  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5;
  ctx.beginPath();
  let first=true;
  for (const p of pts){ if(!p){first=true; continue;} const x=X(p.u), y=Y(p.v); if(first){ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y); }
  ctx.stroke();

  // station labels — height(mm) near curve, u at bottom
  ctx.font="bold 12px system-ui"; ctx.textAlign="center";
  for (const st of stations||[]) {
    const x = X(st.uRun ?? st.uBranch ?? 0);
    // u along baseline
    ctx.fillStyle="#0f172a";
    ctx.fillText(String(st.uRun ?? st.uBranch ?? 0), x, H-pad+14);
    // near-curve pill (choose v for this canvas)
    const v = title?.includes("BRANCH") ? st.vBranch : st.vRun;
    if (v==null) continue;
    const y = Y(v) - 8;
    const text = String(v);
    const tw = Math.ceil(ctx.measureText(text).width)+8, th=18, r=8, rx=x-tw/2, ry=y-th+4;
    ctx.fillStyle="rgba(255,255,255,0.9)";
    ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(rx+r,ry); ctx.lineTo(rx+tw-r,ry);
    ctx.quadraticCurveTo(rx+tw,ry,rx+tw,ry+r);
    ctx.lineTo(rx+tw,ry+th-r); ctx.quadraticCurveTo(rx+tw,ry+th,rx+tw-r,ry+th);
    ctx.lineTo(rx+r,ry+th); ctx.quadraticCurveTo(rx,ry+th,rx,ry+th-r);
    ctx.lineTo(rx,ry+r); ctx.quadraticCurveTo(rx,ry,rx+r,ry); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle="#0f172a"; ctx.fillText(text, x, y);
  }

  // baseline
  ctx.strokeStyle="#94a3b8";
  ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();
}

/* ========================= UI Page ========================= */
export default function PipeTeeTemplates() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState(60);      // mm
  const [branchOD, setBranchOD] = useState(60);
  const [pitchDeg, setPitchDeg] = useState(90); // 90 = Tee
  const [yawDeg, setYawDeg] = useState(0);
  const [stepDeg, setStepDeg] = useState(30);

  const cRun = useRef(null);
  const cBr  = useRef(null);

  const result = useMemo(()=>solveTee({
    runOD: Number(runOD)||0,
    branchOD: Number(branchOD)||0,
    pitchDeg: Number(pitchDeg)||0,
    yawDeg: Number(yawDeg)||0,
    stepFineDeg: 1,
    seamStepDeg: Number(stepDeg)||30
  }), [runOD, branchOD, pitchDeg, yawDeg, stepDeg]);

  useEffect(()=>{
    drawUV(cRun.current, result.run, "Run-hole stencil (wrap on RUN)", result.Crun, result.stations);
    drawUV(cBr.current,  result.branch, "Branch-cut stencil (wrap on BRANCH)", result.Cbr, result.stations);
  }, [result]);

  const clear = () => {
    setTitle(""); setRunOD(""); setBranchOD(""); setPitchDeg(""); setYawDeg(""); setStepDeg(30);
  };

  const save = async () => {
    const now = Date.now();
    const data = {
      title: title || "Untitled tee",
      createdAt: now,
      expiresAt: now + 90*24*60*60*1000,
      inputs: { runOD:Number(runOD), branchOD:Number(branchOD), pitchDeg:Number(pitchDeg), yawDeg:Number(yawDeg), stepDeg:Number(stepDeg) },
      run: result.run,
      branch: result.branch,
      stations: result.stations,
      meta: { runC: result.Crun, branchC: result.Cbr }
    };
    await dbSet(push(dbRef(db, "teeTemplates")), data);
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />

        <div className="row" style={{marginTop:8}}>
          <input className="input" type="number" inputMode="decimal" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Branch OD (mm)" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
        </div>
        <div className="row" style={{marginTop:8}}>
          <input className="input" type="number" inputMode="decimal" placeholder="Pitch (°)" value={pitchDeg} onChange={e=>setPitchDeg(e.target.value)} />
          <input className="input" type="number" inputMode="decimal" placeholder="Yaw (°)" value={yawDeg} onChange={e=>setYawDeg(e.target.value)} />
        </div>
        <div className="row" style={{marginTop:8}}>
          <input className="input" type="number" inputMode="decimal" placeholder="Station step (°)" value={stepDeg} onChange={e=>setStepDeg(e.target.value)} />
        </div>

        <div className="row" style={{marginTop:10}}>
          <button className="btn" onClick={()=>{ /* nothing to compute: useMemo updates */ }}>↻ Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clear} style={{background:"#6b7280"}}>🧹 Clear</button>
        </div>

        <div className="small" style={{marginTop:8, lineHeight:1.4}}>
          • စက္ကူ/တိရိပ်ကို pipe ပေါ် 360° ပတ်ပြီး **0° seam** ကို တိုက်စေပါ — အောက်ကပြထားတဲ့ degree အလိုက် pill အညွှန်း (integer mm) တွေကို မှတ်ရင်လုံလောက်ပါတယ်။<br/>
          • Run-hole stencil ကို <b>RUN</b> ပတ်ပြီး — အပေါက် outline.  Branch-cut stencil ကို <b>BRANCH</b> ပတ်ပြီး — fish-mouth cut outline.
        </div>
      </div>

      {/* canvases */}
      <div className="card">
        <canvas ref={cRun} style={{width:"100%", height:260, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff"}} />
      </div>
      <div className="card">
        <canvas ref={cBr} style={{width:"100%", height:260, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff"}} />
      </div>

      {/* station table */}
      <div className="card">
        <div className="page-title">Stations (every {stepDeg}°)</div>
        <div className="small">Numbers are millimetres (no units printed).</div>
        <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead>
              <tr>
                <th>Deg</th>
                <th>Run u</th><th>Run height</th>
                <th>Branch u</th><th>Branch height</th>
              </tr>
            </thead>
            <tbody>
              {result.stations.map((s,i)=>(
                <tr key={i}>
                  <td>{s.deg}</td>
                  <td>{s.uRun}</td><td>{s.vRun ?? "-"}</td>
                  <td>{s.uBranch ?? "-"}</td><td>{s.vBranch ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="small" style={{marginTop:8}}>
          Dimensions — Run C ≈ <b>{(result.Crun||0).toFixed(2)}</b> mm · Branch C ≈ <b>{(result.Cbr||0).toFixed(2)}</b> mm · Tilts → Pitch {pitchDeg}°, Yaw {yawDeg}°, Step {stepDeg}°
        </div>
      </div>
    </div>
  );
                    }
