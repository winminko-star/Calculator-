import React, { useState } from "react";

export default function FloatingTriangleCalc() {
  const [facing, setFacing] = useState("");
  const [nearest, setNearest] = useState("");
  const [hypotenuse, setHypotenuse] = useState("");
  const [facingDegree, setFacingDegree] = useState("");
  const [nearestDegree, setNearestDegree] = useState("");

  const clearAll = () => {
    setFacing("");
    setNearest("");
    setHypotenuse("");
    setFacingDegree("");
    setNearestDegree("");
  };
  const toNumber = (value) => {
  if (value === "") return null;
  return parseFloat(value);
};

const round = (value) => {
  return Math.round(value * 10000) / 10000;
};const calculate = () => {
  const f = toNumber(facing);
  const n = toNumber(nearest);

  // Facing + Nearest
  if (f !== null && n !== null) {
    const h = Math.sqrt(f * f + n * n);

    setHypotenuse(round(h).toString());

    const fd = Math.atan(f / n) * 180 / Math.PI;
    const nd = 90 - fd;

    setFacingDegree(round(fd).toString());
    setNearestDegree(round(nd).toString());
  }
  const h = toNumber(hypotenuse);

// Facing + Hypotenuse
if (f !== null && h !== null && n === null) {

  if (h <= f) return;

  const newNearest = Math.sqrt(h * h - f * f);

  setNearest(round(newNearest).toString());

  const fd = Math.atan(f / newNearest) * 180 / Math.PI;

  setFacingDegree(round(fd).toString());
  setNearestDegree(round(90 - fd).toString());

  return;
}
};

  return (
    <div style={{ display: "grid", gap: 10 }}>

      <h3 style={{ margin: 0 }}>
        📐 Right Triangle Calculator
      </h3>

      <input
  type="number"
  placeholder="Facing"
  value={facing}
  onChange={(e) => {
    setFacing(e.target.value);
    
  }}
/>

      <input
  type="number"
  placeholder="Nearest"
  value={nearest}
  onChange={(e) => {
    setNearest(e.target.value);
    
  }}
/>

      <input
        type="number"
        placeholder="Hypotenuse"
        value={hypotenuse}
        onChange={(e) => setHypotenuse(e.target.value)}
      />

      <input
        type="number"
        placeholder="Facing Degree"
        value={facingDegree}
        onChange={(e) => setFacingDegree(e.target.value)}
      />

      <input
        type="number"
        placeholder="Nearest Degree"
        value={nearestDegree}
        onChange={(e) => setNearestDegree(e.target.value)}
      />

      <button onClick={clearAll}>
        Clear
      </button>

    </div>
  );
}
