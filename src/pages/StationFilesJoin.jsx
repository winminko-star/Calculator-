// src/pages/StationFilesJoin.jsx
import React, { useState } from "react";
import "./StationMerge.css";

export default function StationFilesJoin() {
  const [fileBlocks, setFileBlocks] = useState([]);
  const [info, setInfo] = useState("");

  const onFile = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    let blocks = [...fileBlocks];
    let staCount = {};

    for (const f of files) {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(Boolean);

      let current = "";
      let group = [];
      for (let ln of lines) {
        if (/^STA/i.test(ln.trim())) {
          // Save previous STA block
          if (current && group.length) {
            blocks.push({ name: current, lines: group });
          }

          const parts = ln.trim().split(",");
          const baseName = parts[0];
          staCount[baseName] = (staCount[baseName] || 0) + 1;

          // ✅ rename both header name + inside header line
          let newName = baseName;
          if (staCount[baseName] > 1) newName = `${baseName}B`;
          parts[0] = newName; // change the STA header itself
          const renamedHeader = parts.join(",");

          current = newName;
          group = [renamedHeader];
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

  const clearAll = () => {
    setFileBlocks([]);
    setInfo("🧹 Cleared all data");
  };

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

      {fileBlocks.length > 0 && (
        <div className="card">
          <button onClick={exportJoined}>📤 Export Joined File</button>
        </div>
      )}

      <footer className="footer">© 2025 WMK Seatrium DC Team</footer>
    </div>
  );
}