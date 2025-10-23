// 💡 IDEA by WIN MIN KO
import React, { useState, useMemo } from "react";
import "./StationMerge.css";
import { create, all } from "mathjs";
const math = create(all);
console.log("MathJS version =", math.version);

// ✅ Safe pseudo-inverse helper
function pseudoInverse(A) {
  const AT = math.transpose(A);
  const ATA = math.multiply(AT, A);
  let invATA;
  try {
    invATA = math.inv(ATA);
  } catch {
    const eps = 1e-8;
    const I = math.identity(ATA.size()[0]);
    invATA = math.inv(math.add(ATA, math.multiply(I, eps)));
  }
  return math.multiply(invATA, AT);
}

function fourPoint3DTransform(srcPts, dstPts) {
  const n = srcPts.length;
  if (n < 3) throw new Error("Need at least 3 points");

  const A = math.matrix(srcPts);
  const B = math.matrix(dstPts);

  const meanA = math.mean(A, 0);
  const meanB = math.mean(B, 0);

  // ✅ math.repeat() မသုံးဘဲ manual repeat
  const Am = math.subtract(
    A,
    math.matrix(Array(n).fill(meanA.toArray()))
  );
  const Bm = math.subtract(
    B,
    math.matrix(Array(n).fill(meanB.toArray()))
  );

  const H = math.multiply(math.transpose(Am), Bm);
  const { U, S, V } = math.svd(H);

  let R = math.multiply(V, math.transpose(U));
  if (math.det(R) < 0) {
    const Vfix = V.clone();
    const col2 = math.multiply(
      Vfix.subset(math.index([0, 1, 2], 2)),
      -1
    );
    Vfix.subset(math.index([0, 1, 2], 2), col2);
    R = math.multiply(Vfix, math.transpose(U));
  }

  const T = math.subtract(meanB, math.multiply(R, meanA));
  return { R, T };
}

// ✅ linear solver (optional)
function solveLinear(A, b) {
  const A_pinv = pseudoInverse(math.matrix(A));
  return math.multiply(A_pinv, b).toArray();
}

