// src/pages/StationMerge.jsx
// 💡 SEATRIUM
// Simple Station Merge – ENH values are NEVER changed.
// - Supports headers like "STA1" or "STA.1"
// - If same header appears many times, auto-renames: STA1, STA1_2, STA1_3 ...

import React, { useMemo, useState, useEffect } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  // -------------------- States --------------------
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({}); // {STA1:[{name,E,N,H},...], ...}
  const [info, setInfo] = useState("");

  // Filter (unwanted points)
  const [filterOpen, setFilterOpen] = useState(false);
  const [keepMap, setKeepMap] = useState({}); // {STA:{ptName:true/false}}

  // Merge
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [merged, setMerged] = useState([]); // last merged (working set when >0)

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
      setFromSta("");
      setToSta("");
      setMerged([]);
    };
    r.readAsText(f);
  };

  // return a unique STA key like "STA1", "STA1_2", ...
  const uniqueStaKey = (base, obj) => {
    let key = base.replace(/\s+/g, "");
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
        const E = +e,
          N = +n,
          H = +h;
        if ([E, N, H].every(Number.isFinite)) {
          out[current].push({ name, E, N, H });
        }
      }
    }
    return out;
  }

  // Single group ⇒ auto use as merged working set
  useEffect(() => {
    const ks = Object.keys(groups);
    if (ks.length === 1) {
      setMerged(groups[ks[0]]);
    }
  }, [groups]);

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
        .map((p) => ({
          ...p,
          name: (p.name ?? "").toString().trim(),
        }));

      next[sta] = makeUniquePoints(cleaned);
    }
    setGroups(next);
    setFilterOpen(false);
    setInfo("✅ Filter applied (trimmed & de-duplicated point names).");
  };

  // Point field update (name/E/N/H) in-place
  const updatePointField = (sta, idx, key, val) => {
    setGroups((prev) => {
      const list = prev[sta];
      if (!list) return prev;

      const next = [...list];
      const p = { ...next[idx] };

      if (key === "name") {
        p.name = (val ?? "").toString();
      } else {
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
    if (toSta === sta) setToSta("");
    setInfo(`🗑️ Removed ${sta}`);
  };

  // STA rename (key change)
  const renameSta = (oldKey, newLabel) => {
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

  // current active working set (for preview/export)
  const getActiveSet = () => {
    if (merged.length) return merged;
    const ks = Object.keys(groups);
    if (ks.length === 1) return groups[ks[0]];
    return [];
  };

  // Simple merge: ENH values are NOT changed, just concatenated
  const handleMerge = () => {
    if (!fromSta || !toSta)
      return setInfo("⚠️ Choose two STAs first");
    if (fromSta === toSta)
      return setInfo("⚠️ Choose different STAs");

    const A = groups[fromSta];
    const B = groups[toSta];
    if (!A || !B) return setInfo("⚠️ Invalid STA names");

    const mergedArr = [...A, ...B]; // no transform
    const ng = { ...groups };
    delete ng[toSta];
    ng[fromSta] = mergedArr;

    setGroups(ng);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta} (ENH unchanged)`);
  };

  const exportMerged = () => {
    const data = getActiveSet();
    if (!data.length) return alert("No merged data.");
    const txt = data
      .map(
        (p) =>
          `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
      )
      .join("\n");
    downloadTxt(txt, "Merged_STA.txt");
  };

  // optional: export each STA as its own block
  const exportAllGroups = () => {
    if (!staNames.length) return alert("No STA groups.");
    const blocks = [];
    for (const name of staNames) {
      blocks.push(`*** ${name} ***`);
      const pts = groups[name] || [];
      for (const p of pts) {
        blocks.push(
          `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
        );
      }
      blocks.push(""); // blank line
    }
    const txt = blocks.join("\n");
    downloadTxt(txt, "All_STAs_WMK.txt");
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
      <h2>📐 Station Merge (Level STA only, ENH unchanged)</h2>
      <h3>STA1 / STA.1 / duplicate headers → auto STA1, STA1_2, STA1_3 …</h3>

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
            <h3>🧹 Remove / Edit Points</h3>
            <button
              className="btn btn-ghost"
              onClick={() => setFilterOpen((v) => !v)}
            >
              {filterOpen ? "Hide Points" : "Show Points"}
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
                    </div>

                    <button
                      className="btn btn-danger"
                      onClick={() => deleteGroup(sta)}
                    >
                      🗑️ Delete Group
                    </button>
                  </div>

                  <div>
                    {pts.map((p, idx) => {
                      const checked = keepMap[sta]?.[p.name] !== false;
                      return (
                        <div
                          key={`${p.name}-${idx}`}
                          className="ptrow"
                        >
                          {/* keep / remove */}
                          <label className="chk">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleKeep(sta, p.name)}
                            />
                            <span />
                          </label>

                          {/* Name */}
                          <input
                            className="input"
                            placeholder="Point name"
                            value={p.name}
                            onChange={(e) =>
                              updatePointField(
                                sta,
                                idx,
                                "name",
                                e.target.value
                              )
                            }
                          />

                          {/* E / N / H */}
                          <input
                            className="input"
                            placeholder="E"
                            value={p.E}
                            onChange={(e) =>
                              updatePointField(
                                sta,
                                idx,
                                "E",
                                e.target.value
                              )
                            }
                            inputMode="decimal"
                          />
                          <input
                            className="input"
                            placeholder="N"
                            value={p.N}
                            onChange={(e) =>
                              updatePointField(
                                sta,
                                idx,
                                "N",
                                e.target.value
                              )
                            }
                            inputMode="decimal"
                          />
                          <input
                            className="input"
                            placeholder="H"
                            value={p.H}
                            onChange={(e) =>
                              updatePointField(
                                sta,
                                idx,
                                "H",
                                e.target.value
                              )
                            }
                            inputMode="decimal"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="row end">
                <button className="btn" onClick={applyFilter}>
                  ✔ Apply Filter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Merge section */}
      {Object.keys(groups).length > 1 && (
        <div className="card">
          <h3>🧩 Choose Two STAs to Merge (no ENH change)</h3>
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
              <option value="">-- To (Append Into Base) --</option>
              {staNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <button className="btn" onClick={handleMerge}>
              🔄 Merge
            </button>
            <button className="btn btn-ghost" onClick={exportMerged}>
              💾 Export Working Set
            </button>
            <button className="btn btn-ghost" onClick={exportAllGroups}>
              📄 Export All STAs
            </button>
          </div>
        </div>
      )}

      {/* Active set preview (merged or single-group) */}
      {(merged.length || Object.keys(groups).length === 1) && (
        <div className="card">
          <h3>
            ✅ Working Set (
            {merged.length ||
              (Object.keys(groups).length === 1
                ? groups[Object.keys(groups)[0]].length
                : 0)}
            {" "}
            pts)
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
                {(merged.length
                  ? merged
                  : groups[Object.keys(groups)[0]]
                ).map((p, i) => (
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
            <button className="btn btn-ghost" onClick={exportMerged}>
              📄 Export Working Set TXT
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