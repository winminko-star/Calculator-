// src/pages/OwnerLogin.jsx
import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "../firebase";

export default function OwnerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    height: 48,           // မပုလွင်—ပုံမှန်အမြင့်
    fontSize: 16,
    padding: "10px 12px",
    width: "100%",        // 👈 အကျယ်ပြည့်
    boxSizing: "border-box",
    marginBottom: 12,
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuth(app);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      alert("✅ Logged in");
    } catch (err) {
      alert("❌ " + (err?.message || "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="container"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "#f8fafc",
      }}
    >
      <form
        onSubmit={handleLogin}
        className="card"
        style={{
          width: "100%",                // 👈 parent အကျယ်ပြည့်
          maxWidth: "min(640px, 96vw)", // 👈 ဘေးကိုရှည်—ဖုန်းမှာ 96vw, ကြီးတဲ့မျက်နှာပြင် 640px
          padding: 20,
          borderRadius: 14,
        }}
      >
        <div className="page-title" style={{ marginBottom: 16 }}>
          🔐 Owner Login
        </div>

        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          style={inputStyle}
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          type="submit"
          className="btn"
          disabled={loading}
          style={{ width: "100%", height: 48, fontSize: 16 }} // 👈 အကျယ်ပြည့်
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
