// src/components/Step4Download.jsx
import React from "react";
import "./workflow.css";

export default function Step4Download({ data = [], onReset }) {
  const downloadTXT = () => {
    const text = data.map(p => `${p.id},${p.x},${p.y},${(p.z ?? "").toFixed ? p.z.toFixed(3) : p.z}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "STA_ENH_Final.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "STA_ENH_Final.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h3>Step 4 — Download final ENH</h3>
      <div style={{ marginBottom: 12 }}>
        <button onClick={downloadTXT} style={{ marginRight: 8 }}>Download TXT</button>
        <button onClick={downloadJSON}>Download JSON</button>
      </div>
      {onReset && <button onClick={onReset} style={{ marginTop: 8 }}>Reset Workflow</button>}
    </div>
  );
}