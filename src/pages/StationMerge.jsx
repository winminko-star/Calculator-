// ===== StationMerge.jsx — PART 1/3 =====
import React, { useState, useMemo } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  // raw text + info
  const [rawText, setRawText] = useState("");
  const [info, setInfo] = useState("");

  // groups: { "STA.1_1": [ {name,E,N,H}, ... ], ... }
  const [groups, setGroups] = useState({});
  // keep map for remove points: { staKey: { ptName: true/false } }
  const [keepMap, setKeepMap] = useState({});

  // merged working set
  const [merged, setMerged] = useState([]);

  // merge selection
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");

  // tolerance summary + error list
  const [mergeSummaries, setMergeSummaries] = useState([]);
  const [mergeErrors, setMergeErrors] = useState([]);

  // reference line
  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
  const [transformed, setTransformed] = useState([]);

  // ---------- helpers ----------
  const norm = (s) =>
    (s ?? "").toString().trim().replace(/\s+/g, "").toUpperCase();

  const staSortedEntries = useMemo(() => {
    const entries = Object.entries(groups);
    entries.sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" })
    );
    return entries;
  }, [groups]);

  const staNames = useMemo(
    () => staSortedEntries.map(([k]) => k),
    [staSortedEntries]
  );

  const getWorkingSet = () => {
    if (merged.length) return merged;
    const names = Object.keys(groups);
    if (names.length === 1) {
      return groups[names[0]] || [];
    }
    return [];
  };

  // ---------- parse text to groups (STA header အလိုလို 1,2 ခွဲ) ----------
  const parseTextToGroups = (text) => {
    const lines = text.split(/\r?\n/);
    const out = {};
    const keepInit = {};
    const staCount = {}; // base STA name -> index count
    let currentKey = null;
    let currentBase = null;

    const pushPoint = (key, pt) => {
      if (!out[key]) out[key] = [];
      out[key].push(pt);
      if (!keepInit[key]) keepInit[key] = {};
      keepInit[key][pt.name] = true;
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const parts = line.split(/[,;\t]+/);
      if (parts.length < 4) continue;

      const name = parts[0].trim();
      const E = parseFloat(parts[1]);
      const N = parseFloat(parts[2]);
      const H = parseFloat(parts[3]);
      if (!Number.isFinite(E) || !Number.isFinite(N) || !Number.isFinite(H))
        continue;

      // STA header
      if (/^STA/i.test(name)) {
        currentBase = name;
        const cnt = (staCount[currentBase] || 0) + 1;
        staCount[currentBase] = cnt;
        currentKey = `${currentBase}_${cnt}`;
        pushPoint(currentKey, { name, E, N, H });
      } else if (currentKey) {
        // normal point row under current STA
        pushPoint(currentKey, { name, E, N, H });
      }
    }

    setGroups(out);
    setKeepMap(keepInit);
    setMerged([]);
    setFromSta("");
    setToSta("");
    setMergeSummaries([]);
    setMergeErrors([]);
    setRefA("");
    setRefB("");
    setTransformed([]);
    setInfo(
      Object.keys(out).length
        ? `✅ Parsed ${Object.keys(out).length} STA group(s).`
        : "⚠️ No STA.* header found."
    );
  };

  // file upload
  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      setRawText(txt);
      parseTextToGroups(txt);
      setInfo(`✅ Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };
  // ===== StationMerge.jsx — PART 2/3 =====
// (ဤကို PART 1 အောက်နောက်ဆက်ရေး)

  // ---------- STA summary ----------
  const renderStaSummary = () => {
    if (!staSortedEntries.length) return null;
    return (
      <div className="card">
        <h3>📊 STA groups</h3>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>STA Group</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {staSortedEntries.map(([sta, pts]) => (
                <tr key={sta}>
                  <td>{sta}</td>
                  <td>{pts.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---------- STA rename ----------
  const renameSta = (oldKey, newNameRaw) => {
    const v = (newNameRaw || "").trim();
    if (!v || v === oldKey) return;

    setGroups((prev) => {
      if (!prev[oldKey]) return prev;
      const next = { ...prev };
      next[v] = next[oldKey];
      delete next[oldKey];
      return next;
    });

    setKeepMap((prev) => {
      if (!prev[oldKey]) return prev;
      const next = { ...prev };
      next[v] = next[oldKey];
      delete next[oldKey];
      return next;
    });

    setFromSta((cur) => (cur === oldKey ? v : cur));
    setToSta((cur) => (cur === oldKey ? v : cur));
  };

  // ---------- point name update ----------
  const updatePointName = (staKey, idx, newName) => {
    setGroups((prev) => {
      const grp = prev[staKey];
      if (!grp) return prev;
      const nextGrp = grp.map((p, i) =>
        i === idx ? { ...p, name: newName } : p
      );
      return { ...prev, [staKey]: nextGrp };
    });
  };

  // ---------- toggle keep / remove ----------
  const toggleKeep = (staKey, ptName) => {
    setKeepMap((prev) => {
      const prevSta = prev[staKey] || {};
      const cur = prevSta[ptName];
      const nextSta = { ...prevSta, [ptName]: cur === false ? true : false };
      return { ...prev, [staKey]: nextSta };
    });
  };

  // ---------- apply remove ----------
  const applyFilter = () => {
    setGroups((prevGroups) => {
      const next = {};
      for (const [sta, pts] of Object.entries(prevGroups)) {
        const keepSta = keepMap[sta] || {};
        const newPts = pts.filter(
          (p) => (keepSta[p.name] ?? true) !== false
        );
        if (newPts.length) next[sta] = newPts;
      }
      return next;
    });
    setMerged([]);
    setInfo("✅ Removed unchecked points.");
  };

  // ---------- merge tolerance summary ----------
  const renderToleranceSummary = () => {
    if (!mergeSummaries.length) return null;
    return (
      <div className="summary">
        <h4>Merge tolerance (3D, limit 3 mm)</h4>
        {mergeSummaries.map((s, i) =>
          s.count > 0 ? (
            <div key={i} className="line bad">
              ⚠ {s.from} + {s.to} → {s.count} pt(s) &gt; 3 mm, max ={" "}
              {s.maxmm.toFixed(1)} mm
            </div>
          ) : (
            <div key={i} className="line ok">
              ✅ {s.from} + {s.to} → within 3 mm (max ={" "}
              {s.maxmm.toFixed(1)} mm)
            </div>
          )
        )}
      </div>
    );
  };

  // ---------- merge two STA groups (ENH မပြောင်း) ----------
  const handleMerge = () => {
    if (!fromSta || !toSta) {
      setInfo("⚠️ Choose two STA groups.");
      return;
    }
    if (fromSta === toSta) {
      setInfo("⚠️ Choose different STA groups.");
      return;
    }

    const A = groups[fromSta];
    const B = groups[toSta];
    if (!A || !B) {
      setInfo("⚠️ Invalid STA groups.");
      return;
    }

    const Amap = new Map(A.map((p) => [norm(p.name), p]));
    const Bmap = new Map(B.map((p) => [norm(p.name), p]));
    const common = [...Amap.keys()].filter((k) => Bmap.has(k));

    // common point မရှိရင် စပ်ပေးရုံ
    if (common.length === 0) {
      const mergedArr = [...A, ...B];
      const ng = { ...groups };
      delete ng[toSta];
      ng[fromSta] = mergedArr;
      setGroups(ng);
      setMerged(mergedArr);
      setMergeSummaries([]);
      setMergeErrors([]);
      setInfo(`✅ ${fromSta} + ${toSta} merged (no common points, ENH unchanged)`);
      return;
    }

    // 3D tolerance check on common points (mm)
    const TOL_MM = 3;
    let exceedCount = 0;
    let maxmm = 0;
    const errList = [];

    for (const key of common) {
      const a = Amap.get(key);
      const b = Bmap.get(key);
      if (!a || !b) continue;

      const dE = b.E - a.E;
      const dN = b.N - a.N;
      const dH = b.H - a.H;
      const d = Math.sqrt(dE * dE + dN * dN + dH * dH);
      const dmm = d * 1000;

      if (dmm > TOL_MM) {
        exceedCount++;
        if (dmm > maxmm) maxmm = dmm;
        errList.push({ name: a.name, dE, dN, dH, dmm });
      } else if (dmm > maxmm) {
        maxmm = dmm;
      }
    }

    setMergeSummaries([
      { from: fromSta, to: toSta, count: exceedCount, maxmm }
    ]);
    setMergeErrors(errList);

    // merged: A + B non-duplicate (A ကို priority)
    const mergedArr = [
      ...A,
      ...B.filter((p) => !Amap.has(norm(p.name)))
    ];

    const ng = { ...groups };
    delete ng[toSta];
    ng[fromSta] = mergedArr;
    setGroups(ng);
    setMerged(mergedArr);

    setInfo(
      exceedCount
        ? `⚠️ Merged ${fromSta} + ${toSta}. ${exceedCount} common pt(s) > 3 mm.`
        : `✅ Merged ${fromSta} + ${toSta}. All common pts within 3 mm (max = ${maxmm.toFixed(
            1
          )} mm).`
    );
  };

  // ---------- export helpers ----------
  const downloadTxt = (txt, filename) => {
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMerged = () => {
    const data = getWorkingSet();
    if (!data.length) {
      alert("No working set to export.");
      return;
    }
    const txt = data
      .map(
        (p) =>
          `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
      )
      .join("\n");
    downloadTxt(txt, "StationMerge_ENH.txt");
  };

  const exportTransformed = () => {
    const data = transformed.length ? transformed : getWorkingSet();
    if (!data.length) {
      alert("No transformed / working set to export.");
      return;
    }
    const txt = data
      .map(
        (p) =>
          `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
      )
      .join("\n");
    downloadTxt(txt, "StationMerge_RefLine.txt");
  };

  // ---------- Reference line (N = along, E = left-/right+) ----------
  const applyRefLine = () => {
    const data = getWorkingSet();
    if (!data.length) {
      setInfo("⚠️ No working set. Upload / Merge first.");
      return;
    }

    const a = data.find((p) => norm(p.name) === norm(refA));
    const b = data.find((p) => norm(p.name) === norm(refB));

    if (!a || !b) {
      setInfo("⚠️ Point A / B not found in working set.");
      return;
    }
    if (norm(refA) === norm(refB)) {
      setInfo("⚠️ A and B must be different.");
      return;
    }

    const dx = b.E - a.E;
    const dy = b.N - a.N;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 1e-6) {
      setInfo("⚠️ Reference points are too close.");
      return;
    }

    const ux = dx / len;
    const uy = dy / len;

    const refPts = data.map((p) => {
      const vx = p.E - a.E;
      const vy = p.N - a.N;

      // along A→B (N axis), across right-hand (E axis)
      const along = vx * ux + vy * uy;        // N
      const across = vx * uy - vy * ux;       // E (left -, right +)

      return {
        ...p,
        E: across,
        N: along,
        H: p.H - a.H // A point H = 0
      };
    });

    setTransformed(refPts);
    setInfo(
      `✅ Reference line applied: ${refA}→${refB} (N along line, E left-/right+, H(A)=0).`
    );
  };
  // ===== StationMerge.jsx — PART 3/3 =====
// (ဤကို PART 2 အောက်နောက်ဆက်ရေး)

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

      {/* 3) Edit / Remove points + Rename STA */}
      {staSortedEntries.length > 0 && (
        <div className="card">
          <h3>✏️ Edit / Remove points</h3>
          {staSortedEntries.map(([sta, pts]) => (
            <div key={sta} className="sta-card">
              <div className="row space-between">
                <div className="row" style={{ gap: 8 }}>
                  <h4 style={{ margin: 0 }}>{sta}</h4>
                  <>
                    <input
                      className="input"
                      style={{ width: 160 }}
                      placeholder="Rename STA..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renameSta(sta, e.currentTarget.value);
                        }
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
                </div>
              </div>

              <div>
                {pts.map((p, idx) => {
                  const checked =
                    (keepMap[sta]?.[p.name] ?? true) !== false;
                  return (
                    <div key={`${p.name}-${idx}`} className="ptrow">
                      {/* keep / remove */}
                      <label className="chk">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKeep(sta, p.name)}
                        />
                        <span />
                      </label>

                      {/* Name (editable) */}
                      <input
                        className="input"
                        placeholder="Point name"
                        value={p.name}
                        onChange={(e) =>
                          updatePointName(sta, idx, e.target.value)
                        }
                      />

                      {/* ENH – show only, not editable */}
                      <input className="input" value={p.E} readOnly />
                      <input className="input" value={p.N} readOnly />
                      <input className="input" value={p.H} readOnly />
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
              <option value="">-- Merge into Base --</option>
              {staNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <button className="btn" onClick={handleMerge}>
              🔄 Merge
            </button>
            <button
              className="btn btn-ghost"
              onClick={exportMerged}
            >
              💾 Export Merged ENH
            </button>
          </div>

          {renderToleranceSummary()}

          {/* 3 mm ထက် ကျော်တဲ့ common points list */}
          {mergeErrors.length > 0 && (
            <div className="tablewrap" style={{ marginTop: 12 }}>
              <h4>⚠ Common points &gt; 3 mm (last merge)</h4>
              <table>
                <thead>
                  <tr>
                    <th>Pt</th>
                    <th>ΔE (m)</th>
                    <th>ΔN (m)</th>
                    <th>ΔH (m)</th>
                    <th>Δ (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {mergeErrors.map((p, i) => (
                    <tr key={i}>
                      <td>{p.name}</td>
                      <td>{p.dE.toFixed(4)}</td>
                      <td>{p.dN.toFixed(4)}</td>
                      <td>{p.dH.toFixed(4)}</td>
                      <td>{p.dmm.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5) Working set preview */}
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

      {/* 7) Transformed preview */}
      {transformed.length > 0 && (
        <div className="card">
          <h3>🔄 Transformed Result (Ref Line)</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Pt</th>
                  <th>E (left-/right+)</th>
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
