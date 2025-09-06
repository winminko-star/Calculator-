import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const go = (path) => () => navigate(path);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* top intro card removed for compact view */}

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <button className="card btn" onClick={go("/drawing2d")} style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🧭 2D Drawing (E,N)</div>
          <div className="small">Points • Lines (length) • Angle</div>
        </button>

        <button className="card btn" onClick={go("/review")} style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🗂️ All Review</div>
          <div className="small">Saved drawings • dates • auto cleanup</div>
        </button>

        <button className="card btn" onClick={go("/righttriangle")} style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>📐 Right Triangle</div>
          <div className="small">Hypotenuse, legs, angles…</div>
        </button>

        <button className="card btn" onClick={go("/circlecenter")} style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⭕ Circle Center</div>
          <div className="small">Center/Radius from points</div>
        </button>

        <button className="card btn" onClick={go("/levelling")} style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>📏 Levelling</div>
          <div className="small">Rise/Fall, RL, misclosure…</div>
        </button>
      </div>
    </div>
  );
}
