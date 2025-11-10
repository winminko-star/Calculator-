// src/pages/StationMerge.jsx
// 💡 SEATRIUM
// Reference Line only (4-point UI/logic removed), supports single-group files (no merge needed).
import React, { useMemo, useState, useEffect } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  // -------------------- States --------------------
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});                 // {STA1:[{name,E,N,H},...], ...}
  const [info, setInfo] = useState("");

  // Filter (unwanted points)
  const [filterOpen, setFilterOpen] = useState(false);
  const [keepMap, setKeepMap] = useState({});               // {STA:{ptName:true/false}}
  // Edit lock: first merge ဖြစ်သွားရင် Edit မဖြစ်အောင်
  const [editLocked, setEditLocked] = useState(false);

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

      setEditLocked(false); // 👉 upload အသစ်တိုင်း edit ပြန်ဖွင့်

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

  // return a unique STA key like "STA1", "STA1_2", ...
  const uniqueStaKey = (base, obj) => {
    let key = (base || "").replace(/\s+/g, "");
    if (!obj[key]) return key;
    let i = 2;
    while (obj[`${key}_${i}`]) i++;
    return `${key}_${i}`;
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

      // accept "STA1" or "STA.1"
      const m = /^STA\.?\d+/i.exec(name);
      if (m) {
        // normalize header label (remove dot/spaces) then auto-unique
        const base = name.replace(/\./g, "").replace(/\s+/g, "");
        const key = uniqueStaKey(base, out);
        current = key;
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

  // Single group + not joined yet ⇒ groups → merged auto-sync
  useEffect(() => {
    if (editLocked) return;                  // once joined, don't touch merged
    const ks = Object.keys(groups);
    if (ks.length === 1) setMerged(groups[ks[0]]);
  }, [groups, editLocked]);

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

      const cleaned = pts
        .filter((p) => km[p.name] !== false)
        .map((p) => ({ ...p, name: (p.name ?? "").toString().trim() }));

      next[sta] = makeUniquePoints(cleaned);
    }
    setGroups(next);
    setFilterOpen(false);
    setInfo("✅ Filter applied (trimmed & de-duplicated point names).");
  };

  // ---- Update a single point field (name/E/N/H) in-place ----
  const updatePointField = (sta, idx, key, val) => {
    setGroups((prev) => {
      const list = prev[sta];
      if (!list) return prev;

      const next = [...list];
      const p = { ...next[idx] };

      if (key === "name") {
        // point name: keep raw string; trim later on Apply Filter/merge if you like
        p.name = (val ?? "").toString();
      } else {
        // numeric fields: only commit when it's a valid number
        const num = Number(val);
        if (!Number.isFinite(num)) return prev; // ignore invalid typing
        p[key] = num;
      }

      next[idx] = p;
      return { ...prev, [sta]: next };
    });
  };

  // -------------------- Helpers --------------------
  // make point names unique inside one STA: A, A_2, A_3...
  const makeUniquePoints = (pts) => {
    const used = new Map(); // key = uppercased name
    return pts.map((p) => {
      let base = (p.name ?? "").toString().trim();
      if (!base) base = "PT";
      let key = base.toUpperCase();
      let i = (used.get(key) || 0) + 1;
      used.set(key, i);
      const name = i === 1 ? base : `${base}_${i}`;
      return { ...p, name };
    });
  };

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

  // STA rename (key change). Merged/locked ဖြစ်ရင် မပြောင်းနိုင်။
  const renameSta = (oldKey, newLabel) => {
    if (editLocked) return;
    const base = (newLabel ?? "").toString().trim().replace(/\s+/g, "");
    if (!base) return;

    // allow same name if unchanged; else make unique
    let candidate = base;
    if (candidate !== oldKey && groups[candidate]) {
      let i = 2;
      while (groups[`${candidate}_${i}`]) i++;
      candidate = `${candidate}_${i}`;
    }

    setGroups((prev) => {
      if (!prev[oldKey]) return prev;
      const copy = { ...prev };
      copy[candidate] = copy[oldKey];
      delete copy[oldKey];
      return copy;
    });

    // keep selections in sync
    setFromSta((v) => (v === oldKey ? candidate : v));
    setToSta((v) => (v === oldKey ? candidate : v));

    setInfo(`✏️ Renamed ${oldKey} → ${candidate}`);
  };

  // ✅ Replace your current handleMerge with this best-fit version
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STAs first");
    if (fromSta === toSta)  return setInfo("⚠️ Choose different STAs");
    const A = groups[fromSta], B = groups[toSta];
    if (!A || !B) return setInfo("⚠️ Invalid STA names");

    // maps & common names
    const Amap = new Map(A.map(p => [p.name, p]));
    const Bmap = new Map(B.map(p => [p.name, p]));
    const common = [...Amap.keys()].filter(k => Bmap.has(k));

    // if no common, just concatenate (no transform)
    if (common.length === 0) {
      const mergedArr = [...A, ...B];
      const ng = { ...groups }; delete ng[toSta]; ng[fromSta] = mergedArr;
      setGroups(ng); setMerged(mergedArr);
      setMergeSummaries(prev => prev.filter(s => s.group !== toSta));
      setGeomDiff([]); setGeomShow(false);
      setTransformed([]); setLastMethod("");

      // ✅ lock edits BEFORE returning
      setEditLocked(true);

      return setInfo(`✅ ${fromSta} merged with ${toSta} (no common pts)`);
    }

    // ---- Best-fit (EN) + mean H shift using only common points
    const BaseEN = common.map(n => [Amap.get(n).E, Amap.get(n).N]);
    const MovEN  = common.map(n => [Bmap.get(n).E, Bmap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(BaseEN, MovEN);
    let dHsum = 0; for (const n of common) dHsum += Amap.get(n).H - Bmap.get(n).H;
    const dHavg = dHsum / common.length;

    // helper: transform a B point into A frame
    const tfB = (p) => ({
      name: p.name,
      E: scale * (cos * p.E - sin * p.N) + tx,
      N: scale * (sin * p.E + cos * p.N) + ty,
      H: p.H + dHavg,
    });

    // ---- Tolerance summary on common points (after transform)
    let exceedCount = 0, maxmm = 0;
    for (const n of common) {
      const a = Amap.get(n);
      const bT = tfB(Bmap.get(n));
      const rE = bT.E - a.E, rN = bT.N - a.N, rH = bT.H - a.H;
      const dmm = Math.sqrt(rE * rE + rN * rN + rH * rH);
      if (dmm > TOL) exceedCount++;
      if (dmm > maxmm) maxmm = dmm;
    }
// ---- Build merged: keep A’s values for duplicates; add transformed B non-duplicates
const nonDup = B.filter((p) => !Amap.has(p.name)).map(tfB);
const mergedArr = [...A, ...nonDup];

const ng = { ...groups };
delete ng[toSta];
ng[fromSta] = mergedArr;

setGroups(ng);
setMerged(mergedArr);
setInfo(`✅ Best-fit merged ${toSta} → ${fromSta} (refs=${common.length})`);
setTransformed([]);
setLastMethod("");

// ✅ lock here too (no return just after this line)
setEditLocked(true);

// update tolerance panel (mm shown)
setMergeSummaries((prev) => {
  const others = prev.filter((s) => s.group !== toSta);
  return [...others, { group: toSta, count: exceedCount, maxmm }];
});

// keep geometry-diff viewer (between original A and B)
const A_only = new Map(A.map((p) => [p.name, p]));
const B_only = new Map(B.map((p) => [p.name, p]));
computeGeometryDiff(A_only, B_only);
};

// -------------------- Geometry Difference (1→All) --------------------
function fitSimilarity2D(basePts, movePts) {
  const n = basePts.length;
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
    normM = 0,
    normB = 0;
  for (let i = 0; i < n; i++) {
    const bx = basePts[i][0] - cEx,
      by = basePts[i][1] - cEy;
    const mx = movePts[i][0] - cMx,
      my = movePts[i][1] - cMy;
    Sxx += mx * bx + my * by;
    Sxy += mx * by - my * bx;
    normM += mx * mx + my * my;
    normB += bx * bx + by * by;
  }
  const scale = Math.sqrt(normB / normM);
  const r = Math.hypot(Sxx, Sxy) || 1e-12;
  const cos = Sxx / r,
    sin = Sxy / r;
  const tx = cEx - scale * (cos * cMx - sin * cMy);
  const ty = cEy - scale * (sin * cMx + cos * cMy);
  return { scale, cos, sin, tx, ty };
}

const computeGeometryDiff = (baseMap, nextMap) => {
  const names = [...baseMap.keys()].filter((k) => nextMap.has(k));
  if (names.length < 2) {
    setGeomDiff([]);
    setGeomShow(false);
    return;
  }

  const B = names.map((n) => [baseMap.get(n).E, baseMap.get(n).N]);
  const M = names.map((n) => [nextMap.get(n).E, nextMap.get(n).N]);
  const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);

  let dHsum = 0;
  for (const n of names) dHsum += baseMap.get(n).H - nextMap.get(n).H;
  const dHavg = dHsum / names.length;

  const ref = names[0];
  const rB = baseMap.get(ref),
    rM = nextMap.get(ref);
  const rMx = scale * (cos * rM.E - sin * rM.N) + tx;
  const rMy = scale * (sin * rM.E + cos * rM.N) + ty;
  const rMh = rM.H + dHavg;

  const diffs = [];
  for (let i = 1; i < names.length; i++) {
    const nm = names[i];
    const b = baseMap.get(nm),
      m = nextMap.get(nm);
    const mX = scale * (cos * m.E - sin * m.N) + tx;
    const mY = scale * (sin * m.E + cos * m.N) + ty;
    const mH = m.H + dHavg;

    const dE1 = b.E - rB.E,
      dN1 = b.N - rB.N,
      dH1 = b.H - rB.H;
    const dE2 = mX - rMx,
      dN2 = mY - rMy,
      dH2 = mH - rMh;

    const de = dE1 - dE2,
      dn = dN1 - dN2,
      dh = dH1 - dH2;
    const dmm = Math.sqrt(de * de + dn * dn + dh * dh) * 1000; // mm
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
const norm = (s) =>
  (s ?? "").toString().trim().replace(/\s+/g, "").toUpperCase();

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
  const data = merged.length
    ? merged
    : Object.keys(groups).length === 1
    ? groups[Object.keys(groups)[0]]
    : [];
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

  const dE = B.E - A.E,
    dN = B.N - A.N,
    dH = B.H - A.H;
  const dist = Math.hypot(dE, dN);
  if (dist === 0) return setInfo("⚠️ Reference points are coincident in EN.");

  // rotate so A→(0,0,0) and AB aligns with +N axis
  const phi = Math.atan2(dE, dN);
  const c = Math.cos(phi),
    s = Math.sin(phi);

  const out = data.map((p) => {
    const e0 = p.E - A.E,
      n0 = p.N - A.N,
      h0 = p.H - A.H;
    return { name: p.name, E: c * e0 - s * n0, N: s * e0 + c * n0, H: h0 };
  });

  setTransformed(out);
  setLastMethod("Reference Line");
  setInfo(
    `✅ Reference line applied — A→(0,0,0)  B→(0,${dist.toFixed(3)},${dH.toFixed(
      3
    )})`
  );
};

// -------------------- Export helpers --------------------
const exportMerged = () => {
  const data = merged.length ? merged : getActivePoints();
  if (!data.length) return alert("No merged data.");
  const txt = data
    .map(
      (p) =>
        `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
    )
    .join("\n");
  downloadTxt(txt, "Merged_STA.txt");
};

const exportTransformed = () => {
  const data = transformed.length ? transformed : getActivePoints();
  if (!data.length) return alert("No data to export.");
  const name = transformed.length
    ? `Final_${lastMethod.replace(/\s+/g, "")}.txt`
    : "Merged_STA.txt";
  const txt = data
    .map(
      (p) =>
        `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
    )
    .join("\n");
  downloadTxt(txt, name);
};

const exportGeometryDiff = () => {
  if (!geomDiff.length) return alert("No diff data.");
  const t = geomDiff
    .map(
      (p) =>
        `${p.name}\t${p.de.toFixed(3)}\t${p.dn.toFixed(3)}\t${p.dh.toFixed(
          3
        )}\t${p.dmm.toFixed(1)} mm`
    )
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
    <h1>💡 SEATRIUM</h1>
    <h2>📐 Station Merge & Reference Line</h2>
    <h2>Note# Only for Level Stations. 3D Stations can not use.</h2>

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
          <button
            className="btn btn-ghost"
            onClick={() => setFilterOpen((v) => !v)}
          >
            {filterOpen ? "Hide Filter" : "Show Points"}
          </button>
        </div>
{/* Show / Edit / Remove points */}
{filterOpen && (
  <div className="card">
    {staSortedEntries.map(([sta, pts]) => (
      <div key={sta} className="sta-card">
        <div className="row space-between">
          <div className="row" style={{ gap: 8 }}>
            <h4 style={{ margin: 0 }}>{sta}</h4>

            {!editLocked && (
              <>
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
              </>
            )}
          </div>

          <button
            className="btn btn-danger"
            onClick={() => deleteGroup(sta)}
            disabled={editLocked}
          >
            🗑️ Delete Group
          </button>
        </div>

        <div>
          {pts.map((p, idx) => {
            const checked = keepMap[sta]?.[p.name] !== false;
            return (
              <div key={`${p.name}-${idx}`} className="ptrow">
                {/* keep / remove */}
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKeep(sta, p.name)}
                    disabled={editLocked}
                  />
                  <span />
                </label>

                {/* Name */}
                <input
                  className="input"
                  placeholder="Point name"
                  value={p.name}
                  onChange={(e) => updatePointField(sta, idx, "name", e.target.value)}
                  disabled={editLocked}
                />

                {/* E / N / H */}
                <input
                  className="input"
                  placeholder="E"
                  value={p.E}
                  onChange={(e) => updatePointField(sta, idx, "E", e.target.value)}
                  disabled={editLocked}
                  inputMode="decimal"
                />
                <input
                  className="input"
                  placeholder="N"
                  value={p.N}
                  onChange={(e) => updatePointField(sta, idx, "N", e.target.value)}
                  disabled={editLocked}
                  inputMode="decimal"
                />
                <input
                  className="input"
                  placeholder="H"
                  value={p.H}
                  onChange={(e) => updatePointField(sta, idx, "H", e.target.value)}
                  disabled={editLocked}
                  inputMode="decimal"
                />
              </div>
            );
          })}
        </div>
      </div>
    ))}

    <div className="row end">
      <button className="btn" onClick={applyFilter}>✔ Apply Filter</button>
    </div>
  </div>
)}

{/* Merge section (optional) */}
{Object.keys(groups).length > 1 && (
  <div className="card">
    <h3>🧩 Choose Two STAs to Merge</h3>
    <div className="row">
      <select
        value={fromSta}
        onChange={(e) => setFromSta(e.target.value)}
        className="input"
      >
        <option value="">-- From (Base) --</option>
        {staNames.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <select
        value={toSta}
        onChange={(e) => setToSta(e.target.value)}
        className="input"
      >
        <option value="">-- To (Merge Into Base) --</option>
        {staNames.map((s) => (
          <option key={s}>{s}</option>
        ))}
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
    <h3>
      ✅ Working Set (
      {merged.length || (Object.keys(groups).length === 1 ? groups[Object.keys(groups)[0]].length : 0)}
      {" "}pts)
    </h3>
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
        {mergedNames.map((n) => (
          <option key={n} value={n} />
        ))}
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
        <button className="btn btn-ghost" onClick={exportTransformed}>
          📄 Final Export TXT
        </button>
      </div>
    </div>
  )}

  <footer className="footer">© 2025 WMK Seatrium DC Team</footer>
</div>   {/* ← closes <div className="sta-merge"> */}
);       {/* ← closes return ( */}
}        {/* ← closes function StationMerge */}
