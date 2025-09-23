// src/pages/StationMerge.jsx (Part 1/2)
import React, { useMemo, useState } from "react";

/* ========== parsing ========== */
// support: "name, E, N, H" OR "name E N H" (commas/spaces mixed)
function parseNameENHText(text) {
  const out = [];
  for (const ln of (text || "").split(/\r?\n/)) {
    const s = ln.trim();
    if (!s) continue;
    const t = s.split(/[,\s]+/).filter(Boolean);
    if (t.length < 4) continue;
    const name = String(t[0]);
    const E = Number(t[1]), N = Number(t[2]), H = Number(t[3]);
    if (!isFinite(E) || !isFinite(N) || !isFinite(H)) continue;
    out.push({ name, E, N, H });
  }
  return out;
}
const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");

/* ========== small 3D LA ========== */
const sub3 = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add3 = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul3 = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const dot3 = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const det3 = (A) => A[0]*(A[4]*A[8]-A[5]*A[7]) - A[1]*(A[3]*A[8]-A[5]*A[6]) + A[2]*(A[3]*A[7]-A[4]*A[6]);

function mean3(arr){ const n=arr.length||1; let x=0,y=0,z=0; for(const p of arr){x+=p[0];y+=p[1];z+=p[2];} return [x/n,y/n,z/n]; }
function mat3mul(A,B){ const C=new Array(9).fill(0); for(let r=0;r<3;r++)for(let c=0;c<3;c++)for(let k=0;k<3;k++)C[r*3+c]+=A[r*3+k]*B[k*3+c]; return C; }
function mat3vec(A,v){ return [A[0]*v[0]+A[1]*v[1]+A[2]*v[2], A[3]*v[0]+A[4]*v[1]+A[5]*v[2], A[6]*v[0]+A[7]*v[1]+A[8]*v[2]]; }

/* --- eigen (Jacobi) for symmetric 3x3 --- */
function jacobiSym3(M9){
  let A=M9.slice(), V=[1,0,0, 0,1,0, 0,0,1];
  const off=()=>Math.hypot(A[1],A[2],A[5]);
  for(let it=0; it<30 && off()>1e-12; it++){
    let p=0,q=1;
    if(Math.abs(A[2])>Math.abs(A[1])){ p=0;q=2; }
    if(Math.abs(A[5])>Math.abs(A[p*3+q])){ p=1;q=2; }
    const app=A[p*3+p], aqq=A[q*3+q], apq=A[p*3+q]; if(Math.abs(apq)<1e-18) break;
    const phi=0.5*Math.atan2(2*apq, aqq-app), c=Math.cos(phi), s=Math.sin(phi);
    for(let k=0;k<3;k++){ const aik=A[k*3+p], aiq=A[k*3+q]; A[k*3+p]=c*aik-s*aiq; A[k*3+q]=s*aik+c*aiq; }
    for(let k=0;k<3;k++){ const apk=A[p*3+k], aqk=A[q*3+k]; A[p*3+k]=c*apk-s*aqk; A[q*3+k]=s*apk+c*aqk; }
    A[p*3+q]=A[q*3+p]=0;
    for(let k=0;k<3;k++){ const vkp=V[k*3+p], vkq=V[k*3+q]; V[k*3+p]=c*vkp-s*vkq; V[k*3+q]=s*vkp+c*vkq; }
  }
  return { eigVals:[A[0],A[4],A[8]], eigVecs:V };
}

