// src/utils/stationMergeHelpers.js

/* ========== Parsing (Name,E,N,H) ========== */
// support: "name, E, N, H" OR "name E N H" (commas/spaces mixed)
export function parseNameENHText(text) {
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
export const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");

/* ========== Name mapping helpers ========== */
// mapObj: { aliasName: canonicalName, ... }  (exact match)
export const mapName = (name, mapObj) => {
  if (!name) return name;
  return mapObj && mapObj[name] ? mapObj[name] : name;
};
export function applyNameMap(rows, mapObj) {
  if (!mapObj || !Object.keys(mapObj).length) return rows;
  return rows.map(p => ({ ...p, name: mapName(p.name, mapObj) }));
}

// Parse mapping from CSV/Lines/JSON
// - CSV/Lines: "from,to"  or  "from  to"
// - JSON: { "from":"to", ... }  or  [ {from:"", to:""}, ...]
export function parseNameMapText(text) {
  const s = (text || "").trim();
  const out = {};
  if (!s) return out;

  // JSON?
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const obj = JSON.parse(s);
      if (Array.isArray(obj)) {
        for (const it of obj) if (it && it.from && it.to) out[String(it.from)] = String(it.to);
      } else {
        for (const k of Object.keys(obj)) out[String(k)] = String(obj[k]);
      }
      return out;
    } catch {}
  }

  // CSV/Lines
  for (const ln of s.split(/\r?\n/)) {
    const t = ln.split(/[,\s]+/).filter(Boolean);
    if (t.length >= 2) out[String(t[0])] = String(t[1]);
  }
  return out;
}
export function stringifyNameMapCSV(mapObj) {
  const rows = [];
  for (const k of Object.keys(mapObj)) rows.push(`${k},${mapObj[k]}`);
  return rows.join("\n");
}

/* ========== Small 3D LA (flat 3×3) ========== */
export const sub3 = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const add3 = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const mul3 = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot3 = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

export function mat3mul(A,B){
  const C = new Array(9).fill(0);
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) for(let k=0;k<3;k++)
    C[r*3+c]+=A[r*3+k]*B[k*3+c];
  return C;
}
export function mat3vec(A,v){
  return [
    A[0]*v[0]+A[1]*v[1]+A[2]*v[2],
    A[3]*v[0]+A[4]*v[1]+A[5]*v[2],
    A[6]*v[0]+A[7]*v[1]+A[8]*v[2],
  ];
}
export const det3=(A)=>A[0]*(A[4]*A[8]-A[5]*A[7]) - A[1]*(A[3]*A[8]-A[5]*A[6]) + A[2]*(A[3]*A[7]-A[4]*A[6]);

/* ========== Eigen + SVD (3×3) ========== */
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
    for(let k=0;k<3;k++){ const apk=A[p*3+k], aqk=A[q*3+k]; A[p*3+k]=c*apk-s*aqk; A[q*3+k]=s*aqk+c*apk; }
    A[p*3+q]=A[q*3+p]=0;
    for(let k=0;k<3;k++){ const vkp=V[k*3+p], vkq=V[k*3+q]; V[k*3+p]=c*vkp-s*vkq; V[k*3+q]=s*vkp+c*vkq; }
  }
  return { eigVals:[A[0],A[4],A[8]], eigVecs:V };
}
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

/* ========== Best-fit (Kabsch / Similarity) ========== */
/** ref: [[E,N,H],...] , obs: [[E,N,H],...]
 * return { R(9), t(3), s, rms }
 */
