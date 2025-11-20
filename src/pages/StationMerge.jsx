// ===== StationMerge.jsx — PART 1/3 =====
import React, { useState } from "react";
import "./StationMerge.css"; // CSS ရှိသလိုသုံး

// 2D best-fit similarity (scale + rotation + shift)
function fitSimilarity2D(basePts, movePts) {
  // basePts = destination (A), movePts = source (B)
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
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({}); // {STA => [{name,E,N,H}]}
  const [keepMap, setKeepMap] = useState({}); // {STA => {ptName:false}}  => false = remove
  const [info, setInfo] = useState("");
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [mergeSummaries, setMergeSummaries] = useState([]); // [{group,count,maxmm}]
  const [merged, setMerged] = useState([]); // merged points
  const [editLocked, setEditLocked] = useState(false); // merge ပြီးရင် lock
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
  const [transformed, setTransformed] = useState([]);

  // ===== 1) parse upload =====
  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      setRawText(txt);
      parseTextToGroups(txt);
    };
    reader.readAsText(f);
  };

  const parseTextToGroups = (txt) => {
    const lines = txt.split(/\r?\n/);
    const next = {};
    const used = {}; // baseName -> count
    let currentSta = null;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[,\t;]+/).map((s) => s.trim());
      if (!parts[0]) continue;

      // header line – STA.* ကို group ခေါင်းစဉ်အဖြစ်ယူ
      if (/^STA/i.test(parts[0])) {
        const base = parts[0];
        const count = (used[base] || 0) + 1;
        used[base] = count;
        const name = count === 1 ? base : `${base}_${count}`;
        currentSta = name;
        if (!next[name]) next[name] = [];
        continue;
      }

      // point row
      if (!currentSta) continue;
      const [pname, eStr, nStr, hStr] = parts;
      const E = parseFloat(eStr);
      const N = parseFloat(nStr);
      const H = parseFloat(hStr);
      if (!pname || !Number.isFinite(E) || !Number.isFinite(N) || !Number.isFinite(H))
        continue;
      next[currentSta].push({ name: pname, E, N, H });
    }

    setGroups(next);
    setKeepMap({});
    setInfo(`✔ Loaded ${Object.keys(next).length} STA group(s).`);
    setFromSta("");
    setToSta("");
    setMergeSummaries([]);
    setMerged([]);
    setEditLocked(false);
    setRefA("");
    setRefB("");
    setTransformed([]);
  };

  // ===== 2) helpers =====
  const staNames = Object.keys(groups).sort();
  const staSortedEntries = staNames.map((k) => [k, groups[k]]);

  // point keep/remove toggle
  const toggleKeep = (sta, ptName) => {
    setKeepMap((prev) => {
      const g = { ...(prev[sta] || {}) };
      const cur = g[ptName];
      g[ptName] = cur === false ? true : false; // default: true; false => remove
      return { ...prev, [sta]: g };
    });
  };

  // Rename STA group (before merge only)
  const renameSta = (oldName, val) => {
    if (editLocked) {
      setInfo("🔒 After merge, STA names are locked.");
      return;
    }
    const raw = (val || "").trim();
    if (!raw) return;

    let newName = raw;
    if (groups[newName]) {
      let i = 2;
      while (groups[`${newName}_${i}`]) i++;
      newName = `${newName}_${i}`;
    }

    if (newName === oldName) return;

    const ng = { ...groups };
    ng[newName] = ng[oldName];
    delete ng[oldName];

    // keep map / select box update
    const km = { ...keepMap };
    if (km[oldName]) {
      km[newName] = km[oldName];
      delete km[oldName];
    }

    setGroups(ng);
    setKeepMap(km);
    setInfo(`✏️ Renamed ${oldName} → ${newName}`);

    if (fromSta === oldName) setFromSta(newName);
    if (toSta === oldName) setToSta(newName);
  };

  // point name only (ENH ကို မပြောင်း)
  const updatePointName = (sta, idx, value) => {
    if (editLocked) {
      setInfo("🔒 After merge, point names are locked.");
      return;
    }
    setGroups((prev) => {
      const copy = { ...prev };
      const arr = [...(copy[sta] || [])];
      arr[idx] = { ...arr[idx], name: value };
      copy[sta] = arr;
      return copy;
    });
  };

  // Apply Remove unwanted points (checkbox လက်ရှိအတိုင်း)
  const applyFilter = () => {
    const ng = {};
    for (const sta of Object.keys(groups)) {
      const pts = groups[sta];
      const keepCfg = keepMap[sta] || {};
      const filtered = pts.filter((p) => keepCfg[p.name] !== false);
      if (filtered.length > 0) ng[sta] = filtered;
    }
    setGroups(ng);
    setInfo("🧹 Removed unwanted points.");
    setMerged([]);
    setTransformed([]);
  };

  // ===== 3) Merge two STAs (3 mm tolerance) =====
  const handleMerge = () => {
    if (!fromSta || !toSta) {
      setInfo("⚠️ Choose two STAs first.");
      return;
    }
    if (fromSta === toSta) {
      setInfo("⚠️ Choose different STAs.");
      return;
    }
    const A = groups[fromSta];
    const B = groups[toSta];
    if (!A || !B) {
      setInfo("⚠️ Invalid STA names.");
      return;
    }

    // build maps and common names
    const Amap = new Map(A.map((p) => [p.name, p]));
    const Bmap = new Map(B.map((p) => [p.name, p]));
    const common = [...Amap.keys()].filter((k) => Bmap.has(k));

    // no common → just join (no transform)
    if (common.length === 0) {
      const mergedArr = [...A, ...B];
      const ng = { ...groups };
      delete ng[toSta];
      ng[fromSta] = mergedArr;
      setGroups(ng);
      setMerged(mergedArr);
      setMergeSummaries((prev) => prev.filter((s) => s.group !== toSta));
      setEditLocked(true);
      setInfo(`✅ ${fromSta} merged with ${toSta} (no common pts).`);
      return;
    }

    // need at least 2 common points
    if (common.length < 2) {
      setInfo("⚠️ Need ≥2 common points for best-fit.");
      return;
    }

    // best-fit EN, mean H shift
    const baseEN = common.map((n) => [Amap.get(n).E, Amap.get(n).N]);
    const movEN = common.map((n) => [Bmap.get(n).E, Bmap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(baseEN, movEN);

    let dHsum = 0;
    for (const n of common) {
      dHsum += Amap.get(n).H - Bmap.get(n).H;
    }
    const dHavg = dHsum / common.length;

    const transformB = (p) => ({
      name: p.name,
      E: scale * (cos * p.E - sin * p.N) + tx,
      N: scale * (sin * p.E + cos * p.N) + ty,
      H: p.H + dHavg,
    });

    // tolerance summary (3 mm)
    const TOL = 0.003;
    let exceedCount = 0;
    let maxmm = 0;
    for (const n of common) {
      const a = Amap.get(n);
      const bt = transformB(Bmap.get(n));
      const dE = bt.E - a.E;
      const dN = bt.N - a.N;
      const dH = bt.H - a.H;
      const d = Math.sqrt(dE * dE + dN * dN + dH * dH); // m
      if (d > TOL) exceedCount++;
      if (d > maxmm) maxmm = d;
    }

    const nonDup = B.filter((p) => !Amap.has(p.name)).map(transformB);
    const mergedArr = [...A, ...nonDup];

    const ng = { ...groups };
    delete ng[toSta];
    ng[fromSta] = mergedArr;

    setGroups(ng);
    setMerged(mergedArr);
    setEditLocked(true);
    setTransformed([]);

    setMergeSummaries((prev) => {
      const others = prev.filter((s) => s.group !== toSta);
      return [
        ...others,
        {
          group: toSta,
          count: exceedCount,
          maxmm,
        },
      ];
    });

    setInfo(
      `✅ Best-fit merged ${toSta} → ${fromSta} (refs=${common.length})`
    );
  };

  // Export merged ENH (before reference line)
  const exportMerged = () => {
    const ws =
      merged.length > 0
        ? merged
        : staNames.length === 1
        ? groups[staNames[0]]
        : [];
    if (!ws || ws.length === 0) {
      setInfo("⚠️ No working set to export.");
      return;
    }
    const lines = ws.map(
      (p) =>
        `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`
    );
    downloadTextFile("StationMerge_merged.txt", lines.join("\n"));
  };
  // ===== StationMerge.jsx — PART 2/3 =====
// (ဒီကို Part 1 အောက်နောက်ဆက်ရေး)

  // working set helper
  const getWorkingSet = () => {
    if (merged.length > 0) return merged;
    if (staNames.length === 1) return groups[staNames[0]];
    return [];
  };

  const applyRefLine = () => {
  const pts = getWorkingSet();
  if (!refA || !refB) {
    setInfo("⚠️ Enter reference points A and B");
    return;
  }

  const A = pts.find(p => p.name === refA);
  const B = pts.find(p => p.name === refB);

  if (!A || !B) {
    setInfo("⚠️ Invalid reference point names");
    return;
  }

  // vector from A → B
  const dx = B.E - A.E;
  const dy = B.N - A.N;

  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 1e-6) {
    setInfo("⚠️ Reference points are too close.");
    return;
  }

  // unit direction
  const ux = dx / len;   // along (N direction)
  const uy = dy / len;

  const result = pts.map(p => {
    const vx = p.E - A.E;
    const vy = p.N - A.N;

    // projection
    const along  = vx * ux + vy * uy;       // N-axis (forward)
    const across = vx * uy - vy * ux;      // E-axis (perpendicular)

    return {
      ...p,
      E: across,           // East = across
      N: along,            // North = along
      H: p.H - A.H         // A point = 0
    };
  });

  setTransformed(result);
  setInfo(`📏 Reference Line Applied (A=${refA}, B=${refB})`);
};

  // export final (after reference line)
  const exportTransformed = () => {
    const arr = transformed.length > 0 ? transformed : getWorkingSet();
    if (!arr || arr.length === 0) {
      setInfo("⚠️ Nothing to export. Apply Reference Line first.");
      return;
    }
    const lines = arr.map(
      (p) =>
        `${p.name},${p.E.toFixed(4)},${p.N.toFixed(4)},${p.H.toFixed(4)}`
    );
    downloadTextFile("StationMerge_final_refline.txt", lines.join("\n"));
  };

  // small components for reuse
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
    if (mergeSummaries.length === 0) return null;
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
            <div key={i} className="line ok">
              ✅ {s.group} → within tolerance
            </div>
          )
        )}
      </div>
    );
  };
  // ===== StationMerge.jsx — PART 3/3 =====
