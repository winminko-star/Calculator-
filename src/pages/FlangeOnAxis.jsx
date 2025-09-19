// src/pages/FlangeOnAxis.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------------- small 3D math ---------------- */
const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul3=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm3=(a)=>Math.hypot(a[0],a[1],a[2])||1;
const unit3=(a)=>{const n=norm3(a);return [a[0]/n,a[1]/n,a[2]/n];};
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/* ----------- robust parsing ----------- */
function parseLineENH(line){
  const m=line.trim().split(/[,\s]+/).filter(Boolean);
  if(m.length<3) return null;
  const E=Number(m[0]),N=Number(m[1]),H=Number(m[2]);
  if(!isFinite(E)||!isFinite(N)||!isFinite(H)) return null;
  return {E,N,H};
}
function parseENHList(raw){
  const out=[]; for(const ln of raw.split(/\r?\n/)){ const p=parseLineENH(ln); if(p) out.push(p); }
  return out;
}

/* ----------- axis frame ----------- */
function buildAxisFrame(A,B){
  const a=[A.E,A.N,A.H], b=[B.E,B.N,B.H];
  const u=unit3(sub3(b,a));
  const ref=Math.abs(u[2])<0.9?[0,0,1]:[1,0,0];
  const v=unit3(cross3(u,ref));
  const w=unit3(cross3(u,v));
  return {a,u,v,w};
}
function projectPointToAxisFrame(frame,P){
  const p=[P.E,P.N,P.H],{a,u,v,w}=frame;
  const d=sub3(p,a); const t=dot3(d,u);
  const du=mul3(u,t); const rvec=sub3(d,du); const r=norm3(rvec);
  const x=dot3(rvec,v), y=dot3(rvec,w);
  let theta=Math.atan2(y,x)*180/Math.PI; if(theta<0) theta+=360;
  return {t,r,theta, rvec, foot:add3(a,du)};
}

/* ----------- stats ----------- */
const mean=arr=>arr.length?arr.reduce((s,x)=>s+x,0)/arr.length:0;
const rmsErr=(arr,mu)=>arr.length? Math.sqrt(arr.reduce((s,x)=>s+(x-mu)*(x-mu),0)/arr.length):0;

/* ----------- canvas renderer ----------- */
function drawCrossSection(ctx,w,h,proj,radiusAvg){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for(let gx=0;gx<w;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke();}
  for(let gy=0;gy<h;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke();}
  const cx=w/2, cy=h/2;
  ctx.strokeStyle="#94a3b8"; ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(w,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,h); ctx.stroke();

  if(!proj || !proj.length) return;
  const rMax=Math.max(...proj.map(p=>p.r), radiusAvg||0, 1);
  const pad=20; const scale=Math.min((w/2-pad)/rMax,(h/2-pad)/rMax);
  if(radiusAvg){ ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,radiusAvg*scale,0,Math.PI*2); ctx.stroke(); }
  for(const p of proj){
    const x=cx+(p.r*Math.cos(p.theta*Math.PI/180))*scale;
    const y=cy-(p.r*Math.sin(p.theta*Math.PI/180))*scale;
    ctx.fillStyle="#ef4444"; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle="#0f172a"; ctx.font="12px system-ui";
  ctx.fillText("Cross-section (axis ⟂ view)",10,16);
  ctx.fillText(`scale: ${scale.toFixed(2)} px/mm`,10,32);
}

/* ----------- localStorage key ----------- */
const LS_KEY = "pipe_last_centers";

/* ----------- hook ----------- */
export function useFlangeOnAxis(){
  const [centerA,setCenterA]=useState("0,0,0");
  const [centerB,setCenterB]=useState("1000,0,0");
  const [rawPts,setRawPts]=useState("");

  const A=useMemo(()=>parseLineENH(centerA)||{E:0,N:0,H:0},[centerA]);
  const B=useMemo(()=>parseLineENH(centerB)||{E:0,N:0,H:0},[centerB]);
  const pts=useMemo(()=>parseENHList(rawPts),[rawPts]);
  const frame=useMemo(()=>buildAxisFrame(A,B),[A,B]);

  const proj=useMemo(()=> pts.map(p=>({...projectPointToAxisFrame(frame,p),src:p})), [pts,frame]);

  const summary=useMemo(()=>{
    if(!proj.length) return null;
    const radii=proj.map(p=>p.r); const rAvg=mean(radii); const rRms=rmsErr(radii,rAvg);
    const tMin=Math.min(...proj.map(p=>p.t)); const tMax=Math.max(...proj.map(p=>p.t));
    return { rAvg, rRms, tMin, tMax, count:proj.length };
  },[proj]);

  return { centerA,setCenterA, centerB,setCenterB, rawPts,setRawPts, A,B, pts, proj, summary };
}

/* ----------- page ----------- */
export default function FlangeOnAxisPage(){
  const st=useFlangeOnAxis();
  const [target,setTarget]=useState("A");

  // auto-load centers from PipeEndsSlope (if present)
  useEffect(()=>{
    const s=localStorage.getItem(LS_KEY);
    if(s){
      try{
        const {A,B}=JSON.parse(s);
        if(A && B){
          const aStr=`${Number(A.E).toFixed(3)},${Number(A.N).toFixed(3)},${Number(A.H).toFixed(3)}`;
          const bStr=`${Number(B.E).toFixed(3)},${Number(B.N).toFixed(3)},${Number(B.H).toFixed(3)}`;
          st.setCenterA(aStr); st.setCenterB(bStr);
        }
      }catch{}
    }
    const onStorage=(e)=>{ if(e.key!==LS_KEY) return;
      try{
        const {A,B}=JSON.parse(e.newValue||"{}");
        if(A && B){
          const aStr=`${Number(A.E).toFixed(3)},${Number(A.N).toFixed(3)},${Number(A.H).toFixed(3)}`;
          const bStr=`${Number(B.E).toFixed(3)},${Number(B.N).toFixed(3)},${Number(B.H).toFixed(3)}`;
          st.setCenterA(aStr); st.setCenterB(bStr);
        }
      }catch{}
    };
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // canvas
  const wrapRef=useRef(null), canvasRef=useRef(null), ctxRef=useRef(null);
  useEffect(()=>{
    const cvs=canvasRef.current, wrap=wrapRef.current; if(!cvs||!wrap) return;
    const dpr=window.devicePixelRatio||1;
    const w=Math.max(320,Math.floor(wrap.clientWidth||360));
    const h=Math.min(Math.max(Math.floor(w*0.75),280),560);
    cvs.style.width=w+"px"; cvs.style.height=h+"px";
    cvs.width=Math.floor(w*dpr); cvs.height=Math.floor(h*dpr);
    const ctx=cvs.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctxRef.current=ctx;
    drawCrossSection(ctx,w,h,st.proj,st.summary?.rAvg||0);
  },[st.proj,st.summary]);
  useEffect(()=>{
    const onR=()=>{
      const ctx=ctxRef.current; if(!ctx) return;
      const cvs=canvasRef.current, wrap=wrapRef.current, dpr=window.devicePixelRatio||1;
      const w=Math.max(320,Math.floor(wrap.clientWidth||360));
      const h=Math.min(Math.max(Math.floor(w*0.75),280),560);
      cvs.style.width=w+"px"; cvs.style.height=h+"px";
      cvs.width=Math.floor(w*dpr); cvs.height=Math.floor(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawCrossSection(ctx,w,h,st.proj,st.summary?.rAvg||0);
    };
    window.addEventListener("resize",onR);
    return ()=>window.removeEventListener("resize",onR);
  },[st.proj,st.summary]);

  // info pill
  const Info=({label,value,accent})=>(
    <div style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:10,background:"#fff",minWidth:140}}>
      <div style={{ fontSize:12, color:"#64748b" }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:16, color:accent||"#0f172a" }}>{value}</div>
    </div>
  );

  // custom keyboard
  const applyTo=(fn)=>{ if(target==="A") st.setCenterA(fn(st.centerA)); else if(target==="B") st.setCenterB(fn(st.centerB)); else st.setRawPts(fn(st.rawPts)); };
  const onKey=(k)=>{
    if(k==="AC") return applyTo(()=> "");
    if(k==="DEL") return applyTo(s=>s.slice(0,-1));
    if(k==="↵") return applyTo(s=>s+"\n");
    if(k==="SPC") return applyTo(s=>s+" ");
    if(k===" , ") return applyTo(s=>s+", ");
    return applyTo(s=>s+k);
  };
  const Key=({label})=>(
    <button onClick={()=>onKey(label)}
      style={{height:42,padding:"0 12px",borderRadius:12,border:"1px solid #e5e7eb",background:"#f8fafc",fontWeight:800}}>
      {label}
    </button>
  );
  const Keyboard=()=>(
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:8}}>
      <Key label="7"/><Key label="8"/><Key label="9"/><Key label=","/><Key label=" , "/><Key label="DEL"/>
      <Key label="4"/><Key label="5"/><Key label="6"/><Key label="-"/><Key label="."/><Key label="AC"/>
      <Key label="1"/><Key label="2"/><Key label="3"/><Key label="SPC"/><Key label="↵"/><Key label="0"/>
      <Key label="E"/><Key label="N"/><Key label="H"/><Key label="/"/><Key label=";"/><Key label=":"/>
    </div>
  );
  const chip=(id,text)=>(
    <button onClick={()=>setTarget(id)}
      style={{padding:"6px 10px",border:"1px solid #e5e7eb",borderRadius:9999,background:target===id?"#0ea5e9":"#f8fafc",color:target===id?"#fff":"#0f172a",fontWeight:700}}>
      {text}
    </button>
  );
  const activeBg=(id)=>({ background: target===id ? "#dbeafe" : "#fff" });

  // ---- Single point add & clear ----
  function SingleAdd({ onAdd, onClear }){
    const [e,setE]=useState(""), [n,setN]=useState(""), [h,setH]=useState("");
    const ok = [e,n,h].every(s=>s.trim()!=="" && isFinite(Number(s)));
    const add=()=>{ if(!ok) return; onAdd(Number(e),Number(n),Number(h)); setE(""); setN(""); setH(""); };
    const Field=({label,val,set})=>(
      <label style={{display:"grid",gap:4}}>
        <span className="small" style={{color:"#64748b"}}>{label}</span>
        <input className="input" value={val} onChange={ev=>set(ev.target.value)} inputMode="decimal"/>
      </label>
    );
    return (
      <div className="card" style={{ marginTop:10, background:"#f8fafc" }}>
        <div className="page-subtitle">Quick add one point</div>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <Field label="E" val={e} set={setE}/>
          <Field label="N" val={n} set={setN}/>
          <Field label="H" val={h} set={setH}/>
          <button className="btn" disabled={!ok} onClick={add}>+ Add point</button>
          <button className="btn" style={{ background:"#334155" }} onClick={onClear}>🧹 Clear list</button>
        </div>
      </div>
    );
  }

  // remove i-th valid ENH row (index = projected table row)
  const removeENHByProjectedIndex=(idxToRemove)=>{
    const lines=st.rawPts.split(/\r?\n/);
    let validIdx=0; const kept=[];
    for(const ln of lines){
      const p=parseLineENH(ln);
      if(p && validIdx===idxToRemove){ validIdx++; continue; }
      if(p) validIdx++;
      kept.push(ln);
    }
    const joined=kept.join("\n").replace(/\n{3,}/g,"\n\n").trim();
    st.setRawPts(joined);
  };

  return (
    <div className="grid" style={{ gap:12 }}>
      {/* Canvas */}
      <div className="card" style={{ padding:8 }}>
        <div ref={wrapRef} style={{ width:"100%" }}>
          <canvas ref={canvasRef} style={{ display:"block", width:"100%", background:"#fff", borderRadius:12, border:"1px solid #e5e7eb" }}/>
        </div>
      </div>

      {/* Axis centers */}
      <div className="card" style={{ background:"#ffffff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">Axis (Ref line) — centers ENH</div>
        <div className="row" style={{ gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <input className="input" placeholder="Center A (E,N,H)" value={st.centerA}
            onChange={(e)=>st.setCenterA(e.target.value)} onFocus={()=>setTarget("A")} style={{ width:260, ...activeBg("A") }}/>
          <input className="input" placeholder="Center B (E,N,H)" value={st.centerB}
            onChange={(e)=>st.setCenterB(e.target.value)} onFocus={()=>setTarget("B")} style={{ width:260, ...activeBg("B") }}/>
          <button className="btn" onClick={()=>{
            const s=localStorage.getItem(LS_KEY); if(!s) return;
            try{
              const {A,B}=JSON.parse(s);
              const aStr=`${Number(A.E).toFixed(3)},${Number(A.N).toFixed(3)},${Number(A.H).toFixed(3)}`;
              const bStr=`${Number(B.E).toFixed(3)},${Number(B.N).toFixed(3)},${Number(B.H).toFixed(3)}`;
              st.setCenterA(aStr); st.setCenterB(bStr);
            }catch{}
          }}>⬇ Load from PipeEndsSlope</button>
        </div>

        <div className="page-title" style={{ marginTop:8 }}>Flange points — ENH (≥3)</div>
        <textarea rows={8} value={st.rawPts} onChange={(e)=>st.setRawPts(e.target.value)} onFocus={()=>setTarget("PTS")}
          placeholder={`E,N,H per line\n1200.0, 350.0, 15.2\n1198.5 352.2 15.3\n1211.4, 363.1, 28.2`}
          style={{width:"100%",fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",border:"1px solid #e5e7eb",borderRadius:10,padding:10,outline:"none",...activeBg("PTS")}}/>

        {/* single add + clear */}
        <SingleAdd onAdd={(E,N,H)=>{
          const line=`${E}, ${N}, ${H}`;
          st.setRawPts(prev=> prev ? (prev.trim()+"\n"+line) : line );
        }} onClear={()=>st.setRawPts("")}/>

        {/* Keyboard target + keyboard */}
        <div className="row" style={{ gap:8, marginTop:8, flexWrap:"wrap" }}>
          <span className="small" style={{ color:"#64748b" }}>Keyboard target:</span>
          {chip("A","Center A")}
          {chip("B","Center B")}
          {chip("PTS","Flange Pts")}
        </div>
        <div style={{ marginTop:8 }}><Keyboard/></div>
        <div className="small" style={{ color:"#64748b", marginTop:6 }}>
          Tips: <b>,</b> / <b>SPC</b> / <b>↵</b> / <b>DEL</b> / <b>AC</b>
        </div>
      </div>

      {/* Summary */}
      <div className="card" style={{ background:"#fff", border:"1px solid #e5e7eb" }}>
        <div className="page-title">Summary</div>
        {!st.summary && <div className="small">Need ≥ 3 flange points.</div>}
        {st.summary && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Info label="Count" value={st.summary.count}/>
            <Info label="Avg radius" value={st.summary.rAvg.toFixed(3)+" mm"} accent="#0ea5e9"/>
            <Info label="RMS (radius)" value={st.summary.rRms.toFixed(3)+" mm"} accent="#ef4444"/>
            <Info label="t range" value={`${st.summary.tMin.toFixed(2)} .. ${st.summary.tMax.toFixed(2)} mm`}/>
          </div>
        )}
      </div>

      {/* Table with delete buttons */}
      <div className="card">
        <div className="page-title">Points (projected)</div>
        {st.proj.length===0 && <div className="small">No data.</div>}
        {st.proj.length>0 && (
          <div style={{ overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:10 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  <th style={th}>#</th>
                  <th style={th}>E</th><th style={th}>N</th><th style={th}>H</th>
                  <th style={th}>t (mm)</th><th style={th}>r (mm)</th><th style={th}>θ (°)</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {st.proj.map((p,i)=>(
                  <tr key={i}>
                    <td style={td}>{i+1}</td>
                    <td style={td}>{p.src.E}</td>
                    <td style={td}>{p.src.N}</td>
                    <td style={td}>{p.src.H}</td>
                    <td style={td}><b>{p.t.toFixed(3)}</b></td>
                    <td style={td}><b>{p.r.toFixed(3)}</b></td>
                    <td style={td}>{p.theta.toFixed(2)}</td>
                    <td style={{ ...td, textAlign:"right" }}>
                      <button className="btn" style={{ background:"#ef4444", padding:"4px 10px", borderRadius:8 }}
                        onClick={()=>removeENHByProjectedIndex(i)} title="Remove this ENH point">×</button>
                    </td>
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

const th={ textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:12, color:"#64748b" };
const td={ padding:"8px 10px", borderBottom:"1px solid #e5e7eb", fontSize:13 };