export default function StationMerge() {
  // ===== Core State =====
  const [rawText, setRawText] = useState("");
  const [chosenFile, setChosenFile] = useState("");
  const [groups, setGroups] = useState({});      // { STA1: [{name,E,N,H}, ...], ... }
  const [info, setInfo] = useState("");

  // Merge + Diff
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [geomDiff, setGeomDiff] = useState([]);  // rows for diff table
  const [showGeom, setShowGeom] = useState(false);

  // (Part 2 will use these)
  const [transformed, setTransformed] = useState([]);
  const [lastMethod, setLastMethod] = useState(""); // "ReferenceLine" | "FourPointFit"
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
  const [fitPts, setFitPts] = useState([
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
  ]);

  // ===== File Upload & Parse =====
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setChosenFile(f.name);
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      const g = parseSTAFile(text);
      setGroups(g);
      setInfo("File loaded successfully");
      // reset volatile states
      setFromSta(""); setToSta("");
      setGeomDiff([]); setShowGeom(false);
      setTransformed([]); setLastMethod("");
      setRefA(""); setRefB("");
      setFitPts([
        { name: "", E: "", N: "", H: "" },
        { name: "", E: "", N: "", H: "" },
        { name: "", E: "", N: "", H: "" },
        { name: "", E: "", N: "", H: "" },
      ]);
    };
    r.readAsText(f);
  };

  // Parse TXT: "STA#" headers define groups; their ENH are ignored.
  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let current = null;
    for (let raw of lines) {
      if (!raw.trim()) continue;
      // allow comma or tab
      const p = raw.split(/[,\t]/).map((x) => x.trim());
      if (p.length < 4) continue;
      const [name, e, n, h] = p;

      if (/^STA\d+/i.test(name)) {
        current = name;
        out[current] = [];
        continue; // STA header ENH are not counted
      }

      if (current) {
        const E = parseFloat(e), N = parseFloat(n), H = parseFloat(h);
        if ([E, N, H].every(Number.isFinite)) out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ===== Optional Filter (point-level & group-level remove) =====
  const handleRemovePoint = (sta, ptName) => {
    const copy = { ...groups };
    copy[sta] = copy[sta].filter((p) => p.name !== ptName);
    setGroups(copy);
    setInfo(`Removed ${ptName} from ${sta}`);
  };

  const handleRemoveSta = (sta) => {
    const copy = { ...groups };
    delete copy[sta];
    setGroups(copy);
    if (fromSta === sta) setFromSta("");
    if (toSta === sta) setToSta("");
    setInfo(`Removed ${sta}`);
  };

  // ===== Best-Fit Alignment (2D Similarity + mean ΔH) =====
  function fitSimilarity2D(basePts, movePts) {
    // basePts, movePts: arrays of [E, N]
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

  // ===== Mega-Merge (pairwise) + 3mm tolerance report =====
  const TOL = 0.003; // 3 mm

  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("Choose two STA names first");
    if (!groups[fromSta] || !groups[toSta]) return setInfo("Invalid STA names");
    if (fromSta === toSta) return setInfo("Choose different STAs");

    const base = groups[fromSta];
    const next = groups[toSta];
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));

    if (common.length < 2) {
      // not enough common points → just union (no check)
      const mergedArr = [
        ...base,
        ...next.filter((p) => !baseMap.has(p.name)),
      ];
      const newGroups = { ...groups };
      delete newGroups[toSta];
      newGroups[fromSta] = mergedArr;
      setGroups(newGroups);
      setGeomDiff([]); setShowGeom(false);
      setInfo(`${toSta} merged into ${fromSta} (no/insufficient common points)`);
      return;
    }

    // fit (2D) + mean ΔH
    const B = common.map((n) => [baseMap.get(n).E, baseMap.get(n).N]);
    const M = common.map((n) => [nextMap.get(n).E, nextMap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);
    const dHavg =
      common.reduce((acc, n) => acc + (baseMap.get(n).H - nextMap.get(n).H), 0) /
      common.length;

    // ref-based geometry diff (choose first as reference)
    const ref = common[0];
    const rB = baseMap.get(ref), rM = nextMap.get(ref);
    const rMx = scale * (cos * rM.E - sin * rM.N) + tx;
    const rMy = scale * (sin * rM.E + cos * rM.N) + ty;
    const rMh = rM.H + dHavg;

    const diffs = [];
    let exceed = 0, maxmm = 0;

    for (let i = 1; i < common.length; i++) {
      const nm = common[i];
      const b = baseMap.get(nm), m = nextMap.get(nm);
      const mX = scale * (cos * m.E - sin * m.N) + tx;
      const mY = scale * (sin * m.E + cos * m.N) + ty;
      const mH = m.H + dHavg;

      const dE1 = b.E - rB.E, dN1 = b.N - rB.N, dH1 = b.H - rB.H;
      const dE2 = mX - rMx,  dN2 = mY - rMy,  dH2 = mH - rMh;

      const de = dE1 - dE2, dn = dN1 - dN2, dh = dH1 - dH2;
      const dmm = Math.sqrt(de*de + dn*dn + dh*dh) * 1000; // mm

      if (dmm > 3) exceed++;
      if (dmm > maxmm) maxmm = dmm;

      diffs.push({ name: `${ref}→${nm}`, dE1, dE2, de, dn, dh, dmm });
    }

    // merge coords (apply fitted shift to "next" & append non-duplicates)
    const shiftedNew = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({
        name: p.name,
        E: scale * (cos * p.E - sin * p.N) + tx,
        N: scale * (sin * p.E + cos * p.N) + ty,
        H: p.H + dHavg,
      }));

    const mergedArr = [...base, ...shiftedNew];
    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);

    setGeomDiff(diffs);
    setShowGeom(true);
    setTransformed([]);      // transform only after final (Part 2)
    setLastMethod("");

    const msg =
      exceed > 0
        ? `Merged ${toSta} → ${fromSta}. ${exceed} ref points > 3 mm (max ${maxmm.toFixed(1)} mm).`
        : `Merged ${toSta} → ${fromSta}. All reference points within 3 mm.`;
    setInfo(msg);
  };

  // ===== Detect "last STA" (when only one group left) =====
  const lastStaName = useMemo(() => {
    const names = Object.keys(groups);
    if (names.length === 1) return names[0];
    return "";
  }, [groups]);

  // ===== Render (Upload + Preview + Filter + Merge + Diff) =====
  return (
    <div className="sta-merge">
      <h1>IDEA by WIN MIN KO</h1>
      <h2>Station Mega-Merge • 3 mm Tol • Transform Ready</h2>

      {/* Upload */}
      <div className="card">
        <label>Upload TXT File</label>
        <input type="file" accept=".txt" onChange={onFile} />
        {chosenFile && <div className="filename">File: {chosenFile}</div>}
        {info && <div className="msg">{info}</div>}
      </div>

      {/* Original preview */}
      {rawText && (
        <div className="card">
          <h3>Original Upload</h3>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {/* Group browser + optional filter */}
      {Object.keys(groups).length > 0 && (
        <div className="card">
          <h3>Groups & Points (expand to view)</h3>
          {Object.entries(groups).map(([sta, pts]) => (
            <details key={sta} className="sta-card">
              <summary>
                {sta} <small>({pts.length} pts)</small>
                <button
                  className="mini danger"
                  onClick={(e) => { e.preventDefault(); handleRemoveSta(sta); }}
                  style={{ marginLeft: 12 }}
                >
                  Remove Group
                </button>
              </summary>
              <ul className="pt-list">
                {pts.map((p, i) => (
                  <li key={i} className="point-item">
                    <div className="point-info">
                      <b>{p.name}</b>
                      <span className="coords">
                        E={p.E.toFixed(3)} N={p.N.toFixed(3)} H={p.H.toFixed(3)}
                      </span>
                    </div>
                    <button
                      className="mini"
                      onClick={() => handleRemovePoint(sta, p.name)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      {/* Merge controls */}
      {Object.keys(groups).length >= 2 && (
        <div className="card">
          <h3>Pairwise Merge (any order) + 3 mm tolerance check</h3>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)}>
              <option value="">From (Base)</option>
              {Object.keys(groups).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">To (Merge Into Base)</option>
              {Object.keys(groups).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={handleMerge}>Compare / Merge</button>
          </div>
          <div className="hint">
            After each merge: the second STA disappears, base name remains. Keep merging until one STA left.
          </div>
        </div>
      )}

      {/* Diff + Tol report (Accept to continue) */}
      {showGeom && (
        <div className="card">
          <div className="row space-between">
            <h3>Geometry Difference (best-fit refs) — 3 mm tol</h3>
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
          <div className="hint">Rows highlighted red are over 3 mm tolerance.</div>
        </div>
      )}

      {/* (Part 2 will continue here: final STA detection + Reference Line + 4-Point + Preview + Export) */}
      {/* when only one STA remains → transformation & export */}
      {lastStaName && groups[lastStaName] && (
        <div className="card">
          <h3>Final Transform (Reference Line / 4 Points) — {lastStaName}</h3>

          {/* reference-line method */}
          
<div className="row">
  <input
    placeholder="Ref A name"
    value={refA}
    onChange={(e) => setRefA(e.target.value)}
  />
  <input
    placeholder="Ref B name"
    value={refB}
    onChange={(e) => setRefB(e.target.value)}
  />
<button
  onClick={() => {
    const pts = groups[lastStaName];
    const a = pts.find(p => p.name === refA);
    const b = pts.find(p => p.name === refB);
    if (!a || !b) return setInfo("❌ Invalid ref A/B points");

    // Vector A→B
    const dE = b.E - a.E;
    const dN = b.N - a.N;
    const dH = b.H - a.H;

    // ✅ Angle to align A→B with +N axis
    const alpha = Math.atan2(dN, dE);     // direction of A→B from E-axis
    const theta = Math.PI / 2 - alpha;    // rotate so that A→B → +N

    // Rotate every point around A, then translate so A = (0,0,0)
    const rotated = pts.map(p => {
      const e = p.E - a.E;
      const n = p.N - a.N;
      const h = p.H - a.H;

      const E2 = e * Math.cos(theta) - n * Math.sin(theta);
      const N2 = e * Math.sin(theta) + n * Math.cos(theta);

      return { ...p, E: E2, N: N2, H: h };
    });

    // After rotation: A already (0,0,0).  Ensure B.E = 0, B.N = distance, B.H = ΔH
    // (numerically it's already true; no extra shift needed)

    setTransformed(rotated);
    setLastMethod("ReferenceLine");
    setInfo("✅ Reference line applied — A=(0,0,0), B=(0, distance, ΔH), Right=+E");
  }}
>
  Apply Reference Line
</button>
</div>
        

          {/* manual 4-point fit */}
          <h4>Manual 4 Points ENH Transform</h4>
          {fitPts.map((f, i) => (
            <div key={i} className="row">
              <input
                value={f.name}
                onChange={(e) =>
                  setFitPts((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    )
                  )
                }
                placeholder={`Pt${i + 1} name`}
              />
              <input
                type="number"
                value={f.E}
                onChange={(e) =>
                  setFitPts((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, E: e.target.value } : x
                    )
                  )
                }
                placeholder="E"
              />
              <input
                type="number"
                value={f.N}
                onChange={(e) =>
                  setFitPts((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, N: e.target.value } : x
                    )
                  )
                }
                placeholder="N"
              />
              <input
                type="number"
                value={f.H}
                onChange={(e) =>
                  setFitPts((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, H: e.target.value } : x
                    )
                  )
                }
                placeholder="H"
              />
            </div>
          ))}
<button
  onClick={() => {
    const basePts = fitPts.filter(p => p.name && !isNaN(p.E) && !isNaN(p.N) && !isNaN(p.H));
    if (basePts.length < 4) return setInfo("❌ Need 4 valid points");

    const staPts = groups[lastStaName];
    const src = basePts.map(b => staPts.find(p => p.name === b.name)).filter(Boolean);
    if (src.length < 4) return setInfo("❌ 4 matching points not found in dataset");

    const srcArr = src.map(p => [p.E, p.N, p.H]);
    const dstArr = basePts.map(p => [parseFloat(p.E), parseFloat(p.N), parseFloat(p.H)]);
try {
  const { R, T } = fourPoint3DTransform(srcArr, dstArr);

  const out = staPts.map(p => {
    // v' = R * v + T   (v, T are column/row awarenessကို mathjs handle လုပ်နိုင်တယ်)
    const v  = math.matrix([p.E, p.N, p.H]);     // 1x3 row
    const Rt = math.multiply(R, math.transpose(v)); // 3x1
    const v2 = math.add(Rt, math.transpose(T));     // 3x1

    return {
      ...p,
      E: v2.get([0,0]),
      N: v2.get([1,0]),
      H: v2.get([2,0]),
    };
  });

  setTransformed(out);
  setLastMethod("FourPoint3D");
  setInfo("✅ Applied 4-point rigid 3D transform (follows your ENH exactly)");
} catch (err) {
  setInfo("❌ 3D transform failed: " + err.message);
}
  }}
>
  Apply 4-Point 3D Transform
</button>
          {/* results preview */}
          {transformed.length > 0 && (
            <div className="card">
              <h4>
                Transformed Result ({lastMethod === "ReferenceLine"
                  ? "Ref Line"
                  : "4 Points"}
                )
              </h4>
              <table className="result">
                <thead>
                  <tr>
                    <th>Name</th>
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

              {/* export to TXT */}
              <button
                onClick={() => {
                  const txt = transformed
                    .map(
                      (p) =>
                        `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(
                          3
                        )}\t${p.H.toFixed(3)}`
                    )
                    .join("\n");
                  const blob = new Blob([txt], {
                    type: "text/plain;charset=utf-8",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${lastStaName}_${lastMethod}.txt`;
                  a.click();
                }}
              >
                📤 Export Result
              </button>
            </div>
          )}
        </div>
      )}

      <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
                    }
