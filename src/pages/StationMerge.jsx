// src/pages/StationMerge.jsx — PART 1/3
import React, { useState, useMemo } from "react";
import "./StationMerge.css";

// component-level tolerance (meters)
const TOL = 0.003; // 3 mm

// 2D best-fit similarity (scale + rotation + shift)
function fitSimilarity2D(basePts, movePts) {
  const n = basePts.length;
  if (n === 0) return { scale: 1, cos: 1, sin: 0, tx: 0, ty: 0 };

  let cEx = 0, cEy = 0, cMx = 0, cMy = 0;
  for (let i = 0; i < n; i++) {
    cEx += basePts[i][0]; cEy += basePts[i][1];
    cMx += movePts[i][0]; cMy += movePts[i][1];
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

// helper: download text file
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
      const E = parseFloat(eStr), N = parseFloat(nStr), H = parseFloat(hStr);
      if (!pname || !Number.isFinite(E) || !Number.isFinite(N) || !Number.isFinite(H))
        continue;
      next[current].push({ name: pname.trim(), E, N, H });
    }

    setGroups(next);
    setKeepMap({});
    setInfo(`✔ Loaded ${Object.keys(next).length} STA group(s).`);
    setFromSta(""); setToSta(""); setMerged([]);
    setMergeSummaries([]); setMergeErrors([]); setMergePairErrors([]);
    setTransformed([]); setRefA(""); setRefB("");
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

  const renameSta = (oldName, val) => {
    const raw = (val || "").toString().trim();
    if (!raw) {
      setInfo("⚠️ Enter a non-empty STA name."); return;
    }
    let candidate = raw;
    if (candidate !== oldName && groups[candidate]) {
      let i = 2; while (groups[`${candidate}_${i}`]) i++;
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
      if (copy[oldName]) { copy[candidate] = copy[oldName]; delete copy[oldName]; }
      return copy;
    });

    if (fromSta === oldName) setFromSta(candidate);
    if (toSta === oldName) setToSta(candidate);
    setInfo(`✏️ Renamed ${oldName} → ${candidate}`);
  };
// src/pages/StationMerge.jsx — PART 2/3

  const updatePointName = (sta, idx, value) => {
    setGroups((prev) => {
      const copy = { ...prev };
      const arr = [...(copy[sta] || [])];
      arr[idx] = { ...arr[idx], name: (value || "").toString() };
      copy[sta] = arr;
      return copy;
    });
  };

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
  };

  const handleMerge = () => {
    if (!fromSta || !toSta) { setInfo("⚠️ Choose two STAs first"); return; }
    if (fromSta === toSta) { setInfo("⚠️ Choose different STAs"); return; }

    const A = groups[fromSta], B = groups[toSta];
    if (!A || !B) { setInfo("⚠️ Invalid STA names"); return; }

    const Amap = new Map(A.map((p) => [p.name, p]));
    const Bmap = new Map(B.map((p) => [p.name, p]));
    const common = [...Amap.keys()].filter((k) => Bmap.has(k));

    if (common.length === 0) {
      setInfo("⚠️ Cannot merge: no common points!"); return;
    }
    if (common.length < 7) { setInfo("⚠️ Need ≥7 common points for best-fit."); return; }

    // First common point check (optional alert)
    const p0 = common[0];
    const a0 = Amap.get(p0), b0 = Bmap.get(p0);
    const d0 = Math.hypot(a0.E - b0.E, a0.N - b0.N, a0.H - b0.H);
    if (d0 > TOL) {
      alert(`⚠ First common point '${p0}' differs by ${(d0 * 1000).toFixed(1)} mm`);
    }

    // Best-fit 2D + mean H shift
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

    // Pairwise differences for diagnostics
    const pairErrs = [];
    if (common.length >= 2) {
      const refName = common[0];
      const a_ref = Amap.get(refName);
      const Btrans = new Map(common.map((n) => [n, tfB(Bmap.get(n))]));
      for (let i = 1; i < common.length; i++) {
        const nm = common[i];
        const a_pt = Amap.get(nm), b_pt = Btrans.get(nm);
        const dA = Math.hypot(a_pt.E - a_ref.E, a_pt.N - a_ref.N, a_pt.H - a_ref.H);
        const dB = Math.hypot(b_pt.E - Btrans.get(refName).E, b_pt.N - Btrans.get(refName).N, b_pt.H - Btrans.get(refName).H);
        pairErrs.push({ fromRef: refName, toName: nm, dA, dB, dd: Math.abs(dA - dB), dd_mm: Math.abs(dA - dB) * 1000 });
      }
    }
    setMergePairErrors(pairErrs);

    // Point-wise errors
    const errList = [];
    let exceedCount = 0, maxm = 0;
    for (const n of common) {
      const a = Amap.get(n), bT = tfB(Bmap.get(n));
      const rE = bT.E - a.E, rN = bT.N - a.N, rH = bT.H - a.H;
      const d = Math.hypot(rE, rN, rH);
      if (d > TOL) { exceedCount++; if (d > maxm) maxm = d; errList.push({ name: n, dE: rE, dN: rN, dH: rH, dmm: d * 1000, from: fromSta, to: toSta }); }
    }

    const nonDup = B.filter((p) => !Amap.has(p.name)).map(tfB);
    const mergedArr = [...A, ...nonDup];

    const ng = { ...groups };
    delete ng[toSta]; ng[fromSta] = mergedArr;

    setGroups(ng);
    setMerged(mergedArr);
    setTransformed([]);
    setMergeErrors(errList);
    setMergeSummaries((prev) => [...prev.filter((s) => s.group !== toSta), { group: toSta, count: exceedCount, maxmm: maxm }]);

    setInfo(
      exceedCount > 0
        ? `⚠️ Best-fit merged ${toSta} → ${fromSta} — ${exceedCount} pt(s) > ${(TOL * 1000).toFixed(0)} mm (max ${(maxm * 1000).toFixed(1)} mm)`
        : `✅ Best-fit merged ${toSta} → ${fromSta} (all refs ≤ ${(TOL * 1000).toFixed(0)} mm)`
    );
  };

  const exportMerged = () => {
    const ws = merged.length > 0 ? merged : (staNames.length === 1 ? groups[staNames[0]] : []);
    if (!ws || ws.length === 0) { setInfo("⚠️ No working set to export."); return; }
    const lines = ws.map((p) => `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`);
    downloadTextFile("StationMerge_merged.txt", lines.join("\n"));
  };
