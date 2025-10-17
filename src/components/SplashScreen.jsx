// src/components/SplashScreen.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SplashScreen.css";

export default function SplashScreen() {
  const navigate = useNavigate();
  const circleRef = useRef(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const text = "SEATRIUM DC TEAM SINGAPORE • ";
    const chars = text.split("");
    const angleStep = 360 / chars.length;
    const radius = 160;
    const circle = circleRef.current;

    if (!circle) return;

    // clear (important for hot-reload)
    circle.innerHTML = "";

    chars.forEach((char, i) => {
      const letter = document.createElement("div");
      letter.className = `letter letter${(i % 28) + 1}`; // cycle colors if >28
      letter.textContent = char;

      const angleDeg = i * angleStep;
      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;

      letter.style.left = `calc(50% + ${x}px)`;
      letter.style.top = `calc(50% + ${y}px)`;
      letter.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
      letter.style.animationDelay = `${0.02 * i}s`;

      circle.appendChild(letter);
    });

    return () => {
      // cleanup DOM nodes if component unmounts
      if (circle) circle.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    // Start fade-out shortly before navigation so fade is visible
    const fadeStart = setTimeout(() => setFadeOut(true), 2800); // start fade at 2.8s
    const navTimer = setTimeout(() => navigate("/home"), 3500); // navigate at 3.5s

    return () => {
      clearTimeout(fadeStart);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  return (
    <div className={`splash-container ${fadeOut ? "fade-out" : ""}`}>
      <div className="win-badge" aria-hidden>
        {/* WIN badge SVG */}
        <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
            </filter>
            <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFD93D" stopOpacity="1" />
              <stop offset="100%" stopColor="#F6C445" stopOpacity="1" />
            </linearGradient>
          </defs>

          <path
            d="M 140,10 L 156,70 L 218,70 L 170,108 L 188,168 L 140,130 L 92,168 L 110,108 L 62,70 L 124,70 Z
               M 140,0 L 160,50 L 240,50 L 180,95 L 205,180 L 140,135 L 75,180 L 100,95 L 40,50 L 120,50 Z"
            fill="url(#starGradient)"
            filter="url(#shadow)"
          />
          <text
            x="140"
            y="155"
            fontFamily="Arial Black, sans-serif"
            fontSize="65"
            fontWeight="bold"
            fill="#E74C3C"
            textAnchor="middle"
            style={{ paintOrder: "stroke", stroke: "#C0392B", strokeWidth: 2 }}
          >
            WIN
          </text>
        </svg>
      </div>

      <div id="textCircle" ref={circleRef} />
    </div>
  );
                  }
