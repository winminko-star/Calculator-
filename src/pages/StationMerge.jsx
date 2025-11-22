// src/pages/StationMerge.jsx  — PART 1/3
import React, { useState, useMemo,useEffect } from "react";
import "./StationMerge.css";

// component-level tolerance (meters)
const TOL = 0.003; // 3 mm

// 2D best-fit similarity (scale + rotation + shift)
function fitSimilarity2D(basePts, movePts) {
  // basePts = destination (A), movePts = source (B)
  const n = basePts.length;
  if (n === 0) return { scale: 1, cos: 1, sin: 0, tx: 0, ty: 0 };

  let cEx = 0,
    cEy = 0,
    cMx = 0,
    cMy = 0;

  for (let i = 0; i < n; i++) {
    cEx += basePts[i][0];
    cEy += basePts[i][1];
    cMx += movePts[i][0];
    cMy += movePts[i][1];
  }
  cEx /= n;
  cEy /= n;
  cMx /= n;
  cMy /= n;

  let Sxx = 0,
    Sxy = 0,
    normM = 0;
  for (let i = 0; i < n; i++) {
    const bx = basePts[i][0] - cEx,
      by = basePts[i][1] - cEy;
    const mx = movePts[i][0] - cMx,
      my = movePts[i][1] - cMy;
    Sxx += mx * bx + my * by; // dot
    Sxy += mx * by - my * bx; // cross
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

// small helper – txt download
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
  // core states
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({}); // { STAname: [{name,E,N,H}, ...] }
  const [keepMap, setKeepMap] = useState({}); // { STAname: { pointName: false } } false -> remove
  const [info, setInfo] = useState("");
const [showEditPoints, setShowEditPoints] = useState(true);

  // merge / working set / UI
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [merged, setMerged] = useState([]); // working merged set (if any)
  const [mergeSummaries, setMergeSummaries] = useState([]); // {group,count,maxmm}
  const [mergeErrors, setMergeErrors] = useState([]); // point-level errors > TOL
  const [mergePairErrors, setMergePairErrors] = useState([]); // pairwise (first-common -> others)
// STEP 1 — Height error states
const [heightErrors, setHeightErrors] = useState([]); 
const [heightSummary, setHeightSummary] = useState(null);
  const [transformed, setTransformed] = useState([]); // after reference line
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
// restore previous uploaded text on mount
useEffect(() => {
  const saved = localStorage.getItem("stationMergeRaw");
  if (saved) setRawText(saved);
}, []);
// --- PLACE THIS ABOVE return(...) ---
const MergeHeightBox = () => {
  if (!heightErrors || heightErrors.length === 0) return null;

  return (
    <div
      className="card merge-height-box"
      style={{
        border: "1px solid #cc9",
        background: "#fffaf0",
        padding: 10,
        marginTop: 10,
        position: "relative",
      }}
    >
      <button
        className="btn btn-ghost"
        style={{ position: "absolute", right: 8, top: 8 }}
        onClick={() => { setHeightErrors([]); setHeightSummary(null); }}
        title="Clear height errors"
      >
        ✖
      </button>

      <h4 style={{ marginTop: 0 }}>⛰️ Height differences (after transform)</h4>

      <div style={{ marginBottom: 8 }}>
        <strong>Summary:</strong>{" "}
        {heightSummary ? (
          <span>
            {heightSummary.count} pt(s) — mean {heightSummary.mean_mm.toFixed(2)} mm, max {heightSummary.max_mm.toFixed(2)} mm
          </span>
        ) : (
          <span>-</span>
        )}
      </div>

      <div style={{ maxHeight: 180, overflowY: "auto", padding: "6px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "4px 6px" }}>Pt</th>
              <th style={{ padding: "4px 6px" }}>A H</th>
              <th style={{ padding: "4px 6px" }}>B (transf.) H</th>
              <th style={{ padding: "4px 6px" }}>ΔH (mm)</th>
            </tr>
          </thead>
          <tbody>
            {heightErrors.map((h, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #fafafa" }}>
                <td style={{ padding: "4px 6px" }}>{h.name}</td>
                <td style={{ padding: "4px 6px" }}>{h.aH.toFixed(3)}</td>
                <td style={{ padding: "4px 6px" }}>{h.bH_transformed.toFixed(3)}</td>
                <td style={{ padding: "4px 6px" }}>{h.dH_mm.toFixed(1)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

  // parse uploaded / pasted text into groups
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
  localStorage.setItem("stationMergeRaw", txt); 
    const lines = txt.split(/\r?\n/);
    const next = {};
    const used = {}; // baseName -> count
    let current = null;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // split by comma/ tab / semicolon
      const parts = line.split(/[,\t;]+/).map((s) => s.trim());
      if (!parts[0]) continue;

      // header line — if starts with STA (case-insensitive) treat as group header
      if (/^STA\.?\d*/i.test(parts[0])) {
        const base = parts[0].replace(/\s+/g, "");
        const count = (used[base] || 0) + 1;
        used[base] = count;
        const name = count === 1 ? base : `${base}_${count}`;
        current = name;
        if (!next[current]) next[current] = [];
        continue;
      }

      if (!current) continue; // skip until we have a header

      const [pname, eStr, nStr, hStr] = parts;
      const E = parseFloat(eStr);
      const N = parseFloat(nStr);
      const H = parseFloat(hStr);
      if (!pname || !Number.isFinite(E) || !Number.isFinite(N) || !Number.isFinite(H))
        continue;
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

  // convenience
  const staNames = useMemo(() => Object.keys(groups).sort(), [groups]);
  const staSortedEntries = staNames.map((k) => [k, groups[k]]);

  // toggle keep/remove point
  const toggleKeep = (sta, ptName) => {
    setKeepMap((prev) => {
      const g = { ...(prev[sta] || {}) };
      // default true; clicking toggles false
      g[ptName] = g[ptName] === false ? true : false;
      return { ...prev, [sta]: g };
    });
  };

  // rename STA (allowed anytime)
  const renameSta = (oldName, val) => {
    const raw = (val || "").toString().trim();
    if (!raw) {
      setInfo("⚠️ Enter a non-empty STA name.");
      return;
    }
    // make unique if collides
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
// src/pages/StationMerge.jsx  — PART 2/3 (continue in same file)

  // update point name (only name editable)
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

    // maps & common names
    const Amap = new Map(A.map((p) => [p.name, p]));
    const Bmap = new Map(B.map((p) => [p.name, p]));
    const common = [...Amap.keys()].filter((k) => Bmap.has(k));

    // if no common, just concat (no transform)
    if (common.length === 0) {
 setInfo("⚠️ Need Minimum (7) common points for best-fit.No Common Points Found.");
      return;
    }

    // need >=7 common to compute similarity properly
    if (common.length < 7) {
      setInfo("⚠️ Need Minimum (7) common points for best-fit.");
      return;
    }

    // first-common point check (3D) — alert only (optional abort commented)
    {
      const p0 = common[0];
      const a0 = Amap.get(p0);
      const b0 = Bmap.get(p0);
      const d0 = Math.hypot(a0.E - b0.E, a0.N - b0.N, a0.H - b0.H);
      if (d0 > TOL) {
        alert(`⚠ First common point '${p0}' differs by ${(d0 * 1000).toFixed(1)} mm`);
        // If you want to abort when first point differs, uncomment next line:
        // return;
      }
    }

    // Best-fit 2D (EN) + mean H shift
    const BaseEN = common.map((n) => [Amap.get(n).E, Amap.get(n).N]);
    const MovEN = common.map((n) => [Bmap.get(n).E, Bmap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(BaseEN, MovEN);

    let dHsum = 0;
    for (const n of common) dHsum += Amap.get(n).H - Bmap.get(n).H;
    const dHavg = dHsum / common.length;

    const tfB = (p) => ({
      name: p.name,
      E: scale * (cos * p.E - sin * p.N) + tx,
      N: scale * (sin * p.E + cos * p.N) + ty,
      H: p.H + dHavg,
    });

    // compute pairwise differences relative to first-common (for diagnostics)
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

        const dAx = a_pt.E - a_ref.E;
        const dAy = a_pt.N - a_ref.N;
        const dAz = a_pt.H - a_ref.H;
        const dA = Math.hypot(dAx, dAy, dAz); // m

        const b_ref = Btrans.get(refName);
        const dBx = b_pt.E - b_ref.E;
        const dBy = b_pt.N - b_ref.N;
        const dBz = b_pt.H - b_ref.H;
        const dB = Math.hypot(dBx, dBy, dBz); // m

        const dd = Math.abs(dA - dB);
        pairErrs.push({
          fromRef: refName,
          toName: nm,
          dA,
          dB,
          dd,
          dd_mm: dd * 1000,
        });
      }
    }
    setMergePairErrors(pairErrs);


    // tolerance summary + error list (point-wise after transform)
    let exceedCount = 0;
    let maxm = 0;
    const errList = [];
    for (const n of common) {
      const a = Amap.get(n);
      const bT = tfB(Bmap.get(n));
      const rE = bT.E - a.E;
      const rN = bT.N - a.N;
      const rH = bT.H - a.H;
      const d = Math.hypot(rE, rN, rH); // meters
      if (d > TOL) {
        exceedCount++;
        if (d > maxm) maxm = d;
        errList.push({
          name: n,
          dE: rE,
          dN: rN,
          dH: rH,
          dmm: d * 1000,
          from: fromSta,
          to: toSta,
        });
      }
    }
// --- set point-wise merge errors (existing)
    setMergeErrors(errList);

    // --- NEW: compute height errors per common point (after transforming B)
    const hList = [];
    for (const n of common) {
      const a = Amap.get(n);
      const bT = tfB(Bmap.get(n)); // transformed B point
      const dH = bT.H - a.H; // signed in meters
      hList.push({
        name: n,
        aH: a.H,
        bH_transformed: bT.H,
        dH, // meters signed
        dH_mm: Math.abs(dH) * 1000, // absolute mm
      });
    }
    setHeightErrors(hList);

    // --- NEW: height summary (mean, max) in mm (persistent)
    if (hList.length > 0) {
      const sum_mm = hList.reduce((s, x) => s + x.dH_mm, 0);
      const mean_mm = sum_mm / hList.length;
      const max_mm = Math.max(...hList.map((x) => x.dH_mm));
      setHeightSummary({ count: hList.length, mean_mm, max_mm });
    } else {
      setHeightSummary(null);
    }
    // build merged: keep A's values for duplicates; add transformed B non-duplicates
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

  // export merged ENH
  const exportMerged = () => {
    const ws = merged.length > 0 ? merged : (staNames.length === 1 ? groups[staNames[0]] : []);
    if (!ws || ws.length === 0) {
      setInfo("⚠️ No working set to export.");
      return;
    }
    const lines = ws.map((p) => `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`);
    downloadTextFile("StationMerge_merged.txt", lines.join("\n"));
  };
// src/pages/StationMerge.jsx  — PART 3/3 (continue & render)

  // working set helper
  const getWorkingSet = () => {
    if (merged && merged.length > 0) return merged;
    if (staNames.length === 1) return groups[staNames[0]] || [];
    return [];
  };

  // Reference line: N = along A→B, E = across (right = +, left = -), H(A)=0
  const applyRefLine = () => {
    const pts = getWorkingSet();
    if (!pts || pts.length === 0) {
      setInfo("⚠️ No working set available (upload or merge first).");
      return;
    }
    if (!refA || !refB) {
      setInfo("⚠️ Enter reference points A and B.");
      return;
    }

    const A = pts.find((p) => p.name === refA);
    const B = pts.find((p) => p.name === refB);
    if (!A || !B) {
      setInfo("⚠️ Reference point names not found in working set.");
      return;
    }

    const dx = B.E - A.E;
    const dy = B.N - A.N;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) {
      setInfo("⚠️ Reference points are coincident or too close.");
      return;
    }

    // unit along (N axis)
    const ux = dx / len;
    const uy = dy / len;

    const out = pts.map((p) => {
      const vx = p.E - A.E;
      const vy = p.N - A.N;
      const along = vx * ux + vy * uy; // new N (along)
      const across = vx * uy - vy * ux; // new E (across), right positive
      return {
        name: p.name,
        E: across, // across (right +)
        N: along,  // along
        H: p.H - A.H, // A becomes H=0
      };
    });

    setTransformed(out);
    setInfo(`📏 Reference line applied — A=${refA}, B=${refB} (A→(0,0,0))`);
  };

  // export transformed (final)
  const exportTransformed = () => {
    const arr = transformed.length > 0 ? transformed : getWorkingSet();
    if (!arr || arr.length === 0) {
      setInfo("⚠️ Nothing to export. Apply Reference Line or merge first.");
      return;
    }
    const lines = arr.map((p) => `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`);
    downloadTextFile("StationMerge_final_refline.txt", lines.join("\n"));
  };

  // render helpers
  const renderStaSummary = () => {
    if (staNames.length === 0) return null;
    return (
      <div className="card">
        <h3>📂 STA Groups</h3>
        <ul>
          {staNames.map((s) => (
            <li key={s}>
              <strong>{s}</strong> – {groups[s].length} pts
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderToleranceSummary = () => {
    if (!mergeSummaries || mergeSummaries.length === 0) return null;
    return (
      <div className="card">
        <h3>📏 Merge tolerance summary (≤ 3 mm)</h3>
        {mergeSummaries.map((s, i) =>
          s.count > 0 ? (
            <div key={i} className="line bad">
              ⚠ {s.group} → exceeded on {s.count} ref point(s), max=
              {(s.maxmm * 1000).toFixed(1)} mm
            </div>
          ) : (
            <div key={i} className="line ok">✅ {s.group} → within tolerance</div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="page station-merge">
      <h2>📐 StationMerge – WMK / Seatrium DC</h2>
<div style={{ marginBottom: 12 }}>
  <button
    className="btn btn-ghost"
    onClick={() => {
      setFromSta("");
      setToSta("");
      setMerged([]);
      setTransformed([]);
      setMergeErrors([]);
      setMergePairErrors([]);
      setMergeSummaries([]);
      setRefA("");
      setRefB("");
      setInfo("🌀 Ready to process uploaded data.");
      // rawText နဲ့ groups ကို reset / reparse လုပ်ချင်ရင်
      parseTextToGroups(rawText);
    }}
  >
    🔄 Retry / Reprocess
  </button>
</div>

      {info && <div className="info">{info}</div>}

      {/* Upload / paste */}
      <div className="card">
        <h3>📥 Upload TXT / CSV</h3>
        <input type="file" accept=".txt,.csv" onChange={handleFile} />
        <textarea
          className="textarea"
          rows={6}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            parseTextToGroups(e.target.value);
          }}
          placeholder="Paste lines: STA..., PointName, E, N, H  (comma/tab/semicolon separated)"
        />
      </div>

      {/* STA summary */}
      {renderStaSummary()}
<button className="btn btn-ghost" onClick={() => setShowEditPoints(prev => !prev)}>
  {showEditPoints ? "🔽 Hide Point Edit" : "🔼 Show Point Edit"}
</button>



{/* Show last-merge tolerance summary even after groups reduced to 1 */}
{mergeSummaries && mergeSummaries.length > 0 && (
  <div style={{ marginTop: 12 }}>
    {renderToleranceSummary()}
    {/* also show point-level errors (if any) */}
    {mergeErrors && mergeErrors.length > 0 && (
      <div className="card" style={{ marginTop: 8 }}>
        <h4>⚠ Points exceeding {(TOL*1000).toFixed(0)} mm (last merge)</h4>
        <ul>
          {mergeErrors.map((e, i) => (
            <li key={i}>
              {e.name}: {e.dmm.toFixed(1)} mm (ΔE={e.dE.toFixed(3)}, ΔN={e.dN.toFixed(3)}, ΔH={e.dH.toFixed(3)})
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* show pairwise diagnostics (if any) */}
    {mergePairErrors && mergePairErrors.length > 0 && (
      <div className="tablewrap" style={{ marginTop: 8 }}>
        <h4>Pairwise Δ from first-common (last merge)*Memories# Double Showing List</h4>
        <table>
          <thead>
            <tr><th>Ref</th><th>To</th><th>dA (m)</th><th>dB (m)</th><th>|Δ| (mm)</th></tr>
          </thead>
          <tbody>
            {mergePairErrors.map((r, i) => (
              <tr key={i} className={r.dd_mm > (TOL*1000) ? "err" : ""}>
                <td>{r.fromRef}</td>
                <td>{r.toName}</td>
                <td>{r.dA.toFixed(4)}</td>
                <td>{r.dB.toFixed(4)}</td>
                <td>{r.dd_mm.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
{ /* Show height differences box */ }
<MergeHeightBox />
  </div>
)}

      {/* Edit / Remove points */}
{showEditPoints && staSortedEntries.length > 0 && (
  <div className="card">
    <h3>✏️ Edit / Remove points</h3>
    {staSortedEntries.map(([sta, pts]) => (
      <div key={sta} className="sta-card">
        <div className="row space-between" style={{ alignItems: "center" }}>
          <div className="row" style={{ gap: 8 }}>
            <h4 style={{ margin: 0 }}>{sta}</h4>
            <input
              className="input"
              style={{ width: 160 }}
              placeholder="Rename STA..."
              onKeyDown={(e) => {
                if (e.key === "Enter") renameSta(sta, e.currentTarget.value);
              }}
            />
            <button
              className="btn btn-ghost"
              onClick={(e) => {
                const box = e.currentTarget.previousSibling;
                const val = box && box.value ? box.value : "";
                renameSta(sta, val);
              }}
            >
              ✏️ Rename
            </button>
          </div>
        </div>

        <div>
          {pts.map((p, idx) => {
            const checked = (keepMap[sta]?.[p.name] ?? true) !== false;
            return (
              <div key={idx} className="ptrow">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKeep(sta, p.name)}
                  />
                  <span />
                </label>

                <input
                  className="input"
                  placeholder="Point name"
                  value={p.name}
                  onChange={(e) => updatePointName(sta, idx, e.target.value)}
                />

                <input className="input" value={p.E} readOnly />
                <input className="input" value={p.N} readOnly />
                <input className="input" value={p.H} readOnly />
              </div>
            );
          })}
        </div>
      </div>
    ))}

    <div className="row end" style={{ marginTop: 8 }}>
      <button className="btn" onClick={applyFilter}>
        ✔ Apply Remove (unchecked)
      </button>
    </div>
  </div>
)}

      {/* Merge */}
      {staNames.length > 1 && (
        <div className="card">
          <h3>🧩 Merge two STA groups (Best-fit)</h3>
          <div className="row" style={{ gap: 8 }}>
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)} className="input">
              <option value="">-- Base (keep) --</option>
              {staNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={toSta} onChange={(e) => setToSta(e.target.value)} className="input">
              <option value="">-- Merge Into Base --</option>
              {staNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <button className="btn" onClick={handleMerge}>🔄 Merge</button>
            <button className="btn btn-ghost" onClick={exportMerged}>💾 Export Merged ENH</button>
          </div>

          {renderToleranceSummary()}

          {/* Pairwise diff table */}
          {mergePairErrors.length > 0 && (
            <div className="tablewrap" style={{ marginTop: 12 }}>
              <h4>⚠ Pairwise Δ from first-common (A vs B) — |Δ| (mm)</h4>
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>To</th>
                    <th>dA (m)</th>
                    <th>dB (m)</th>
                    <th>|Δ| (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {mergePairErrors.map((r, i) => (
                    <tr key={i} className={r.dd_mm > (TOL * 1000) ? "err" : ""}>
                      <td>{r.fromRef}</td>
                      <td>{r.toName}</td>
                      <td>{r.dA.toFixed(4)}</td>
                      <td>{r.dB.toFixed(4)}</td>
                      <td>{r.dd_mm.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
{ /* Show height differences box */ }
<MergeHeightBox />
            </div>
          )}

          {/* point-level error list */}
          {mergeErrors.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4>⚠ Points exceeding { (TOL*1000).toFixed(0) } mm</h4>
              <ul>
                {mergeErrors.map((e, i) => (
                  <li key={i}>
                    {e.name}: {e.dmm.toFixed(1)} mm (ΔE={e.dE.toFixed(3)}, ΔN={e.dN.toFixed(3)}, ΔH={e.dH.toFixed(3)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Working set preview */}
      {getWorkingSet().length > 0 && (
        <div className="card">
          <h3>✅ Working Set ({getWorkingSet().length} pts)</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Pt</th>
                  <th>E</th>
                  <th>N</th>
                  <th>H</th>
                </tr>
              </thead>
              <tbody>
                {getWorkingSet().map((p, i) => (
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
        </div>
      )}

      {/* Reference line */}
      {getWorkingSet().length > 0 && (
        <div className="card">
          <h3>📏 Reference line on Working Set</h3>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="Point A (start)" value={refA} onChange={(e) => setRefA(e.target.value)} list="ptnames" />
            <input className="input" placeholder="Point B (direction)" value={refB} onChange={(e) => setRefB(e.target.value)} list="ptnames" />
            <datalist id="ptnames">{getWorkingSet().map((p) => <option key={p.name} value={p.name} />)}</datalist>

            <button className="btn" onClick={applyRefLine}>▶ Apply Reference Line</button>
            <button className="btn btn-ghost" onClick={exportTransformed}>📄 Final Export TXT</button>
          </div>
        </div>
      )}

      {/* Transformed preview */}
      {transformed.length > 0 && (
        <div className="card">
          <h3>🔄 Transformed Result (Ref Line)</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Pt</th>
                  <th>E (across)</th>
                  <th>N (along)</th>
                  <th>H (A=0)</th>
                </tr>
              </thead>
              <tbody>
                {transformed.map((p, i) => (
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

          <div className="row end" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={exportTransformed}>📄 Final Export TXT</button>
          </div>
        </div>
      )}

      <footer className="footer">© 2025 WMK Seatrium DC Team</footer>
    </div>
  );
}