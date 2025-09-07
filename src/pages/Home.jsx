// src/pages/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const Btn = ({ icon, label, desc, to }) => (
    <button
      className="btn"
      onClick={() => navigate(to)}
      style={{
        display: "block",
        width: "100%",
        marginBottom: 12,
        textAlign: "left",
        borderRadius: 9999,
        padding: "12px 16px",
        background: "#0ea5e9",
        color: "#fff",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        {icon} {label}
      </div>
      {desc && <div className="small" style={{ color: "#e0f2fe" }}>{desc}</div>}
    </button>
  );

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <Btn
        icon="🧭"
        label="2D Drawing (E,N)"
        desc="Points • Lines (length) • Angle"
        to="/drawing2d"
      />
      <Btn
        icon="📂"
        label="All Review"
        desc="Saved drawings • dates • auto cleanup"
        to="/review"
      />
      <Btn
        icon="📐"
        label="Right Triangle"
        desc="Hypotenuse, legs, angles…"
        to="/righttriangle"
      />
      <Btn
        icon="⭕"
        label="Circle Center"
        desc="Center/Radius from points"
        to="/circlecenter"
      />
      <Btn
        icon="📏"
        label="Levelling"
        desc="Rise/Fall, RL, misclosure…"
        to="/levelling"
      />
      {/* New: Levelling Review */}
      <Btn
        icon="📝"
        label="Levelling Review"
        desc="Saved levelling results"
        to="/levelling-review"
      />
      <Btn
  icon="🧮"
  label="Simple Calculator"
  desc="Big keys • one decimal • clean UI"
  to="/simple-calc"
/>
    </div>
  );
      }
