import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);
  const [info, setInfo] = useState("");
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [geomDiff, setGeomDiff] = useState([]);

  // ------------- FILE UPLOAD -------------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      setGroups(parseSTAFile(text));
      setInfo("✅ File loaded successfully");
    };
    r.readAsText(f);
  };

  // ------------- PARSER -------------
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
        if ([E, N, H].every(Number.isFinite)) out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ------------- MERGE LOGIC -------------
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names first");
    if (fromSta === toSta) return setInfo("⚠️ Choose different STAs");
    if (!groups[fromSta] || !groups[toSta]) return setInfo("⚠️ Invalid STA names");

    const base = groups[fromSta];
    const next = groups[toSta];
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (common.length === 0)
      return setInfo("⚠️ No common points between STAs");

    // mean offset
    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n);
      const b = nextMap.get(n);
      dE += a.E - b.E; dN += a.N - b.N; dH += a.H - b.H;
    }
    dE /= common.length; dN /= common.length; dH /= common.length;

    // build merged
    const newPts = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH }));
    const mergedArr = [...base, ...newPts];
    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta}`);

    // geometry difference check (1→All)
    computeGeometryDiff(baseMap, nextMap, fromSta, toSta);
  };

  // ------------- GEOMETRY DIFFERENCE (1→All) -------------
  const computeGeometryDiff = (baseMap, nextMap, s1, s2) => {
    const pts = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (pts.length < 2) return setGeomDiff([]);
    const p1 = baseMap.get(pts[0]);
    const p1b = nextMap.get(pts[0]);
    const diffs = [];
    for (let i = 1; i < pts.length; i++) {
      const pA = baseMap.get(pts[i]);
      const pB = nextMap.get(pts[i]);
      const dE1 = pA.E - p1.E, dN1 = pA.N - p1.N, dH1 = pA.H - p1.H;
      const dE2 = pB.E - p1b.E, dN2 = pB.N - p1b.N, dH2 = pB.H - p1b.H;
      const de = dE1 - dE2, dn = dN1 - dN2, dh = dH1 - dH2;
      const dmm = Math.sqrt(de * de + dn * dn + dh * dh);
      diffs.push({ name: `${pts[0]}→${pts[i]}`, dE1, dE2, de, dn, dh, dmm });
    }
    setGeomDiff(diffs);
  };

  // ------------- ACCEPT -------------
  const handleAccept = () => {
    setGeomDiff([]);
    setInfo("✅ Accepted. Ready for next merge.");
  };

  // ------------- EXPORT -------------
  const onExport = () => {
    if (!merged.length) return alert("No merged data yet.");
    const txt = merged.map(
      (p) => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
    ).join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Merged_STA.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const staNames = Object.keys(groups);

  return (
    <div className="sta-merge">
      <h1>📐 Station Merge (Pair Mode)</h1>

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
              {staNames.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">-- To (Merge Into Base) --</option>
              {staNames.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={handleMerge}>🔄 Merge Selected</button>
            <button onClick={onExport}>💾 Export TXT</button>
          </div>
          <div className="hint">After merge → Base STA name remains.</div>
        </div>
      )}

      {/* geometry difference table */}
      {geomDiff.length > 0 && (
        <div className="card">
          <h2>📊 Geometry Difference (1 → Others)</h2>
          <table>
            <thead>
              <tr>
                <th>Ref→Pt</th><th>ΔE₁</th><th>ΔE₂</th>
                <th>ΔE diff</th><th>ΔN diff</th><th>ΔH diff</th><th>Δmm</th>
              </tr>
            </thead>
            <tbody>
              {geomDiff.map((r, i) => (
                <tr key={i} className={r.dmm > 0.003 ? "err" : ""}>
                  <td>{r.name}</td>
                  <td>{r.dE1.toFixed(3)}</td>
                  <td>{r.dE2.toFixed(3)}</td>
                  <td>{r.de.toFixed(3)}</td>
                  <td>{r.dn.toFixed(3)}</td>
                  <td>{r.dh.toFixed(3)}</td>
                  <td>{(r.dmm * 1000).toFixed(1)} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleAccept}>✅ Accept & Continue Merge</button>
        </div>
      )}

      {/* show groups */}
      {Object.entries(groups).map(([sta, pts]) => (
        <div key={sta} className="sta-card">
          <h3>{sta}</h3>
          <table>
            <thead><tr><th>Point</th><th>E</th><th>N</th><th>H</th></tr></thead>
            <tbody>
              {pts.map((p, i) => (
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
      ))}

      {merged.length > 0 && (
        <div className="card">
          <h2>✅ Last Merged Result ({merged.length} pts)</h2>
          <table>
            <thead><tr><th>Point</th><th>E</th><th>N</th><th>H</th></tr></thead>
            <tbody>
              {merged.map((p, i) => (
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
      )}
    </div>
  );
      }
