// src/pages/AuthLogin.jsx
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const ALLOWED = import.meta.env.VITE_ALLOWED_EMAIL;

export default function AuthLogin() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);

    try {
      if (
        ALLOWED &&
        email.trim().toLowerCase() !== ALLOWED.trim().toLowerCase()
      ) {
        throw new Error("This account is not allowed.");
      }
      await signInWithEmailAndPassword(auth, email, pw);
      navigate("/", { replace: true });
    } catch (e) {
      setErr(
        e?.message === "This account is not allowed."
          ? e.message
          : "Incorrect email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 12px",
        background: "#f8fafc", // very light bg to make card stand out
      }}
    >
      <form
        onSubmit={onSubmit}
        className="card"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 20,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.07)",
          display: "grid",
          gap: 10,
        }}
      >
        <div className="page-title" style={{ marginBottom: 4 }}>
          🔐 Owner Login
        </div>

        <input
          className="input"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ height: 44 }}
        />

        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ height: 44 }}
        />

        {ALLOWED && (
          <div className="small" style={{ color: "#64748b" }}>
            Allowed: <b>{ALLOWED}</b>
          </div>
        )}

        {err && (
          <div className="small" style={{ color: "#b91c1c", fontWeight: 700 }}>
            {err}
          </div>
        )}

        <button
          className="btn"
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            height: 44,
            background: "#0ea5e9",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
        }
