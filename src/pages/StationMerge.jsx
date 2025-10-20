import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);            // last merged points (base group content)
  const [info, setInfo] = useState("");
  const [mergeSummaries, setMergeSummaries] = useState([]); // [{group, count, maxmm}]

  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");

  // Transform states
  const [refA, setRefA] = useState(""); // method 1
  const [refB, setRefB] = useState("");
  const [fitPts, setFitPts] = useState([               // method 2 (manual 4-point)
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
  ]);
  const [transformed, setTransformed] = useState([]);  // preview of transformed
  const [lastMethod, setLastMethod] = useState("");    // "Reference Line" | "4-Point Fit"

  // -------- File Upload --------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      setGroups(parseSTAFile(text));
      setInfo("✅ File loaded successfully");
      setMerged([]);
      setTransformed([]);
      setMergeSummaries([]);
      setLastMethod("");
    };
    r.readAsText(f);
  };

  // -------- Parser (CSV: STA header ENH skipped) --------
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
        if ([E, N, H].every(Number.isFinite)) {
          out[current].push({ name, E, N, H });
        }
      }
    }
    return out;
  }

  // -------- Merge Logic (pair) + error summary (B style) --------
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
      // no common → simple union
      const mergedArr = [...base, ...next];
      const newGroups = { ...groups };
      delete newGroups[toSta];
      newGroups[fromSta] = mergedArr;
      setGroups(newGroups);
      setMerged(mergedArr);
      setInfo(`✅ ${fromSta} merged with ${toSta} (no common pts)`);
      // summary: none (no common points to check)
      setMergeSummaries((prev) => prev.filter(s => s.group !== toSta));
      setTransformed([]);
      setLastMethod("");
      return;
    }

    // Compute avg Δ using common points (align next -> base)
    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      dE += a.E - b.E;
      dN += a.N - b.N;
      dH += a.H - b.H;
    }
    dE /= common.length; dN /= common.length; dH /= common.length;

    // Check residuals after alignment (error summary)
    let exceedCount = 0;
    let maxmm = 0;
    for (const n of common) {
      const a = baseMap.get(n), b = nextMap.get(n);
      const rE = (b.E + dE) - a.E;
      const rN = (b.N + dN) - a.N;
      const rH = (b.H + dH) - a.H;
      const dmm = Math.sqrt(rE*rE + rN*rN + rH*rH);
      if (dmm > TOL) exceedCount++;
      if (dmm > maxmm) maxmm = dmm;
    }

    // Apply avg shift to non-duplicate points of next
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
    setTransformed([]);
    setLastMethod("");

    // update summary for this merged group
    setMergeSummaries((prev) => {
      const others = prev.filter((s) => s.group !== toSta);
      return [...others, { group: toSta, count: exceedCount, maxmm }];
    });
  };

  // -------- Reference Line (Method 1) --------
  const applyRefLine = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    const Aname = refA.trim(), Bname = refB.trim();
    if (!Aname || !Bname) return setInfo("⚠️ Enter two point names.");
    const map = new Map(merged.map((p) => [p.name, p]));
    const A = map.get(Aname), B = map.get(Bname);
    if (!A || !B) return setInfo("⚠️ Point not found.");

    const dE = B.E - A.E, dN = B.N - A.N, dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("⚠️ Reference points are coincident in E/N.");

    // rotate so AB -> (0,+dist)
    const phi = Math.atan2(dE, dN); // E' = 0 for B
    const c = Math.cos(phi), s = Math.sin(phi);

    const out = merged.map((p) => {
      const e0 = p.E - A.E, n0 = p.N - A.N, h0 = p.H - A.H;
      const E1 = c*e0 - s*n0;
      const N1 = s*e0 + c*n0;
      const H1 = h0;
      return { name: p.name, E: E1, N: N1, H: H1 };
    });
    setTransformed(out);
    setLastMethod("Reference Line");
    setInfo(`✅ Reference line applied — A→(0,0,0), B→(0, ${dist.toFixed(3)}, ${dH.toFixed(3)})`);
  };

  // -------- 4-Point Manual Fit (Affine 3D from 4 constraints) --------
  // Solve 12 unknowns: A(3x3) + t(3x1); with 4 points → 12 equations (exact)
  function solveLinearSystem(A, b) {
    // Gaussian elimination (A: m x n with n=12, m=12; b: m)
    const m = A.length, n = A[0].length; // expect 12x12
    // build augmented
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      // find pivot
      let piv = col;
      for (let r = col + 1; r < m; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      }
      if (Math.abs(M[piv][col]) < 1e-12) continue; // singular-ish
      // swap
      if (piv !== col) [M[piv], M[col]] = [M[col], M[piv]];
      // normalize
      const div = M[col][col];
      for (let k = col; k <= n; k++) M[col][k] /= div;
      // eliminate others
      for (let r = 0; r < m; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        for (let k = col; k <= n; k++) M[r][k] -= factor * M[col][k];
      }
    }
    // solution
    const x = new Array(n).fill(0);
    for (let i = 0; i < n; i++) x[i] = M[i][n];
    return x;
  }

  const apply4PointFit = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    // validate 4 pts
    for (const p of fitPts) {
      if (!p.name || p.E === "" || p.N === "" || p.H === "") {
        return setInfo("⚠️ Fill all four points (name + target E/N/H).");
      }
    }
    const srcMap = new Map(merged.map((p) => [p.name, p]));
    const src = [];
    const tgt = [];
    for (const p of fitPts) {
      const s = srcMap.get(p.name.trim());
      if (!s) return setInfo(`⚠️ Source point not found: ${p.name}`);
      src.push([s.E, s.N, s.H]);
      tgt.push([parseFloat(p.E), parseFloat(p.N), parseFloat(p.H)]);
    }

    // Build linear system: for each point i with xs,ys,zs -> xt,yt,zt
    // Row xt: [xs ys zs  0 0 0  0 0 0  1 0 0]
    // Row yt: [0 0 0  xs ys zs  0 0 0  0 1 0]
    // Row zt: [0 0 0  0 0 0  xs ys zs  0 0 1]
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [xs, ys, zs] = src[i];
      const [xt, yt, zt] = tgt[i];
      A.push([xs, ys, zs, 0, 0, 0, 0, 0, 0, 1, 0, 0]); b.push(xt);
      A.push([0, 0, 0, xs, ys, zs, 0, 0, 0, 0, 1, 0]); b.push(yt);
      A.push([0, 0, 0, 0, 0, 0, xs, ys, zs, 0, 0, 1]); b.push(zt);
    }
    const x = solveLinearSystem(A, b);
    // params
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
    setLastMethod("4-Point Fit");

    // Error check for the 4 control points (show in summary style)
    let exceed = 0, maxmm = 0;
    for (let i = 0; i < 4; i++) {
      const [xt, yt, zt] = tgt[i];
      const {E,N,H} = apply(src[i][0], src[i][1], src[i][2]);
      const dmm = Math.sqrt((E-xt)**2 + (N-yt)**2 + (H-zt)**2);
      if (dmm > TOL) exceed++;
      if (dmm > maxmm) maxmm = dmm;
    }
    // store as a pseudo summary item labelled "4-Point Fit"
    setMergeSummaries(prev => {
      const others = prev.filter(s => s.group !== "4-Point Fit");
      return [...others, { group: "4-Point Fit", count: exceed, maxmm }];
    });
    setInfo("✅ 4-Point Fit applied.");
  };

  // -------- Export (final-first) --------
  const onExport = () => {
    const data = transformed.length ? transformed : merged;
    if (!data.length) return alert("No data to export.");
    const txt = data
      .map(p => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`)
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = transformed.length
      ? `Final_${lastMethod.replace(/\s+/g,"")}.txt`
      : "Merged_STA.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const staNames = Object.keys(groups);

  return (
    <div className="sta-merge">
      <h1>📐 Station Merge (Pair Mode) + Transform</h1>

      <div className="card">
        <input type="file" accept=".txt" onChange={onFile} />
        {info && <div className="msg">{info}</div>}
      </div>

      {rawText && (
        <div className="card">
          <h2>🧾 Original Upload Preview</h2>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {staNames.length > 0 && (
        <div className="card">
          <h2>🧩 Choose Two STAs to Merge</h2>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)}>
              <option value="">-- From (Base) --</option>
              {staNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">-- To (Merge Into Base) --</option>
              {staNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <button onClick={handleMerge}>🔄 Merge Selected</button>
            <button onClick={onExport}>💾 Export TXT</button>
          </div>
          <div className="hint">After merge → Base STA name remains, second one disappears.</div>

          {/* Error summary (B style) */}
          {mergeSummaries.length > 0 && (
            <div className="summary">
              <h4>Merge tolerance summary (3 mm):</h4>
              {mergeSummaries.map((s, i) => (
                s.count > 0 ? (
                  <div key={i} className="line bad">
                    ⚠ {s.group} → exceeded tolerance on {s.count} ref point(s), max = {(s.maxmm*1000).toFixed(1)} mm
                  </div>
                ) : (
                  <div key={i} className="line ok">
                    ✅ {s.group} → within tolerance (all refs ≤ 3 mm)
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last merged preview */}
      {merged.length > 0 && (
        <div className="card">
          <h2>✅ Last Merged Result ({merged.length} pts)</h2>
          <Table rows={merged} />
        </div>
      )}

      {/* Transform methods (operate on final merged only) */}
      {merged.length > 0 && (
        <div className="card">
          <h2>📏 Transform (choose one)</h2>
          <div className="grid2">
            <div>
              <h4>Method 1 – Reference Line</h4>
              <div className="grid2">
                <input placeholder="Point A" value={refA} onChange={(e)=>setRefA(e.target.value)} />
                <input placeholder="Point B" value={refB} onChange={(e)=>setRefB(e.target.value)} />
              </div>
              <button onClick={applyRefLine}>▶ Apply Reference Line</button>
            </div>

            <div>
              <h4>Method 2 – 4-Point Manual Fit</h4>
              <div className="fit-grid">
                {fitPts.map((p, idx) => (
                  <div key={idx} className="fit-row">
                    <input
                      className="nm"
                      placeholder="Name"
                      value={p.name}
                      onChange={(e)=>{
                        const a=[...fitPts]; a[idx].name=e.target.value; setFitPts(a);
                      }}
                    />
                    <input
                      placeholder="E"
                      value={p.E}
                      onChange={(e)=>{
                        const a=[...fitPts]; a[idx].E=e.target.value; setFitPts(a);
                      }}
                    />
                    <input
                      placeholder="N"
                      value={p.N}
                      onChange={(e)=>{
                        const a=[...fitPts]; a[idx].N=e.target.value; setFitPts(a);
                      }}
                    />
                    <input
                      placeholder="H"
                      value={p.H}
                      onChange={(e)=>{
                        const a=[...fitPts]; a[idx].H=e.target.value; setFitPts(a);
                      }}
                    />
                  </div>
                ))}
              </div>
              <button onClick={apply4PointFit}>▶ Apply 4-Point Fit</button>
            </div>
          </div>
        </div>
      )}

      {/* Transformed preview + Export */}
      {transformed.length > 0 && (
        <div className="card">
          <h2>🔄 Transformed Result ({lastMethod})</h2>
          <Table rows={transformed} />
          <div className="row end">
            <button onClick={onExport}>📄 Final Export TXT</button>
          </div>
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
          <tr>
            <th className="left">Point</th>
            <th>E</th>
            <th>N</th>
            <th>H</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
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