/* --- SVD for 3x3 via eigen on AtA (adequate here) --- */
function svd3x3(H){
  const AtA=[
    H[0]*H[0]+H[3]*H[3]+H[6]*H[6], H[0]*H[1]+H[3]*H[4]+H[6]*H[7], H[0]*H[2]+H[3]*H[5]+H[6]*H[8],
    H[1]*H[0]+H[4]*H[3]+H[7]*H[6], H[1]*H[1]+H[4]*H[4]+H[7]*H[7], H[1]*H[2]+H[4]*H[5]+H[7]*H[8],
    H[2]*H[0]+H[5]*H[3]+H[8]*H[6], H[2]*H[1]+H[5]*H[4]+H[8]*H[7], H[2]*H[2]+H[5]*H[5]+H[8]*H[8],
  ];
  const {eigVals,eigVecs}=jacobiSym3(AtA);
  const s=eigVals.map(v=>Math.sqrt(Math.max(v,0))), idx=[0,1,2].sort((i,j)=>s[j]-s[i]);
  const S=[s[idx[0]],s[idx[1]],s[idx[2]]];
  const V=[ eigVecs[0+idx[0]],eigVecs[0+idx[1]],eigVecs[0+idx[2]],
            eigVecs[3+idx[0]],eigVecs[3+idx[1]],eigVecs[3+idx[2]],
            eigVecs[6+idx[0]],eigVecs[6+idx[1]],eigVecs[6+idx[2]] ];
  const VT=[V[0],V[3],V[6], V[1],V[4],V[7], V[2],V[5],V[8]];
  const AV=mat3mul(H,V);
  const U=[ AV[0]/(S[0]||1), AV[1]/(S[1]||1), AV[2]/(S[2]||1),
            AV[3]/(S[0]||1), AV[4]/(S[1]||1), AV[5]/(S[2]||1),
            AV[6]/(S[0]||1), AV[7]/(S[1]||1), AV[8]/(S[2]||1) ];
  return { U,S,VT };
}

/** Kabsch/Procrustes 3D (rigid or similarity) */
function bestFitTransform3D(ref, obs, {allowScale=false}={}){
  const n=Math.min(ref.length, obs.length); if(n<3) return null;
  const cref=mean3(ref), cobs=mean3(obs);
  const X=ref.map(p=>sub3(p,cref)), Y=obs.map(p=>sub3(p,cobs));
  let H=[0,0,0,0,0,0,0,0,0];
  for(let i=0;i<n;i++){
    const x=X[i], y=Y[i];
    H[0]+=y[0]*x[0]; H[1]+=y[0]*x[1]; H[2]+=y[0]*x[2];
    H[3]+=y[1]*x[0]; H[4]+=y[1]*x[1]; H[5]+=y[1]*x[2];
    H[6]+=y[2]*x[0]; H[7]+=y[2]*x[1]; H[8]+=y[2]*x[2];
  }
  const {U,S,VT}=svd3x3(H);
  let R=mat3mul(U,VT);
  if(det3(R)<0){ const U2=U.slice(); U2[2]*=-1; U2[5]*=-1; U2[8]*=-1; R=mat3mul(U2,VT); }
  let s=1;
  if(allowScale){ let num=S[0]+S[1]+S[2], den=0; for(const x of X) den+=dot3(x,x); s=den>0? num/den : 1; }
  const t = sub3(cref, mul3(mat3vec(R,cobs), s));

  let sse=0;
  for(let i=0;i<n;i++){
    const py=add3(mul3(mat3vec(R,obs[i]),s), t);
    const r=sub3(ref[i], py); sse+=r[0]*r[0]+r[1]*r[1]+r[2]*r[2];
  }
  return {R,t,s, rms:Math.sqrt(sse/n)};
}

export { parseNameENHText, fmt, add3, mul3, mat3vec, bestFitTransform3D };
// src/pages/StationMerge.jsx (Part 2/2)
import React, { useMemo, useState } from "react";
import { parseNameENHText, fmt, add3, mul3, mat3vec, bestFitTransform3D } from "./StationMerge.jsx";

