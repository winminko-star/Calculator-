// 💡 IDEA By WIN MIN KO
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);
  const [info, setInfo] = useState("");
  const [geomDiff, setGeomDiff] = useState([]);
  const [showGeom, setShowGeom] = useState(false);
  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");
  const [filterMap, setFilterMap] = useState({});

  // ========== FILE UPLOAD ==========
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

  // ========== PARSER ==========
  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let current = null;
    for (let raw of lines) {
      if (!raw.trim()) continue;
      const p = raw.split(",").map((x) => x.trim());
      if (p.length < 4) continue;
      const [name, e, n, h] = p;
      if (/^STA\d+/i.test(name)) {
        current = name;
        out[current] = [];
        continue;
      }
      if (current) {
        const E = +e,
          N = +n,
          H = +h;
        if ([E, N, H].every(Number.isFinite))
          out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ========== GEOMETRY FIT ==========
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

  // ========== MERGE CALCULATION ==========
  const handleMerge = () => {
    if (!fromSta || !toSta) return setInfo("⚠️ Choose two STA names");
    const base = groups[fromSta],
      next = groups[toSta];
    if (!base || !next) return setInfo("⚠️ Invalid STA");
    const baseMap = new Map(base.map((p) => [p.name, p]));
    const nextMap = new Map(next.map((p) => [p.name, p]));
    const common = [...baseMap.keys()].filter((k) => nextMap.has(k));
    if (common.length < 2)
      return setInfo("⚠️ Need ≥2 common points for geometry diff");

    const B = common.map((n) => [baseMap.get(n).E, baseMap.get(n).N]);
    const M = common.map((n) => [nextMap.get(n).E, nextMap.get(n).N]);
    const { scale, cos, sin, tx, ty } = fitSimilarity2D(B, M);
    const dhAvg =
      common.reduce(
        (a, n) => a + (baseMap.get(n).H - nextMap.get(n).H),
        0
      ) / common.length;

    const ref = common[0];
    const rB = baseMap.get(ref),
      rM = nextMap.get(ref);
    const rMx = scale * (cos * rM.E - sin * rM.N) + tx;
    const rMy = scale * (sin * rM.E + cos * rM.N) + ty;
    const rMh = rM.H + dhAvg;
    const diff = [];
    for (let i = 1; i < common.length; i++) {
      const nm = common[i];
      const b = baseMap.get(nm),
        m = nextMap.get(nm);
      const mX = scale * (cos * m.E - sin * m.N) + tx;
      const mY = scale * (sin * m.E + cos * m.N) + ty;
      const mH = m.H + dhAvg;
      const dE1 = b.E - rB.E,
        dN1 = b.N - rB.N,
        dH1 = b.H - rB.H;
      const dE2 = mX - rMx,
        dN2 = mY - rMy,
        dH2 = mH - rMh;
      const de = dE1 - dE2,
        dn = dN1 - dN2,
        dh = dH1 - dH2;
      const dmm = Math.sqrt(de * de + dn * dn + dh * dh) * 1000;
      diff.push({ name: `${ref}→${nm}`, dE1, dE2, de, dn, dh, dmm });
    }
    setGeomDiff(diff);
    setShowGeom(true);
    setInfo(`✅ Geometry diff ready (${fromSta} → ${toSta})`);
  };
  // ========== EXPORT ==========
  const onExport = () => {
    if (!geomDiff.length) return alert("No diff data");
    const t = geomDiff
      .map(
        (p) =>
          `${p.name}\t${p.de.toFixed(3)}\t${p.dn.toFixed(
            3
          )}\t${p.dh.toFixed(3)}\t${p.dmm.toFixed(1)} mm`
      )
      .join("\n");
    const blob = new Blob([t], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "GeometryDiff_WMK.txt";
    a.click();
  };

  // ========== REMOVE STA ==========
  const removeSTA = (sta) => {
    const newGroups = { ...groups };
    delete newGroups[sta];
    setGroups(newGroups);
    if (fromSta === sta) setFromSta("");
    if (toSta === sta) setToSta("");
    setInfo(`🗑️ Removed ${sta}`);
  };

  // ========== FILTER ==========
  const toggleFilter = (sta) => {
    setFilterMap((prev) => ({
      ...prev,
      [sta]: !prev[sta],
    }));
  };

  // ========== MAIN RENDER ==========
  return (
    <div className="sta-merge">
      <h1>💡 IDEA By WIN MIN KO</h1>
      <h2>📐 Station Merge & Geometry Difference</h2>

      <div className="card">
        <input type="file" accept=".txt" onChange={onFile} />
        {info && <div className="msg">{info}</div>}
      </div>

      {rawText && (
        <div className="card">
          <h3>🧾 Original Upload</h3>
          <textarea readOnly value={rawText} className="rawbox" />
        </div>
      )}

      {Object.keys(groups).length > 0 && (
        <div className="card">
          <h3>🧩 Choose STAs</h3>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)}>
              <option value="">From (Base)</option>
              {Object.keys(groups).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">To (Compare)</option>
              {Object.keys(groups).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button onClick={handleMerge}>🔄 Compare</button>
            <button onClick={onExport}>💾 Export</button>
          </div>

          <div className="sta-card">
            <h4>🗂 Remove or Filter STA</h4>
            <div className="grid2">
              {Object.keys(groups).map((sta) => (
                <div key={sta} className="chk">
                  <label>
                    <input
                      type="checkbox"
                      checked={filterMap[sta] || false}
                      onChange={() => toggleFilter(sta)}
                    />
                    {sta}
                  </label>
                  <button
                    className="danger"
                    onClick={() => removeSTA(sta)}
                    title="Remove this STA"
                  >
                    🗑 Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showGeom && (
        <div className="card">
          <div className="row space-between">
            <h3>📊 Geometry Difference ({fromSta} → {toSta})</h3>
            <button
              className="okbtn"
              onClick={() => {
                setShowGeom(false);
                setGeomDiff([]);
                setInfo("✔ Accepted and cleared geometry diff table");
              }}
            >
              ✔ Accept
            </button>
          </div>

          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Ref → Pt</th>
                  <th>ΔE₁</th>
                  <th>ΔE₂</th>
                  <th>ΔE diff</th>
                  <th>ΔN diff</th>
                  <th>ΔH diff</th>
                  <th>Δ mm</th>
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

          {geomDiff.some((p) => p.dmm > 3) && (
            <div className="msg warn">
              ⚠️ Some points exceed the tolerance limit of 3 mm.
            </div>
          )}
        </div>
      )}
    </div>
  );
                      }
