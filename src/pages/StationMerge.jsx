// Part 1/3
import React, { useState, useMemo } from "react";
import "./StationMerge.css";

const TOL = 0.003; // 3 mm

function fitSimilarity2D(basePts, movePts) {
  const n = basePts.length;
  if (n === 0) return { scale: 1, cos: 1, sin: 0, tx: 0, ty: 0 };

  let cEx = 0, cEy = 0, cMx = 0, cMy = 0;
  for (let i = 0; i < n; i++) {
    cEx += basePts[i][0];
    cEy += basePts[i][1];
    cMx += movePts[i][0];
    cMy += movePts[i][1];
  }
  cEx /= n; cEy /= n; cMx /= n; cMy /= n;

  let Sxx = 0, Sxy = 0, normM = 0;
  for (let i = 0; i < n; i++) {
    const bx = basePts[i][0] - cEx, by = basePts[i][1] - cEy;
    const mx = movePts[i][0] - cMx, my = movePts[i][1] - cMy;
    Sxx += mx * bx + my * by;
    Sxy += mx * by - my * bx;
    normM += mx * mx + my * my;
  }

  const r = Math.hypot(Sxx, Sxy) || 1e-12;
  const scale = r / (normM || 1e-12);
  const cos = Sxx / r;
  const sin = Sxy / r;
  const tx = cEx - scale * (cos * cMx - sin * cMy);
  const ty = cEy - scale * (sin * cMx + cos * cMy);
  return { scale, cos, sin, tx, ty };
}

function downloadTextFile(name, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [keepMap, setKeepMap] = useState({});
  const [info, setInfo] = useState("");
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [merged, setMerged] = useState([]);
  const [mergeSummaries, setMergeSummaries] = useState([]);
  const [mergeErrors, setMergeErrors] = useState([]);
  const [mergePairErrors, setMergePairErrors] = useState([]);
  const [mergeWarnings, setMergeWarnings] = useState([]);
  const [transformed, setTransformed] = useState([]);
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const txt = String(ev.target.result || "");
      setRawText(txt);
      parseTextToGroups(txt);
    };
    r.readAsText(f);
  };

  const parseTextToGroups = (txt) => {
    const lines = txt.split(/\r?\n/);
    const next = {};
    const used = {};
    let current = null;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[,\t;]+/).map((s) => s.trim());
      if (!parts[0]) continue;
      if (/^STA\.?\d*/i.test(parts[0])) {
        const base = parts[0].replace(/\s+/g, "");
        const count = (used[base] || 0) + 1;
        used[base] = count;
        const name = count === 1 ? base : `${base}_${count}`;
        current = name;
        if (!next[current]) next[current] = [];
        continue;
      }
      if (!current) continue;
      const [pname, eStr, nStr, hStr] = parts;
      const E = parseFloat(eStr);
      const N = parseFloat(nStr);
      const H = parseFloat(hStr);
      if (!pname || !Number.isFinite(E) || !Number.isFinite(N) || !Number.isFinite(H)) continue;
      next[current].push({ name: pname.trim(), E, N, H });
    }

    setGroups(next);
    setKeepMap({});
    setInfo(`✔ Loaded ${Object.keys(next).length} STA group(s).`);
    setFromSta("");
    setToSta("");
    setMerged([]);
    setMergeSummaries([]);
    setMergeErrors([]);
    setMergePairErrors([]);
    setTransformed([]);
    setRefA("");
    setRefB("");
  };

  const staNames = useMemo(() => Object.keys(groups).sort(), [groups]);
  const staSortedEntries = staNames.map((k) => [k, groups[k]]);

  const toggleKeep = (sta, ptName) => {
    setKeepMap((prev) => {
      const g = { ...(prev[sta] || {}) };
      g[ptName] = g[ptName] === false ? true : false;
      return { ...prev, [sta]: g };
    });
  };
