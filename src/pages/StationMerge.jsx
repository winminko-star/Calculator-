import React, { useState } from "react";
import "./StationMerge.css";

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});
  const [merged, setMerged] = useState([]);
  const [info, setInfo] = useState("");
  const [mergeSummaries, setMergeSummaries] = useState([]);

  const [fromSta, setFromSta] = useState("");
  const [toSta, setToSta] = useState("");

  const [refA, setRefA] = useState("");
  const [refB, setRefB] = useState("");
  const [fitPts, setFitPts] = useState([
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
    { name: "", E: "", N: "", H: "" },
  ]);
  const [transformed, setTransformed] = useState([]);
  const [lastMethod, setLastMethod] = useState("");

  // ---------- File Upload ----------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      setGroups(parseSTAFile(text));
      setInfo("✅ File loaded successfully");
      setMerged([]);
      setTransformed([]);
      setMergeSummaries([]);
      setLastMethod("");
    };
    r.readAsText(f);
  };

  // ---------- Parse STA file ----------
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
        const E = parseFloat(e),
          N = parseFloat(n),
          H = parseFloat(h);
        if ([E, N, H].every(Number.isFinite))
          out[current].push({ name, E, N, H });
      }
    }
    return out;
  }

  // ---------- Merge ----------
  const TOL = 0.003;
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

    let dE = 0, dN = 0, dH = 0;
    for (const n of common) {
      const a = baseMap.get(n),
        b = nextMap.get(n);
      dE += a.E - b.E;
      dN += a.N - b.N;
      dH += a.H - b.H;
    }
    dE /= common.length;
    dN /= common.length;
    dH /= common.length;

    let exceedCount = 0, maxmm = 0;
    for (const n of common) {
      const a = baseMap.get(n),
        b = nextMap.get(n);
      const rE = (b.E + dE) - a.E;
      const rN = (b.N + dN) - a.N;
      const rH = (b.H + dH) - a.H;
      const dmm = Math.sqrt(rE * rE + rN * rN + rH * rH);
      if (dmm > TOL) exceedCount++;
      if (dmm > maxmm) maxmm = dmm;
    }

    const newPts = next
      .filter((p) => !baseMap.has(p.name))
      .map((p) => ({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH }));

    const mergedArr = [...base, ...newPts];
    const newGroups = { ...groups };
    delete newGroups[toSta];
    newGroups[fromSta] = mergedArr;
    setGroups(newGroups);
    setMerged(mergedArr);
    setInfo(`✅ Merged ${toSta} → ${fromSta} (${common.length} ref pts)`);
    setMergeSummaries([{ group: toSta, count: exceedCount, maxmm }]);
  };

  // ---------- Reference Line ----------
  const applyRefLine = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    const map = new Map(merged.map((p) => [p.name, p]));
    const A = map.get(refA.trim());
    const B = map.get(refB.trim());
    if (!A || !B) return setInfo("⚠️ Invalid reference points.");

    const dE = B.E - A.E, dN = B.N - A.N, dH = B.H - A.H;
    const dist = Math.hypot(dE, dN);
    if (dist === 0) return setInfo("⚠️ Reference points are coincident.");

    const phi = Math.atan2(dE, dN);
    const c = Math.cos(phi), s = Math.sin(phi);

    const out = merged.map((p) => {
      const e0 = p.E - A.E, n0 = p.N - A.N, h0 = p.H - A.H;
      return {
        name: p.name,
        E: c * e0 - s * n0,
        N: s * e0 + c * n0,
        H: h0,
      };
    });
    setTransformed(out);
    setLastMethod("Reference Line");
    setInfo(`✅ Reference line applied — A→(0,0,0)  B→(0,${dist.toFixed(3)},${dH.toFixed(3)})`);
  };

  // ---------- 4-Point Fit ----------
  function solveLinear(A, b) {
    const n = A[0].length;
    for (let i = 0; i < n; i++) {
      let max = i;
      for (let j = i + 1; j < n; j++)
        if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j;
      [A[i], A[max]] = [A[max], A[i]];
      [b[i], b[max]] = [b[max], b[i]];
      const div = A[i][i];
      for (let k = i; k < n; k++) A[i][k] /= div;
      b[i] /= div;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const f = A[j][i];
        for (let k = i; k < n; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    return b;
  }

  const apply4PointFit = () => {
    if (!merged.length) return setInfo("⚠️ Merge first.");
    for (const p of fitPts)
      if (!p.name || p.E === "" || p.N === "" || p.H === "")
        return setInfo("⚠️ Fill all 4 points.");
    const srcMap = new Map(merged.map((p) => [p.name, p]));
    const src = [], tgt = [];
    for (const p of fitPts) {
      const s = srcMap.get(p.name.trim());
      if (!s) return setInfo(`⚠️ Not found: ${p.name}`);
      src.push([s.E, s.N, s.H]);
      tgt.push([+p.E, +p.N, +p.H]);
    }

    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [xs, ys, zs] = src[i], [xt, yt, zt] = tgt[i];
      A.push([xs, ys, zs, 0, 0, 0, 0, 0, 0, 1, 0, 0]); b.push(xt);
      A.push([0, 0, 0, xs, ys, zs, 0, 0, 0, 0, 1, 0]); b.push(yt);
      A.push([0, 0, 0, 0, 0, 0, xs, ys, zs, 0, 0, 1]); b.push(zt);
    }
    const x = solveLinear(A, b);

    const out = merged.map((p) => ({
      name: p.name,
      E: x[0]*p.E + x[1]*p.N + x[2]*p.H + x[9],
      N: x[3]*p.E + x[4]*p.N + x[5]*p.H + x[10],
      H: x[6]*p.E + x[7]*p.N + x[8]*p.H + x[11],
    }));
    setTransformed(out);
    setLastMethod("4-Point Fit");
    setInfo("✅ 4-Point Fit applied");
  };

  // ---------- Export ----------
  const onExport = () => {
    const data = transformed.length ? transformed : merged;
    if (!data.length) return alert("No data to export.");
    const txt = data
      .map((p) =>
        `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`
      )
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = transformed.length
      ? `Final_${lastMethod.replace(/\s+/g, "")}.txt`
      : "Merged_STA.txt";
    a.click();
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
          <h2>🧩 Choose Two STAs</h2>
          <div className="row">
            <select value={fromSta} onChange={(e) => setFromSta(e.target.value)}>
              <option value="">-- From (Base) --</option>
              {staNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={toSta} onChange={(e) => setToSta(e.target.value)}>
              <option value="">-- To Merge --</option>
              {staNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button onClick={handleMerge}>🔄 Merge</button>
            <button onClick={onExport}>💾 Export</button>
          </div>

          {mergeSummaries.map((s, i) => (
            <div key={i} className={s.count > 0 ? "warn" : "ok"}>
              {s.count > 0
                ? `⚠ ${s.group} exceeded ${s.count} pts (${(s.maxmm * 1000).toFixed(1)} mm)`
                : `✅ ${s.group} within 3 mm`}
            </div>
          ))}
        </div>
      )}

      {merged.length > 0 && (
        <div className="card">
          <h2>✅ Last Merged ({merged.length})</h2>
          <Table rows={merged} />
        </div>
      )}

      {merged.length > 0 && (
        <div className="card">
          <h2>📏 Transform</h2>
          <div className="grid2">
            <div>
              <h4>Reference Line</h4>
              <input placeholder="Point A" value={refA} onChange={(e)=>setRefA(e.target.value)} />
              <input placeholder="Point B" value={refB} onChange={(e)=>setRefB(e.target.value)} />
              <button onClick={applyRefLine}>▶ Apply Ref Line</button>
            </div>

            <div>
              <h4>4-Point Fit</h4>
              {fitPts.map((p, i) => (
                <div key={i} className="fit-row">
                  <input className="nm" placeholder="Name" value={p.name}
                    onChange={(e)=>{const a=[...fitPts]; a[i].name=e.target.value; setFitPts(a);}} />
                  {["E","N","H"].map(k=>(
                    <input key={k} placeholder={k} value={p[k]}
                      onChange={(e)=>{const a=[...fitPts]; a[i][k]=e.target.value; setFitPts(a);}} />
                  ))}
                </div>
              ))}
              <button onClick={apply4PointFit}>▶ Apply 4-Point</button>
            </div>
          </div>
        </div>
      )}

      {transformed.length > 0 && (
        <div className="card">
          <h2>🔄 Transformed ({lastMethod})</h2>
          <Table rows={transformed} />
          <button onClick={onExport}>📄 Final Export</button>
        </div>
      )}
    </div>
  );
}

function Table({ rows }) {
  return (
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
          {rows.map((p, i) => (
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
  );
        }
