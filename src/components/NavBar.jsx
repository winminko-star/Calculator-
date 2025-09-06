import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function NavBar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="header">
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>WMK Calc</strong>
          <nav className="nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/drawing2d">2D Drawing</NavLink>
            <NavLink to="/review">All Review</NavLink>
            <NavLink to="/righttriangle">Right Triangle</NavLink>
            <NavLink to="/circlecenter">Circle Center</NavLink>
            <NavLink to="/levelling">Levelling</NavLink>

            {user ? (
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  try {
                    await onLogout?.();
                  } finally {
                    navigate("/login", { replace: true });
                  }
                }}
                style={{ marginLeft: 8 }}
              >
                Logout
              </button>
            ) : (
              <NavLink to="/login">Login</NavLink>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
