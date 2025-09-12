// src/components/NavBar.jsx
import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";

export default function NavBar({ user, onLogout }) {
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="header" style={{ padding: 8 }}>
      <div className="container" style={{ padding: 0 }}>
        {/* Brand + Logout */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong style={{ fontSize: 16 }}>WMK Calc</strong>

          {user && (
            <button
              className="btn"
              style={{
                height: 36,
                padding: "0 12px",
                background: "#ef4444",
              }}
              onClick={async () => {
                try {
                  await onLogout?.();
                } finally {
                  navigate("/login", { replace: true });
                }
              }}
            >
              Logout
            </button>
          )}
        </div>

        {/* Navigation Chips */}
        <nav
          className="nav"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
            paddingTop: 8,
          }}
        >
          <Chip to="/" label="Home" />
          <Chip to="/drawing2d" label="2D Drawing" />
          <Chip to="/review" label="2D Review" />
          <Chip to="/righttriangle" label="Right Triangle" />
          <Chip to="/circlecenter" label="Circle Center" />
          <Chip to="/levelling" label="Levelling" />
          <Chip to="/levelling-review" label="Levelling Review" /> 
          <Chip to="/simple-calc" label="Simple Calc" />
          <Chip to="/circlearc" label="Circle Arc" />
          <Chip to="/enh-calc" label="ENH Changer" />
          <Chip to="/enh-tie" label="ENH Tie" />
          <Chip to="/enh-canvas" label="ENH Canvas" />
          <Chip to="/enh-review" label="ENH Review" />
          <Chip to="/pipe-ends-slope" label="Pipe Ends Slope" />
          <Chip to="/notepad" label="Note Pad" />
          
          
         </nav>
      </div>
    </div>
  );
}

function Chip({ to, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "inline-block",
        padding: "8px 12px",
        borderRadius: 9999,
        border: "1px solid #e5e7eb",
        background: isActive ? "#0ea5e9" : "#f1f5f9",
        color: isActive ? "#fff" : "#0f172a",
        fontWeight: 600,
        textDecoration: "none",
        flex: "0 0 auto",
      })}
      end={to === "/"}
    >
      {label}
    </NavLink>
  );
              }
