// src/pages/StationFilesJoin.jsx
// 💡 Station Files Join (Preserve original format, simple rename only) by Win Min Ko
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationFilesJoin() {
  const [fileBlocks, setFileBlocks] = useState([]); // keep raw lines per STA
  const [info, setInfo] = useState("");

  // === Upload multiple files ===
  const onFile = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    let blocks = [...fileBlocks];
    let staCount = {}; // to track STA repetition

    for (const f of files) {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(Boolean);

      let current = "";
      let group = [];
      for (let ln of lines) {
        if (/^STA/i.test(ln.trim())) {
          // When a new STA starts, save previous
          if (current && group.length) {
            blocks.push({ name: current, lines: group });
          }
          let header = ln.trim();
          // Check duplicate header names
          const base = header.split(",")[0];
          staCount[base] = (staCount[base] || 0) + 1;
          if (staCount[base] > 1) header = `${base}B`; // second or later = STA1B
          current = header;
          group = [header];
        } else if (current) {
          group.push(ln.trim());
        }
      }
      if (current && group.length) {
        blocks.push({ name: current, lines: group });
      }
    }

    setFileBlocks(blocks);
    setInfo(`✅ Loaded ${files.length} file(s), total ${blocks.length} STA blocks`);
  };

  // === Clear all ===
  const clearAll = () => {
    setFileBlocks([]);
    setInfo("🧹 Cleared all data");
  };

  // === Export joined ===
  const exportJoined = () => {
    const txt = fileBlocks.map(b => b.lines.join("\n")).join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Joined_STAs.txt";
    a.click();
  };

  return (
    <div className="sta-merge">
      <h1>📁 Station Files Join (Keep Original Format)</h1>
      <h3>Multiple .TXT files → auto rename duplicates (STA1 → STA1B)</h3>

      <div className="card">
        <input type="file" accept=".txt" multiple onChange={onFile} />
        <button onClick={clearAll} style={{ marginLeft: 8 }}>🧹 Clear</button>
        {info && <div className="msg">{info}</div>}
      </div>

      {/* Preview */}
      {fileBlocks.length > 0 && (
        <div className="card">
          <h3>Loaded Blocks ({fileBlocks.length})</h3>
          {fileBlocks.map((b, i) => (
            <details key={i} open>
              <summary>{b.name}</summary>
              <pre className="rawbox">{b.lines.join("\n")}</pre>
            </details>
          ))}
        </div>
      )}

      {/* Export */}
      {fileBlocks.length > 0 && (
        <div className="card">
          <button onClick={exportJoined}>📤 Export Joined File</button>
        </div>
      )}

      <footer className="footer">© 2025 WMK Seatrium DC Team</footer>
    </div>
  );
}