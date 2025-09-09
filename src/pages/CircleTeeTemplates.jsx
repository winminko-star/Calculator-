import React, { useMemo, useRef, useEffect, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

const DEG = Math.PI/180;
const uN = v=>{const m=Math.hypot(...v)||1;return [v[0]/m,v[1]/m,v[2]/m];};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(v,k)=>[v[0]*k,v[1]*k,v[2]*k];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

function solveTee({ runOD, branchOD, pitchDeg, yawDeg, stepDegFine=2 }) {
  const Rr=runOD/2, Rb=branchOD/2;
  const pitch=pitchDeg*DEG, yaw=yawDeg*DEG;
  const d=uN([Math.cos(yaw)*Math.sin(pitch), Math.sin(yaw)*Math.sin(pitch), Math.cos(pitch)]);
  const k=[0,0,1];
  const n=Math.abs(d[2])<0.9?[0,0,1]:[1,0,0];
  const e1=uN(sub(n, mul(d, dot(n,d)))); const e2=cross(d,e1);

  const run=[], branch=[];
  for(let a=0;a<=360;a+=stepDegFine){
    const φ=a*DEG; const p0=[Rr*Math.cos(φ), Rr*Math.sin(φ), 0];
    const A=dot(p0,d), u=sub(p0, mul(d,A)), w=sub(k, mul(d, dot(k,d)));
    const A2=dot(w,w), B2=2*dot(u,w), C2=dot(u,u)-Rb*Rb, disc=B2*B2-4*A2*C2;
    if(disc<0){ run.push(null); branch.push(null); continue; }
    const z=(-B2 + Math.sign(B2||1)*Math.sqrt(disc))/(2*A2); // nearer
    const p=add(p0, mul(k,z));
    run.push({u:Rr*(a*DEG), v:z, deg:a});

    const s=dot(p,d), q=sub(p, mul(d,s));
    const phi_b=Math.atan2(dot(q,e2), dot(q,e1)); const phi01=phi_b<0?phi_b+2*Math.PI:phi_b;
    branch.push({u: Rb*phi01, v:s, deg:a});
  }
  const minR=Math.min(...run.filter(Boolean).map(p=>p.v)), minB=Math.min(...branch.filter(Boolean).map(p=>p.v));
  run.forEach(p=>{if(p) p.v-=minR;}); branch.forEach(p=>{if(p) p.v-=minB;});
  const pick=(arr)=>{ const out=[]; for(let a=0;a<=360;a+=30){ const m=arr.find(p=>p&&p.deg===a); out.push({deg:a,h:m?Math.round(m.v):0}); } return out; };
  return { run, branch, tableRun:pick(run), tableBranch:pick(branch), C_run:Math.PI*runOD, C_branch:Math.PI*branchOD };
}

function drawUV(canvas, pts, title, Cmm){
  if(!canvas) return;
  const dpr=window.devicePixelRatio||1, W=canvas.clientWidth||640, H=canvas.clientHeight||220;
  canvas.width=W*dpr; canvas.height=H*dpr; const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H); ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
  const pad=20, minU=0, maxU=Cmm||1;
  const vals=(pts||[]).filter(Boolean); const maxV=Math.max(1, ...(vals.map(p=>p.v||0)));
  const X=u=>pad+(u-minU)*(W-2*pad)/Math.max(1e-6,maxU-minU);
  const Y=v=>H-pad - v*(H-2*pad)/Math.max(1e-6,maxV);
  const stepU=(Cmm||0)/12; ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for(let u=minU; u<=maxU+1e-6; u+=stepU){ ctx.beginPath(); ctx.moveTo(X(u),pad); ctx.lineTo(X(u),H-pad); ctx.stroke(); }
  ctx.strokeStyle="#94a3b8"; ctx.strokeRect(pad,pad,W-2*pad,H-2*pad);
  ctx.fillStyle="#0f172a"; ctx.font="600 14px system-ui"; ctx.fillText(title, pad, pad-4);
  if(!vals.length) return; ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2.5; ctx.beginPath();
  vals.forEach((p,i)=>{ const x=X(p.u), y=Y(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
}

function AngleTable({ rows }){
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%", borderCollapse:"collapse"}}>
        <thead><tr>{rows.map(r=><th key={r.deg} style={{padding:6, borderBottom:"1px solid #e5e7eb"}}>{r.deg}°</th>)}</tr></thead>
        <tbody><tr>{rows.map(r=><td key={r.deg} style={{textAlign:"center", padding:6}}>{r.h}</td>)}</tr></tbody>
      </table>
    </div>
  );
}

export default function PipeTeeStencil(){
  const [title, setTitle] = useState("");
  const [runOD,setRunOD]=useState(60);
  const [branchOD,setBranchOD]=useState(60);
  const [pitch,setPitch]=useState(90);
  const [yaw,setYaw]=useState(0);

  const data = useMemo(()=>solveTee({
    runOD:Number(runOD)||0, branchOD:Number(branchOD)||0,
    pitchDeg:Number(pitch)||0, yawDeg:Number(yaw)||0,
  }), [runOD,branchOD,pitch,yaw]);

  const cRun=useRef(null), cBr=useRef(null);
  useEffect(()=>{ drawUV(cRun.current, data.run, "Run-hole stencil (wrap on RUN)", data.C_run); }, [data]);
  useEffect(()=>{ drawUV(cBr.current,  data.branch, "Branch-cut stencil (wrap on BRANCH)", data.C_branch); }, [data]);

  const clearAll=()=>{ setTitle(""); setRunOD(""); setBranchOD(""); setPitch(""); setYaw(""); };

  const saveToFirebase = async () => {
    const now=Date.now(); const expiresAt=now+90*24*60*60*1000;
    const payload = {
      createdAt: now, expiresAt, title: title || "Untitled Tee",
      inputs: { runOD:Number(runOD), branchOD:Number(branchOD), pitch:Number(pitch), yaw:Number(yaw) },
      run: data.run, branch: data.branch,
      stations: Array.from({length:13},(_,i)=>({
        deg:i*30,
        uRun: (data.C_run/12)*i,
        vRun:  data.tableRun[i]?.h ?? null,
        uBranch:(data.C_branch/12)*i,
        vBranch:data.tableBranch[i]?.h ?? null,
      })),
    };
    await set(push(dbRef(db,"teeTemplates")), payload);
    alert("✅ Saved to All Review");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">Pipe Tee — Canvas + 30° Table</div>
        <div className="row" style={{gap:8, flexWrap:"wrap"}}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
          <input className="input" placeholder="Run OD (mm)" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" placeholder="Branch OD (mm)" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
          <input className="input" placeholder="Pitch (deg)" value={pitch} onChange={e=>setPitch(e.target.value)} />
          <input className="input" placeholder="Yaw (deg)" value={yaw} onChange={e=>setYaw(e.target.value)} />
        </div>
        <div className="row" style={{gap:8, marginTop:8}}>
          <button className="btn" onClick={saveToFirebase}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{background:"#475569"}}>🧹 Clear</button>
        </div>
      </div>

      <div className="card"><canvas ref={cRun} style={{width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12}}/></div>
      <div className="card"><canvas ref={cBr}  style={{width:"100%", height:240, border:"1px solid #e5e7eb", borderRadius:12}}/></div>

      <div className="card"><div className="page-title">Run-hole heights (mm @ every 30°)</div><AngleTable rows={data.tableRun}/></div>
      <div className="card"><div className="page-title">Branch-cut heights (mm @ every 30°)</div><AngleTable rows={data.tableBranch}/></div>
    </div>
  );
  }
