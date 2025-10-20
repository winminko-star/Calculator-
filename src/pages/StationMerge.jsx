// 💡 IDEA by WIN MIN KO
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);
  const [filteredPts, setFilteredPts] = useState([]);
  const [info, setInfo] = useState("");
  const [geomDiff, setGeomDiff] = useState([]);
  const [showGeom, setShowGeom] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");

  // Transform states
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

  // ---- File Upload ----
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f.name);
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      const g = parseSTAFile(text);
      setGroups(g);
      setFilteredPts([]);
      setInfo("✅ File loaded successfully");
    };
    r.readAsText(f);
  };

  // ---- Parser (STA header skip ENH) ----
  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let current = null;
    for (let raw of lines) {
      if (!raw.trim()) continue;
      const p = raw.split(/[,\t]/).map((x) => x.trim());
      if (p.length < 4) continue;
      const [name, e, n, h] = p;
      if (/^STA\d+/i.test(name)) {
        current = name;
        out[current] = [];
        continue;
      }
      if (current) {
        const E = parseFloat(e),
          N = parseFloat(n),
          H = parseFloat(h);
        if ([E, N, H].every(Number.isFinite))
          out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ---- Remove unwanted points ----
  const handleRemovePoint = (sta, name) => {
    const newGroup = { ...groups };
    newGroup[sta] = newGroup[sta].filter((p) => p.name !== name);
    setGroups(newGroup);
    setFilteredPts([...filteredPts, name]);
    setInfo(`🗑 Removed point ${name} from ${sta}`);
  };

  // ---- Similarity fit (rotation + scale + translation) ----
  function fitSimilarity2D(basePts, movePts) {
    const n = basePts.length;
    let cEx = 0, cEy = 0, cMx = 0, cMy = 0;
    for (let i = 0; i < n; i++) {
      cEx += basePts[i][0];
      cEy += basePts[i][1];
      cMx += movePts[i][0];
      cMy += movePts[i][1];
    }
    cEx /= n; cEy /= n; cMx /= n; cMy /= n;
    let Sxx = 0, Sxy = 0, normM = 0, normB = 0;
    for (let i = 0; i < n; i++) {
      const bx = basePts[i][0] - cEx, by = basePts[i][1] - cEy;
      const mx = movePts[i][0] - cMx, my = movePts[i][1] - cMy;
      Sxx += mx * bx + my * by;
      Sxy += mx * by - my * bx;
      normM += mx * mx + my * my;
      normB += bx * bx + by * by;
    }
    const scale = Math.sqrt(normB / normM);
    const r = Math.hypot(Sxx, Sxy) || 1e-12;
    const cos = Sxx / r, sin = Sxy / r;
    const tx = cEx - scale * (cos * cMx - sin * cMy);
    const ty = cEy - scale * (sin * cMx + cos * cMy);
    return { scale, cos, sin, tx, ty };
  }

  // ---- Merge + Geometry Diff ----
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names");
    const base = groups[fromSta], next = groups[toSta];
    if (!base || !next) return setInfo("⚠️ Invalid STA");

    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (common.length < 2) return setInfo("⚠️ Need ≥2 common points");

    const B = common.map((n) => [baseMap.get(n).E, baseMap.get(n).N]);
    const M = common.map((n) => [nextMap.get(n).E, nextMap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);
    const dhAvg = common.reduce((a, n) => a + (baseMap.get(n).H - nextMap.get(n).H), 0) / common.length;

    const ref = common[0];
    const rB = baseMap.get(ref), rM = nextMap.get(ref);
    const rMx = scale * (cos * rM.E - sin * rM.N) + tx;
    const rMy = scale * (sin * rM.E + cos * rM.N) + ty;
    const rMh = rM.H + dhAvg;
    const diff = [];

    for (let i = 1; i < common.length; i++) {
      const nm = common[i];
      const b = baseMap.get(nm), m = nextMap.get(nm);
      const mX = scale * (cos * m.E - sin * m.N) + tx;
      const mY = scale * (sin * m.E + cos * m.N) + ty;
      const mH = m.H + dhAvg;
      const dE1 = b.E - rB.E, dN1 = b.N - rB.N, dH1 = b.H - rB.H;
      const dE2 = mX - rMx, dN2 = mY - rMy, dH2 = mH - rMh;
      const de = dE1 - dE2, dn = dN1 - dN2, dh = dH1 - dH2;
      const dmm = Math.sqrt(de * de + dn * dn + dh * dh) * 1000;
      diff.push({ name: `${ref}→${nm}`, dE1, dE2, de, dn, dh, dmm });
    }

    const mergedNew = [...base];
    for (const [name, p] of nextMap) if (!baseMap.has(name)) mergedNew.push(p);
    delete groups[toSta];
    groups[fromSta] = mergedNew;

    setGroups({ ...groups });
    setMerged(mergedNew);
    setGeomDiff(diff);
    setShowGeom(true);
    setInfo(`✅ ${fromSta} merged with ${toSta}. Diff ready.`);
  };
  // ---- Reference Line Transform ----
  const applyRefLine = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    const A = merged.find((p) => p.name === refA);
    const B = merged.find((p) => p.name === refB);
    if (!A || !B) return setInfo("⚠️ Invalid reference points");
    const dE = B.E - A.E, dN = B.N - A.N, dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("⚠️ Coincident reference line");
    const phi = Math.atan2(dE, dN);
    const c = Math.cos(phi), s = Math.sin(phi);
    const out = merged.map((p) => {
      const e0 = p.E - A.E, n0 = p.N - A.N, h0 = p.H - A.H;
      return { name: p.name, E: c * e0 - s * n0, N: s * e0 + c * n0, H: h0 };
    });
    setTransformed(out);
    setLastMethod("Reference Line");
    setInfo(`✅ Ref line applied — ${refA}→${refB}`);
  };

  // ---- 4-Point Manual Fit ----
  const apply4PointFit = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    for (const p of fitPts)
      if (!p.name || p.E === "" || p.N === "" || p.H === "")
        return setInfo("⚠️ Fill all 4 points");
    const srcMap = new Map(merged.map((p) => [p.name, p]));
    const src = fitPts.map((p) => {
      const s = srcMap.get(p.name.trim());
      if (!s) throw new Error(`Missing ${p.name}`);
      return [s.E, s.N, s.H];
    });
    const tgt = fitPts.map((p) => [parseFloat(p.E), parseFloat(p.N), parseFloat(p.H)]);
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [xs, ys, zs] = src[i], [xt, yt, zt] = tgt[i];
      A.push([xs, ys, zs, 0, 0, 0, 0, 0, 0, 1, 0, 0]); b.push(xt);
      A.push([0, 0, 0, xs, ys, zs, 0, 0, 0, 0, 1, 0]); b.push(yt);
      A.push([0, 0, 0, 0, 0, 0, xs, ys, zs, 0, 0, 1]); b.push(zt);
    }
    const x = solveLinearSystem(A, b);
    const apply = (E, N, H) => ({
      E: x[0] * E + x[1] * N + x[2] * H + x[9],
      N: x[3] * E + x[4] * N + x[5] * H + x[10],
      H: x[6] * E + x[7] * N + x[8] * H + x[11],
    });
    setTransformed(merged.map((p) => ({ name: p.name, ...apply(p.E, p.N, p.H) })));
    setLastMethod("4-Point Fit");
    setInfo("✅ 4-Point Fit applied");
  };

  function solveLinearSystem(A, b) {
    const n = A.length, m = A[0].length;
    const M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < m; i++) {
      let p = i;
      for (let j = i + 1; j < n; j++)
        if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      [M[i], M[p]] = [M[p], M[i]];
      const div = M[i][i]; if (!div) continue;
      for (let k = i; k <= m; k++) M[i][k] /= div;
      for (let j = 0; j < n; j++)
        if (j !== i) {
          const f = M[j][i];
          for (let k = i; k <= m; k++) M[j][k] -= f * M[i][k];
        }
    }
    return M.map((r) => r[m]);
  }

  // ---- Export ----
  const onExport = () => {
    const data = transformed.length ? transformed : merged;
    if (!data.length) return alert("No data");
    const t = data
      .map((p) => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`)
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
    a.download = "Final_STA_WMK.txt";
    a.click();
  };

  return (
    <div className="sta-merge">
      <h1>💡 IDEA by WIN MIN KO</h1>
      <div className="card">
        <label>📤 Upload TXT File</label>
        <input type="file" accept=".txt" onChange={onFile} />
        {selectedFile && <div className="filename">📄 {selectedFile}</div>}
        {info && <div className="msg">{info}</div>}
      </div>

      {Object.keys(groups).length > 0 && (
        <div className="card">
          <h3>🗑 Remove Unwanted Points</h3>
          {Object.entries(groups).map(([sta, pts]) => (
            <details key={sta}>
              <summary>{sta} ({pts.length} pts)</summary>
              <ul>
                {pts.map((p, i) => (
                  <li key={i}>
                    {p.name}{" "}
                    <button onClick={() => handleRemovePoint(sta, p.name)}>Remove</button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      {/* Merge & Diff Section */}
      {/* Transform methods and Export similar to previous version */}
      {showGeom && (
        <div className="card">
          <div className="row space-between">
            <h3>📊 Geometry Diff ({fromSta} → {toSta})</h3>
            <button onClick={() => setShowGeom(false)}>✔ Accept</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Ref→Pt</th><th>ΔE₁</th><th>ΔE₂</th>
                  <th>ΔE diff</th><th>ΔN diff</th><th>ΔH diff</th><th>Δ mm</th>
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
    </div>
  );
        }
