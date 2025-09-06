import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL || "winminthuzar1@gmail.com";

export default function AuthLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/";

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (email.trim().toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
        setErr("This app is for the owner only.");
        setBusy(false);
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pw);
      if (cred.user.email?.toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
        await signOut(auth);
        setErr("Unauthorized user.");
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <div className="page-title">🔐 Owner Login</div>
        <form onSubmit={onSubmit} className="grid">
          <input className="input" type="email" placeholder={you@example.com} value={email} onChange={(e)=>setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={pw} onChange={(e)=>setPw(e.target.value)} required />
          {err && <div className="small" style={{ color: "#b91c1c" }}>{err}</div>}
          <button className="btn" disabled={busy}>{busy ? "Please wait…" : "Login"}</button>
        </form>
      </div>
    </div>
  );
          }
