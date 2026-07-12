import React, { useEffect, useState } from "react";

export default function FloatingTriangleCalc() {
  const [facing, setFacing] = useState("");
  const [nearest, setNearest] = useState("");
  const [hypotenuse, setHypotenuse] = useState("");
  const [facingDeg, setFacingDeg] = useState("");
  const [nearestDeg, setNearestDeg] = useState("");
  const toNum = (v) => (v === "" ? null : Number(v));

const round = (v) => Math.round(v * 10000) / 10000;
  useEffect(() => {
  const f = toNum(facing);
  const n = toNum(nearest);

  if (f !== null && n !== null && hypotenuse === "") {
    const h = Math.sqrt(f * f + n * n);

    setHypotenuse(round(h).toString());

    const fd = Math.atan(f / n) * 180 / Math.PI;
    const nd = 90 - fd;

    setFacingDeg(round(fd).toString());
    setNearestDeg(round(nd).toString());
  }
    const h = toNum(hypotenuse);

if (f !== null && h !== null && nearest === "" && h > f) {

  const n2 = Math.sqrt(h * h - f * f);

  setNearest(round(n2).toString());

  const fd = Math.atan(f / n2) * 180 / Math.PI;
  const nd = 90 - fd;

  setFacingDeg(round(fd).toString());
  setNearestDeg(round(nd).toString());

}

}, [facing, nearest]);

  return (
    <div style={{ display: "grid", gap: 10 }}>

      <h3 style={{ margin: 0 }}>📐 Right Triangle Calculator</h3>

      <input
        type="number"
        placeholder="Facing"
        value={facing}
        onChange={(e) => setFacing(e.target.value)}
      />

      <input
        type="number"
        placeholder="Nearest"
        value={nearest}
        onChange={(e) => setNearest(e.target.value)}
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
        value={facingDeg}
        onChange={(e) => setFacingDeg(e.target.value)}
      />

      <input
        type="number"
        placeholder="Nearest Degree"
        value={nearestDeg}
        onChange={(e) => setNearestDeg(e.target.value)}
      />

      <button
        onClick={() => {
          setFacing("");
          setNearest("");
          setHypotenuse("");
          setFacingDeg("");
          setNearestDeg("");
        }}
      >
        Clear
      </button>

    </div>
  );
}
