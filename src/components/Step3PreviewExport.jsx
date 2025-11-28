import React from "react";
import './workflow.css';

export default function Step3PreviewExport({ points }) {
  const downloadTXT = () => {
    const text = points.map(p=>`${p.id},${p.x},${p.y},${p.z.toFixed(3)}`).join("\n");
    const blob = new Blob([text],{type:"text/plain"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="STA_ENH_Updated.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="step-container">
      <h2>Step 3: Preview & Export</h2>
      <table className="preview-table">
        <thead><tr><th>ID</th><th>X</th><th>Y</th><th>Z (ENH)</th></tr></thead>
        <tbody>
          {points.map((p,i)=><tr key={i}><td>{p.id}</td><td>{p.x}</td><td>{p.y}</td><td>{p.z.toFixed(3)}</td></tr>)}
        </tbody>
      </table>
      <button onClick={downloadTXT} style={{marginTop:12}}>Download TXT</button>
    </div>
  );
}