export function bestFitTransform3D(ref, obs, {allowScale=false}={}) {
  const n=Math.min(ref.length, obs.length);
  if(n<3) return null;

  const mean3 = (arr)=>[
    arr.reduce((s,p)=>s+p[0],0)/arr.length,
    arr.reduce((s,p)=>s+p[1],0)/arr.length,
    arr.reduce((s,p)=>s+p[2],0)/arr.length,
  ];

  const cref=mean3(ref), cobs=mean3(obs);
  const sub3v=(p,c)=>[p[0]-c[0],p[1]-c[1],p[2]-c[2]];
  const X=ref.map(p=>sub3v(p,cref)), Y=obs.map(p=>sub3v(p,cobs));

  // H = Σ Y X^T
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
  if(allowScale){
    let num=S[0]+S[1]+S[2], den=0;
    for(const x of X) den+=dot3(x,x);
    s=den>0? num/den : 1;
  }

  const Rcobs = mat3vec(R, cobs);
  const t = sub3(cref, mul3(Rcobs, s));

  let sse=0;
  for(let i=0;i<n;i++){
    const py = add3(mul3(mat3vec(R, obs[i]), s), t);
    const r = sub3(ref[i], py);
    sse += dot3(r,r);
  }
  return { R, t, s, rms: Math.sqrt(sse/n) };
}
// src/pages/StationMerge.jsx
import React, { useMemo, useState } from "react";
import {
  parseNameENHText, fmt,
  add3, mul3, mat3vec, bestFitTransform3D,
  applyNameMap, mapName, parseNameMapText, stringifyNameMapCSV
} from "../utils/stationMergeHelpers";

