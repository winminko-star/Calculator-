import React, { useRef, useState } from "react";
const fmt=(v,d=3)=>Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const c3=(A,B,C)=>{const x1=A.E,y1=A.N,x2=B.E,y2=B.N,x3=C.E,y3=C.N,a1=x1-x2,b1=y1-y2,a2=x1-x3,b2=y1-y3,e=((x1*x1-x2*x2)+(y1*y1-y2*y2))/2,f=((x1*x1-x3*x3)+(y1*y1-y3*y3))/2,det=a1*b2-b1*a2;if(Math.abs(det)<1e-12)return null;return{E:(e*b2-b1*f)/det,N:(a1*f-e*a2)/det}};
const dist=(c,p)=>Math.hypot(c.E-p.E,c.N-p.N);
function adjusted(pts){const n=pts.length;if(n<3)throw Error("Need ≥3");let se=0,sn=0,k=0;for(let i=0;i<n-2;i++)for(let j=i+1;j<n-1;j++)for(let m=j+1;m<n;m++){const c=c3(pts[i],pts[j],pts[m]);if(c){se+=c.E;sn+=c.N;k++;}}if(!k)throw Error("Collinear");return{E:se/k,N:sn/k,triples:k};}
const dot=(r,b)=>r[0]*b[0]+r[1]*b[1]+r[2]*b[2];
function inv3(M){const d=M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);if(Math.abs(d)<1e-12)return null;return[[(M[1][1]*M[2][2]-M[1][2]*M[2][1])/d,(M[0][2]*M[2][1]-M[0][1]*M[2][2])/d,(M[0][1]*M[1][2]-M[0][2]*M[1][1])/d],[(M[1][2]*M[2][0]-M[1][0]*M[2][2])/d,(M[0][0]*M[2][2]-M[0][2]*M[2][0])/d,(M[0][2]*M[1][0]-M[0][0]*M[1][2])/d],[(M[1][0]*M[2][1]-M[1][1]*M[2][0])/d,(M[0][1]*M[2][0]-M[0][0]*M[2][1])/d,(M[0][0]*M[1][1]-M[0][1]*M[1][0])/d]];}
function bestFit(pts){const n=pts.length;if(n<3)throw Error("Need ≥3");let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,S1=n,Tx=0,Ty=0,T1=0;for(const p of pts){const x=p.E,y=p.N,t=-(x*x+y*y);Sx+=x;Sy+=y;Sxx+=x*x;Syy+=y*y;Sxy+=x*y;Tx+=x*t;Ty+=y*t;T1+=t;}const M=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,S1]],b=[Tx,Ty,T1],inv=inv3(M);if(!inv)throw Error("Best-fit failed");const a=dot(inv[0],b),bb=dot(inv[1],b),c=dot(inv[2],b);return{E:-a/2,N:-bb/2,r:Math.sqrt(Math.max(0,(a*a+bb*bb)/4-c))};}

export default function CircleCenter(){
  const [rows,setRows]=useState([{name:"P1",E:"",N:""},{name:"P2",E:"",N:""},{name:"P3",E:"",N:""}]);
  const [out,setOut]=useState({adj:null,bf:null});
  const cvsRef=useRef(null);
  const add=()=>setRows(r=>[...r,{name:`P${r.length+1}`,E:"",N:""}]);
  const rm =()=>setRows(r=>r.length? r.slice(0,-1):r);
  const ch =(i,k,v)=>setRows(r=>r.map((x,ix)=>ix===i?{...x,[k]:v}:x));

  const compute=()=>{
    const pts=[],names=[];
    rows.forEach((r,i)=>{const E=parseFloat(r.E),N=parseFloat(r.N);if(Number.isFinite(E)&&Number.isFinite(N)){pts.push({E,N});names.push(r.name||`P${i+1}`);}});
    if(pts.length<3){alert("Need at least 3 valid points");return;}
    let adj=null,bf=null; try{adj=adjusted(pts);}catch{}
    try{bf=bestFit(pts);}catch{}
    setOut({adj,bf}); draw(names,pts,adj,bf);
  };

  const draw=(names,pts,adj,bf)=>{
    const c=cvsRef.current,ctx=c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);
    const allE=[...pts.map(p=>p.E)],allN=[...pts.map(p=>p.N)];
    if(adj){allE.push(adj.E);allN.push(adj.N);} if(bf){allE.push(bf.E);allN.push(bf.N);}
    const minE=Math.min(...allE),maxE=Math.max(...allE),minN=Math.min(...allN),maxN=Math.max(...allN);
    const pad=36,scale=Math.min((c.width-2*pad)/(maxE-minE||1),(c.height-2*pad)/(maxN-minN||1));
    const x=E=>pad+(E-minE)*scale,y=N=>c.height-(pad+(N-minN)*scale);

    ctx.fillStyle="blue";
    pts.forEach((p,i)=>{ctx.beginPath();ctx.arc(x(p.E),y(p.N),5,0,2*Math.PI);ctx.fill();ctx.fillText(names[i],x(p.E)+6,y(p.N)-6);});

    if(adj){const rs=pts.map(p=>dist(adj,p)),avg=rs.reduce((s,a)=>s+a,0)/rs.length;
      ctx.fillStyle="#e11";ctx.beginPath();ctx.arc(x(adj.E),y(adj.N),6,0,2*Math.PI);ctx.fill();ctx.fillText("Adj",x(adj.E)+8,y(adj.N));
      ctx.strokeStyle="#22a255";ctx.beginPath();ctx.arc(x(adj.E),y(adj.N),avg*scale,0,2*Math.PI);ctx.stroke();
    }
    if(bf){ctx.fillStyle="#06f";ctx.beginPath();ctx.arc(x(bf.E),y(bf.N),6,0,2*Math.PI);ctx.fill();ctx.fillText("Best",x(bf.E)+8,y(bf.N));
      ctx.setLineDash([6,4]);ctx.strokeStyle="#0a6cff";ctx.beginPath();ctx.arc(x(bf.E),y(bf.N),bf.r*scale,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <button className="btn" onClick={()=>setRows([{name:"P1",E:"",N:""},{name:"P2",E:"",N:""},{name:"P3",E:"",N:""}])}>Clear</button>
          <button className="btn" onClick={add}>+ Add row</button>
          <button className="btn" onClick={rm}>– Remove</button>
          <button className="btn ok" onClick={compute} style={{marginLeft:"auto"}}>Compute</button>
        </div>

        <div className="tableWrap">
          <table>
            <thead><tr><th>#</th><th>Name</th><th>E</th><th>N</th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i}>
                  <td>{i+1}</td>
                  <td><input value={r.name} onChange={e=>ch(i,"name",e.target.value)}/></td>
                  <td><input type="number" value={r.E} onChange={e=>ch(i,"E",e.target.value)}/></td>
                  <td><input type="number" value={r.N} onChange={e=>ch(i,"N",e.target.value)}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="info" style={{marginTop:8}}>
          <div><b>Adjusted:</b> {out.adj?`E=${fmt(out.adj.E)} , N=${fmt(out.adj.N)} (triples=${out.adj.triples})`:"—"}</div>
          <div><b>Best-fit:</b> {out.bf?`E=${fmt(out.bf.E)} , N=${fmt(out.bf.N)} , r=${fmt(out.bf.r)}`:"—"}</div>
        </div>

        <canvas ref={cvsRef} width="620" height="380" style={{marginTop:8,border:"1px solid #e5e7eb"}}/>
      </div>
    </div>
  );
  }
