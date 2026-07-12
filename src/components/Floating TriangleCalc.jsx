import React from "react";

export default function FloatingTriangleCalc() {
  return (
    <div style={{ padding: 15 }}>
      <h3>📐 Right Triangle Calculator</h3>

      <div style={{ display: "grid", gap: 10 }}>
        <input type="number" placeholder="Facing" />

        <input type="number" placeholder="Nearest" />

        <input type="number" placeholder="Hypotenuse" />

        <input type="number" placeholder="Facing Degree" />

        <input type="number" placeholder="Nearest Degree" />
      </div>
    </div>
  );
}