export default function StationMerge(){
  // stationId -> rows[{name,E,N,H}]
  const [data, setData]   = useState({});
  const [order, setOrder] = useState([]);
  const [refId, setRefId] = useState("");
  const [allowScale, setAllowScale] = useState(false);

  // name mapping state (alias -> canonical)
  const [nameMap, setNameMap] = useState({});
  const [mapText, setMapText] = useState("");

  // merged text (for quick copy)
  const [mergedText, setMergedText] = useState("");

  /* ------- Import Stations (USB/phone OK) ------- */
  const onFiles = async (e)=>{
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    const next = {...data};
    const nextOrder = [...order];

    for(const f of files){
      const text = await f.text();
      const id = (f.name||"STATION").replace(/\.[^.]+$/,"");
      const rows = parseNameENHText(text);
      if(!rows.length) continue;
      next[id] = rows;
      if(!nextOrder.includes(id)) nextOrder.push(id);
    }
    setData(next);
    setOrder(nextOrder);
    if(!refId && nextOrder.length) setRefId(nextOrder[0]);
    e.target.value = "";
  };

  /* ------- Import/Export Name Mapping ------- */
  const onImportMapFile = async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const text = await f.text();
    const parsed = parseNameMapText(text);
    const merged = { ...nameMap, ...parsed };
    setNameMap(merged);
    setMapText(stringifyNameMapCSV(merged));
    e.target.value = "";
  };
  const exportMapCSV = ()=>{
    const csv = stringifyNameMapCSV(nameMap);
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "name_mapping.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const exportMapJSON = ()=>{
    const json = JSON.stringify(nameMap, null, 2);
    const blob = new Blob([json], { type:"application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "name_mapping.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const applyMapText = ()=>{
    const parsed = parseNameMapText(mapText);
    setNameMap(parsed);
  };

  /* ------- Build per-station "controls" & transforms ------- */
  const stationFits = useMemo(()=>{
    if(!refId || !data[refId]) return {};

    // reference (after mapping)
    const refRows0 = data[refId] || [];
    const refRows  = applyNameMap(refRows0, nameMap);
    const refMap   = new Map(refRows.map(p=>[p.name, [p.E,p.N,p.H]]));

    const fits = {};
    for(const sid of order){
      if(sid===refId) continue;
      const rows0 = data[sid] || [];
      const rows  = applyNameMap(rows0, nameMap);

      // controls: intersection by name (mapped)
      const refC=[], obsC=[];
      const controlNames=[];
      for(const q of rows){
        const r = refMap.get(q.name);
        if(r){
          refC.push(r);
          obsC.push([q.E,q.N,q.H]);
          controlNames.push(q.name);
        }
      }

      if(refC.length>=3){
        const fit = bestFitTransform3D(refC, obsC, { allowScale });
        fits[sid] = { ok:true, fit, controlCount:refC.length, controlNames };
      } else {
        fits[sid] = { ok:false, controlCount:refC.length, controlNames };
      }
    }
    return fits;
  }, [data, order, refId, allowScale, nameMap]);

  /* ------- Merge to reference frame (with mapping) ------- */
  const merged = useMemo(()=>{
    if(!refId || !data[refId]) return null;

    // reference (mapped)
    const refRows = applyNameMap(data[refId], nameMap);
    const refMap  = new Map(refRows.map(p=>[p.name, [p.E,p.N,p.H]]));

    // start with reference points
    const out = new Map(); // key = mappedName
    for(const p of refRows){
      out.set(p.name, { name:p.name, E:p.E, N:p.N, H:p.H, src:refId });
    }

    // loop other stations
    for(const sid of order){
      if(sid===refId) continue;
      const rows = applyNameMap(data[sid] || [], nameMap);
      if(!rows.length) continue;

      const fitInfo = stationFits[sid];
      if(!fitInfo || !fitInfo.ok) continue;

      const { fit } = fitInfo;
      for(const q of rows){
        const y=[q.E,q.N,q.H];
        const py = add3(mul3(mat3vec(fit.R, y), fit.s), fit.t);
        // keep reference’s coordinate if conflict by name
        if(!out.has(q.name)){
          out.set(q.name, { name:q.name, E:py[0], N:py[1], H:py[2], src:sid });
        }
      }
    }

    const list = Array.from(out.values()).sort((a,b)=>a.name.localeCompare(b.name));
    return { list, count:list.length };
  }, [data, order, refId, allowScale, nameMap, stationFits]);

  /* ------- Export merged CSV ------- */
  const exportMerged = ()=>{
    if(!merged) return;
    const lines = ["name,E,N,H,source"];
    for(const p of merged.list){
      lines.push(`${p.name},${fmt(p.E)},${fmt(p.N)},${fmt(p.H)},${p.src||refId}`);
    }
    const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "merged_station.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ------- Build merged text for quick copy ------- */
  const buildMergedText = ()=>{
    if(!merged) return setMergedText("");
    const lines = merged.list.map(p=>`${p.name}, ${fmt(p.E)}, ${fmt(p.N)}, ${fmt(p.H)}`);
    setMergedText(lines.join("\n"));
  };

  /* ------- Small UI helpers ------- */
  const removeStation = (id)=>{
    setOrder(s=>s.filter(x=>x!==id));
    setData(s=>{ const d={...s}; delete d[id]; return d; });
    if(refId===id){
      const rest = order.filter(x=>x!==id);
      setRefId(rest[0] || "");
    }
  };

  return (
    <div className="container grid" style={{ gap:12 }}>
      <div className="card">
        <div className="page-title">🧩 Station Merge (Best-fit + Name Mapping)</div>
        <div className="small">
          Station1/2/3 … ကို multi-import → <b>name mapping</b> (alias→canonical) သတ်မှတ်ပြီး →
          reference station ကို အခြေခံကာ <b>per-station controls</b> ဖြင့် best-fit ပြောင်းညှိ merge လုပ်ပေးမယ်။
          (USB/phone import & CSV/JSON export OK)
        </div>
      </div>

      {/* Import stations */}
      <div className="card grid" style={{ gap:10 }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <input type="file" accept=".csv,.txt" multiple onChange={onFiles} />
          <div className="small" style={{ color:"#64748b" }}>
            Format: <code>name,E,N,H</code> (comma/space OK)
          </div>
        </div>

        {!!order.length && (
          <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
            <div className="small">Reference:</div>
            <select className="input" value={refId} onChange={e=>setRefId(e.target.value)} style={{ width:240 }}>
              {order.map(id=><option key={id} value={id}>{id}</option>)}
            </select>

            <label className="small" style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input type="checkbox" checked={allowScale} onChange={e=>setAllowScale(e.target.checked)} />
              Allow scale (Similarity)
            </label>

            <div className="small">Loaded: <b>{order.length}</b> files</div>
          </div>
        )}
      </div>

      {/* Name Mapping */}
      <div className="card grid" style={{ gap:10 }}>
        <div className="page-title">🔗 Name Mapping (alias → canonical)</div>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <input type="file" accept=".csv,.txt,.json" onChange={onImportMapFile} />
          <button className="btn" onClick={exportMapCSV}>⬇ Export CSV</button>
          <button className="btn" style={{ background:"#334155" }} onClick={exportMapJSON}>⬇ Export JSON</button>
        </div>
        <textarea
          rows={6}
          className="input"
          value={mapText}
          onChange={(e)=>setMapText(e.target.value)}
          placeholder={`alias, canonical\nP01, E1\nPT-2, E2`}
          style={{ fontFamily:"ui-monospace, Menlo, monospace" }}
        />
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={applyMapText}>✔ Apply Mapping</button>
          <button className="btn" style={{ background:"#ef4444" }}
            onClick={()=>{ setNameMap({}); setMapText(""); }}>✖ Clear Mapping</button>
        </div>

        {/* Mapping preview */}
        <div className="small" style={{ color:"#64748b" }}>
          {Object.keys(nameMap).length
            ? <>Active mappings: <b>{Object.keys(nameMap).length}</b></>
            : <>No mapping.</>}
        </div>
      </div>

      {/* Per-station Controls & RMS */}
      {!!order.length && refId && (
        <div className="card grid" style={{ gap:12 }}>
          <div className="page-title">📋 Per-Station Controls</div>
          {order.filter(id=>id!==refId).map(id=>{
            const info = stationFits[id];
            return (
              <div key={id} className="card" style={{ background:"#fff", border:"1px solid #e5e7eb" }}>
                <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
                  <div><b>{id}</b></div>
                  <button className="btn" style={{ background:"#ef4444" }} onClick={()=>removeStation(id)}>✖ Remove</button>
                </div>
                {!info && <div className="small">No data.</div>}
                {info && (
                  <>
                    <div className="row" style={{ gap:12, flexWrap:"wrap" }}>
                      <div className="small">Controls: <b>{info.controlCount}</b></div>
                      {info.ok
                        ? <div className="small">RMS: <b>{fmt(info.fit?.rms, 3)}</b></div>
                        : <div className="small" style={{ color:"#ef4444" }}>Need ≥ 3 common names</div>}
                      {info.ok && (
                        <>
                          <div className="small">Scale s: <b>{fmt(info.fit?.s, 6)}</b></div>
                          <div className="small">t: <b>[{fmt(info.fit?.t?.[0])}, {fmt(info.fit?.t?.[1])}, {fmt(info.fit?.t?.[2])}]</b></div>
                        </>
                      )}
                    </div>
                    <div className="small" style={{
                      marginTop:6, maxHeight:120, overflow:"auto",
                      border:"1px dashed #e5e7eb", borderRadius:8, padding:8, background:"#f8fafc"
                    }}>
                      {info.controlCount
                        ? info.controlNames.sort().join(", ")
                        : "No matching names."}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loaded list & remove */}
      {!!order.length && (
        <div className="card">
          <div className="page-subtitle">📦 Loaded Files</div>
          <div className="small">
            {order.map(id=>(
              <div key={id} className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
                <div><b>{id}</b> — {data[id]?.length||0} rows</div>
                {id!==refId && (
                  <button className="btn" style={{ background:"#ef4444" }} onClick={()=>removeStation(id)}>✖ Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Build / Export + Textarea */}
      <div className="card grid" style={{ gap:10 }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={buildMergedText} disabled={!merged}>🔧 Build Merged Text</button>
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
    </div>
  );
}
