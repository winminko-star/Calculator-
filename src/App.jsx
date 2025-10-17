// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";

import SplashScreen from "./components/SplashScreen";
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
import NotePad from "./pages/NotePad";
import Notepad2 from "./pages/Notepad2";
import CanvasENH from "./pages/CanvasENH";
import ENHReview from "./pages/ENHReview";
import PipeEndsSlopePage from "./pages/PipeEndsSlope.jsx";
import FlangeOnAxisPage from "./pages/FlangeOnAxis.jsx";
import FloatingCalc from "./components/FloatingCalc";
import FloatingCircleCalc from "./components/FloatingCircleCalc";
import ChainageOffsetPro from "./pages/ChainageOffsetPro";
import StationMerge from "./pages/StationMerge";

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Splash screen 3s
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Lock portrait
  useEffect(() => {
    const tryLock = async () => {
      if (screen.orientation?.lock) {
        try {
          await screen.orientation.lock("portrait");
        } catch {}
      }
    };
    tryLock();
    window.addEventListener("orientationchange", tryLock);
    return () => window.removeEventListener("orientationchange", tryLock);
  }, []);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) return <div className="container">Loading…</div>;

  return (
    <BrowserRouter>
      {showSplash ? (
        <SplashScreen />
      ) : (
        <>
          {user && <NavBar user={user} onLogout={() => signOut(auth)} />}
          <FloatingCalc />
          <FloatingCircleCalc />

          <div className="container">
            <Routes>
              {/* Login: if already authed, go home */}
              <Route
                path="/login"
                element={!user ? <AuthLogin /> : <Navigate to="/" replace />}
              />

              {/* Protected routes */}
              <Route
                path="/"
                element={user ? <Home /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/drawing2d"
                element={user ? <Drawing2D /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/review"
                element={user ? <AllReview /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/righttriangle"
                element={user ? <RightTriangle /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/circlecenter"
                element={user ? <CircleCenter /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/levelling"
                element={user ? <Levelling /> : <Navigate to="/login" replace />}
              />

              {/* Public pages */}
              <Route path="/levelling-review" element={<LevellingReview />} />
              <Route path="/simple-calc" element={<SimpleCalc />} />
              <Route path="/circlearc" element={<CircleArc />} />
              <Route path="/enh-calc" element={<ENHCalc />} />
              <Route path="/notepad" element={<NotePad />} />
              <Route path="/notepad2" element={<Notepad2 />} />
              <Route path="/enh-tie" element={<ENHTie />} />
              <Route path="/enh-canvas" element={<CanvasENH />} />
              <Route path="/enh-review" element={<ENHReview />} />
              <Route path="/pipe-ends-slope" element={<PipeEndsSlopePage />} />
              <Route path="/flange-on-axis" element={<FlangeOnAxisPage />} />
              <Route path="/chainage-offset-pro" element={<ChainageOffsetPro />} />
              <Route path="/station-merge" element={<StationMerge />} />

              {/* Fallback */}
              <Route
                path="*"
                element={<Navigate to={user ? "/" : "/login"} replace />}
              />
            </Routes>
          </div>
        </>
      )}
    </BrowserRouter>
  );
                             }
