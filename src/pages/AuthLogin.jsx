import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

const ALLOWED = import.meta.env.VITE_ALLOWED_EMAIL; // UI မှာ မပြ — စစ်ရန်ပဲ

export default function AuthLogin() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (ALLOWED && email.trim().toLowerCase() !== ALLOWED.trim().toLowerCase()) {
      setErr("This account is not allowed.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch {
      setErr("Incorrect email or password.");
    }
  };

  return (
    <div className="grid" style={{ minHeight: "70vh", placeItems: "center" }}>
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <div className="page-title">🔐 Owner Login</div>

        <form onSubmit={onSubmit} className="grid" style={{ gap: 8 }}>
          <input
            className="input"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"   // ✅ string!
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          {err && (
            <div className="small" style={{ color: "#b91c1c" }}>{err}</div>
          )}

          <button className="btn" type="submit" style={{ width: "100%", marginTop: 6 }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
      }
