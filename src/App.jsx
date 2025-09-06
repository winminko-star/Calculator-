import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Drawing2D from "./pages/Drawing2D";
import AllReview from "./pages/AllReview";
import AuthLogin from "./pages/AuthLogin";

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
      {user && <NavBar user={user} onLogout={() => signOut(auth)} />}
      <div className="container">
        <Routes>
          {/* login always accessible */}
          <Route path="/login" element={<AuthLogin />} />

          {/* after login → home page first */}
          <Route
            path="/"
            element={
              <Private user={user}>
                <Home />
              </Private>
            }
          />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
            }
