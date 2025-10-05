// src/components/SingaporeWeatherFloating.jsx
import React, { useEffect, useState } from "react";
import "./SingaporeWeatherFloating.css";

export default function SingaporeWeatherFloating() {
  const [weather, setWeather] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current_weather=true"
        );
        const data = await res.json();
        setWeather(data.current_weather);
      } catch (err) {
        console.error("Failed to load weather:", err);
      }
    }
    fetchWeather();
  }, []);

  if (!weather) {
    return <div className="weather-floating small">⛅</div>;
  }

  // 10 conditions mapping
  const weatherMap = {
    0: { label: "☀️ Sunny", image: "/images/sunny.jpg" },
    1: { label: "🌤 Mostly Sunny", image: "/images/mostly_sunny.jpg" },
    2: { label: "⛅ Partly Cloudy", image: "/images/partly_cloudy.jpg" },
    3: { label: "☁️ Overcast", image: "/images/cloudy.jpg" },
    45: { label: "🌫 Foggy", image: "/images/foggy.jpg" },
    48: { label: "🌫 Dense Fog", image: "/images/dense_fog.jpg" },
    51: { label: "🌦 Light Drizzle", image: "/images/drizzle.jpg" },
    61: { label: "🌧 Rainy", image: "/images/rain.jpg" },
    71: { label: "🌨 Light Snow", image: "/images/snow.jpg" },
    95: { label: "⛈ Thunderstorm", image: "/images/storm.jpg" },
  };

  const scene = weatherMap[weather.weathercode] || {
    label: "🌤 Normal",
    image: "/images/default.jpg",
  };

  return (
    <>
      {/* Small Floating Icon */}
      {!expanded && (
        <div
          className="weather-floating small"
          onClick={() => setExpanded(true)}
          title="Show Singapore Weather"
        >
          {scene.label.split(" ")[0]} {/* emoji only */}
        </div>
      )}

      {/* Expanded Popup */}
      {expanded && (
        <div className="weather-floating expanded">
          <button className="close-btn" onClick={() => setExpanded(false)}>
            ×
          </button>
          <div className="weather-scene">
            <img src={scene.image} alt={scene.label} className="bg" />
            <div className="overlay">
              <div className="condition">{scene.label}</div>
              <div className="temp">{weather.temperature}°C</div>
              <div className="desc">Singapore Weather</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
