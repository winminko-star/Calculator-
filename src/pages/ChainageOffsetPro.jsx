// src/pages/StationFilesJoin.jsx
// 💡 Station Files Join by Win Min Ko
import React, { useState } from "react";
import "./StationMerge.css"; // reuse existing style

export default function StationFilesJoin() {
  const [groups, setGroups] = useState({});
  const [info, setInfo] = useState("");

  // === Multiple file upload ===
  const onFile = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let allGroups = { ...groups };

    for (const f of files) {
      const text = await f.text();
      const parsed = parseSTAFile(text, f.name);
      allGroups = { ...allGroups, ...parsed };
    }

    setGroups(allGroups);
    setInfo(`✅ Loaded ${files.length} file(s)`);
  };

  // === Parse STA file, auto suffix if same group already exists ===
  const parseSTAFile = (text, fileName) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    let current = "";
    let out = {};
    const suffix = fileName.replace(/\.[^.]+$/, ""); // use filename as tag

    lines.forEach((ln) => {
      if (/^STA/i.test(ln.trim())) {
        // detect STA header line
        let name = ln.trim();
        if (out[name] || groups[name]) {
          name = `${name}_${suffix}`; // rename only STA name
        }
        current = name;
        out[current] = [];
      } else {
        const p = ln.trim().split(/[\s,]+/);
        if (p.length >= 4 && current) {
          // ✅ Keep E, N, H exactly as in original file
          out[current].push({
            name: p[0],
            E: p[1],
            N: p[2],
            H: p[3],
          });
        }
      }
    });
    return out;
  };

  const clearAll = () => {
    setGroups({});
    setInfo("Cleared all groups");
  };

  return (
    <div className="sta-merge">
      <h1>📁 Station Files Join</h1>
      <h3>Upload multiple .TXT files (auto-rename STA if duplicated)</h3>

      {/* Upload */}
      <div className="card">
        <label>
          Choose Files:
          <input
            type="file"
            accept=".txt"
            multiple
            onChange={onFile}
            style={{ marginLeft: 8 }}
          />
        </label>
        <button onClick={clearAll} style={{ marginLeft: 8 }}>
          🧹 Clear
        </button>
        {info && <div className="msg">{info}</div>}
      </div>

      {/* Group preview */}
      {Object.keys(groups).length > 0 && (
        <div className="card">
          <h3>Loaded Groups ({Object.keys(groups).length})</h3>
          {Object.entries(groups).map(([g, pts]) => (
            <details key={g} className="sta-card" open>
              <summary>
                {g} <small>({pts.length} pts)</small>
              </summary>
              <table className="result">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>E</th>
                    <th>N</th>
                    <th>H</th>
                  </tr>
                </thead>
                <tbody>
                  {pts.map((p, i) => (
                    <tr key={i}>
                      <td>{p.name}</td>
                      <td>{p.E}</td>
                      <td>{p.N}</td>
                      <td>{p.H}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}

      {/* Export */}
      {Object.keys(groups).length > 0 && (
        <div className="card">
          <button
            onClick={() => {
              const txt = Object.entries(groups)
                .map(([g, pts]) => {
                  const header = g;
                  const body = pts
                    .map((p) => `${p.name}\t${p.E}\t${p.N}\t${p.H}`)
                    .join("\n");
                  return `${header}\n${body}`;
                })
                .join("\n\n");

              const blob = new Blob([txt], {
                type: "text/plain;charset=utf-8",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "Joined_STAs.txt";
              a.click();
            }}
          >
            📤 Export Joined File
          </button>
        </div>
      )}

      <footer className="footer">© 2025 WMK Seatrium DC Team</footer>
    </div>
  );
}