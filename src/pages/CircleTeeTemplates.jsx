// src/pages/PipeTeeStencils.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/* ---------------- math helpers ---------------- */
const RAD = Math.PI / 180;
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const norm = (a)=>Math.hypot(a[0],a[1],a[2]);
const unit = (a)=>{const n=norm(a)||1; return [a[0]/n,a[1]/n,a[2]/n];};
function basisFor(d){ // build orthonormal e1,e2 ⟂ d
  const tmp = Math.abs(d[2])<0.9 ? [0,0,1] : [1,0,0];
  let e1 = unit([ d[1]*tmp[2]-d[2]*tmp[1], d[2]*tmp[0]-d[0]*tmp[2], d[0]*tmp[1]-d[1]*tmp[0] ]); // cross(d,tmp)
  let e2 = [ d[1]*e1[2]-d[2]*e1[1], d[2]*e1[0]-d[0]*e1[2], d[0]*e1[1]-d[1]*e1[0] ];
  return { e1, e2 };
}
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------------- solver (clean envelope + unwrap) ---------------- */
function envelopeByDeg(arr){
  const out = new Array(361).fill(null);
  for(const p of arr){
    if(!p) continue;
    const d = Math.round(clamp(p.deg,0,360));
    if(!out[d] || p.v < out[d].v) out[d] = { v:p.v, deg:d, phi:p.phi??0 };
  }
  // fill gaps
  let last=null;
  for(let i=0;i<=360;i++){ if(!out[i]) out[i]=last; else last=out[i]; }
  for(let i=360;i>=0;i--){ if(!out[i]) out[i]=last; else last=out[i]; }
  return out;
}
function wrap01(x){ // normalize to [0,1)
  let r = x%1; if(r<0) r+=1; return r;
}

function solveTee({ runOD, branchOD, pitchDeg, yawDeg, stepFineDeg=1, seamStepDeg=30 }){
  const Rr = Math.max(0.1, runOD/2);
  const Rb = Math.max(0.1, branchOD/2);
  const k=[0,0,1];

  const pitch=(pitchDeg||0)*RAD;
  const yaw=(yawDeg||0)*RAD;
  const inPlane=[Math.cos(yaw), Math.sin(yaw), 0];
  const d=unit(add(mul(inPlane, Math.sin(pitch)), mul(k, Math.cos(pitch))));
  const {e1,e2}=basisFor(d);

  const rawRun=[], rawBr=[];
  let zPrev=0, phiPrev=null;

  for(let a=0;a<=360+1e-9;a+=stepFineDeg){
    const φ=a*RAD;
    const p0=[Rr*Math.cos(φ), Rr*Math.sin(φ), 0];

    // quadratic in z
    const alpha=dot(d,k);
    const B=sub(p0, mul(d, dot(d,p0)));
    const A=sub(k, mul(d, alpha));
    const qa=dot(A,A), qb=2*dot(A,B), qc=dot(B,B)-Rb*Rb;
    const disc=qb*qb-4*qa*qc;
    if(disc<0){ rawRun.push(null); rawBr.push(null); continue; }

    let z1=(-qb - Math.sqrt(disc))/(2*qa);
    let z2=(-qb + Math.sqrt(disc))/(2*qa);
    let z = (Math.abs(z1-zPrev)<=Math.abs(z2-zPrev)) ? z1 : z2;
    zPrev=z;

    const p = add(p0, mul(k,z));

    // unwrap on RUN (arc-length)
    const uRun = Math.PI*runOD*(a/180);
    rawRun.push({ u:uRun, v:z, deg:a });

    // unwrap on BRANCH (continuous angle)
    const s = dot(p,d);
    const q = sub(p, mul(d,s));
    let phi = Math.atan2(dot(q,e2), dot(q,e1)); // -π..π
    if(phiPrev==null) phiPrev=phi;
    phi += Math.round((phiPrev - phi)/(2*Math.PI)) * 2*Math.PI;
    phiPrev=phi; // continuous
    rawBr.push({ u: (Math.PI*branchOD)*(phi/(2*Math.PI)), v:s, deg:a, phi:phi/Math.PI/2 }); // phi normalized (for table)
  }

  // baseline shift (min(v)=0)
  const minRun = Math.min(...rawRun.filter(Boolean).map(p=>p.v));
  const minBr  = Math.min(...rawBr .filter(Boolean).map(p=>p.v));
  const runS = rawRun.map(p=>p?({...p, v:p.v-minRun}):null);
  const brS  = rawBr .map(p=>p?({...p, v:p.v-minBr }):null);

  const envRun=envelopeByDeg(runS);
  const envBr =envelopeByDeg(brS);

  const Crun=Math.PI*runOD, Cbr=Math.PI*branchOD;
  const run = envRun.map(p=>p?({u:Crun*(p.deg/360), v:p.v, deg:p.deg}):null);
  const branch = envBr.map(p=>p?({u:Cbr*(p.deg/360), v:p.v, deg:p.deg}):null);

  // stations (every seamStepDeg)
  const stations=[];
  for(let a=0;a<=360;a+=seamStepDeg){
    const i=Math.round(a);
    const pr=envRun[i], pb=envBr[i];
    stations.push({
      deg:a,
      uRun: Math.round(Crun*(a/360)),
      vRun: pr?Math.round(pr.v):null,
      uBranch: Math.round(Cbr*(a/360)),  // for simple wrap on branch at same deg
      vBranch: pb?Math.round(pb.v):null
    });
  }

  return { run, branch, stations, Crun, Cbr };
}