// src/pages/StationMerge.jsx — PART 3/3

const getWorkingSet = () => {
  if (merged && merged.length > 0) return merged;
  if (staNames.length === 1) return groups[staNames[0]] || [];
  return [];
};

const applyRefLine = () => {
  const pts = getWorkingSet();
  if (!pts.length) return setInfo("⚠️ No working set available (upload or merge first).");
  if (!refA || !refB) return setInfo("⚠️ Enter reference points A and B.");

  const A = pts.find((p) => p.name === refA);
  const B = pts.find((p) => p.name === refB);
  if (!A || !B) return setInfo("⚠ Reference point names not found in working set.");

  const dx = B.E - A.E;
  const dy = B.N - A.N;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) return setInfo("⚠ Reference points are coincident or too close.");

  const ux = dx / len;
  const uy = dy / len;

  const out = pts.map((p) => ({
    name: p.name,
    E: vx = p.E - A.E,
    N: vy = p.N - A.N,
    H: p.H - A.H,
    E: vx * uy - vy * ux,
    N: vx * ux + vy * uy,
  }));

  setTransformed(out);
  setInfo(`📏 Reference line applied — A=${refA}, B=${refB} (A→(0,0,0))`);
};

const exportTransformed = () => {
  const arr = transformed.length ? transformed : getWorkingSet();
  if (!arr.length) return setInfo("⚠️ Nothing to export. Apply Reference Line or merge first.");
  const lines = arr.map((p) => `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`);
  downloadTextFile("StationMerge_final_refline.txt", lines.join("\n"));
};

// UI Rendering helpers
const renderStaSummary = () => {
  if (!staNames.length) return null;
  return (
    <div className="card">
      <h3>📂 STA Groups</h3>
      <ul>
        {staNames.map((s) => (
          <li key={s}>
            <strong>{s}</strong> – {groups[s]?.length || 0} pts
          </li>
        ))}
      </ul>
    </div>
  );
};

const renderToleranceSummary = () => {
  if (!mergeSummaries?.length) return null;
  return (
    <div className="card">
      <h3>📏 Merge tolerance summary (≤ 3 mm)</h3>
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
  );
};

const MergeWarningBox = () => {
  if (!mergeWarnings?.length) return null;
  return (
    <div
      className="merge-warning-box"
      style={{ border: "1px solid orange", padding: "10px", marginTop: 10, backgroundColor: "#fff4e5" }}
    >
      <h4 style={{ color: "orange" }}>⚠ Merge Warning</h4>
      <ul>
        {mergeWarnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
};

return (
  <div className="page station-merge">
    <h2>📐 StationMerge – WMK / Seatrium DC</h2>
    {info && <div className="info">{info}</div>}
    <MergeWarningBox />
    {/* Upload / Paste */}
    <div className="card">
      <h3>📥 Upload TXT / CSV</h3>
      <input type="file" accept=".txt,.csv" onChange={handleFile} />
      <textarea
        className="textarea"
        rows={6}
        value={rawText}
        onChange={(e) => { setRawText(e.target.value); parseTextToGroups(e.target.value); }}
        placeholder="Paste lines: STA..., PointName, E, N, H  (comma/tab/semicolon separated)"
      />
    </div>
    {renderStaSummary()}
    {renderToleranceSummary()}
    {/* Merge & Reference Line UI omitted for brevity; use PART1+PART2 code */}
    <footer className="footer">© 2025 WMK Seatrium DC Team</footer>
  </div>
);

} // function StationMerge end

export default StationMerge;