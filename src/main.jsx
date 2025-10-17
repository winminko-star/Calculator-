import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// ⏳ Optional: Hide splash after 4 seconds
setTimeout(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) splash.style.display = "none";
}, 4000);