// Part 2/3
  // rename STA
  const renameSta = (oldName, val) => {
    const raw = (val || "").toString().trim();
    if (!raw) {
      setInfo("⚠️ Enter a non-empty STA name.");
      return;
    }
    let candidate = raw;
    if (candidate !== oldName && groups[candidate]) {
      let i = 2;
      while (groups[`${candidate}_${i}`]) i++;
      candidate = `${candidate}_${i}`;
    }
    if (candidate === oldName) return;

    setGroups((prev) => {
      const copy = { ...prev };
      copy[candidate] = copy[oldName];
      delete copy[oldName];
      return copy;
    });

    setKeepMap((prev) => {
      const copy = { ...prev };
      if (copy[oldName]) {
        copy[candidate] = copy[oldName];
        delete copy[oldName];
      }
      return copy;
    });

    if (fromSta === oldName) setFromSta(candidate);
    if (toSta === oldName) setToSta(candidate);
    setInfo(`✏️ Renamed ${oldName} → ${candidate}`);
  };

  // update point name
  const updatePointName = (sta, idx, value) => {
    setGroups((prev) => {
      const copy = { ...prev };
      const arr = [...(copy[sta] || [])];
      arr[idx] = { ...arr[idx], name: (value || "").toString() };
      copy[sta] = arr;
      return copy;
    });
  };

  // apply removal of unchecked points
  const applyFilter = () => {
    const ng = {};
    for (const sta of Object.keys(groups)) {
      const pts = groups[sta] || [];
      const keepCfg = keepMap[sta] || {};
      const filtered = pts.filter((p) => keepCfg[p.name] !== false);
      if (filtered.length > 0) ng[sta] = filtered;
    }
    setGroups(ng);
    setInfo("🧹 Removed unwanted points (unchecked).");
    setMerged([]);
    setTransformed([]);
    setMergeErrors([]);
    setMergePairErrors([]);
    setMergeSummaries([]);
  };

  // ===== Merge (best-fit) =====
  const handleMerge = () => {
    if (!fromSta || !toSta) {
      setInfo("⚠️ Choose two STAs first");
      return;
    }
    if (fromSta === toSta) {
      setInfo("⚠️ Choose different STAs");
      return;
    }
    const A = groups[fromSta];
    const B = groups[toSta];
    if (!A || !B) {
      setInfo("⚠️ Invalid STA names");
      return;
    }

    const Amap = new Map(A.map((p) => [p.name, p]));
    const Bmap = new Map(B.map((p) => [p.name, p]));
    const common = [...Amap.keys()].filter((k) => Bmap.has(k));

    if (common.length === 0) {
      setInfo("⚠️ Cannot merge: no common points!");
      setMergeWarnings([`⚠️ Cannot merge: no common points!`]);
      return;
    }

    if (common.length < 7) {
      setInfo("⚠️ Need ≥7 common points for best-fit.");
      setMergeWarnings([`⚠️ Cannot merge: less than 7 common points!`]);
      return;
    }

    setMergeWarnings([]);

    // First common point alert
    {
      const p0 = common[0];
      const a0 = Amap.get(p0);
      const b0 = Bmap.get(p0);
      const d0 = Math.hypot(a0.E - b0.E, a0.N - b0.N, a0.H - b0.H);
      if (d0 > TOL) {
        alert(`⚠ First common point '${p0}' differs by ${(d0 * 1000).toFixed(1)} mm`);
      }
    }

    // Best-fit 2D (EN) + mean H shift
    const BaseEN = common.map((n) => [Amap.get(n).E, Amap.get(n).N]);
    const MovEN = common.map((n) => [Bmap.get(n).E, Bmap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(BaseEN, MovEN);

    const dHavg = common.reduce((sum, n) => sum + (Amap.get(n).H - Bmap.get(n).H), 0) / common.length;

    const tfB = (p) => ({
      name: p.name,
      E: scale * (cos * p.E - sin * p.N) + tx,
      N: scale * (sin * p.E + cos * p.N) + ty,
      H: p.H + dHavg,
    });

    // pairwise differences
    const pairErrs = [];
    if (common.length >= 2) {
      const refName = common[0];
      const a_ref = Amap.get(refName);
      const Btrans = new Map();
      for (const n of common) Btrans.set(n, tfB(Bmap.get(n)));

      for (let i = 1; i < common.length; i++) {
        const nm = common[i];
        const a_pt = Amap.get(nm);
        const b_pt = Btrans.get(nm);
        const dA = Math.hypot(a_pt.E - a_ref.E, a_pt.N - a_ref.N, a_pt.H - a_ref.H);
        const dB = Math.hypot(b_pt.E - Btrans.get(refName).E, b_pt.N - Btrans.get(refName).N, b_pt.H - Btrans.get(refName).H);
        pairErrs.push({ fromRef: refName, toName: nm, dA, dB, dd: Math.abs(dA - dB), dd_mm: Math.abs(dA - dB) * 1000 });
      }
    }
    setMergePairErrors(pairErrs);

    // point-wise tolerance errors
    let exceedCount = 0, maxm = 0;
    const errList = [];
    for (const n of common) {
      const a = Amap.get(n);
      const bT = tfB(Bmap.get(n));
      const dE = bT.E - a.E;
      const dN = bT.N - a.N;
      const dH = bT.H - a.H;
      const d = Math.hypot(dE, dN, dH);
      if (d > TOL) {
        exceedCount++;
        if (d > maxm) maxm = d;
        errList.push({ name: n, dE, dN, dH, dmm: d * 1000, from: fromSta, to: toSta });
      }
    }

    const nonDup = B.filter((p) => !Amap.has(p.name)).map(tfB);
    const mergedArr = [...A, ...nonDup];

    const ng = { ...groups };
    delete ng[toSta];
    ng[fromSta] = mergedArr;

    setGroups(ng);
    setMerged(mergedArr);
    setTransformed([]);
    setMergeErrors(errList);
    setMergeSummaries((prev) => {
      const others = prev.filter((s) => s.group !== toSta);
      return [...others, { group: toSta, count: exceedCount, maxmm: maxm }];
    });

    setInfo(
      exceedCount > 0
        ? `⚠️ Best-fit merged ${toSta} → ${fromSta} — ${exceedCount} pt(s) > ${(TOL * 1000).toFixed(0)} mm (max ${(maxm * 1000).toFixed(1)} mm)`
        : `✅ Best-fit merged ${toSta} → ${fromSta} (all refs ≤ ${(TOL * 1000).toFixed(0)} mm)`
    );
  };

  // export merged
  const exportMerged = () => {
    const ws = merged.length > 0 ? merged : (staNames.length === 1 ? groups[staNames[0]] : []);
    if (!ws || ws.length === 0) {
      setInfo("⚠️ No working set to export.");
      return;
    }
    const lines = ws.map((p) => `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`);
    downloadTextFile("StationMerge_merged.txt", lines.join("\n"));
  };
// Part 3/3
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>🗂 Station Merge Tool</h2>
      <div style={{ marginBottom: "10px" }}>
        <label>
          From STA: 
          <select value={fromSta || ""} onChange={(e) => setFromSta(e.target.value)}>
            <option value="">--Select--</option>
            {staNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ marginLeft: "15px" }}>
          To STA: 
          <select value={toSta || ""} onChange={(e) => setToSta(e.target.value)}>
            <option value="">--Select--</option>
            {staNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button onClick={handleMerge} style={{ marginLeft: "15px" }}>🔀 Merge</button>
        <button onClick={applyFilter} style={{ marginLeft: "10px" }}>🧹 Remove unchecked</button>
        <button onClick={exportMerged} style={{ marginLeft: "10px" }}>💾 Export Merged</button>
      </div>

      <div style={{ marginBottom: "10px", color: "green" }}>{info}</div>
      {mergeWarnings.length > 0 && (
        <div style={{ color: "red" }}>
          {mergeWarnings.map((w, idx) => <div key={idx}>{w}</div>)}
        </div>
      )}

      <div style={{ display: "flex", gap: "30px" }}>
        {staNames.map((s) => (
          <div key={s} style={{ border: "1px solid #aaa", padding: "10px", flex: 1 }}>
            <h3>
              <input
                value={s}
                onChange={(e) => renameSta(s, e.target.value)}
                style={{ width: "80%" }}
              />
            </h3>
            <ul>
              {(groups[s] || []).map((p, i) => (
                <li key={i}>
                  <input
                    type="checkbox"
                    checked={keepMap[s]?.[p.name] !== false}
                    onChange={(e) =>
                      setKeepMap((prev) => ({
                        ...prev,
                        [s]: { ...prev[s], [p.name]: e.target.checked },
                      }))
                    }
                  />{" "}
                  <input
                    value={p.name}
                    onChange={(e) => updatePointName(s, i, e.target.value)}
                    style={{ width: "70%" }}
                  />{" "}
                  E:{p.E.toFixed(3)} N:{p.N.toFixed(3)} H:{p.H.toFixed(3)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {mergePairErrors.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h4>📊 Pairwise Differences (mm)</h4>
          <table border={1} cellPadding={3}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Point</th>
                <th>dA</th>
                <th>dB</th>
                <th>Δ (mm)</th>
              </tr>
            </thead>
            <tbody>
              {mergePairErrors.map((p, i) => (
                <tr key={i}>
                  <td>{p.fromRef}</td>
                  <td>{p.toName}</td>
                  <td>{(p.dA*1000).toFixed(2)}</td>
                  <td>{(p.dB*1000).toFixed(2)}</td>
                  <td>{p.dd_mm.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mergeErrors.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h4>❌ Exceeding Tolerance (mm)</h4>
          <table border={1} cellPadding={3}>
            <thead>
              <tr>
                <th>Name</th>
                <th>dE</th>
                <th>dN</th>
                <th>dH</th>
                <th>dTotal</th>
              </tr>
            </thead>
            <tbody>
              {mergeErrors.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.dE.toFixed(3)}</td>
                  <td>{p.dN.toFixed(3)}</td>
                  <td>{p.dH.toFixed(3)}</td>
                  <td>{p.dmm.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {merged.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h4>✅ Merged Points Preview</h4>
          <table border={1} cellPadding={3}>
            <thead>
              <tr>
                <th>Name</th>
                <th>E</th>
                <th>N</th>
                <th>H</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.E.toFixed(4)}</td>
                  <td>{p.N.toFixed(4)}</td>
                  <td>{p.H.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer style={{ marginTop: "20px", fontSize: "0.9em", color: "#555" }}>
        StationMerge.jsx – Developed by Win Min Thuzar – 2025
      </footer>
    </div>
  );
};

export default StationMerge;