// 💡 IDEA by WIN MIN KO
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  // ---------- core states ----------
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);                 // last merged base group content
  const [info, setInfo] = useState("");

  // merge choose
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");

  // tolerance summary (classic)
  const [mergeSummaries, setMergeSummaries] = useState([]); // [{group, count, maxmm}]

  // geometry diff (1→All) after best-fit
  const [geomDiff, setGeomDiff] = useState([]);             // rows
  const [showGeom, setShowGeom] = useState(false);

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
  const [lastMethod, setLastMethod] = useState("");         // "Reference Line" | "4-Point Fit"

  // ---------- file upload ----------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      setGroups(parseSTAFile(text));
      setInfo("✅ File loaded successfully");
      // reset all
      setMerged([]); setTransformed([]); setMergeSummaries([]); setGeomDiff([]); setShowGeom(false);
      setFromSta(""); setToSta(""); setRefA(""); setRefB("");
      setLastMethod("");
    };
    r.readAsText(f);
  };

  // ---------- parser (CSV lines, STA header ENH ignored) ----------
  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let current = null;
    for (let raw of lines) {
      if (!raw.trim()) continue;
      const parts = raw.split(",").map((x) => x.trim());
      if (parts.length < 4) continue;
      const [name, e, n, h] = parts;
      if (/^STA\d+/i.test(name)) {
        current = name;
        out[current] = [];
        continue;
      }
      if (current) {
        const E = parseFloat(e), N = parseFloat(n), H = parseFloat(h);
        if ([E, N, H].every(Number.isFinite)) out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ---------- MERGE (pair) + tolerance check + geometry diff ----------
  const TOL = 0.003; // 3 mm
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names first");
    if (fromSta === toSta) return setInfo("⚠️ Choose different STAs");
    if (!groups[fromSta] || !groups[toSta]) return setInfo("⚠️ Invalid STA names");

    const base = groups[fromSta];
    const next = groups[toSta];
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));

    if (common.length === 0) {
      // simple union if no common
      const mergedArr = [...base, ...next];
      const newGroups = { ...groups };
      delete newGroups[toSta];
      newGroups[fromSta] = mergedArr;
      setGroups(newGroups);
      setMerged(mergedArr);
      setInfo(`✅ ${fromSta} merged with ${toSta} (no common pts)`);
      setMergeSummaries([]);
      setGeomDiff([]); setShowGeom(false);
      setTransformed([]); setLastMethod("");
      return;
    }

    // average translation using common points (legacy merge rule)
    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      dE += a.E - b.E; dN += a.N - b.N; dH += a.H - b.H;
    }
    dE /= common.length; dN /= common.length; dH /= common.length;

    // tolerance residuals for common points (info bar)
    let exceedCount = 0, maxmm = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      const rE = (b.E + dE) - a.E;
      const rN = (b.N + dN) - a.N;
      const rH = (b.H + dH) - a.H;
      const dmm = Math.sqrt(rE*rE + rN*rN + rH*rH);
      if (dmm > TOL) exceedCount++;
      if (dmm > maxmm) maxmm = dmm;
    }
    setMergeSummaries([{ group: toSta, count: exceedCount, maxmm }]);

    // apply translation to unique points from 'toSta'
    const newPts = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH }));
    const mergedArr = [...base, ...newPts];

    // mutate groups: remove 'toSta', keep 'fromSta'
    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setTransformed([]); setLastMethod("");
    setInfo(`✅ Merged ${toSta} → ${fromSta} (refs=${common.length})`);

    // also compute best-fit geometry-diff (1→All) for diagnostics
    computeGeometryDiffFit(baseMap, nextMap);
  };

  // ---------- Best-fit (rotation + scale + translation) for EN ----------
  function fitSimilarity2D(basePts, movePts) {
    const n = basePts.length;
    let cEx=0,cEy=0,cMx=0,cMy=0;
    for (let i=0;i<n;i++){ cEx+=basePts[i][0]; cEy+=basePts[i][1]; cMx+=movePts[i][0]; cMy+=movePts[i][1]; }
    cEx/=n; cEy/=n; cMx/=n; cMy/=n;
    let Sxx=0,Sxy=0,normM=0,normB=0;
    for (let i=0;i<n;i++){
      const bx=basePts[i][0]-cEx, by=basePts[i][1]-cEy;
      const mx=movePts[i][0]-cMx, my=movePts[i][1]-cMy;
      Sxx += mx*bx + my*by;
      Sxy += mx*by - my*bx;
      normM += mx*mx + my*my;
      normB += bx*bx + by*by;
    }
    const scale = Math.sqrt(normB / normM);
    const r = Math.hypot(Sxx, Sxy) || 1e-12;
    const cos = Sxx / r, sin = Sxy / r;
    const tx = cEx - scale*(cos*cMx - sin*cMy);
    const ty = cEy - scale*(sin*cMx + cos*cMy);
    return { scale, cos, sin, tx, ty };
  }

  function computeGeometryDiffFit(baseMap, nextMap) {
    const names = [...baseMap.keys()].filter(k => nextMap.has(k));
    if (names.length < 2) { setGeomDiff([]); setShowGeom(false); return; }

    // build arrays to fit (EN only)
    const B = names.map(n => [baseMap.get(n).E, baseMap.get(n).N]);
    const M = names.map(n => [nextMap.get(n).E, nextMap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);

    // mean height shift
    const dHavg = names.reduce((acc, n) => acc + (baseMap.get(n).H - nextMap.get(n).H), 0) / names.length;

    // reference = first common
    const ref = names[0];
    const rB = baseMap.get(ref);
    const rM = nextMap.get(ref);
    const rMx = scale*(cos*rM.E - sin*rM.N) + tx;
    const rMy = scale*(sin*rM.E + cos*rM.N) + ty;
    const rMh = rM.H + dHavg;

    const rows = [];
    for (let i = 1; i < names.length; i++) {
      const nm = names[i];
      const b = baseMap.get(nm), m = nextMap.get(nm);
      const mX = scale*(cos*m.E - sin*m.N) + tx;
      const mY = scale*(sin*m.E + cos*m.N) + ty;
      const mH = m.H + dHavg;

      // vectors from ref(1→i)
      const dE1 = b.E - rB.E, dN1 = b.N - rB.N, dH1 = b.H - rB.H;
      const dE2 = mX - rMx,  dN2 = mY - rMy,  dH2 = mH - rMh;

      const de = dE1 - dE2, dn = dN1 - dN2, dh = dH1 - dH2;
      const dmm = Math.sqrt(de*de + dn*dn + dh*dh) * 1000; // mm
      rows.push({ name: `${ref}→${nm}`, dE1, dE2, de, dn, dh, dmm });
    }
    setGeomDiff(rows);
    setShowGeom(true);
  }

  const handleAccept = () => {
    setShowGeom(false);
    setGeomDiff([]);
    setInfo("✅ Accepted. Ready for next merge.");
  };

  // ---------- Reference Line Transform ----------
  const applyRefLine = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    const map = new Map(merged.map((p) => [p.name, p]));
    const A = map.get(refA.trim()), B = map.get(refB.trim());
    if (!A || !B) return setInfo("⚠️ Invalid reference points.");

    const dE = B.E - A.E, dN = B.N - A.N, dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("⚠️ Reference points are coincident in E/N.");
    const phi = Math.atan2(dE, dN); // rotate so B becomes (0,+dist)
    const c = Math.cos(phi), s = Math.sin(phi);

    const out = merged.map((p) => {
      const e0 = p.E - A.E, n0 = p.N - A.N, h0 = p.H - A.H;
      return { name: p.name, E: c*e0 - s*n0, N: s*e0 + c*n0, H: h0 };
    });
    setTransformed(out);
    setLastMethod("Reference Line");
    setInfo(`✅ Reference line applied — A→(0,0,0), B→(0, ${dist.toFixed(3)}, ${dH.toFixed(3)})`);
  };

  // ---------- 4-Point Manual Fit (3D affine exact, 4 pts) ----------
  function solveLinear(A, b) { // 12x12
    const n = A[0].length;
    for (let i = 0; i < n; i++) {
      let max = i;
      for (let j = i+1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j;
      [A[i], A[max]] = [A[max], A[i]]; [b[i], b[max]] = [b[max], b[i]];
      const div = A[i][i]; for (let k=i; k<n; k++) A[i][k] /= div; b[i] /= div;
      for (let r=0; r<n; r++) if (r!==i) {
        const f = A[r][i];
        for (let k=i; k<n; k++) A[r][k] -= f*A[i][k];
        b[r] -= f*b[i];
      }
    }
    return b;
  }

  const apply4PointFit = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    for (const p of fitPts) if (!p.name || p.E==="" || p.N==="" || p.H==="") return setInfo("⚠️ Fill all 4 points.");
    const srcMap = new Map(merged.map((p) => [p.name, p]));
    const src=[], tgt=[];
    for (const p of fitPts) {
      const s = srcMap.get(p.name.trim());
      if (!s) return setInfo(`⚠️ Source point not found: ${p.name}`);
      src.push([s.E, s.N, s.H]); tgt.push([+p.E, +p.N, +p.H]);
    }
    const A=[], b=[];
    for (let i=0;i<4;i++){
      const [xs,ys,zs]=src[i], [xt,yt,zt]=tgt[i];
      A.push([xs,ys,zs,0,0,0,0,0,0,1,0,0]); b.push(xt);
      A.push([0,0,0,xs,ys,zs,0,0,0,0,1,0]); b.push(yt);
      A.push([0,0,0,0,0,0,xs,ys,zs,0,0,1]); b.push(zt);
    }
    const x = solveLinear(A,b);
    const out = merged.map(p => ({
      name: p.name,
      E: x[0]*p.E + x[1]*p.N + x[2]*p.H + x[9],
      N: x[3]*p.E + x[4]*p.N + x[5]*p.H + x[10],
      H: x[6]*p.E + x[7]*p.N + x[8]*p.H + x[11],
    }));
    setTransformed(out);
    setLastMethod("4-Point Fit");
    setInfo("✅ 4-Point Fit applied.");
  };

  // ---------- Export (transformed first, else merged) ----------
  const onExport = () => {
    const data = transformed.length ? transformed : merged;
    if (!data.length) return alert("No data to export.");
    const txt = data.map(p => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`).join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = transformed.length ? `Final_${lastMethod.replace(/\s+/g,"")}.txt` : "Merged_STA.txt";
    a.click();
  };

  const staNames = Object.keys(groups);

  return (
    <div className="sta-merge">
      <h1>💡 IDEA by WIN MIN KO</h1>
      <h2>📐 Station Merge + Transform</h2>

      <div className="card">
        <input type="file" accept=".txt" onChange={onFile} />
        {info && <div className="msg">{info}</div>}
      </div>

      {rawText && (
        <div className="card">
          <h3>🧾 Original Upload Preview</h3>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {staNames.length > 0 && (
        <div className="card">
          <h3>🧩 Choose Two STAs to Merge</h3>
          <div className="row">
            <select value={fromSta} onChange={(e)=>setFromSta(e.target.value)}>
              <option value="">-- From (Base) --</option>
              {staNames.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={toSta} onChange={(e)=>setToSta(e.target.value)}>
              <option value="">-- To (Merge Into Base) --</option>
              {staNames.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={handleMerge}>🔄 Merge / Check</button>
            <button onClick={onExport}>💾 Export TXT</button>
          </div>
          <div className="hint">After merge → Base STA name remains, second one disappears.</div>

          {mergeSummaries.length>0 && (
            <div className="summary">
              <h4>Merge tolerance summary (3 mm):</h4>
              {mergeSummaries.map((s,i)=> s.count>0 ? (
                <div key={i} className="line bad">⚠ {s.group} → exceeded tolerance on {s.count} ref point(s), max = {(s.maxmm*1000).toFixed(1)} mm</div>
              ) : (
                <div key={i} className="line ok">✅ {s.group} → within tolerance (all refs ≤ 3 mm)</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Geometry difference (best-fit) */}
      {showGeom && geomDiff.length>0 && (
        <div className="card">
          <div className="row space-between">
            <h3>📊 Geometry Difference (1 → Others, best-fit)</h3>
            <button onClick={handleAccept}>✔ Accept</button>
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
                {geomDiff.map((r,i)=>(
                  <tr key={i} className={r.dmm>3 ? "err" : ""}>
                    <td>{r.name}</td>
                    <td>{r.dE1.toFixed(3)}</td>
                    <td>{r.dE2.toFixed(3)}</td>
                    <td>{r.de.toFixed(3)}</td>
                    <td>{r.dn.toFixed(3)}</td>
                    <td>{r.dh.toFixed(3)}</td>
                    <td>{r.dmm.toFixed(1)} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Group lists */}
      {Object.keys(groups).length > 0 && (
        <div className="sta-list">
          {Object.entries(groups).map(([sta, pts]) => (
            <div key={sta} className="sta-card">
              <h3>{sta}</h3>
              <Table rows={pts} />
            </div>
          ))}
        </div>
      )}

      {/* Last merged preview */}
      {merged.length > 0 && (
        <div className="card">
          <h3>✅ Last Merged Result ({merged.length} pts)</h3>
          <Table rows={merged} />
        </div>
      )}

      {/* Transform methods (on final merged only) */}
      {merged.length > 0 && (
        <div className="card">
          <h3>📏 Transform (choose one)</h3>
          <div className="grid2">
            <div>
              <h4>Reference Line</h4>
              <div className="grid2">
                <input placeholder="Point A" value={refA} onChange={(e)=>setRefA(e.target.value)} />
                <input placeholder="Point B" value={refB} onChange={(e)=>setRefB(e.target.value)} />
              </div>
              <button onClick={applyRefLine}>▶ Apply Reference Line</button>
            </div>
            <div>
              <h4>4-Point Manual Fit</h4>
              <div className="fit-grid">
                {fitPts.map((p,idx)=>(
                  <div key={idx} className="fit-row">
                    <input className="nm" placeholder="Name" value={p.name}
                      onChange={(e)=>{const a=[...fitPts]; a[idx].name=e.target.value; setFitPts(a);}} />
                    {["E","N","H"].map(k=>(
                      <input key={k} placeholder={k} value={p[k]}
                        onChange={(e)=>{const a=[...fitPts]; a[idx][k]=e.target.value; setFitPts(a);}} />
                    ))}
                  </div>
                ))}
              </div>
              <button onClick={apply4PointFit}>▶ Apply 4-Point Fit</button>
            </div>
          </div>
        </div>
      )}

      {/* Transformed Preview + Final Export */}
      {transformed.length > 0 && (
        <div className="card">
          <h3>🔄 Transformed Result ({lastMethod})</h3>
          <Table rows={transformed} />
          <div className="row end"><button onClick={onExport}>📄 Final Export TXT</button></div>
        </div>
      )}
    </div>
  );
}

function Table({ rows }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr><th className="left">Point</th><th>E</th><th>N</th><th>H</th></tr>
        </thead>
        <tbody>
          {rows.map((p,i)=>(
            <tr key={i}>
              <td className="left">{p.name}</td>
              <td>{Number.isFinite(p.E) ? p.E.toFixed(3) : ""}</td>
              <td>{Number.isFinite(p.N) ? p.N.toFixed(3) : ""}</td>
              <td>{Number.isFinite(p.H) ? p.H.toFixed(3) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
    }
