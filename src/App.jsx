// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import AuthLogin from "./pages/AuthLogin";
import Drawing2D from "./pages/Drawing2D";
import AllReview from "./pages/AllReview";
import RightTriangle from "./pages/RightTriangle";
import CircleCenter from "./pages/CircleCenter";
import Levelling from "./pages/Levelling";
import LevellingReview from "./pages/LevellingReview";
import SimpleCalc from "./pages/SimpleCalc";
import CircleArc from "./pages/CircleArc";
import ENHCalc from "./pages/ENHCalc";
import ENHTie from "./pages/ENHTie";


export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);
    });
    return () => unsub();
  }, []);

  // ← ဒီကောက်ချက်টাই မင်းမေးတာ
  if (!ready) {
    return <div className="container">Loading…</div>; // null ပြန်မပို့တော့
  }

  return (
    <BrowserRouter>
      {user && <NavBar user={user} onLogout={() => signOut(auth)} />}
      <div className="container">
        <Routes>
          {/* Login page: login ထဲကနေ အစောင့်အောင် user ရှိရင် Home သို့ */}
          <Route path="/login" element={!user ? <AuthLogin /> : <Navigate to="/" replace />} />

          {/* Protected routes */}
          <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
          <Route path="/drawing2d" element={user ? <Drawing2D /> : <Navigate to="/login" replace />} />
          <Route path="/review" element={user ? <AllReview /> : <Navigate to="/login" replace />} />
          <Route path="/righttriangle" element={user ? <RightTriangle /> : <Navigate to="/login" replace />} />
          <Route path="/circlecenter" element={user ? <CircleCenter /> : <Navigate to="/login" replace />} />
          <Route path="/levelling" element={user ? <Levelling /> : <Navigate to="/login" replace />} />
          <Route path="/levelling-review" element={<LevellingReview />} />
          <Route path="/simple-calc" element={<SimpleCalc />} />
          <Route path="/circlearc" element={<CircleArc />} />
          <Route path="/enh-calc" element={<ENHCalc />} />
          <Route path="/enh-tie" element={<ENHTie />} />
          

          {/* fallback */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
          }
