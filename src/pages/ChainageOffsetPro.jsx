import React, { useMemo, useState } from "react";

/* ========== helpers ========== */
const deg = (rad) => (rad * 180) / Math.PI;
const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN);
const rms = (arr) => {
  if (!arr.length) return NaN;
  const m = mean(arr.map((x) => x * x));
  return Math.sqrt(m);
};

// parse "E,N[,H]" lines
function parseENHList(raw) {
  const out = [];
  for (const ln of raw.split(/\r?\n/)) {
    const s = ln.trim();
    if (!s) continue;
    const m = s.split(/[,\s]+/).filter(Boolean);
    if (m.length >= 2) {
      const E = Number(m[0]), N = Number(m[1]);
      const H = m[2] != null ? Number(m[2]) : undefined;
      if (isFinite(E) && isFinite(N) && (H === undefined || isFinite(H))) out.push({ E, N, H });
    }
  }
  return out;
}
function parseOneENH(s) {
  const m = (s || "").trim().split(/[,\s]+/).filter(Boolean);
  if (m.length < 2) return null;
  const E = Number(m[0]), N = Number(m[1]);
  const H = m[2] != null ? Number(m[2]) : undefined;
  if (!isFinite(E) || !isFinite(N) || (m[2] != null && !isFinite(H))) return null;
  return { E, N, H };
}

/* ========== core math ========== */
/** Chainage/Offset (2D) + profile H interpolation (if A.H & B.H given) */
function chainageOffset(A, B, P) {
  const ux = B.E - A.E, uy = B.N - A.N;
  const len = Math.hypot(ux, uy);
  if (len < 1e-9) return { t: NaN, off: NaN, side: "", Hline: NaN, dH: NaN };

  const uxh = ux / len, uyh = uy / len;
  const dEx = P.E - A.E, dNy = P.N - A.N;

  const t = dEx * uxh + dNy * uyh;
  const off = uxh * dNy - uyh * dEx; // +L / −R
  const side = Number.isFinite(off) ? (off > 0 ? "L" : off < 0 ? "R" : "0") : "";

  let Hline = NaN, dH = NaN;
  if (Number.isFinite(A.H) && Number.isFinite(B.H)) {
    const r = t / len;
    Hline = A.H + r * (B.H - A.H);
    if (Number.isFinite(P.H)) dH = P.H - Hline;
  }
  return { t, off, side, Hline, dH, len };
}

/* ========== tiny SVG charts ========== */
function Bars({ values = [], title = "", unit = "mm" }) {
  if (!values.length) return null;
  const w = 360, h = 120, pad = 24;
  const n = values.length;
  const maxAbs = Math.max(1e-6, ...values.map((v) => Math.abs(v)));
  const scale = (h - 2 * pad) / (2 * maxAbs);
  const barW = Math.max(2, (w - 2 * pad) / Math.max(n, 1) - 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      <rect x="0" y="0" width={w} height={h} rx="10" fill="#fff" stroke="#e5e7eb" />
      <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#94a3b8" />
      {values.map((v, i) => {
        const x = pad + i * ((w - 2 * pad) / Math.max(n, 1));
        const bh = Math.abs(v) * scale;
        const y = v >= 0 ? h / 2 - bh : h / 2;
        return <rect key={i} x={x} y={y} width={barW} height={bh} fill="#0ea5e9" rx="2" />;
      })}
      <text x={pad} y={18} fontSize="12" fill="#0f172a">{title}</text>
      <text x={w - pad} y={18} fontSize="12" fill="#64748b" textAnchor="end">±{fmt(maxAbs)} {unit}</text>
    </svg>
  );
}

/* ========== CSV export ========== */
function toCSV(rows) {
  const header = ["#", "E", "N", "H", "t(mm)", "offset(mm)", "side", "Hline", "dH"];
  const lines = [header.join(",")];
  rows.forEach((r, i) => {
    lines.push(
      [
        i + 1,
        fmt(r.p.E),
        fmt(r.p.N),
        r.p.H != null ? fmt(r.p.H) : "",
        fmt(r.t),
        fmt(r.off),
        r.side,
        fmt(r.Hline),
        fmt(r.dH),
      ].join(",")
    );
  });
  return lines.join("\n");
}
function downloadText(name, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ========== File picker (manual import) ========== */
async function importViaPicker(appendText) {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: "ENH files", accept: { "text/plain": [".txt", ".csv"] } }],
        excludeAcceptAllOption: false,
      });
      const texts = [];
      for (const h of handles) {
        const file = await h.getFile();
        texts.push(await file.text());
      }
      appendText(texts.join("\n"));
      return;
    } catch { /* user cancelled */ }
  }
  // fallback: input[type=file]
  await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".txt,.csv,text/plain"; input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      const texts = await Promise.all(files.map(f => f.text()));
      appendText(texts.join("\n")); resolve();
    };
    input.click();
  });
}

