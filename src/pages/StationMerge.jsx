// 💡 IDEA by WIN MIN KO
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [info, setInfo] = useState("");
  const [merged, setMerged] = useState([]);
  const [geomDiff, setGeomDiff] = useState([]);
  const [showGeom, setShowGeom] = useState(false);
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
    };
    r.readAsText(f);
  };

  // ---------- PARSER ----------
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

  // ---------- MERGE ----------
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const TOL = 0.003;

  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names");
    const base = groups[fromSta], next = groups[toSta];
    if (!base || !next) return setInfo("⚠️ Invalid STA names");

    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (common.length === 0) return setInfo("⚠️ No common points");

    // average offsets
    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      dE += a.E - b.E;
      dN += a.N - b.N;
      dH += a.H - b.H;
    }
    dE /= common.length; dN /= common.length; dH /= common.length;

    // check diff
    let exceed = 0, maxmm = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      const rE = b.E + dE - a.E, rN = b.N + dN - a.N, rH = b.H + dH - a.H;
      const dmm = Math.sqrt(rE*rE + rN*rN + rH*rH);
      if (dmm > TOL) exceed++;
      if (dmm > maxmm) maxmm = dmm;
    }

    const newPts = next.filter((p) => !baseMap.has(p.name))
      .map((p) => ({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH }));
    const mergedArr = [...base, ...newPts];
    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta} (${common.length} refs)`);

    computeGeometryDiff(baseMap, nextMap);
  };

  // ---------- GEOMETRY DIFF ----------
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
      const bx = basePts[i][0]-cEx, by = basePts[i][1]-cEy;
      const mx = movePts[i][0]-cMx, my = movePts[i][1]-cMy;
      Sxx += mx*bx + my*by;
      Sxy += mx*by - my*bx;
      normM += mx*mx + my*my;
      normB += bx*bx + by*by;
    }
    const scale = Math.sqrt(normB / normM);
    const r = Math.hypot(Sxx, Sxy) || 1e-12;
    const cos = Sxx / r, sin = Sxy / r;
    const tx = cEx - scale * (cos*cMx - sin*cMy);
    const ty = cEy - scale * (sin*cMx + cos*cMy);
    return { scale, cos, sin, tx, ty };
  }

  const computeGeometryDiff = (baseMap, nextMap) => {
    const names = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (names.length < 2) return;
    const B = names.map((n) => [baseMap.get(n).E, baseMap.get(n).N]);
    const M = names.map((n) => [nextMap.get(n).E, nextMap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);
    let dHavg = 0;
    for (const n of names) dHavg += baseMap.get(n).H - nextMap.get(n).H;
    dHavg /= names.length;
    const ref = names[0];
    const rB = baseMap.get(ref), rM = nextMap.get(ref);
    const rMx = scale * (cos*rM.E - sin*rM.N) + tx;
    const rMy = scale * (sin*rM.E + cos*rM.N) + ty;
    const rMh = rM.H + dHavg;
    const diffs = [];
    for (let i = 1; i < names.length; i++) {
      const nm = names[i];
      const b = baseMap.get(nm), m = nextMap.get(nm);
      const mX = scale*(cos*m.E - sin*m.N)+tx;
      const mY = scale*(sin*m.E + cos*m.N)+ty;
      const mH = m.H + dHavg;
      const dE1 = b.E - rB.E, dN1 = b.N - rB.N, dH1 = b.H - rB.H;
      const dE2 = mX - rMx, dN2 = mY - rMy, dH2 = mH - rMh;
      const de = dE1 - dE2, dn = dN1 - dN2, dh = dH1 - dH2;
      const dmm = Math.sqrt(de*de + dn*dn + dh*dh) * 1000;
      diffs.push({ name:`${ref}→${nm}`, dE1,dE2,de,dn,dh,dmm });
    }
    setGeomDiff(diffs);
    setShowGeom(true);
  };
  // ---------- FILTER (points) ----------
  const [filterOpen, setFilterOpen] = useState(false);
  const [keepMap, setKeepMap] = useState({}); // { [sta]: { [ptName]: true/false } }

  const toggleKeep = (sta, pt) => {
    setKeepMap((prev) => {
      const s = { ...(prev[sta] || {}) };
      s[pt] = !(s[pt] === false); // default = kept (true)
      return { ...prev, [sta]: s };
    });
  };

  const applyFilter = () => {
    if (!Object.keys(groups).length) return;
    const next = {};
    for (const [sta, pts] of Object.entries(groups)) {
      const km = keepMap[sta] || {};
      next[sta] = pts.filter((p) => km[p.name] !== false);
    }
    setGroups(next);
    setFilterOpen(false);
    setInfo("Filter applied: removed unchecked points.");
  };

  // ---------- REFERENCE LINE (Method 1) ----------
  const applyRefLine = () => {
    if (!merged.length) return setInfo("Merge first, then apply Reference Line.");
    const Aname = refA.trim(), Bname = refB.trim();
    if (!Aname || !Bname) return setInfo("Enter 2 point names for Reference Line.");
    const map = new Map(merged.map((p) => [p.name, p]));
    const A = map.get(Aname), B = map.get(Bname);
    if (!A || !B) return setInfo("Reference points not found in merged set.");

    const dE = B.E - A.E, dN = B.N - A.N, dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("Reference points are coincident in E/N.");
    const phi = Math.atan2(dE, dN); // rotate so A->B goes to (0, +dist)
    const c = Math.cos(phi), s = Math.sin(phi);

    const out = merged.map((p) => {
      const e0 = p.E - A.E, n0 = p.N - A.N, h0 = p.H - A.H;
      const E1 = c * e0 - s * n0;
      const N1 = s * e0 + c * n0;
      const H1 = h0;
      return { name: p.name, E: E1, N: N1, H: H1 };
    });
    setTransformed(out);
    setLastMethod("ReferenceLine");
    setInfo(`Reference Line OK. A→(0,0,0), B→(0, ${dist.toFixed(3)}, ${dH.toFixed(3)})`);
  };

  // ---------- 4-POINT MANUAL FIT (Method 2) ----------
  function solveLinearSystem(A, b) {
    // Gaussian elimination for 12x12
    const m = A.length, n = A[0].length; // expect 12
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      // pivot
      let piv = col;
      for (let r = col + 1; r < m; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      }
      if (Math.abs(M[piv][col]) < 1e-12) continue;
      if (piv !== col) [M[piv], M[col]] = [M[col], M[piv]];
      const div = M[col][col];
      for (let k = col; k <= n; k++) M[col][k] /= div;
      for (let r = 0; r < m; r++) {
        if (r === col) continue;
        const f = M[r][col];
        for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = 0; i < n; i++) x[i] = M[i][n];
    return x;
  }

  const apply4PointFit = () => {
    if (!merged.length) return setInfo("Merge first, then 4-Point Fit.");
    for (const p of fitPts) {
      if (!p.name || p.E === "" || p.N === "" || p.H === "") {
        return setInfo("Fill all 4 points (name + target E/N/H).");
      }
    }
    const srcMap = new Map(merged.map((p) => [p.name, p]));
    const src = [], tgt = [];
    for (const p of fitPts) {
      const s = srcMap.get(p.name.trim());
      if (!s) return setInfo(`Source point not found: ${p.name}`);
      src.push([s.E, s.N, s.H]);
      tgt.push([parseFloat(p.E), parseFloat(p.N), parseFloat(p.H)]);
    }

    // Build 12x12 system
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [xs, ys, zs] = src[i];
      const [xt, yt, zt] = tgt[i];
      // xt row
      A.push([xs, ys, zs, 0, 0, 0, 0, 0, 0, 1, 0, 0]); b.push(xt);
      // yt row
      A.push([0, 0, 0, xs, ys, zs, 0, 0, 0, 0, 1, 0]); b.push(yt);
      // zt row
      A.push([0, 0, 0, 0, 0, 0, xs, ys, zs, 0, 0, 1]); b.push(zt);
    }
    const x = solveLinearSystem(A, b);
    const a11 = x[0], a12 = x[1], a13 = x[2],
          a21 = x[3], a22 = x[4], a23 = x[5],
          a31 = x[6], a32 = x[7], a33 = x[8],
          t1  = x[9], t2  = x[10], t3  = x[11];

    const apply = (E,N,H) => ({
      E: a11*E + a12*N + a13*H + t1,
      N: a21*E + a22*N + a23*H + t2,
      H: a31*E + a32*N + a33*H + t3,
    });

    const out = merged.map(p => ({ name: p.name, ...apply(p.E, p.N, p.H) }));
    setTransformed(out);
    setLastMethod("FourPointFit");

    // Quick fit error check (control points)
    const TOL = 0.003;
    let exceed = 0, maxmm = 0;
    for (let i = 0; i < 4; i++) {
      const [xt, yt, zt] = tgt[i];
      const {E,N,H} = apply(src[i][0], src[i][1], src[i][2]);
      const dmm = Math.sqrt((E-xt)**2 + (N-yt)**2 + (H-zt)**2);
      if (dmm > TOL) exceed++;
      if (dmm > maxmm) maxmm = dmm;
    }
    setInfo(`4-Point Fit OK. Controls exceed=${exceed}, max=${(maxmm*1000).toFixed(1)} mm`);
  };

  // ---------- FINAL EXPORT ----------
  const onFinalExport = () => {
    const data = transformed.length ? transformed : merged;
    if (!data.length) return alert("No data to export.");
    const fname = transformed.length
      ? `Final_${lastMethod || "Transformed"}.txt`
      : "Merged_STA.txt";
    const txt = data
      .map(p => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`)
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
  };

  // ---------- UI ----------
  return (
    <div className="sta-merge">
      <h1>IDEA by WIN MIN KO</h1>
      <h2>Station Merge + Filter + Geometry & Transform</h2>

      {/* Upload */}
      <div className="card">
        <input type="file" accept=".txt" onChange={onFile} />
        {info && <div className="msg">{info}</div>}
      </div>

      {/* Original preview */}
      {rawText && (
        <div className="card">
          <h3>Original Upload</h3>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {/* Filter points FIRST */}
      {Object.keys(groups).length > 0 && (
        <div className="card">
          <div className="row space-between">
            <h3>Remove Unwanted Points (before calculation)</h3>
            <button onClick={() => setFilterOpen(v => !v)}>
              {filterOpen ? "Hide" : "Show"}
            </button>
          </div>
          {filterOpen && (
            <>
              {Object.entries(groups).map(([sta, pts]) => (
                <div key={sta} className="sta-card">
                  <h4>{sta}</h4>
                  <div className="grid2">
                    {pts.map((p, i) => (
                      <label key={i} className="chk">
                        <input
                          type="checkbox"
                          checked={keepMap[sta]?.[p.name] !== false}
                          onChange={() => toggleKeep(sta, p.name)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={applyFilter}>Apply Filter</button>
            </>
          )}
        </div>
      )}

      {/* Merge + Diff */}
      {Object.keys(groups).length > 0 && (
        <div className="card">
          <h3>Choose Two STAs to Merge/Compare</h3>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)}>
              <option value="">From (Base)</option>
              {Object.keys(groups).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">To (Merge Into Base)</option>
              {Object.keys(groups).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <button onClick={handleMerge}>Compare / Merge</button>
          </div>
        </div>
      )}

      {/* Geometry Difference Table */}
      {showGeom && (
        <div className="card">
          <div className="row space-between">
            <h3>Geometry Difference (best-fit)</h3>
            <button onClick={() => { setShowGeom(false); setGeomDiff([]); }}>
              Accept
            </button>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
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

      {/* Transform Methods */}
      {merged.length > 0 && (
        <div className="card">
          <h3>Transform (choose one)</h3>
          <div className="grid2">
            <div>
              <h4>Method 1 — Reference Line</h4>
              <div className="grid2">
                <input
                  placeholder="Point A"
                  value={refA}
                  onChange={(e) => setRefA(e.target.value)}
                />
                <input
                  placeholder="Point B"
                  value={refB}
                  onChange={(e) => setRefB(e.target.value)}
                />
              </div>
              <button onClick={applyRefLine}>Apply Reference Line</button>
            </div>

            <div>
              <h4>Method 2 — 4-Point Manual Fit</h4>
              <div className="fit-grid">
                {fitPts.map((p, idx) => (
                  <div key={idx} className="fit-row">
                    <input
                      className="nm"
                      placeholder="Name"
                      value={p.name}
                      onChange={(e) => {
                        const a = [...fitPts]; a[idx].name = e.target.value; setFitPts(a);
                      }}
                    />
                    <input
                      placeholder="E"
                      value={p.E}
                      onChange={(e) => {
                        const a = [...fitPts]; a[idx].E = e.target.value; setFitPts(a);
                      }}
                    />
                    <input
                      placeholder="N"
                      value={p.N}
                      onChange={(e) => {
                        const a = [...fitPts]; a[idx].N = e.target.value; setFitPts(a);
                      }}
                    />
                    <input
                      placeholder="H"
                      value={p.H}
                      onChange={(e) => {
                        const a = [...fitPts]; a[idx].H = e.target.value; setFitPts(a);
                      }}
                    />
                  </div>
                ))}
              </div>
              <button onClick={apply4PointFit}>Apply 4-Point Fit</button>
            </div>
          </div>
        </div>
      )}

      {/* Transformed preview + Final Export */}
      {transformed.length > 0 && (
        <div className="card">
          <h3>Transformed Result ({lastMethod})</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="left">Point</th>
                  <th>E</th>
                  <th>N</th>
                  <th>H</th>
                </tr>
              </thead>
              <tbody>
                {transformed.map((p, i) => (
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
          <div className="row end">
            <button onClick={onFinalExport}>Final Export TXT</button>
          </div>
        </div>
      )}
    </div>
  );
}
