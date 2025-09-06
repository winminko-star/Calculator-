import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Drawing2D from "./pages/Drawing2D";
import AllReview from "./pages/AllReview";
import AuthLogin from "./pages/AuthLogin";

// New pages
import RightTriangle from "./pages/RightTriangle";
import CircleCenter from "./pages/CircleCenter";
import Levelling from "./pages/Levelling";

// simple route guard
function Private({ user, children }) {
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <>
      {/* Login မပြီးသေးရင် Navbar မပြ */}
      {user && <NavBar user={user} onLogout={() => signOut(auth)} />}

      <div className="container">
        <Routes>
          {/* Login အမြဲလမ်းလ麼 */}
          <Route path="/login" element={<AuthLogin />} />

          {/* Login အောင်ရင် Home ကို ပထမဆုံး မြင် */}
          <Route
            path="/"
            element={
              <Private user={user}>
                <Home />
              </Private>
            }
          />

          {/* Tools (all private) */}
          <Route
            path="/drawing2d"
            element={
              <Private user={user}>
                <Drawing2D />
              </Private>
            }
          />
          <Route
            path="/review"
            element={
              <Private user={user}>
                <AllReview />
              </Private>
            }
          />
          <Route
            path="/righttriangle"
            element={
              <Private user={user}>
                <RightTriangle />
              </Private>
            }
          />
          <Route
            path="/circlecenter"
            element={
              <Private user={user}>
                <CircleCenter />
              </Private>
            }
          />
          <Route
            path="/levelling"
            element={
              <Private user={user}>
                <Levelling />
              </Private>
            }
          />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
            }