// (ဒီကို Part 2 အောက်နောက်ဆက်ရေး)

  return (
    <div className="page station-merge">
      <h2>📐 StationMerge – WMK / Seatrium DC</h2>

      {info && <div className="info">{info}</div>}

      {/* 1) Upload / paste */}
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
          placeholder="Paste STA.* , Point, E, N, H …"
        />
      </div>

      {/* 2) STA summary */}
      {renderStaSummary()}

      {/* 3) Edit / Remove unwanted points + Rename STA */}
      {staSortedEntries.length > 0 && (
        <div className="card">
          <h3>✏️ Edit / Remove points</h3>
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
                          if (e.key === "Enter")
                            renameSta(sta, e.currentTarget.value);
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
              </div>

              <div>
                {pts.map((p, idx) => {
                  const checked =
                    (keepMap[sta]?.[p.name] ?? true) !== false;
                  return (
                    <div
                      key={idx}
                      className="ptrow"
                    >
                      {/* keep / remove */}
                      <label className="chk">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleKeep(sta, p.name)
                          }
                        />
                        <span />
                      </label>

                      {/* Name (only this one can change) */}
                      <input
                        className="input"
                        placeholder="Point name"
                        value={p.name}
                        onChange={(e) =>
                          updatePointName(
                            sta,
                            idx,
                            e.target.value
                          )
                        }
                      />

                      {/* ENH – show only, not editable */}
                      <input
                        className="input"
                        value={p.E}
                        readOnly
                      />
                      <input
                        className="input"
                        value={p.N}
                        readOnly
                      />
                      <input
                        className="input"
                        value={p.H}
                        readOnly
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="row end">
            <button className="btn" onClick={applyFilter}>
              ✔ Apply Remove (un-checked pts)
            </button>
          </div>
        </div>
      )}

      {/* 4) Merge two STA groups */}
      {staNames.length > 1 && (
        <div className="card">
          <h3>🧩 Merge two STA groups</h3>
          <div className="row">
            <select
              value={fromSta}
              onChange={(e) => setFromSta(e.target.value)}
              className="input"
            >
              <option value="">-- Base (keep) --</option>
              {staNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select
              value={toSta}
              onChange={(e) => setToSta(e.target.value)}
              className="input"
            >
              <option value="">-- Merge Into Base --</option>
              {staNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <button className="btn" onClick={handleMerge}>
              🔄 Merge
            </button>
            <button className="btn btn-ghost" onClick={exportMerged}>
              💾 Export Merged ENH
            </button>
          </div>

          {renderToleranceSummary()}
        </div>
      )}

      {/* 5) Working set preview */}
      {getWorkingSet().length > 0 && (
        <div className="card">
          <h3>
            ✅ Working Set ({getWorkingSet().length} pts)
          </h3>
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

      {/* 6) Reference line + final export */}
      {getWorkingSet().length > 0 && (
        <div className="card">
          <h3>📏 Reference line on Working Set</h3>
          <div className="row">
            <input
              className="input"
              placeholder="Point A (start)"
              value={refA}
              onChange={(e) => setRefA(e.target.value)}
              list="ptnames"
            />
            <input
              className="input"
              placeholder="Point B (direction)"
              value={refB}
              onChange={(e) => setRefB(e.target.value)}
              list="ptnames"
            />
            <datalist id="ptnames">
              {getWorkingSet().map((p) => (
                <option key={p.name} value={p.name} />
              ))}
            </datalist>

            <button className="btn" onClick={applyRefLine}>
              ▶ Apply Reference Line
            </button>
            <button
              className="btn btn-ghost"
              onClick={exportTransformed}
            >
              📄 Final Export TXT
            </button>
          </div>
        </div>
      )}

      {/* 7) transformed preview */}
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
                    <td>{p.E.toFixed(3)}</td>
                    <td>{p.N.toFixed(3)}</td>
                    <td>{p.H.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row end">
            <button
              className="btn btn-ghost"
              onClick={exportTransformed}
            >
              📄 Final Export TXT
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
      }
