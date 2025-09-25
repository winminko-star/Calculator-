// src/pages/StationMerge.jsx
import React, { useMemo, useState } from "react";
import {
  parseNameENHText, fmt,
  add3, mul3, mat3vec, bestFitTransform3D,
  applyNameMap, parseNameMapText, stringifyNameMapCSV
} from "../utils/stationMergeHelpers";

export default function StationMerge(){
  const [data, setData]   = useState({});
  const [order, setOrder] = useState([]);
  const [refId, setRefId] = useState("");
  const [allowScale, setAllowScale] = useState(false);

  const [nameMap, setNameMap] = useState({});
  const [mapText, setMapText] = useState("");

  const [mergedText, setMergedText] = useState("");
  const [showPreview, setShowPreview] = useState(false); // 👈 Preview control

  /* ------- Import Stations ------- */
  const onFiles = async (e)=>{ /* ... အဆင်မပြောင်း ... */ };

  /* ------- Import/Export Name Mapping ------- */
  const onImportMapFile = async (e)=>{ /* ... အဆင်မပြောင်း ... */ };
  const exportMapCSV = ()=>{ /* ... အဆင်မပြောင်း ... */ };
  const exportMapJSON = ()=>{ /* ... အဆင်မပြောင်း ... */ };
  const applyMapText = ()=> setNameMap(parseNameMapText(mapText));

  /* ------- Per-station controls ------- */
  const stationFits = useMemo(()=>{ /* ... အဆင်မပြောင်း ... */ }, [data, order, refId, allowScale, nameMap]);

  /* ------- Merge ------- */
  const merged = useMemo(()=>{ /* ... အဆင်မပြောင်း ... */ }, [data, order, refId, nameMap, stationFits]);

  /* ------- Export / Build text ------- */
  const exportMergedCSV = ()=>{
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

  // 👇 TXT export
  const exportMergedTXT = ()=>{
    if(!merged) return;
    const lines = merged.list.map(p=>`${p.name}\t${fmt(p.E)}\t${fmt(p.N)}\t${fmt(p.H)}\t${p.src||refId}`);
    const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "merged_station.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const buildMergedText = ()=>{
    if(!merged) return setMergedText("");
    setMergedText(merged.list.map(p=>`${p.name}, ${fmt(p.E)}, ${fmt(p.N)}, ${fmt(p.H)}`).join("\n"));
  };

  const removeStation = (id)=>{ /* ... အဆင်မပြောင်း ... */ };

  return (
    <div className="container grid" style={{ gap:12 }}>
      {/* ... အပေါ်ပိုင်း မပြောင်း ... */}

      {/* Build / Export + Textarea */}
      <div className="card grid" style={{ gap:10 }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <button className="btn" onClick={buildMergedText} disabled={!merged}>🔧 Build Merged Text</button>
          <button className="btn" style={{ background:"#334155" }} onClick={exportMergedCSV} disabled={!merged}>⬇ Export CSV</button>
          <button className="btn" style={{ background:"#0284c7" }} onClick={exportMergedTXT} disabled={!merged}>⬇ Export TXT</button>
          <button className="btn" style={{ background:"#10b981" }} onClick={()=>setShowPreview(true)} disabled={!merged}>👁 Preview</button>
        </div>

        <textarea
          rows={10}
          className="input"
          value={mergedText}
          onChange={(e)=>setMergedText(e.target.value)}
          placeholder="Merged points will appear here (editable)…"
          style={{ fontFamily:"ui-monospace, Menlo, monospace" }}
        />

        {/* Preview Modal */}
        {showPreview && (
          <div style={{
            position:"fixed", top:0, left:0, right:0, bottom:0,
            background:"rgba(0,0,0,0.6)", display:"flex", justifyContent:"center", alignItems:"center"
          }}>
            <div style={{ background:"#fff", padding:20, borderRadius:8, maxWidth:"80%", maxHeight:"80%", overflow:"auto" }}>
              <h3>👁 Preview Merged Data</h3>
              <pre style={{ whiteSpace:"pre-wrap", fontFamily:"ui-monospace" }}>
                {mergedText}
              </pre>
              <button className="btn" style={{ marginTop:12, background:"#ef4444" }} onClick={()=>setShowPreview(false)}>✖ Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
      }