/* ---------------- canvas renderer ---------------- */
function drawStencil(canvas, pts, title, C, stations) {
  if(!canvas) return;
  const dpr=window.devicePixelRatio||1;
  const W=canvas.clientWidth||640, H=canvas.clientHeight||240;
  canvas.width=Math.floor(W*dpr); canvas.height=Math.floor(H*dpr);
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  if(!pts?.length){ ctx.fillStyle="#64748b"; ctx.font="14px system-ui"; ctx.fillText("No domain",12,22); return; }

  const pad=18;
  const minU=0, maxU=C||Math.max(...pts.filter(Boolean).map(p=>p.u));
  let minV=0, maxV=Math.max(1, ...pts.filter(Boolean).map(p=>p.v));
  const X=u=>pad + (u-minU)*(W-2*pad)/Math.max(1e-6,(maxU-minU));
  const Y=v=>H-pad - (v-minV)*(H-2*pad)/Math.max(1e-6,(maxV-minV));

  // grid: every 30°
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  const step = (maxU-minU)/12;
  for(let u=minU; u<=maxU+1e-6; u+=step){ ctx.beginPath(); ctx.moveTo(X(u),pad); ctx.lineTo(X(u),H-pad); ctx.stroke(); }
  ctx.strokeStyle="#94a3b8"; ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);

  // title
  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui";
  ctx.fillText(title, pad, pad-4);

  // curve
  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5;
  ctx.beginPath(); let first=true;
  pts.forEach(p=>{
    if(!p){ first=true; return; }
    const x=X(p.u), y=Y(p.v);
    if(first){ ctx.moveTo(x,y); first=false; } else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // station labels (every 30°)
  ctx.font="bold 12px system-ui"; ctx.textAlign="center";
  (stations||[]).forEach(st=>{
    const x=X(st.uRun), y=Y(st.vRun??0)-8;
    const text=String(st.vRun??0);
    const w=Math.ceil(ctx.measureText(text).width)+8, h=18, r=8;
    const rx=x-w/2, ry=y-h+4;
    ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(rx+r,ry); ctx.lineTo(rx+w-r,ry);
    ctx.quadraticCurveTo(rx+w,ry,rx+w,ry+r);
    ctx.lineTo(rx+w,ry+h-r); ctx.quadraticCurveTo(rx+w,ry+h,rx+w-r,ry+h);
    ctx.lineTo(rx+r,ry+h); ctx.quadraticCurveTo(rx,ry+h,rx,ry+h-r);
    ctx.lineTo(rx,ry+r); ctx.quadraticCurveTo(rx,ry,rx+r,ry); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle="#0f172a"; ctx.fillText(text,x,y);

    ctx.fillStyle="#0f172a"; ctx.fillText(String(Math.round(st.uRun)), x, H-pad+14);
  });

  // baseline
  ctx.strokeStyle="#94a3b8"; ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
}

/* ---------------- page ---------------- */
export default function PipeTeeStencils(){
  const [title,setTitle]=useState("");
  const [runOD,setRunOD]=useState(60);
  const [branchOD,setBranchOD]=useState(60);
  const [pitch,setPitch]=useState(90);  // deg
  const [yaw,setYaw]=useState(0);       // deg
  const [step,setStep]=useState(30);    // deg seam spacing

  const [out,setOut]=useState(null);
  const cRun=useRef(null);
  const cBr=useRef(null);

  const compute=()=>{
    const res = solveTee({
      runOD:Number(runOD)||0,
      branchOD:Number(branchOD)||0,
      pitchDeg:Number(pitch)||0,
      yawDeg:Number(yaw)||0,
      stepFineDeg:1,
      seamStepDeg:Number(step)||30
    });
    setOut(res);
  };

  useEffect(()=>{ compute(); /* eslint-disable-next-line */},[]);

  useEffect(()=>{
    if(!out) return;
    drawStencil(cRun.current, out.run, "Run-hole stencil (wrap on RUN)", out.Crun, out.stations);
    drawStencil(cBr.current,  out.branch, "Branch-cut stencil (wrap on BRANCH)", out.Cbr, out.stations);
  },[out]);

  const clearAll=()=>{ setTitle(""); setRunOD(""); setBranchOD(""); setPitch(""); setYaw(""); setStep(30); setOut(null); };

  const save=async()=>{
    if(!out){ alert("Nothing to save"); return; }
    const now=Date.now();
    const rec={
      createdAt: now,
      expiresAt: now + 90*24*60*60*1000,
      title: title || "Untitled tee",
      inputs: { runOD:Number(runOD), branchOD:Number(branchOD), pitch:Number(pitch), yaw:Number(yaw), step:Number(step) },
      run: out.run,            // [{u,v,deg}|null]
      branch: out.branch,      // [{u,v,deg}|null]
      stations: out.stations,  // for table/canvas labels
      Crun: out.Crun, Cbr: out.Cbr
    };
    await set(push(dbRef(db,"teeTemplates")), rec);
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Stencils</div>
        <div className="row" style={{gap:8, marginBottom:8, flexWrap:"wrap"}}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={{flex:"1 1 220px"}}/>
          <input className="input" type="number" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" type="number" placeholder="Branch OD (mm)" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
          <input className="input" type="number" placeholder="Pitch°" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" type="number" placeholder="Yaw°" value={yaw} onChange={e=>setYaw(e.target.value)} />
          <input className="input" type="number" placeholder="Step° (labels)" value={step} onChange={e=>setStep(e.target.value)} />
        </div>

        <div className="row" style={{gap:8, marginBottom:8, flexWrap:"wrap"}}>
          <button className="btn" onClick={compute}>🔄 Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{background:"#64748b"}}>🧹 Clear</button>
        </div>

        <div className="small" style={{marginBottom:8}}>
          • စက္ကူ/တိပ်ကို pipe ရဲ့ 360° ပတ်ပြီး seam ကို 0° ဆီထားပါ — အောက်က graph ရဲ့ degree အောက် label တွေကို 30° တစ်ခါ လိုက်မှတ်ပါ (integer mm).<br/>
          • <b>Run-hole</b> stencil ကို RUN ပတ်ပြီး — အပေါက် outline.<br/>
          • <b>Branch-cut</b> stencil ကို BRANCH ပတ်ပြီး — fish-mouth cut outline.
        </div>

        <canvas ref={cRun} style={{width:"100%", height:260, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff"}}/>
        <div style={{height:10}}/>
        <canvas ref={cBr}  style={{width:"100%", height:260, border:"1px solid #e5e7eb", borderRadius:12, background:"#fff"}}/>
      </div>

      {out && (
        <div className="card">
          <div className="page-title">Dimensions (every {step}°)</div>
          <div className="small" style={{marginBottom:8}}>
            Run C ≈ <b>{out.Crun.toFixed(2)}</b> mm · Branch C ≈ <b>{out.Cbr.toFixed(2)}</b> mm · Tilts → Pitch <b>{pitch}°</b>, Yaw <b>{yaw}°</b>
          </div>
          <div className="table" style={{overflowX:"auto"}}>
            <table className="simple" style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th>Deg</th>
                  <th>Run: u (mm)</th>
                  <th>Run: height</th>
                  <th>Branch: u (mm)</th>
                  <th>Branch: height</th>
                </tr>
              </thead>
              <tbody>
                {out.stations.map((s,i)=>(
                  <tr key={i}>
                    <td>{s.deg}</td>
                    <td>{s.uRun}</td>
                    <td>{s.vRun ?? "-"}</td>
                    <td>{s.uBranch}</td>
                    <td>{s.vBranch ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
    }
