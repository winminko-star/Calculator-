import React, { useMemo, useState } from "react";
import "./StationMerge.css";

/**
 * StationMerge — Full tool
 * - TXT upload with [STA*] groups
 * - Multi-STA merge via average ΔE/ΔN/ΔH from common points
 * - Error/Tolerance (≤3mm OK, 3–4mm warn, >4mm red)
 * - Method 1: Reference Line (2 points, true distance)
 * - Method 2: 4-Point Fit (PCA orientation, centroid origin)
 * - Preview tables + Export TXT
 */

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [groups, setGroups] = useState({});        // { STA: [{name,E,N,H}] }
  const [mergeErrors, setMergeErrors] = useState([]); // [{pair:"STA1/STA2", items:[{name, dE, dN, dH, planemm}]}]
  const [merged, setMerged] = useState([]);        // final merged [{name,E,N,H}]
  const [infoMsg, setInfoMsg] = useState("");

  // Method 1 inputs (textboxes)
  const [m1A, setM1A] = useState("");
  const [m1B, setM1B] = useState("");

  // Method 2 inputs (textboxes)
  const [m2P1, setM2P1] = useState("");
  const [m2P2, setM2P2] = useState("");
  const [m2P3, setM2P3] = useState("");
  const [m2P4, setM2P4] = useState("");

  // transformed results (show latest preview)
  const [transformed, setTransformed] = useState([]);
  const [lastMethod, setLastMethod] = useState(null); // "m1" | "m2" | null

  // ---------- Helpers ----------
  const toFixed3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "");
  const mmClass = (mm) => {
    if (!Number.isFinite(mm)) return "";
    if (mm <= 3) return "ok";
    if (mm <= 4) return "warn";
    return "bad";
  };

  // ---------- File parse ----------
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result || "");
      setRawText(text);
      const parsed = parseSTAFile(text);
      setGroups(parsed);
      setMerged([]);
      setTransformed([]);
      setMergeErrors([]);
      setLastMethod(null);
      setInfoMsg(`✅ Loaded ${Object.keys(parsed).length} STA group(s).`);
    };
    reader.readAsText(f);
  };

  function parseSTAFile(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let cur = null;
    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("[") && line.endsWith("]")) {
        cur = line.slice(1, -1);
        out[cur] = [];
      } else if (cur) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const [name, e, n, h] = parts;
          const E = parseFloat(e), N = parseFloat(n), H = parseFloat(h);
          if ([E,N,H].every(Number.isFinite)) {
            out[cur].push({ name, E, N, H });
          }
        }
      }
    }
    return out;
  }

  // ---------- Merge All STAs ----------
  const onMerge = () => {
    const keys = Object.keys(groups);
    if (keys.length === 0) {
      setInfoMsg("⚠️ No groups loaded.");
      return;
    }
    if (keys.length === 1) {
      const only = groups[keys[0]].slice();
      setMerged(only);
      setTransformed([]);
      setMergeErrors([]);
      setLastMethod(null);
      setInfoMsg("✅ Single STA — no merge required.");
      return;
    }

    let base = groups[keys[0]].slice();
    const errors = [];

    for (let i = 1; i < keys.length; i++) {
      const next = groups[keys[i]];
      const res = mergeTwo(base, next);
      base = res.merged;
      if (res.commonErrors?.length) {
        errors.push({
          pair: `${keys[i - 1]} → ${keys[i]}`,
          items: res.commonErrors,
        });
      } else {
        errors.push({
          pair: `${keys[i - 1]} → ${keys[i]}`,
          items: [],
        });
      }
    }

    setMerged(base);
    setTransformed([]);
    setLastMethod(null);
    setMergeErrors(errors);
    setInfoMsg(`✅ Merged ${keys.length} STAs → 1 set.`);
  };

  function mergeTwo(baseArr, nextArr) {
    const baseMap = new Map(baseArr.map((p) => [p.name, p]));
    const nextMap = new Map(nextArr.map((p) => [p.name, p]));
    const commonNames = [...baseMap.keys()].filter((k) => nextMap.has(k));

    if (commonNames.length === 0) {
      // No reference — just union as-is (keep base priority)
      const union = baseArr.slice();
      for (const p of nextArr) {
        if (!baseMap.has(p.name)) union.push({ ...p }); // untouched
      }
      return { merged: union, commonErrors: [] };
    }

    // average deltas using common
    let dE = 0, dN = 0, dH = 0;
    for (const name of commonNames) {
      const b = baseMap.get(name);
      const x = nextMap.get(name);
      dE += b.E - x.E;
      dN += b.N - x.N;
      dH += b.H - x.H;
    }
    dE /= commonNames.length;
    dN /= commonNames.length;
    dH /= commonNames.length;

    // residuals for error report (planimetric mm after applying avg)
    const resRows = [];
    for (const name of commonNames) {
      const b = baseMap.get(name);
      const x = nextMap.get(name);
      const rE = (x.E + dE) - b.E;
      const rN = (x.N + dN) - b.N;
      const rH = (x.H + dH) - b.H;
      const planemm = Math.sqrt(rE * rE + rN * rN) * 1000.0;
      resRows.push({ name, dE: rE, dN: rN, dH: rH, planemm });
    }

    // apply avg shift to next and union (skip duplicates)
    const merged = baseArr.slice();
    for (const p of nextArr) {
      if (!baseMap.has(p.name)) {
        merged.push({ name: p.name, E: p.E + dE, N: p.N + dN, H: p.H + dH });
      }
    }
    return { merged, commonErrors: resRows };
  }

  // ---------- Method 1: Reference Line (True Distance) ----------
  const onMethod1 = () => {
    if (!merged.length) {
      setInfoMsg("⚠️ Merge first (or single STA) before transforming.");
      return;
    }
    const Aname = m1A.trim();
    const Bname = m1B.trim();
    if (!Aname || !Bname) {
      setInfoMsg("⚠️ Enter two point names for Method 1.");
      return;
    }
    const map = new Map(merged.map((p) => [p.name, p]));
    const A = map.get(Aname);
    const B = map.get(Bname);
    if (!A || !B) {
      setInfoMsg("⚠️ Point not found. Check names.");
      return;
    }

    // translate by -A
    const dE = B.E - A.E;
    const dN = B.N - A.N;
    const dH = B.H - A.H;
    const dist2D = Math.sqrt(dE * dE + dN * dN);

    if (dist2D === 0) {
      setInfoMsg("⚠️ The two points are coincident in E/N.");
      return;
    }

    // rotation angle φ such that vector (dE,dN) -> (0, +|v|)
    // Using rotation matrix R(φ): E' = c*E - s*N ; N' = s*E + c*N
    // Choose φ = atan2(dE, dN) to set E' of B to 0
    const phi = Math.atan2(dE, dN);
    const c = Math.cos(phi), s = Math.sin(phi);

    const out = merged.map((p) => {
      const e0 = p.E - A.E;
      const n0 = p.N - A.N;
      const h0 = p.H - A.H;
      const E1 = c * e0 - s * n0;
      const N1 = s * e0 + c * n0;
      const H1 = h0;
      return { name: p.name, E: E1, N: N1, H: H1 };
    });

    setTransformed(out);
    setLastMethod("m1");
    setInfoMsg(`✅ Method 1 applied — A→(0,0,0), B→(0, ${dist2D.toFixed(3)}, ${dH.toFixed(3)})`);
  };

  // ---------- Method 2: 4-Point Fit (PCA orientation, centroid origin, H relative to P1) ----------
  const onMethod2 = () => {
    if (!merged.length) {
      setInfoMsg("⚠️ Merge first (or single STA) before transforming.");
      return;
    }
    const ids = [m2P1.trim(), m2P2.trim(), m2P3.trim(), m2P4.trim()];
    if (ids.some((x) => !x)) {
      setInfoMsg("⚠️ Enter four point names for Method 2.");
      return;
    }
    const map = new Map(merged.map((p) => [p.name, p]));
    const pts = ids.map((id) => map.get(id));
    if (pts.some((p) => !p)) {
      setInfoMsg("⚠️ One or more Method 2 points not found.");
      return;
    }

    // 2D PCA on the 4 chosen points (E,N)
    const cenE = (pts[0].E + pts[1].E + pts[2].E + pts[3].E) / 4;
    const cenN = (pts[0].N + pts[1].N + pts[2].N + pts[3].N) / 4;

    let sEE = 0, sEN = 0, sNN = 0;
    for (const p of pts) {
      const e = p.E - cenE;
      const n = p.N - cenN;
      sEE += e * e;
      sEN += e * n;
      sNN += n * n;
    }
    // principal eigenvector of [[sEE, sEN],[sEN, sNN]]
    const tr = sEE + sNN;
    const det = sEE * sNN - sEN * sEN;
    const disc = Math.max(tr * tr - 4 * det, 0);
    const l1 = (tr + Math.sqrt(disc)) / 2; // principal eigenvalue
    let ux = 1, uy = 0;
    if (sEN !== 0 || sEE !== l1) {
      // eigenvector (sEE - l1)*ux + sEN*uy = 0  → pick ux = sEN, uy = l1 - sEE
      ux = sEN;
      uy = l1 - sEE;
      const norm = Math.hypot(ux, uy) || 1;
      ux /= norm; uy /= norm;
    }
    // rotate so that principal axis aligns with +N (i.e., E' small)
    // We want R(θ) so that a vector along (ux,uy) maps to (0, +1)
    // Choose θ = atan2(ux, uy)
    const theta = Math.atan2(ux, uy);
    const c = Math.cos(theta), s = Math.sin(theta);

    // H reference = H of first selected point
    const H0 = pts[0].H;

    const out = merged.map((p) => {
      const e0 = p.E - cenE;
      const n0 = p.N - cenN;
      const E1 = c * e0 - s * n0;
      const N1 = s * e0 + c * n0;
      const H1 = p.H - H0;
      return { name: p.name, E: E1, N: N1, H: H1 };
    });

    setTransformed(out);
    setLastMethod("m2");
    setInfoMsg("✅ Method 2 applied — PCA orientation with centroid at origin (H relative to P1).");
  };

  // ---------- Export ----------
  const onExport = () => {
    const data = transformed.length ? transformed : (merged.length ? merged : []);
    if (!data.length) {
      alert("No data to export. Merge/Transform first.");
      return;
    }
    const txt = data
      .map((p) => `${p.name}\t${p.E.toFixed(3)}\t${p.N.toFixed(3)}\t${p.H.toFixed(3)}`)
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lastMethod ? `Final_${lastMethod.toUpperCase()}_STA.txt` : "Final_Merged_STA.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Memos for UI ----------
  const staKeys = useMemo(() => Object.keys(groups), [groups]);

  return (
    <div className="station-merge">
      <h1>📐 Station Merge & Transform</h1>

      <div className="card">
        <div className="row">
          <input type="file" accept=".txt" onChange={onFile} />
          <button onClick={onMerge}>🔄 Merge STAs</button>
          <button onClick={onExport}>💾 Export TXT</button>
        </div>
        {infoMsg && <div className="msg">{infoMsg}</div>}
      </div>

      {/* Raw groups preview */}
      {staKeys.length > 0 && (
        <section>
          <h2>🗂️ STA Groups ({staKeys.length})</h2>
          <div className="sta-list">
            {staKeys.map((k) => (
              <div className="sta-card" key={k}>
                <h3>{k}</h3>
                <PointTable rows={groups[k]} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Merge error/tolerance */}
      {mergeErrors.length > 0 && (
        <section>
          <h2>📏 Common Points Residuals (after avg Δ applied)</h2>
          {mergeErrors.map((blk, idx) => (
            <div className="error-block" key={idx}>
              <h4>{blk.pair}</h4>
              {blk.items.length ? (
                <table className="errtable">
                  <thead>
                    <tr>
                      <th>Point</th>
                      <th>dE</th>
                      <th>dN</th>
                      <th>dH</th>
                      <th>Planar (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blk.items.map((r, i) => (
                      <tr key={i} className={mmClass(Math.abs(r.planemm))}>
                        <td className="left">{r.name}</td>
                        <td>{toFixed3(r.dE)}</td>
                        <td>{toFixed3(r.dN)}</td>
                        <td>{toFixed3(r.dH)}</td>
                        <td>{toFixed3(r.planemm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted">No common points.</div>
              )}
            </div>
          ))}
          <div className="legend">
            <span className="chip ok">≤ 3 mm</span>
            <span className="chip warn">3–4 mm</span>
            <span className="chip bad">&gt; 4 mm</span>
          </div>
        </section>
      )}

      {/* Merged preview */}
      {merged.length > 0 && (
        <section>
          <h2>✅ Final Merged STA (before transform)</h2>
          <PointTable rows={merged} />
        </section>
      )}

      {/* Method 1 */}
      {merged.length > 0 && (
        <section className="card">
          <h2>📏 Method 1 — Reference Line (True Distance)</h2>
          <div className="grid2">
            <div>
              <label>Point A (to 0,0,0)</label>
              <input value={m1A} onChange={(e) => setM1A(e.target.value)} placeholder="e.g., P1" />
            </div>
            <div>
              <label>Point B (to 0, +D, ΔH)</label>
              <input value={m1B} onChange={(e) => setM1B(e.target.value)} placeholder="e.g., P2" />
            </div>
          </div>
          <div className="row">
            <button onClick={onMethod1}>▶ Apply Method 1</button>
          </div>
        </section>
      )}

      {/* Method 2 */}
      {merged.length > 0 && (
        <section className="card">
          <h2>🧭 Method 2 — 4-Point Fit (PCA orient, centroid origin)</h2>
          <div className="grid4">
            <div>
              <label>P1</label>
              <input value={m2P1} onChange={(e) => setM2P1(e.target.value)} placeholder="e.g., P1" />
            </div>
            <div>
              <label>P2</label>
              <input value={m2P2} onChange={(e) => setM2P2(e.target.value)} placeholder="e.g., P2" />
            </div>
            <div>
              <label>P3</label>
              <input value={m2P3} onChange={(e) => setM2P3(e.target.value)} placeholder="e.g., P3" />
            </div>
            <div>
              <label>P4</label>
              <input value={m2P4} onChange={(e) => setM2P4(e.target.value)} placeholder="e.g., P4" />
            </div>
          </div>
          <div className="row">
            <button onClick={onMethod2}>▶ Apply Method 2</button>
          </div>
          <div className="muted small">
            • Orientation is set by principal axis of the 4 points.  
            • Origin = centroid(E,N) of the 4 points.  
            • Height is relative to P1 (H − H(P1)).
          </div>
        </section>
      )}

      {/* Transformed preview */}
      {transformed.length > 0 && (
        <section>
          <h2>🔄 Transformed Result ({lastMethod === "m1" ? "Method 1" : "Method 2"})</h2>
          <PointTable rows={transformed} />
        </section>
      )}
    </div>
  );
}

/* ---------- Small table component ---------- */
function PointTable({ rows }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th className="left">Point</th>
            <th>E</th>
            <th>N</th>
            <th>H</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td className="left">{p.name}</td>
              <td>{Number.isFinite(p.E) ? p.E.toFixed(3) : ""}</td>
              <td>{Number.isFinite(p.N) ? p.N.toFixed(3) : ""}</td>
              <td>{Number.isFinite(p.H) ? p.H.toFixed(3) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
         }
