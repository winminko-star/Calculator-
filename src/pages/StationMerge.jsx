// src/pages/StationMerge.jsx
import React, { useMemo, useState } from "react";
import {
  parseNameENHText, fmt,
  add3, mul3, mat3vec, bestFitTransform3D,
  applyNameMap, parseNameMapText, stringifyNameMapCSV
} from "../utils/stationMergeHelpers";

export default function StationMerge(){
  const [data, setData]   = useState({});   // stationId -> rows[{name,E,N,H}]
  const [order, setOrder] = useState([]);   // stationIds (keep order)
  const [refId, setRefId] = useState("");   // reference station
  const [allowScale, setAllowScale] = useState(false);

  // name mapping (alias -> canonical)
  const [nameMap, setNameMap] = useState({});
  const [mapText, setMapText] = useState("");

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
  const applyMapText = ()=> setNameMap(parseNameMapText(mapText));

  /* ------- Per-station controls & transforms ------- */
  const stationFits = useMemo(()=>{
    if(!refId || !data[refId]) return {};
    const refRows = applyNameMap(data[refId], nameMap);
    const refMap  = new Map(refRows.map(p=>[p.name, [p.E,p.N,p.H]]));

    const fits = {};
    for(const sid of order){
      if(sid===refId) continue;
      const rows = applyNameMap(data[sid]||[], nameMap);
      const refC=[], obsC=[], names=[];
      for(const q of rows){
        const r = refMap.get(q.name);
        if(r){ refC.push(r); obsC.push([q.E,q.N,q.H]); names.push(q.name); }
      }
      if(refC.length>=3){
        const fit = bestFitTransform3D(refC, obsC, { allowScale });
        fits[sid] = { ok:true, fit, controlCount:refC.length, controlNames:names };
      }else{
        fits[sid] = { ok:false, controlCount:refC.length, controlNames:names };
      }
    }
    return fits;
  }, [data, order, refId, allowScale, nameMap]);

  /* ------- Merge to reference frame ------- */
  const merged = useMemo(()=>{
    if(!refId || !data[refId]) return null;
    const refRows = applyNameMap(data[refId], nameMap);
    const out = new Map(); // mapped name -> point
    for(const p of refRows) out.set(p.name, { name:p.name, E:p.E, N:p.N, H:p.H, src:refId });

    for(const sid of order){
      if(sid===refId) continue;
      const info = stationFits[sid];
      if(!info?.ok) continue;
      const rows = applyNameMap(data[sid]||[], nameMap);
      for(const q of rows){
        const y=[q.E,q.N,q.H];
        const py = add3(mul3(mat3vec(info.fit.R, y), info.fit.s), info.fit.t);
        if(!out.has(q.name)){
          out.set(q.name, { name:q.name, E:py[0], N:py[1], H:py[2], src:sid });
        }
      }
    }
    const list = Array.from(out.values()).sort((a,b)=>a.name.localeCompare(b.name));
    return { list, count:list.length };
  }, [data, order, refId, nameMap, stationFits]);

  /* ------- Export / Build text ------- */
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
  const buildMergedText = ()=>{
    if(!merged) return setMergedText("");
    setMergedText(merged.list.map(p=>`${p.name}, ${fmt(p.E)}, ${fmt(p.N)}, ${fmt(p.H)}`).join("\n"));
  };

  /* ------- UI helpers ------- */
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
          Multi-import → Name mapping (alias→canonical) → Reference သို့ best-fit ပြောင်းညှိ → merge (USB/phone import/export OK)
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
        <div className="small" style={{ color:"#64748b" }}>
          {Object.keys(nameMap).length
            ? <>Active mappings: <b>{Object.keys(nameMap).length}</b></>
            : <>No mapping.</>}
        </div>
      </div>

      {/* Per-station controls */}
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
                      {info.controlCount ? info.controlNames.sort().join(", ") : "No matching names."}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loaded list */}
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