/* ========== main page ========== */
export default function ChainageOffsetPro() {
  const [unit, setUnit] = useState("mm"); // "mm" | "m"

  // Baseline
  const [aStr, setAStr] = useState("0,0,0");
  const [bStr, setBStr] = useState("10000,0,0");

  // Points list (raw text)
  const [raw, setRaw] = useState("");

  // Quick add
  const [qe, setQE] = useState(""), [qn, setQN] = useState(""), [qh, setQH] = useState("");

  // Tolerance (mm internal)
  const [tolOff, setTolOff] = useState("5");
  const [tolDH, setTolDH]   = useState("5");

  const uRatio = unit === "mm" ? 1 : 1000;
  const fromView = (v) => (Number.isFinite(v) ? v * uRatio : v);
  const toView   = (mm) => (Number.isFinite(mm) ? mm / uRatio : mm);

  // parse baseline with unit handling
  const A = useMemo(() => {
    const p = parseOneENH(aStr);
    if (!p) return { E: 0, N: 0, H: 0 };
    return { E: fromView(p.E), N: fromView(p.N), H: p.H != null ? fromView(p.H) : undefined };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aStr, unit]);

  const B = useMemo(() => {
    const p = parseOneENH(bStr);
    if (!p) return { E: 0, N: 0, H: 0 };
    return { E: fromView(p.E), N: fromView(p.N), H: p.H != null ? fromView(p.H) : undefined };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bStr, unit]);

  const pts = useMemo(() => {
    const list = parseENHList(raw).map((p) => ({
      E: fromView(p.E), N: fromView(p.N), H: p.H != null ? fromView(p.H) : undefined,
    }));
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, unit]);

  const len2Dmm = Math.hypot(B.E - A.E, B.N - A.N);
  const azimuth = useMemo(() => {
    if (len2Dmm < 1e-9) return NaN;
    const ang = Math.atan2(B.E - A.E, B.N - A.N);
    let d = deg(ang);
    if (d < 0) d += 360;
    return d;
  }, [A, B, len2Dmm]);

  const rows = useMemo(() => pts.map((p) => ({ ...chainageOffset(A, B, p), p })), [A, B, pts]);

  // RMS (mm → show unit)
  const rmsOff = toView(rms(rows.filter(r => Number.isFinite(r.off)).map(r => Math.abs(r.off))));
  const rmsDH  = toView(rms(rows.filter(r => Number.isFinite(r.dH)).map(r => Math.abs(r.dH))));

  const swapAB = () => { setAStr(bStr); setBStr(aStr); };

  const addQuick = () => {
    const e = Number(qe), n = Number(qn);
    const h = qh !== "" ? Number(qh) : undefined;
    if (!isFinite(e) || !isFinite(n) || (qh !== "" && !isFinite(h))) return;
    const line = qh !== "" ? `${e}, ${n}, ${qh}` : `${e}, ${n}`;
    setRaw(prev => (prev ? prev + "\n" + line : line));
    setQE(""); setQN(""); setQH("");
  };

  // delete by table index (skip i-th valid line)
  const removeRow = (iDel) => {
    const lines = raw.split(/\r?\n/);
    let vi = 0; const kept = [];
    for (const ln of lines) {
      const p = parseOneENH(ln);
      if (p && vi === iDel) { vi++; continue; }
      if (p) vi++;
      kept.push(ln);
    }
    setRaw(kept.join("\n").replace(/\n{3,}/g,"\n\n").trim());
  };

  const exportCSV = () => {
    const mmRows = rows.map(r => ({ ...r, p: r.p }));
    downloadText("chainage_offset.csv", toCSV(mmRows));
  };

  const tolOffMM = Number(tolOff) || 0;
  const tolDHMM  = Number(tolDH)  || 0;

  const Badge = ({ ok }) => (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#166534" : "#991b1b", fontSize: 12, fontWeight: 700,
      marginLeft: 6
    }}>
      {ok ? "OK" : "NG"}
    </span>
  );

  const appendText = (text) => {
    setRaw(prev => (prev ? prev + "\n" : "") + (text || "").trim());
  };
  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">📏 Chainage & Offset (ENH) — Pro</div>
        <div className="small">Baseline A→B, chainage t, signed offset (L/R), H(line), ΔH • CSV • RMS • Tolerance • Mini charts • <b>File picker import</b></div>
      </div>

      {/* Unit & baseline */}
      <div className="card">
        <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="page-subtitle" style={{ marginRight: 8 }}>Baseline A → B</div>
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Unit:
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 90 }}>
              <option value="mm">mm</option>
              <option value="m">m</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <input className="input" style={{ width: 240 }} placeholder={`A: E,N,H (${unit})`} value={aStr} onChange={(e)=>setAStr(e.target.value)} />
          <input className="input" style={{ width: 240 }} placeholder={`B: E,N,H (${unit})`} value={bStr} onChange={(e)=>setBStr(e.target.value)} />
          <button className="btn" onClick={swapAB}>⇄ Swap A/B</button>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <div className="small">Length (2D): <b>{fmt(toView(len2Dmm))}</b> {unit}</div>
          <div className="small">Azimuth (° from North): <b>{fmt(azimuth, 2)}</b></div>
        </div>
      </div>

      {/* Points + Quick add + Import/Export */}
      <div className="card">
        <div className="page-subtitle">Points (E,N[,H]) — one per line ({unit})</div>

        <textarea
          rows={8}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`E,N[,H]\n12.000,  0.300,  0.010   ${unit}\n13.000, -0.050,  0.012\n15.000,  0.060`}
          style={{
            width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, outline: "none",
          }}
        />

        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <label className="small" style={{ display: "grid", gap: 4 }}>
            <span>E</span>
            <input className="input" inputMode="decimal" value={qe} onChange={(e)=>setQE(e.target.value)} placeholder={`E (${unit})`} style={{ width: 120 }} />
          </label>
          <label className="small" style={{ display: "grid", gap: 4 }}>
            <span>N</span>
            <input className="input" inputMode="decimal" value={qn} onChange={(e)=>setQN(e.target.value)} placeholder={`N (${unit})`} style={{ width: 120 }} />
          </label>
          <label className="small" style={{ display: "grid", gap: 4 }}>
            <span>H (optional)</span>
            <input className="input" inputMode="decimal" value={qh} onChange={(e)=>setQH(e.target.value)} placeholder={`H (${unit})`} style={{ width: 120 }} />
          </label>

          <button className="btn" onClick={addQuick}>+ Add point</button>
          <button className="btn" style={{ background: "#334155" }} onClick={() => setRaw("")}>🧹 Clear list</button>
          <button className="btn" onClick={() => importViaPicker(appendText)}>📂 Open files</button>
          <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Tolerance & RMS */}
      <div className="card">
        <div className="page-subtitle">Quality / Tolerance</div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="small" style={{ display: "grid", gap: 4 }}>
            <span>Offset tol (±)</span>
            <input className="input" value={fmt(toView(tolOffMM))} onChange={(e)=>setTolOff(String(fromView(Number(e.target.value))))} style={{ width: 120 }} />
          </label>
          <label className="small" style={{ display: "grid", gap: 4 }}>
            <span>ΔH tol (±)</span>
            <input className="input" value={fmt(toView(tolDHMM))} onChange={(e)=>setTolDH(String(fromView(Number(e.target.value))))} style={{ width: 120 }} />
          </label>

          <div className="small" style={{ marginLeft: "auto" }}>
            RMS Offset: <b>{fmt(rmsOff)}</b> {unit} &nbsp;&nbsp; RMS ΔH: <b>{fmt(rmsDH)}</b> {unit}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="page-subtitle">Result (A→B)</div>
        {rows.length === 0 ? (
          <div className="small">No points.</div>
        ) : (
          <>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ flex: "1 1 340px" }}>
                <Bars
                  values={rows.map((r) => toView(Number.isFinite(r.off) ? r.off : 0))}
                  title="Signed Offset bars"
                  unit={unit}
                />
              </div>
              <div style={{ flex: "1 1 340px" }}>
                <Bars
                  values={rows.map((r) => toView(Number.isFinite(r.dH) ? r.dH : 0))}
                  title="ΔH bars"
                  unit={unit}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={th}>#</th>
                    <th style={th}>E ({unit})</th>
                    <th style={th}>N ({unit})</th>
                    <th style={th}>H ({unit})</th>
                    <th style={th}>t ({unit})</th>
                    <th style={th}>Offset ({unit})</th>
                    <th style={th}>Side</th>
                    <th style={th}>H(line) ({unit})</th>
                    <th style={th}>ΔH ({unit})</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const okOff = Number.isFinite(r.off) ? Math.abs(toView(r.off)) <= Number(fmt(toView(tolOffMM))) : true;
                    const okDH  = Number.isFinite(r.dH)  ? Math.abs(toView(r.dH))  <= Number(fmt(toView(tolDHMM)))  : true;
                    return (
                      <tr key={i} style={{ background: (!okOff || !okDH) ? "#fff1f2" : undefined }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{fmt(toView(r.p.E))}</td>
                        <td style={td}>{fmt(toView(r.p.N))}</td>
                        <td style={td}>{r.p.H != null ? fmt(toView(r.p.H)) : ""}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{fmt(toView(r.t))}</td>
                        <td style={{ ...td, fontWeight: 700 }}>
                          {fmt(toView(r.off))} <Badge ok={okOff} />
                        </td>
                        <td style={td}>{r.side}</td>
                        <td style={td}>{fmt(toView(r.Hline))}</td>
                        <td style={{ ...td }}>
                          {Number.isFinite(r.dH) ? `${fmt(toView(r.dH))} ` : ""}{Number.isFinite(r.dH) && <Badge ok={okDH} />}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button
                            className="btn"
                            style={{ background: "#ef4444", padding: "4px 10px", borderRadius: 8 }}
                            onClick={() => removeRow(i)}
                            title="Remove this point"
                          >×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#64748b" };
const td = { padding: "8px 10px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };
