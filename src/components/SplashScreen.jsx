// src/components/SplashScreen.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SplashScreen.css";

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/"), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => {
    const text = "SEATRIUM DC TEAM SINGAPORE • ";
    const circle = document.getElementById("textCircle");
    const radius = 150; // WIN badge အလယ်ကို pivot
    const chars = text.split('');
    const angleStep = 360 / chars.length;

    chars.forEach((char, i) => {
      const letter = document.createElement("div");
      letter.className = `letter letter${i + 1}`;
      letter.textContent = char;

      // angle starts at bottom (270deg)
      const angle = i * angleStep - 90;
      const rad = angle * (Math.PI / 180);
      const x = radius * Math.cos(rad);
      const y = radius * Math.sin(rad);

      letter.style.left = `calc(50% + ${x}px)`;
      letter.style.top = `calc(50% + ${y}px)`;
      letter.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`; // bottom pivot

      circle.appendChild(letter);
    });
  }, []);

  return (
    <div className="splash-container">
      <div className="win-badge">
        <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3"/>
            </filter>
            <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#FFD93D', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#F6C445', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path d="M140,10 L156,70 L218,70 L170,108 L188,168 L140,130 L92,168 L110,108 L62,70 L124,70 Z
                   M140,0 L160,50 L240,50 L180,95 L205,180 L140,135 L75,180 L100,95 L40,50 L120,50 Z"
                fill="url(#starGradient)" filter="url(#shadow)" />
          <text x="140" y="155"
                fontFamily="Arial Black, sans-serif"
                fontSize="65"
                fontWeight="bold"
                fill="#E74C3C"
                textAnchor="middle"
                style={{ paintOrder: "stroke", stroke: "#C0392B", strokeWidth: 2 }}>
            WIN
          </text>
        </svg>
      </div>
      <div id="textCircle"></div>
    </div>
  );
    }
