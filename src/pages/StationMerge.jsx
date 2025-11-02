// src/pages/StationMerge.jsx
import React, { useMemo, useRef, useState } from "react";

/**
 * StationMerge.jsx — 4-points input feature removed
 * -------------------------------------------------
 * ✅ Features:
 *  - Upload CSV/JSON or paste text to load station data
 *  - Choose reference group (STA1/STA2/… etc.)
 *  - Per-group chainage shift (e.g., align STA2 to STA1 by +12.345m)
 *  - Live merged preview table (ref-applied chainage)
 *  - Export merged result as CSV (no file-saver dependency)
 *
 * 📄 CSV format (headers optional, auto-detect):
 *    group,station,chainage,x,y
 *    STA1, 1+020.5, 1020.5, 345.123, 67.890
 *    STA2, 0+500,   500,    ,        // x,y optional
 *
 *    - `station` can be free text. `chainage` must be numeric (meters).
 *    - `group` is required (e.g., STA1, STA2…). Case-insensitive.
 *
 * 🧩 JSON format:
 *    [
 *      {"group":"STA1","station":"1+020.5","chainage":1020.5,"x":345.123,"y":67.89},
 *      {"group":"STA2","station":"0+500","chainage":500}
 *    ]
 */

const styles = {
  page: { padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  h1: { fontSize: 24, fontWeight: 800, margin: "8px 0 12px", background: "linear-gradient(90deg,#06b6d4,#818cf8,#f472b6)", WebkitBackgroundClip: "text", color: "transparent" },
  row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" },
  col: (w = 1) => ({ flex: `1 1 ${w * 320}px`, minWidth: 280 }),
  card: { background: "#ffffff", borderRadius: 14, padding: 14, boxShadow: "0 6px 24px rgba(2,8,23,.06), 0 2px 8px rgba(2,8,23,.08)" },
  label: { fontSize: 12, fontWeight: 700, color: "#0f172a", opacity: 0.8, marginBottom: 6, display: "block" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", outline: "none" },
  area: { width: "100%", minHeight: 140, padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", outline: "none", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  btn: { padding: "10px 14px", borderRadius: 9999, background: "#0ea5e9", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" },
  btnGhost: { padding: "10px 14px", borderRadius: 9999, background: "transparent", color: "#0ea5e9", border: "1px solid #0ea5e9", fontWeight: 700, cursor: "pointer" },
  tableWrap: { width: "100%", overflow: "auto", borderRadius: 12, border: "1px solid #e2e8f0" },
  table: { minWidth: 720, width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 12, color: "#334155", background: "#f8fafc", padding: "10px 8px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0 },
  td: { fontSize: 13, color: "#0f172a", padding: "10px 8px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" },
  hint: { fontSize: 12, color: "#64748b" },
  badge: { display: "inline-block", padding: "2px 8px", fontSize: 11, borderRadius: 999, background: "#e2e8f0", color: "#0f172a", fontWeight: 700, marginLeft: 6 },
};

function parseCSV(text) {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (!rows.length) return [];

  // Try to detect header
  const first = rows[0];
  const hasHeader = /group/i.test(first) && /chainage/i.test(first);
  const body = hasHeader ? rows.slice(1) : rows;

  return body
    .map((line) => {
      // simple CSV split (no quotes escaping). Good enough for this tool.
      const parts = line.split(",").map((s) => s.trim());
      const [group, station, chainage, x, y] = parts;
      const ch = chainage === "" ? NaN : Number(chainage);
      const xx = x === "" || x === undefined ? undefined : Number(x);
      const yy = y === "" || y === undefined ? undefined : Number(y);
      return {
        group: String(group || "").trim(),
        station: station ?? "",
        chainage: Number.isFinite(ch) ? ch : NaN,
        x: Number.isFinite(xx) ? xx : undefined,
        y: Number.isFinite(yy) ? yy : undefined,
        _raw: line,
      };
    })
    .filter((r) => r.group); // require group
}

function tryParseJSON(text) {
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return null;
}

function toCSV(rows) {
  const head = ["group", "station", "chainage", "x", "y", "ref_chainage"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const vals = [
      r.group ?? "",
      (r.station ?? "").toString().replace(/,/g, " "), // avoid breaking CSV
      Number.isFinite(r.chainage) ? r.chainage : "",
      r.x ?? "",
      r.y ?? "",
      Number.isFinite(r.ref_chainage) ? r.ref_chainage : "",
    ];
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

function downloadAsCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StationMerge() {
  const [rawText, setRawText] = useState("");
  const [data, setData] = useState([]); // canonical items
  const [refGroup, setRefGroup] = useState("");
  const [shifts, setShifts] = useState({}); // per-group chainage shift (meters)
  const fileRef = useRef(null);

  const groups = useMemo(() => {
    const s = new Set(data.map((d) => d.group));
    return Array.from(s);
  }, [data]);

  // Derived rows with ref-applied chainage
  const merged = useMemo(() => {
    if (!data.length) return [];
    // ensure refGroup
    const ref = refGroup || (groups.length ? groups[0] : "");
    const sMap = { ...shifts, [ref]: Number(shifts?.[ref] ?? 0) };

    return data
      .map((r) => {
        const shift = Number(sMap[r.group] ?? 0);
        const ref_chainage = Number.isFinite(r.chainage) ? r.chainage + shift : NaN;
        return { ...r, ref_chainage };
      })
      .sort((a, b) => {
        // sort by ref_chainage then group
        const ac = Number.isFinite(a.ref_chainage) ? a.ref_chainage : Number.POSITIVE_INFINITY;
        const bc = Number.isFinite(b.ref_chainage) ? b.ref_chainage : Number.POSITIVE_INFINITY;
        if (ac !== bc) return ac - bc;
        if (a.group !== b.group) return (a.group || "").localeCompare(b.group || "");
        return (a.station || "").toString().localeCompare((b.station || "").toString());
      });
  }, [data, shifts, refGroup, groups]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setRawText(text);

      // Try JSON first
      const maybe = tryParseJSON(text);
      if (maybe) {
        const cleaned = maybe
          .map((r) => ({
            group: String(r.group || "").trim(),
            station: r.station ?? "",
            chainage: Number(r.chainage),
            x: r.x !== undefined ? Number(r.x) : undefined,
            y: r.y !== undefined ? Number(r.y) : undefined,
          }))
          .filter((r) => r.group);
        setData(cleaned);
        setRefGroup(cleaned[0]?.group || "");
        return;
      }

      // Fallback CSV
      const rows = parseCSV(text);
      setData(rows);
      setRefGroup(rows[0]?.group || "");
    };
    reader.readAsText(f);
  }

  function handlePaste() {
    const text = rawText.trim();
    if (!text) {
      alert("Paste CSV/JSON into the box first.");
      return;
    }
    const maybe = tryParseJSON(text);
    if (maybe) {
      const cleaned = maybe
        .map((r) => ({
          group: String(r.group || "").trim(),
          station: r.station ?? "",
          chainage: Number(r.chainage),
          x: r.x !== undefined ? Number(r.x) : undefined,
          y: r.y !== undefined ? Number(r.y) : undefined,
        }))
        .filter((r) => r.group);
      setData(cleaned);
      setRefGroup(cleaned[0]?.group || "");
      return;
    }
    const rows = parseCSV(text);
    setData(rows);
    setRefGroup(rows[0]?.group || "");
  }

  function changeShift(g, val) {
    setShifts((prev) => ({ ...prev, [g]: val === "" ? "" : Number(val) }));
  }

  function clearAll() {
    setRawText("");
    setData([]);
    setRefGroup("");
    setShifts({});
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Station Merge (Ref Chainage Alignment)</h1>

      <div style={{ ...styles.card, marginBottom: 12 }}>
        <div style={styles.hint}>
          4 points input feature ကိုပြီးပြည့်စုံဖယ်ရှာပြီးပါပြီ ✅ ဤ version မှာ data
          input (CSV/JSON upload/paste), reference group alignment (per-group shift),
          merged preview, CSV export တို့ကိုသာထားရှိထားပါတယ်။
        </div>
      </div>

      <div style={styles.row}>
        <div style={{ ...styles.col(1.1) }}>
          <div style={styles.card}>
            <label style={styles.label}>Upload CSV/JSON</label>
            <input ref={fileRef} type="file" accept=".csv,.txt,.json" style={styles.input} onChange={handleFile} />

            <div style={{ height: 8 }} />

            <label style={styles.label}>Or Paste CSV/JSON</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`CSV example:
group,station,chainage,x,y
STA1,1+020.5,1020.5,345.123,67.89
STA2,0+500,500,,
`}
              style={styles.area}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={styles.btn} onClick={handlePaste}>Load from Paste</button>
              <button style={styles.btnGhost} onClick={clearAll}>Clear</button>
            </div>
          </div>
        </div>

        <div style={{ ...styles.col(1) }}>
          <div style={styles.card}>
            <label style={styles.label}>Reference Group</label>
            <select
              value={refGroup}
              onChange={(e) => setRefGroup(e.target.value)}
              style={{ ...styles.input, height: 42 }}
            >
              {groups.length === 0 && <option value="">(no data)</option>}
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <div style={{ height: 12 }} />

            <label style={styles.label}>Per-Group Chainage Shift (m)</label>
            <div style={{ display: "grid", gap: 8 }}>
              {groups.map((g) => (
                <div key={g} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ minWidth: 90, fontWeight: 700 }}>{g}
                    {g === refGroup && <span style={styles.badge}>REF</span>}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    value={shifts[g] ?? (g === refGroup ? 0 : "")}
                    onChange={(e) => changeShift(g, e.target.value)}
                    placeholder={g === refGroup ? "0 (locked as ref)" : "e.g. +12.345"}
                    disabled={g === refGroup}
                    style={{ ...styles.input, maxWidth: 220 }}
                  />
                  <span style={styles.hint}>add to chainage</span>
                </div>
              ))}
              {!groups.length && <div style={styles.hint}>No groups yet. Upload or paste first.</div>}
            </div>

            <div style={{ height: 12 }} />
            <button
              style={{ ...styles.btn, width: "100%" }}
              onClick={() => downloadAsCSV("merged_stations.csv", merged)}
              disabled={!merged.length}
              title={!merged.length ? "Load data first" : "Export merged CSV"}
            >
              ⬇️ Export Merged CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={styles.card}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>Merged Preview</div>
          <div style={styles.hint}>
            Rows: <b>{merged.length}</b>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Group</th>
                <th style={styles.th}>Station</th>
                <th style={styles.th}>Chainage</th>
                <th style={styles.th}>x</th>
                <th style={styles.th}>y</th>
                <th style={styles.th}>Ref Chainage</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((r, i) => (
                <tr key={i}>
                  <td style={styles.td}>{i + 1}</td>
                  <td style={styles.td}>{r.group}</td>
                  <td style={styles.td}>{String(r.station ?? "")}</td>
                  <td style={styles.td}>{Number.isFinite(r.chainage) ? r.chainage.toFixed(3) : ""}</td>
                  <td style={styles.td}>{r.x !== undefined && Number.isFinite(r.x) ? r.x.toFixed(3) : ""}</td>
                  <td style={styles.td}>{r.y !== undefined && Number.isFinite(r.y) ? r.y.toFixed(3) : ""}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>
                    {Number.isFinite(r.ref_chainage) ? r.ref_chainage.toFixed(3) : ""}
                  </td>
                </tr>
              ))}
              {!merged.length && (
                <tr>
                  <td style={styles.td} colSpan={7}>
                    <div style={styles.hint}>No data loaded yet. Upload CSV/JSON or paste above.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, ...styles.hint }}>
          Tips:
          <ul style={{ margin: "6px 0 0 18px" }}>
            <li>Reference group ကို fix လုပ်ပြီးနောက်၊ အခြား group တွေမှာ shift (m) ကို ဖြည့်သွင်းပါ (e.g., +12.345).</li>
            <li><b>Ref Chainage</b> = chainage + shift(g). Export CSV ထဲမှာပါ ပါဝင်သွားမည်။</li>
            <li>x,y မပါလည်းရပါတယ်—optional columnsသာဖြစ်ပါတယ်။</li>
          </ul>
        </div>
      </div>
    </div>
  );
}