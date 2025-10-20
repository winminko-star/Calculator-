import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);
  const [info, setInfo] = useState("");

  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");

  // Method 1 & 2 (transform)
  const [m1A, setM1A] = useState("");
  const [m1B, setM1B] = useState("");
  const [m2P1, setM2P1] = useState("");
  const [m2P2, setM2P2] = useState("");
  const [m2P3, setM2P3] = useState("");
  const [m2P4, setM2P4] = useState("");
  const [transformed, setTransformed] = useState([]);
  const [method, setMethod] = useState("");

  // -------- File Upload --------
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

  // -------- Parser --------
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
        out[current] = []; // skip its ENH
        continue;
      }
      if (current) {
        const E = parseFloat(e),
          N = parseFloat(n),
          H = parseFloat(h);
        if ([E, N, H].every(Number.isFinite)) {
          out[current].push({ name, E, N, H });
        }
      }
    }
    return out;
  }

  // -------- Merge Logic --------
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names first");
    if (fromSta === toSta) return setInfo("⚠️ Choose different STAs");
    if (!groups[fromSta] || !groups[toSta])
      return setInfo("⚠️ Invalid STA names");

    const base = groups[fromSta];
    const next = groups[toSta];
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));

    if (common.length === 0) {
      const mergedArr = [...base, ...next];
      const newGroups = { ...groups };
      delete newGroups[toSta];
      newGroups[fromSta] = mergedArr;
      setGroups(newGroups);
      setMerged(mergedArr);
      setInfo(`✅ ${fromSta} merged with ${toSta} (no common pts)`);
      return;
    }

    let dE = 0,
      dN = 0,
      dH = 0;
    for (const n of common) {
      const a = baseMap.get(n);
      const b = nextMap.get(n);
      dE += a.E - b.E;
      dN += a.N - b.N;
      dH += a.H - b.H;
    }
    dE /= common.length;
    dN /= common.length;
    dH /= common.length;

    const newPts = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({
        name: p.name,
        E: p.E + dE,
        N: p.N + dN,
        H: p.H + dH,
      }));

    const mergedArr = [...base, ...newPts];
    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta} (${common.length} ref pts)`);
  };

  // -------- Method 1 (Reference Line) --------
  const handleMethod1 = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    const aName = m1A.trim();
    const bName = m1B.trim();
    if (!aName || !bName) return setInfo("⚠️ Enter 2 points.");
    const map = new Map(merged.map((p) => [p.name, p]));
    const A = map.get(aName);
    const B = map.get(bName);
    if (!A || !B) return setInfo("⚠️ Point not found.");
    const dE = B.E - A.E;
    const dN = B.N - A.N;
    const dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("⚠️ Same point.");

    const phi = Math.atan2(dE, dN);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    const result = merged.map((p) => {
      const e0 = p.E - A.E;
      const n0 = p.N - A.N;
      const h0 = p.H - A.H;
      const E1 = c * e0 - s * n0;
      const N1 = s * e0 + c * n0;
      const H1 = h0;
      return { name: p.name, E: E1, N: N1, H: H1 };
    });

    setTransformed(result);
    setMethod("Reference Line");
    setInfo(`✅ Reference line applied (A→0,0,0 | B→0,${dist.toFixed(3)},${dH.toFixed(3)})`);
  };

  // -------- Method 2 (4 Points Fit) --------
  const handleMethod2 = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    const ids = [m2P1.trim(), m2P2.trim(), m2P3.trim(), m2P4.trim()];
    if (ids.some((x) => !x)) return setInfo("⚠️ Enter 4 points.");
    const map = new Map(merged.map((p) => [p.name, p]));
    const pts = ids.map((id) => map.get(id));
    if (pts.some((p) => !p)) return setInfo("⚠️ Point not found.");

    const cenE = (pts[0].E + pts[1].E + pts[2].E + pts[3].E) / 4;
    const cenN = (pts[0].N + pts[1].N + pts[2].N + pts[3].N) / 4;

    let sEE = 0,
      sEN = 0,
      sNN = 0;
    for (const p of pts) {
      const e = p.E - cenE;
      const n = p.N - cenN;
      sEE += e * e;
      sEN += e * n;
      sNN += n * n;
    }
    const tr = sEE + sNN;
    const det = sEE * sNN - sEN * sEN;
    const disc = Math.max(tr * tr - 4 * det, 0);
    const l1 = (tr + Math.sqrt(disc)) / 2;
    let ux = 1,
      uy = 0;
    if (sEN !== 0 || sEE !== l1) {
      ux = sEN;
      uy = l1 - sEE;
      const norm = Math.hypot(ux, uy) || 1;
      ux /= norm;
      uy /= norm;
    }
    const theta = Math.atan2(ux, uy);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const H0 = pts[0].H;

    const result = merged.map((p) => {
      const e0 = p.E - cenE;
      const n0 = p.N - cenN;
      const E1 = c * e0 - s * n0;
      const N1 = s * e0 + c * n0;
      const H1 = p.H - H0;
      return { name: p.name, E: E1, N: N1, H: H1 };
    });

    setTransformed(result);
    setMethod("4 Points Fit");
    setInfo("✅ 4-point fit applied (centroid origin)");
  };

  // -------- Export --------
  const onExport = () => {
    const data = transformed.length ? transformed : merged;
    if (!data.length) return alert("No data to export.");
    const txt = data
      .map(
        (p) =>
          `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
      )
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Final_STA.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const staNames = Object.keys(groups);

  return (
    <div className="sta-merge">
      <h1>📐 Station Merge + Transform</h1>

      <div className="card">
        <input type="file" accept=".txt" onChange={onFile} />
        {info && <div className="msg">{info}</div>}
      </div>

      {rawText && (
        <div className="card">
          <h2>🧾 Original Upload</h2>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {staNames.length > 0 && (
        <div className="card">
          <h2>🧩 Choose Two STAs to Merge</h2>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)}>
              <option value="">-- From (Base) --</option>
              {staNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">-- To (Merge Into Base) --</option>
              {staNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button onClick={handleMerge}>🔄 Merge</button>
            <button onClick={onExport}>💾 Export</button>
          </div>
          <div className="hint">After merge → Base STA name remains.</div>
        </div>
      )}

      {/* Method 1 / 2 section */}
      {merged.length > 0 && (
        <div className="card">
          <h2>📏 Transform (choose one method)</h2>
          <div className="grid2">
            <div>
              <h4>Method 1 – Reference Line</h4>
              <label>Point A</label>
              <input
                value={m1A}
                onChange={(e) => setM1A(e.target.value)}
                placeholder="e.g. P1"
              />
              <label>Point B</label>
              <input
                value={m1B}
                onChange={(e) => setM1B(e.target.value)}
                placeholder="e.g. P2"
              />
              <button onClick={handleMethod1}>▶ Apply Method 1</button>
            </div>

            <div>
              <h4>Method 2 – 4 Points Fit</h4>
              <div className="grid2">
                <input
                  value={m2P1}
                  onChange={(e) => setM2P1(e.target.value)}
                  placeholder="P1"
                />
                <input
                  value={m2P2}
                  onChange={(e) => setM2P2(e.target.value)}
                  placeholder="P2"
                />
                <input
                  value={m2P3}
                  onChange={(e) => setM2P3(e.target.value)}
                  placeholder="P3"
                />
                <input
                  value={m2P4}
                  onChange={(e) => setM2P4(e.target.value)}
                  placeholder="P4"
                />
              </div>
              <button onClick={handleMethod2}>▶ Apply Method 2</button>
            </div>
          </div>
        </div>
      )}

      {/* Tables */}
      {Object.keys(groups).length > 0 && (
        <div className="sta-list">
          {Object.entries(groups).map(([sta, pts]) => (
            <div key={sta} className="sta-card">
              <h3>{sta}</h3>
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
        </div>
      )}

      {transformed.length > 0 && (
        <div className="card">
          <h2>✅ Transformed Result ({method})</h2>
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
      )}
    </div>
  );
        }
