// src/pages/CircleTee.jsx
import React, { useRef, useState, useEffect } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

const safeId = () => (crypto?.randomUUID?.() || Math.random().toString(36)).slice(0,8);

// run hole profile calculation
function calcRunHeight(Rr, Rb, deg, runTilt=0, sideTilt=0) {
  const rad = (deg * Math.PI) / 180;
  const x = Rr * Math.cos(rad);
  const y = Rr * Math.sin(rad);
  // simple projection (expand for side tilt)
  const h = Rb - Math.sqrt(Math.max(0, Rb*Rb - y*y));
  const tiltAdj = Math.tan(runTilt*Math.PI/180) * x + Math.tan(sideTilt*Math.PI/180) * y;
  return h + tiltAdj;
}

// branch cut profile calculation
function calcBranchCut(Rr, Rb, deg, runTilt=0, sideTilt=0) {
  const rad = (deg * Math.PI) / 180;
  const x = Rr * Math.cos(rad);
  const y = Rr * Math.sin(rad);
  const h = Rr - Math.sqrt(Math.max(0, Rr*Rr - x*x));
  const tiltAdj = Math.tan(runTilt*Math.PI/180) * x + Math.tan(sideTilt*Math.PI/180) * y;
  return h + tiltAdj;
  }
function drawTemplate(canvas, stations, title) {
  if (!canvas) return;
  const dpr = devicePixelRatio || 1;
  const W = canvas.clientWidth || 640, H = canvas.clientHeight || 240;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  const pad=24, top=pad, bot=H-pad;
  const xOf = (deg)=> pad+(deg/360)*(W-pad*2);
  const maxH=Math.max(1,...stations.map(s=>s.h));
  const yOf=(h)=> bot-(h/maxH)*(bot-top);

  // grid
  ctx.strokeStyle="#e5e7eb";
  for(let d=0;d<=360;d+=15){
    const x=xOf(d);
    ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bot);ctx.stroke();
    ctx.fillStyle="#64748b";ctx.font="11px system-ui";
    ctx.fillText(String(d),x-6,bot+14);
  }

  // line
  const pts=stations.map(s=>({x:xOf(s.deg),y:yOf(s.h)}));
  ctx.strokeStyle="#0ea5e9";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.stroke();

  // labels
  const gap=Math.max(1,Math.floor(stations.length/12));
  ctx.font="12px system-ui";
  for(let i=0;i<stations.length;i+=gap){
    const s=stations[i]; if(!s.h) continue;
    const x=xOf(s.deg),y=yOf(s.h)-12;
    const txt=s.h.toFixed(2);
    const w=ctx.measureText(txt).width+10,h=18,r=9;
    const bx=Math.round(x-w/2),by=Math.round(y-h/2);
    ctx.beginPath();
    ctx.moveTo(bx+r,by);ctx.lineTo(bx+w-r,by);
    ctx.quadraticCurveTo(bx+w,by,bx+w,by+r);
    ctx.lineTo(bx+w,by+h-r);ctx.quadraticCurveTo(bx+w,by+h,bx+w-r,by+h);
    ctx.lineTo(bx+r,by+h);ctx.quadraticCurveTo(bx,by+h,bx,by+h-r);
    ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);ctx.closePath();
    ctx.fillStyle="#fff";ctx.strokeStyle="#94a3b8";ctx.lineWidth=1.2;
    ctx.fill();ctx.stroke();
    ctx.fillStyle="#0f172a";ctx.fillText(txt,bx+5,by+12);
  }

  ctx.fillStyle="#0f172a";ctx.font="bold 14px system-ui";
  ctx.fillText(title,pad,16);
}
export default function CircleTee() {
  const [title,setTitle]=useState("");
  const [Rr,setRr]=useState(100); // run radius
  const [Rb,setRb]=useState(50);  // branch radius
  const [deg,setDeg]=useState(90);
  const [runTilt,setRunTilt]=useState(0);
  const [sideTilt,setSideTilt]=useState(0);
  const [stationsRun,setStationsRun]=useState([]);
  const [stationsCut,setStationsCut]=useState([]);
  const runRef=useRef(null), cutRef=useRef(null);

  const calcAll=()=>{
    const stRun=[], stCut=[];
    for(let d=0;d<=360;d+=15){
      stRun.push({deg:d,h:calcRunHeight(Rr,Rb,d,runTilt,sideTilt)});
      stCut.push({deg:d,h:calcBranchCut(Rr,Rb,d,runTilt,sideTilt)});
    }
    setStationsRun(stRun);setStationsCut(stCut);
  };

  useEffect(()=>{calcAll();},[Rr,Rb,deg,runTilt,sideTilt]);
  useEffect(()=>{
    drawTemplate(runRef.current,stationsRun,"Run hole template");
    drawTemplate(cutRef.current,stationsCut,"Branch cut template");
  },[stationsRun,stationsCut]);

  const save=async()=>{
    const now=Date.now();
    await set(push(dbRef(db,"teeTemplates")),{
      id:safeId(),title:title||"Untitled",
      createdAt:now,expiresAt:now+90*24*60*60*1000,
      inputs:{Rr,Rb,deg,runTilt,sideTilt},
      data:{run:stationsRun,cut:stationsCut}
    });
    alert("Saved ✅");
  };
  const clear=()=>{
    setTitle("");setRr(100);setRb(50);setDeg(90);setRunTilt(0);setSideTilt(0);
    setStationsRun([]);setStationsCut([]);
    const ctx1=runRef.current?.getContext("2d"),ctx2=cutRef.current?.getContext("2d");
    ctx1?.clearRect(0,0,runRef.current.width,runRef.current.height);
    ctx2?.clearRect(0,0,cutRef.current.width,cutRef.current.height);
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>
        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <div className="row">
          <input className="input" type="number" value={Rr} onChange={e=>setRr(+e.target.value)} placeholder="Run radius"/>
          <input className="input" type="number" value={Rb} onChange={e=>setRb(+e.target.value)} placeholder="Branch radius"/>
          <input className="input" type="number" value={deg} onChange={e=>setDeg(+e.target.value)} placeholder="Degree"/>
        </div>
        <div className="row">
          <input className="input" type="number" value={runTilt} onChange={e=>setRunTilt(+e.target.value)} placeholder="Run tilt"/>
          <input className="input" type="number" value={sideTilt} onChange={e=>setSideTilt(+e.target.value)} placeholder="Side tilt"/>
        </div>
        <div className="row" style={{marginTop:8}}>
          <button className="btn" onClick={calcAll}>🔄 Update</button>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clear}>🧹 Clear</button>
        </div>
      </div>

      <div className="card">
        <canvas ref={runRef} style={{width:"100%",height:200}}/>
      </div>
      <div className="card">
        <canvas ref={cutRef} style={{width:"100%",height:200}}/>
      </div>
    </div>
  );
      }
