// src/pages/StationMerge.jsx
// 💡 SEATRIUM
// Reference Line only (4-point UI/logic removed), supports single-group files (no merge needed).
import React, { useMemo, useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  // -------------------- States --------------------
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});                 // {STA1:[{name,E,N,H},...], ...}
  const [info, setInfo] = useState("");

  // Filter (unwanted points)
  const [filterOpen, setFilterOpen] = useState(false);
  const [keepMap, setKeepMap] = useState({});               // {STA:{ptName:true/false}}

  // Merge
  const [fromSta, setFromSta] = useState("");
  const [toSta,   setToSta]   = useState("");
  const [merged,  setMerged]  = useState([]);               // last merged (working set when >0)
  const [mergeSummaries, setMergeSummaries] = useState([]); // [{group, count, maxmm}]
  const TOL = 0.003; // 3 mm

  // Geometry diff (1→All) after best-fit
  const [geomDiff,    setGeomDiff]    = useState([]);       // [{name, dE1,dE2,de,dn,dh,dmm}]
  const [geomShow,    setGeomShow]    = useState(false);
  const [geomHideSet, setGeomHideSet] = useState(new Set());

  // Reference line
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");

  // Transform preview
  const [transformed, setTransformed] = useState([]);
  const [lastMethod,  setLastMethod]  = useState("");       // "Reference Line"

  // -------------------- File Upload & Parse --------------------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = String(ev.target.result || "");
      setRawText(text);
      const parsed = parseSTAFile(text);
      setGroups(parsed);
      setInfo("✅ File loaded successfully");

      // reset UI states
      setKeepMap({});
      setFromSta(""); setToSta("");
      setMerged([]); setMergeSummaries([]);
      setGeomDiff([]); setGeomShow(false); setGeomHideSet(new Set());
      setTransformed([]); setLastMethod("");
      setRefA(""); setRefB("");

      // 👉 One-group auto-setup (works without merge)
      const ks = Object.keys(parsed);
      if (ks.length === 1) {
        const only = ks[0];
        setFromSta(only);
        setMerged(parsed[only]);   // merged working set ready
        setInfo("✅ Loaded single group — ready for Reference Line");
      }
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
        if ([E, N, H].every(Number.isFinite)) out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // -------------------- Filter (Unwanted Points) --------------------
  const toggleKeep = (sta, pt) => {
    setKeepMap((prev) => {
      const s = { ...(prev[sta] || {}) };
      s[pt] = !(s[pt] === false); // default true; click toggles false
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
    setInfo("✅ Filter applied (removed unchecked points).");
  };

  // -------------------- Helpers --------------------
  const staNames = Object.keys(groups);
  const staSortedEntries = useMemo(
    () =>
      Object.entries(groups).map(([sta, pts]) => [
        sta,
        [...pts].sort((a, b) => a.name.localeCompare(b.name)),
      ]),
    [groups]
  );

  const deleteGroup = (sta) => {
    const copy = { ...groups };
    delete copy[sta];
    setGroups(copy);
    if (fromSta === sta) setFromSta("");
    if (toSta   === sta) setToSta("");
    setInfo(`🗑️ Removed ${sta}`);
  };

  // -------------------- Merge (Pair) --------------------
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names first");
    if (fromSta === toSta)  return setInfo("⚠️ Choose different STAs");
    if (!groups[fromSta] || !groups[toSta]) return setInfo("⚠️ Invalid STA names");

    const base = groups[fromSta];
    const next = groups[toSta];
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common  = [...baseMap.keys()].filter((k) => nextMap.has(k));

    if (common.length === 0) {
      const mergedArr = [...base, ...next];
      const newGroups = { ...groups };
      delete newGroups[toSta];
      newGroups[fromSta] = mergedArr;
      setGroups(newGroups);
      setMerged(mergedArr);
      setInfo(`✅ ${fromSta} merged with ${toSta} (no common pts)`);
      setMergeSummaries((prev) => prev.filter((s) => s.group !== toSta));
      setGeomDiff([]); setGeomShow(false); setTransformed([]); setLastMethod("");
      return;
    }

    // average delta by common
    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      dE += a.E - b.E; dN += a.N - b.N; dH += a.H - b.H;
    }
    dE /= common.length; dN /= common.length; dH /= common.length;

    // tolerance check on references
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

    // apply to non-duplicate
    const newPts = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH }));
    const mergedArr = [...base, ...newPts];

    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta} (refs=${common.length})`);
    setTransformed([]); setLastMethod("");

    // update tolerance summary
    setMergeSummaries((prev) => {
      const others = prev.filter((s) => s.group !== toSta);
      return [...others, { group: toSta, count: exceedCount, maxmm }];
    });

    // geometry diff (best-fit sim2D + H shift)
    computeGeometryDiff(baseMap, nextMap);
  };

  // -------------------- Geometry Difference (1→All) --------------------
  function fitSimilarity2D(basePts, movePts) {
    const n = basePts.length;
    let cEx = 0, cEy = 0, cMx = 0, cMy = 0;
    for (let i = 0; i < n; i++) {
      cEx += basePts[i][0]; cEy += basePts[i][1];
      cMx += movePts[i][0]; cMy += movePts[i][1];
    }
    cEx /= n; cEy /= n; cMx /= n; cMy /= n;

    let Sxx = 0, Sxy = 0, normM = 0, normB = 0;
    for (let i = 0; i < n; i++) {
      const bx = basePts[i][0] - cEx, by = basePts[i][1] - cEy;
      const mx = movePts[i][0] - cMx, my = movePts[i][1] - cMy;
      Sxx += mx * bx + my * by;
      Sxy += mx * by - my * bx;
      normM += mx*mx + my*my;
      normB += bx*bx + by*by;
    }
    const scale = Math.sqrt(normB / normM);
    const r = Math.hypot(Sxx, Sxy) || 1e-12;
    const cos = Sxx / r, sin = Sxy / r;
    const tx = cEx - scale * (cos * cMx - sin * cMy);
    const ty = cEy - scale * (sin * cMx + cos * cMy);
    return { scale, cos, sin, tx, ty };
  }

  const computeGeometryDiff = (baseMap, nextMap) => {
    const names = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (names.length < 2) {
      setGeomDiff([]); setGeomShow(false);
      return;
    }

    const B = names.map((n) => [baseMap.get(n).E, baseMap.get(n).N]);
    const M = names.map((n) => [nextMap.get(n).E, nextMap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);

    let dHsum = 0;
    for (const n of names) dHsum += baseMap.get(n).H - nextMap.get(n).H;
    const dHavg = dHsum / names.length;

    const ref = names[0];
    const rB = baseMap.get(ref), rM = nextMap.get(ref);
    const rMx = scale * (cos * rM.E - sin * rM.N) + tx;
    const rMy = scale * (sin * rM.E + cos * rM.N) + ty;
    const rMh = rM.H + dHavg;

    const diffs = [];
    for (let i = 1; i < names.length; i++) {
      const nm = names[i];
      const b = baseMap.get(nm), m = nextMap.get(nm);
      const mX = scale * (cos * m.E - sin * m.N) + tx;
      const mY = scale * (sin * m.E + cos * m.N) + ty;
      const mH = m.H + dHavg;

      const dE1 = b.E - rB.E, dN1 = b.N - rB.N, dH1 = b.H - rB.H;
      const dE2 = mX - rMx,  dN2 = mY - rMy,  dH2 = mH - rMh;

      const de = dE1 - dE2, dn = dN1 - dN2, dh = dH1 - dH2;
      const dmm = Math.sqrt(de*de + dn*dn + dh*dh) * 1000; // mm
      diffs.push({ name: `${ref}→${nm}`, dE1, dE2, de, dn, dh, dmm });
    }
    setGeomDiff(diffs);
    setGeomShow(true);
    setGeomHideSet(new Set());
  };

  const hideSelectedDiffRows = () => {
    if (geomHideSet.size === 0) return;
    const arr = geomDiff.filter((_, idx) => !geomHideSet.has(idx));
    setGeomDiff(arr);
    setGeomHideSet(new Set());
  };

  const acceptGeom = () => {
    setGeomShow(false);
    setGeomDiff([]);
    setGeomHideSet(new Set());
    setInfo("✅ Geometry diff accepted. Ready for next merge.");
  };

  // -------------------- Active-set helpers for Reference Line --------------------
  const norm = (s) => (s ?? "").toString().trim().replace(/\s+/g, "").toUpperCase();

  const getPointByName = (name, list) => {
    const key = norm(name);
    for (const p of list) if (norm(p.name) === key) return p;
    return null;
  };

  const getActivePoints = () => {
    if (merged.length) return merged;
    const ks = Object.keys(groups);
    if (ks.length === 1) return groups[ks[0]];
    return [];
  };

  const mergedNames = useMemo(() => {
    const data = merged.length ? merged : (Object.keys(groups).length === 1 ? groups[Object.keys(groups)[0]] : []);
    return data.map((p) => p.name);
  }, [merged, groups]);

  // -------------------- Reference Line --------------------
  const applyRefLine = () => {
    const data = getActivePoints();
    if (!data.length) return setInfo("⚠️ Provide data (upload or merge).");

    const A = getPointByName(refA, data);
    const B = getPointByName(refB, data);
    if (!A || !B) return setInfo("⚠️ Point A / B name not found.");
    if (norm(refA) === norm(refB)) return setInfo("⚠️ A and B must be different.");

    const dE = B.E - A.E, dN = B.N - A.N, dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("⚠️ Reference points are coincident in EN.");

    // rotate so A→(0,0,0) and AB aligns with +N axis
    const phi = Math.atan2(dE, dN);
    const c = Math.cos(phi), s = Math.sin(phi);

    const out = data.map((p) => {
      const e0 = p.E - A.E, n0 = p.N - A.N, h0 = p.H - A.H;
      return { name: p.name, E: c*e0 - s*n0, N: s*e0 + c*n0, H: h0 };
    });

    setTransformed(out);
    setLastMethod("Reference Line");
    setInfo(`✅ Reference line applied — A→(0,0,0)  B→(0,${dist.toFixed(3)},${dH.toFixed(3)})`);
  };

  // -------------------- Export helpers --------------------
  const exportMerged = () => {
    const data = merged.length ? merged : getActivePoints();
    if (!data.length) return alert("No merged data.");
    const txt = data.map((p) => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`).join("\n");
    downloadTxt(txt, "Merged_STA.txt");
  };

  const exportTransformed = () => {
    const data = transformed.length ? transformed : getActivePoints();
    if (!data.length) return alert("No data to export.");
    const name = transformed.length ? `Final_${lastMethod.replace(/\s+/g, "")}.txt` : "Merged_STA.txt";
    const txt = data.map((p) => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`).join("\n");
    downloadTxt(txt, name);
  };

  const exportGeometryDiff = () => {
    if (!geomDiff.length) return alert("No diff data.");
    const t = geomDiff
      .map((p) => `${p.name}\t${p.de.toFixed(3)}\t${p.dn.toFixed(3)}\t${p.dh.toFixed(3)}\t${p.dmm.toFixed(1)} mm`)
      .join("\n");
    downloadTxt(t, "GeometryDiff_WMK.txt");
  };

  function downloadTxt(txt, filename) {
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
// -------------------- UI --------------------
  return (
    <div className="sta-merge">
      <h1>💡 IDEA by WIN MIN KO</h1>
      <h2>📐 Station Merge & Reference Line</h2>

      {/* File upload */}
      <div className="card">
        <div className="row">
          <input type="file" accept=".txt" onChange={onFile} />
          {info && <div className="msg">{info}</div>}
        </div>
      </div>

      {/* Raw preview */}
      {rawText && (
        <div className="card">
          <h3>🧾 Original Upload</h3>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {/* Filter panel */}
      {Object.keys(groups).length > 0 && (
        <div className="card">
          <div className="row space-between">
            <h3>🧹 Remove Unwanted Points</h3>
            <button className="btn btn-ghost" onClick={() => setFilterOpen((v) => !v)}>
              {filterOpen ? "Hide Filter" : "Show Points"}
            </button>
          </div>

          {filterOpen && (
            <>
              {staSortedEntries.map(([sta, pts]) => (
                <div key={sta} className="sta-card">
                  <div className="row space-between">
                    <h4>{sta}</h4>
                    <button className="btn btn-danger" onClick={() => deleteGroup(sta)}>🗑️ Delete Group</button>
                  </div>
                  <div className="grid2">
                    {pts.map((p) => {
                      const checked = (keepMap[sta]?.[p.name] !== false);
                      return (
                        <label key={p.name} className="chk">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleKeep(sta, p.name)}
                          />
                          <span>{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="row end">
                <button className="btn" onClick={applyFilter}>✔ Apply Filter</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Merge section (optional) */}
      {Object.keys(groups).length > 1 && (
        <div className="card">
          <h3>🧩 Choose Two STAs to Merge</h3>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)} className="input">
              <option value="">-- From (Base) --</option>
              {staNames.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={toSta} onChange={(e) => setToSta(e.target.value)} className="input">
              <option value="">-- To (Merge Into Base) --</option>
              {staNames.map((s) => <option key={s}>{s}</option>)}
            </select>

            <button className="btn" onClick={handleMerge}>🔄 Merge</button>
            <button className="btn btn-ghost" onClick={exportMerged}>💾 Export Merged</button>
          </div>

          {/* tolerance summary */}
          {mergeSummaries.length > 0 && (
            <div className="summary">
              <h4>Merge tolerance summary (≤ 3 mm):</h4>
              {mergeSummaries.map((s, i) =>
                s.count > 0 ? (
                  <div key={i} className="line bad">
                    ⚠ {s.group} → exceeded on {s.count} ref point(s), max={(s.maxmm * 1000).toFixed(1)} mm
                  </div>
                ) : (
                  <div key={i} className="line ok">
                    ✅ {s.group} → within tolerance
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Geometry diff (1→All) */}
      {geomShow && (
        <div className="card">
          <div className="row space-between">
            <h3>📊 Geometry Difference (1 → Others, best-fit)</h3>
            <div className="row">
              <button className="btn btn-ghost" onClick={hideSelectedDiffRows}>🙈 Hide Selected</button>
              <button className="btn btn-ghost" onClick={exportGeometryDiff}>💾 Export Diff</button>
              <button className="btn" onClick={acceptGeom}>✔ Accept</button>
            </div>
          </div>

          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Ref→Pt</th>
                  <th>ΔE₁</th>
                  <th>ΔE₂</th>
                  <th>ΔE diff</th>
                  <th>ΔN diff</th>
                  <th>ΔH diff</th>
                  <th>Δmm</th>
                </tr>
              </thead>
              <tbody>
                {geomDiff.map((p, i) => (
                  <tr key={i} className={p.dmm > 3 ? "err" : ""}>
                    <td className="center">
                      <input
                        type="checkbox"
                        checked={geomHideSet.has(i)}
                        onChange={(e) => {
                          const ns = new Set(geomHideSet);
                          if (e.target.checked) ns.add(i);
                          else ns.delete(i);
                          setGeomHideSet(ns);
                        }}
                      />
                    </td>
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

      {/* Active set preview (merged or single-group) */}
      {(merged.length || Object.keys(groups).length === 1) && (
        <div className="card">
          <h3>✅ Working Set ({(merged.length || (Object.keys(groups).length===1 ? groups[Object.keys(groups)[0]].length : 0))} pts)</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Point</th>
                  <th>E</th>
                  <th>N</th>
                  <th>H</th>
                </tr>
              </thead>
              <tbody>
                {(merged.length ? merged : groups[Object.keys(groups)[0]]).map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.E.toFixed(3)}</td>
                    <td>{p.N.toFixed(3)}</td>
                    <td>{p.H.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transform — Reference Line only */}
      {(merged.length || Object.keys(groups).length === 1) && (
        <div className="card">
          <h3>📏 Transform on Working Set — Reference Line</h3>
          <div className="row">
            <input
              className="input"
              list="merged-names"
              placeholder="Point A"
              value={refA}
              onChange={(e) => setRefA(e.target.value)}
            />
            <input
              className="input"
              list="merged-names"
              placeholder="Point B"
              value={refB}
              onChange={(e) => setRefB(e.target.value)}
            />
            <datalist id="merged-names">
              {mergedNames.map((n) => <option key={n} value={n} />)}
            </datalist>

            <button className="btn" onClick={applyRefLine}>▶ Apply Reference Line</button>
            <button className="btn btn-ghost" onClick={exportTransformed}>📄 Final Export TXT</button>
          </div>
        </div>
      )}

      {/* Transformed preview */}
      {transformed.length > 0 && (
        <div className="card">
          <h3>🔄 Transformed Result ({lastMethod})</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Point</th>
                  <th>E</th>
                  <th>N</th>
                  <th>H</th>
                </tr>
              </thead>
              <tbody>
                {transformed.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.E.toFixed(3)}</td>
                    <td>{p.N.toFixed(3)}</td>
                    <td>{p.H.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row end">
            <button className="btn btn-ghost" onClick={exportTransformed}>📄 Final Export TXT</button>
          </div>
        </div>
      )}
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
}