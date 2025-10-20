// 💡 IDEA by WIN MIN KO
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  // ---------- STATES ----------
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [info, setInfo] = useState("");

  // filter
  const [filterOpen, setFilterOpen] = useState(false);
  const [keepMap, setKeepMap] = useState({});

  // merge
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [merged, setMerged] = useState([]);
  const [mergeSummaries, setMergeSummaries] = useState([]);
  const TOL = 0.003;

  // geometry diff
  const [geomDiff, setGeomDiff] = useState([]);
  const [geomShow, setGeomShow] = useState(false);

  // transforms
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
  const [fitPts, setFitPts] = useState([
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
  ]);
  const [transformed, setTransformed] = useState([]);
  const [lastMethod, setLastMethod] = useState("");

  // ---------- FILE UPLOAD ----------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      setGroups(parseSTAFile(text));
      setInfo("✅ File loaded successfully");
      setKeepMap({});
      setFromSta("");
      setToSta("");
      setMerged([]);
      setMergeSummaries([]);
      setGeomDiff([]);
      setGeomShow(false);
      setRefA("");
      setRefB("");
      setTransformed([]);
      setLastMethod("");
    };
    r.readAsText(f);
  };

  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let current = null;
    for (let raw of lines) {
      if (!raw.trim()) continue;
      const p = raw.split(",").map((x) => x.trim());
      if (p.length < 4) continue;
      const [name, e, n, h] = p;
      if (/^STA\d+/i.test(name)) {
        current = name;
        out[current] = [];
        continue;
      }
      if (current) {
        const E = +e, N = +n, H = +h;
        if ([E, N, H].every(Number.isFinite))
          out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ---------- FILTER ----------
  const toggleKeep = (sta, pt) => {
    setKeepMap((prev) => {
      const s = { ...(prev[sta] || {}) };
      s[pt] = !(s[pt] === false);
      return { ...prev, [sta]: s };
    });
  };

  const applyFilter = () => {
    const next = {};
    for (const [sta, pts] of Object.entries(groups)) {
      const km = keepMap[sta] || {};
      next[sta] = pts.filter((p) => km[p.name] !== false);
    }
    setGroups(next);
    setFilterOpen(false);
    setInfo("✅ Filter applied (unchecked points removed)");
  };
  // ---------- MERGE ----------
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names first");
    if (fromSta === toSta) return setInfo("⚠️ Choose different STAs");
    if (!groups[fromSta] || !groups[toSta]) return setInfo("⚠️ Invalid STA names");

    const base = groups[fromSta];
    const next = groups[toSta];
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (common.length === 0) return setInfo("⚠️ No common points");

    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      dE += a.E - b.E; dN += a.N - b.N; dH += a.H - b.H;
    }
    dE /= common.length; dN /= common.length; dH /= common.length;

    const newPts = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH }));
    const mergedArr = [...base, ...newPts];

    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta}`);

    computeGeometryDiff(baseMap, nextMap);
  };

  // ---------- GEOMETRY DIFF ----------
  function fitSimilarity2D(basePts, movePts) {
    const n = basePts.length;
    let cEx=0,cEy=0,cMx=0,cMy=0;
    for(let i=0;i<n;i++){
      cEx+=basePts[i][0];cEy+=basePts[i][1];
      cMx+=movePts[i][0];cMy+=movePts[i][1];
    }
    cEx/=n;cEy/=n;cMx/=n;cMy/=n;
    let Sxx=0,Sxy=0,normM=0,normB=0;
    for(let i=0;i<n;i++){
      const bx=basePts[i][0]-cEx,by=basePts[i][1]-cEy;
      const mx=movePts[i][0]-cMx,my=movePts[i][1]-cMy;
      Sxx+=mx*bx+my*by;
      Sxy+=mx*by-my*bx;
      normM+=mx*mx+my*my;normB+=bx*bx+by*by;
    }
    const scale=Math.sqrt(normB/normM);
    const r=Math.hypot(Sxx,Sxy)||1e-12;
    const cos=Sxx/r,sin=Sxy/r;
    const tx=cEx-scale*(cos*cMx-sin*cMy);
    const ty=cEy-scale*(sin*cMx+cos*cMy);
    return {scale,cos,sin,tx,ty};
  }

  const computeGeometryDiff=(baseMap,nextMap)=>{
    const names=[...baseMap.keys()].filter(k=>nextMap.has(k));
    if(names.length<2)return;
    const B=names.map(n=>[baseMap.get(n).E,baseMap.get(n).N]);
    const M=names.map(n=>[nextMap.get(n).E,nextMap.get(n).N]);
    const {scale,cos,sin,tx,ty}=fitSimilarity2D(B,M);
    let dHsum=0;for(const n of names)dHsum+=baseMap.get(n).H-nextMap.get(n).H;
    const dHavg=dHsum/names.length;
    const ref=names[0];
    const rB=baseMap.get(ref),rM=nextMap.get(ref);
    const rMx=scale*(cos*rM.E-sin*rM.N)+tx;
    const rMy=scale*(sin*rM.E+cos*rM.N)+ty;
    const rMh=rM.H+dHavg;
    const diffs=[];
    for(let i=1;i<names.length;i++){
      const nm=names[i];
      const b=baseMap.get(nm),m=nextMap.get(nm);
      const mX=scale*(cos*m.E-sin*m.N)+tx;
      const mY=scale*(sin*m.E+cos*m.N)+ty;
      const mH=m.H+dHavg;
      const dE1=b.E-rB.E,dN1=b.N-rB.N,dH1=b.H-rB.H;
      const dE2=mX-rMx,dN2=mY-rMy,dH2=mH-rMh;
      const de=dE1-dE2,dn=dN1-dN2,dh=dH1-dH2;
      const dmm=Math.sqrt(de*de+dn*dn+dh*dh)*1000;
      diffs.push({name:`${ref}→${nm}`,dE1,dE2,de,dn,dh,dmm});
    }
    setGeomDiff(diffs);
    setGeomShow(true);
  };
  // ---------- EXPORT ----------
  const onExport = () => {
    const data = transformed.length ? transformed : geomDiff.length ? geomDiff : merged;
    if (!data.length) return alert("No data to export.");
    const txt = data.map(p =>
      p.name ? `${p.name}\t${(p.E??p.de).toFixed(3)}\t${(p.N??p.dn).toFixed(3)}\t${(p.H??p.dh).toFixed(3)}\t${(p.dmm??0).toFixed(1)}`
      : ""
    ).join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Final_WMK.txt";
    a.click();
  };

  // ---------- UI ----------
  return (
    <div className="sta-merge">
      <h1>💡 IDEA by WIN MIN KO</h1>
      <h2>📐 Station Merge + Filter + Geometry Tools</h2>

      <div className="card">
        <input type="file" accept=".txt" onChange={onFile}/>
        {info && <div className="msg">{info}</div>}
      </div>

      {/* FILTER PANEL */}
      {Object.keys(groups).length>0 && (
        <div className="card">
          <h3>🧹 Remove Unwanted Points</h3>
          <button onClick={()=>setFilterOpen(v=>!v)}>
            {filterOpen?"Hide":"Show Points"}
          </button>
          {filterOpen && (
            <>
              {Object.entries(groups).map(([sta,pts])=>(
                <div key={sta} className="sta-card">
                  <h4>{sta}</h4>
                  <div className="grid2">
                    {pts.map((p,i)=>(
                      <label key={i} className="chk">
                        <input
                          type="checkbox"
                          checked={keepMap[sta]?.[p.name]!==false}
                          onChange={()=>toggleKeep(sta,p.name)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={applyFilter}>✔ Apply Filter</button>
            </>
          )}
        </div>
      )}

      {/* CHOOSE STAs */}
      {Object.keys(groups).length>0 && (
        <div className="card">
          <h3>🧩 Choose STAs</h3>
          <div className="row">
            <select value={fromSta} onChange={e=>setFromSta(e.target.value)}>
              <option value="">From (Base)</option>
              {Object.keys(groups).map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={toSta} onChange={e=>setToSta(e.target.value)}>
              <option value="">To (Compare)</option>
              {Object.keys(groups).map(s=><option key={s}>{s}</option>)}
            </select>
            <button onClick={handleMerge}>🔄 Compare</button>
            <button onClick={onExport}>💾 Export</button>
          </div>
        </div>
      )}

      {/* GEOMETRY DIFF TABLE */}
      {geomShow && (
        <div className="card">
          <div className="row space-between">
            <h3>📊 Geometry Difference</h3>
            <button onClick={()=>setGeomShow(false)}>✔ Accept</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Ref→Pt</th><th>ΔE₁</th><th>ΔE₂</th>
                  <th>ΔE diff</th><th>ΔN diff</th><th>ΔH diff</th><th>Δmm</th>
                </tr>
              </thead>
              <tbody>
                {geomDiff.map((p,i)=>(
                  <tr key={i} className={p.dmm>3?"err":""}>
                    <td>{p.name}</td>
                    <td>{p.dE1.toFixed(3)}</td>
                    <td>{p.dE2.toFixed(3)}</td>
                    <td>{p.de.toFixed(3)}</td>
                    <td>{p.dn.toFixed(3)}</td>
                    <td>{p.dh.toFixed(3)}</td>
                    <td>{p.dmm.toFixed(1)} mm</td>
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
