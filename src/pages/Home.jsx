// src/pages/Home.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SingaporeWeatherFloating from "../components/SingaporeWeatherFloating";
import CircleFit from "../components/CircleFit";

export default function Home() {
  const navigate = useNavigate();
  const [showCircle, setShowCircle] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const panelRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // --- Drag handlers ---
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const newX = e.clientX - offset.current.x;
      const newY = e.clientY - offset.current.y;
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => (dragging.current = false);

    const handleTouchMove = (e) => {
      if (!dragging.current) return;
      const touch = e.touches[0];
      const newX = touch.clientX - offset.current.x;
      const newY = touch.clientY - offset.current.y;
      setPosition({ x: newX, y: newY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  const startDrag = (e) => {
    dragging.current = true;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    offset.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
  };

  // --- Navigation Buttons ---
  const Btn = ({ icon, label, desc, to }) => (
    <button
      className="btn"
      onClick={() => navigate(to)}
      style={{
        display: "block",
        width: "100%",
        marginBottom: 12,
        textAlign: "left",
        borderRadius: 9999,
        padding: "12px 16px",
        background: "#0ea5e9",
        color: "#fff",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        {icon} {label}
      </div>
      {desc && <div className="small" style={{ color: "#e0f2fe" }}>{desc}</div>}
    </button>
  );

  return (
    <div className="container" style={{ marginTop: 16 }}>
      {/* quick style for rainbow text */}
      <style>{`
        .rainbowText{
          font-weight: 800;
          font-size: clamp(20px, 5vw, 32px);
          line-height: 1.2;
          text-align: center;
          background: linear-gradient(
            90deg,
            #ff004c, #ff7a00, #ffd400, #4cd964, #32a6ff, #7a5cff, #ff00e6, #ff004c
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: rainbowMove 4s linear infinite;
          letter-spacing: .3px;
          margin-top: 10px;
        }
        @keyframes rainbowMove {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .photoCard{
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:16px;
          padding:10px;
          margin-top:18px;
          box-shadow: 0 6px 20px rgba(15,23,42,.06);
        }
        .heroImg{
          width:100%;
          height:auto;
          display:block;
          border-radius:12px;
          object-fit:cover;
        }
      `}</style>

      {/* Navigation Buttons */}
      <Btn icon="🧭" label="2D Drawing (E,N)" desc="Points • Lines (length) • Angle" to="/drawing2d" />
      <Btn icon="📂" label="2D Review" desc="Saved drawings • dates • auto cleanup" to="/review" />
      <Btn icon="📐" label="Right Triangle" desc="Hypotenuse, legs, angles…" to="/righttriangle" />
      <Btn icon="⭕" label="Circle Center" desc="Center/Radius from points" to="/circlecenter" />
      <Btn icon="📏" label="Levelling" desc="Rise/Fall, RL, misclosure…" to="/levelling" />
      <Btn icon="📝" label="Levelling Review" desc="Saved levelling results" to="/levelling-review" />
      <Btn icon="🧮" label="Simple Calculator" desc="Big keys • one decimal • clean UI" to="/simple-calc" />

      {/* --- Photo + rainbow message footer --- */}
      <div className="photoCard">
        <img src="/couple.jpg" alt="Two people smiling outdoors" className="heroImg" />
        <SingaporeWeatherFloating />
        <div className="rainbowText">
          Someone who loves you is waiting for you. So work safely.
          <h4>Created by Win Min Ko (Seatrium DC Team).</h4>
        </div>
      </div>

      {/* --- Floating Draggable CircleFit Panel --- */}
      <button
        onClick={() => setShowCircle(!showCircle)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg transition-all z-50"
      >
        ⚙️ {showCircle ? "Hide Circle Fit" : "Show Circle Fit"}
      </button>

      {showCircle && (
        <div
          ref={panelRef}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 1000,
            touchAction: "none",
          }}
          className="bg-white rounded-2xl shadow-2xl border p-4 w-[340px] max-h-[90vh] overflow-auto cursor-move select-none"
        >
          <h2 className="text-lg font-semibold mb-2 text-gray-700 flex justify-between items-center">
            🔵 Circle Fit
            <button
              onClick={() => setShowCircle(false)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              ✖
            </button>
          </h2>
          <CircleFit />
        </div>
      )}
    </div>
  );
        }
