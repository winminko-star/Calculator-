// src/components/NavBar.jsx
import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function NavBar({ user, onLogout }) {
  const navigate = useNavigate();

  const routes = [
    { to: "/", label: "Home" },
    { to: "/station-merge", label: "Station Merge" },
    { to: "/chainage-offset-pro", label: "Chainage Offset Pro" },
    { to: "/drawing2d", label: "2D Drawing" },
    { to: "/review", label: "2D Review" },
    { to: "/righttriangle", label: "Right Triangle" },
    { to: "/circlecenter", label: "Circle Center" },
    { to: "/levelling", label: "Levelling" },
    { to: "/levelling-review", label: "Levelling Review" },
    { to: "/simple-calc", label: "Simple Calc" },
    { to: "/circlearc", label: "Circle Arc" },
    { to: "/enh-calc", label: "ENH Changer" },
    { to: "/enh-tie", label: "ENH Tie" },
    { to: "/enh-canvas", label: "ENH Canvas" },
    { to: "/enh-review", label: "ENH Review" },
    { to: "/pipe-ends-slope", label: "Pipe Ends Slope" },
    { to: "/flange-on-axis", label: "Flange On Axis" },
    { to: "/notepad", label: "Note Pad" },
  ];

  const homeRoute = routes[0];
  const otherRoutes = routes.slice(1);

  // state for visible routes
  const [visibleRoutes, setVisibleRoutes] = useState([]);
  const [showSelector, setShowSelector] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("nav_visible_routes");
    if (saved) {
      setVisibleRoutes(JSON.parse(saved));
    } else {
      // default: all visible
      setVisibleRoutes(otherRoutes.map((r) => r.to));
    }
  }, []);

  // Save to localStorage whenever visibleRoutes changes
  useEffect(() => {
    localStorage.setItem("nav_visible_routes", JSON.stringify(visibleRoutes));
  }, [visibleRoutes]);

  const toggleRoute = (routeTo) => {
    setVisibleRoutes((prev) =>
      prev.includes(routeTo)
        ? prev.filter((r) => r !== routeTo)
        : [...prev, routeTo]
    );
  };

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
          {/* Home အမြဲပြ */}
          <Chip to={homeRoute.to} label={homeRoute.label} />

          {/* show selected buttons */}
          {otherRoutes
            .filter((r) => visibleRoutes.includes(r.to))
            .map((r) => (
              <Chip key={r.to} to={r.to} label={r.label} />
            ))}

          {/* control button */}
          <button
            onClick={() => setShowSelector((prev) => !prev)}
            style={{
              padding: "8px 12px",
              borderRadius: 9999,
              border: "1px solid #e5e7eb",
              background: "#fbbf24",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            ⚙ Select
          </button>
        </nav>

        {/* Selector panel */}
        {showSelector && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#f9fafb",
            }}
          >
            <strong>Choose Buttons to Show:</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {otherRoutes.map((r) => (
                <label key={r.to} style={{ padding: 4, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={visibleRoutes.includes(r.to)}
                    onChange={() => toggleRoute(r.to)}
                  />{" "}
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        )}
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