export default function StationMerge(){
  // stationId -> {name,E,N,H}[]
  const [data, setData] = useState({});
  const [order, setOrder] = useState([]);         // keep import order
  const [refId, setRefId] = useState("");         // reference station id
  const [allowScale, setAllowScale] = useState(false);
  const [mergedText, setMergedText] = useState("");

  /** Import multiple files (USB/phone picker OK) */
  const onFiles = async (e)=>{
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = {...data};
    const nextOrder = [...order];

    for (const f of files) {
      const text = await f.text();
      // station id from filename (without ext)
      const id = (f.name || "STATION").replace(/\.[^.]+$/,"");
      const rows = parseNameENHText(text);
      if (!rows.length) continue;
      next[id] = rows;
      if (!nextOrder.includes(id)) nextOrder.push(id);
    }
    setData(next);
    setOrder(nextOrder);
    if (!refId && nextOrder.length) setRefId(nextOrder[0]);
    e.target.value = ""; // allow re-select same files
  };

  /** Compute transforms for every station → refId, then merge all points */
  const merged = useMemo(()=>{
    if (!refId || !data[refId]) return null;

    // map of reference by name
    const refRows = data[refId];
    const refMap = new Map(refRows.map(p=>[p.name, [p.E,p.N,p.H]]));

    // start with all points from reference
    const out = new Map(); // name -> {name,E,N,H,src}
    for (const p of refRows) {
      out.set(p.name, { name:p.name, E:p.E, N:p.N, H:p.H, src:refId });
    }

    // fit + add others
    for (const sid of order) {
      if (sid === refId) continue;
      const rows = data[sid] || [];
      // match controls (name-intersection)
      const obs=[], ref=[];
      for (const q of rows) {
        const r = refMap.get(q.name);
        if (r) { ref.push(r); obs.push([q.E,q.N,q.H]); }
      }
      if (ref.length < 3) continue; // skip if not enough controls

      const fit = bestFitTransform3D(ref, obs, { allowScale });
      if (!fit) continue;

      // transform every point of this station
      for (const q of rows) {
        const y = [q.E,q.N,q.H];
        const py = add3(mul3(mat3vec(fit.R, y), fit.s), fit.t);
        if (!out.has(q.name)) {
          out.set(q.name, { name:q.name, E:py[0], N:py[1], H:py[2], src:sid });
        }
      }
    }

    const list = Array.from(out.values()).sort((a,b)=>a.name.localeCompare(b.name));
    return { list, count:list.length };
  }, [data, order, refId, allowScale]);

  /** Render merged to textarea (edit / copy / paste OK) */
  const renderMerged = ()=>{
    if (!merged) return setMergedText("");
    const lines = merged.list.map(p=>`${p.name}, ${fmt(p.E)}, ${fmt(p.N)}, ${fmt(p.H)}`);
    setMergedText(lines.join("\n"));
  };

  /** Export merged CSV */
  const exportMerged = ()=>{
    if (!merged) return;
    const lines = ["name,E,N,H,source"];
    for (const p of merged.list) {
      lines.push(`${p.name},${fmt(p.E)},${fmt(p.N)},${fmt(p.H)},${p.src||refId}`);
    }
    const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "merged_station.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="page-title">🧩 Station Merge (Best-fit to Single Station)</div>
        <div className="small">
          Station1/2/3 … file တွေကို multi-import လုပ်ပြီး → name တူ control points ဖြင့် best-fit ပြောင်းညှိကာ →
          Reference station တစ်ခုတည်းအဖြစ် ပြန်ပေါင်းထုတ်ပေးပါတယ် (USB/phone import, export OK).
        </div>
      </div>

      <div className="card grid" style={{ gap: 10 }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <input type="file" accept=".csv,.txt" multiple onChange={onFiles} />
          <label className="small" style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input type="checkbox" checked={allowScale} onChange={e=>setAllowScale(e.target.checked)} />
            Allow scale (Similarity)
          </label>
        </div>

        {!!order.length && (
          <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
            <div className="small">Reference station:</div>
            <select className="input" value={refId} onChange={e=>setRefId(e.target.value)} style={{ width:240 }}>
              {order.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
            <div className="small">Loaded: <b>{order.length}</b> files</div>
          </div>
        )}

        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={renderMerged} disabled={!merged}>🔧 Build Merged Text</button>
          <button className="btn" style={{ background:"#334155" }} onClick={exportMerged} disabled={!merged}>⬇ Export CSV</button>
        </div>

        <textarea
          rows={10}
          className="input"
          value={mergedText}
          onChange={(e)=>setMergedText(e.target.value)}
          placeholder="Merged points will appear here (editable)…"
          style={{ fontFamily:"ui-monospace, Menlo, monospace" }}
        />
      </div>

      {!!order.length && (
        <div className="card">
          <div className="page-subtitle">📦 Loaded Preview</div>
          <div className="small">
            {order.map(id=>(
              <div key={id} style={{ marginBottom:6 }}>
                <b>{id}</b> — {data[id]?.length || 0} rows
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
        }
