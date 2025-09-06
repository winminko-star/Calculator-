levellingreviewingreview React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const Btn = ({ icon, label, desc, to }) => (
    <button
      className="btn"
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
      onClick={() => navigate(to)}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 12, opacity: 0.9 }}>{desc}</div>
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
      {/* ➕ New Review Button for Levelling */}
<Btn
  icon="📝"
  label="Levelling Review"
  desc="Saved levelling results"
  to="/levelling-review"   // ✅ hyphen ပါ
/>
    </div>
  );
}
