import React, { useState } from "react";
import './workflow.css';

export default function Step1Upload({ onDataLoaded }) {
  const [fileName, setFileName] = useState("");

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      const points = lines.map((line) => {
        const [id, x, y, z] = line.split(",").map(s => s.trim());
        return { id, x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) };
      });
      onDataLoaded(points);
    };
    reader.readAsText(file);
  };

  return (
    <div className="step-container">
      <h2>Step 1: Upload STA File</h2>
      <input type="file" accept=".txt,.csv" onChange={handleFile} />
      {fileName && <div>Selected file: {fileName}</div>}
    </div>
  );
}