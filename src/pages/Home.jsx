import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const go = (path) => () => navigate(path);

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🏠 Home</div>
        <p className="small">Choose a calculator/tool from below:</p>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        <button className="card btn" onClick={go("/drawing2d")}>
          🧭 2D Drawing
        </button>
        <button className="card btn" onClick={go("/review")}>
          🗂️ All Review
        </button>
        <button className="card btn" onClick={() => alert("Coming soon")}>
          🧮 Scientific Calc
        </button>
        <button className="card btn" onClick={() => alert("Coming soon")}>
          📐 Right Triangle
        </button>
      </div>
    </div>
  );
    }
