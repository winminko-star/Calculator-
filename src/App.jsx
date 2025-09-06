// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import AuthLogin from "./pages/AuthLogin";
import Home from "./pages/Home";
import Drawing2D from "./pages/Drawing2D";
import AllReview from "./pages/AllReview";
import RightTriangle from "./pages/RightTriangle";
import CircleCenter from "./pages/CircleCenter";
import Levelling from "./pages/Levelling";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useEffect, useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); });
    return () => unsub();
  }, []);

  if (!ready) return null; // or a tiny loader

  return (
    <BrowserRouter>
      {user && <NavBar user={user} onLogout={() => signOut(auth)} />}
      <div className="container">
        <Routes>
          {/* Login: user ရှိထားရင် Home သို့ သွား */}
          <Route path="/login" element={!user ? <AuthLogin /> : <Navigate to="/" replace />} />

          {/* Protected routes */}
          <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
          <Route path="/drawing2d" element={user ? <Drawing2D /> : <Navigate to="/login" replace />} />
          <Route path="/review" element={user ? <AllReview /> : <Navigate to="/login" replace />} />
          <Route path="/righttriangle" element={user ? <RightTriangle /> : <Navigate to="/login" replace />} />
          <Route path="/circlecenter" element={user ? <CircleCenter /> : <Navigate to="/login" replace />} />
          <Route path="/levelling" element={user ? <Levelling /> : <Navigate to="/login" replace />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
