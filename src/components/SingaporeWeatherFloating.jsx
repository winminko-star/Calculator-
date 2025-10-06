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
          `https://api.openweathermap.org/data/2.5/weather?lat=1.3521&lon=103.8198&appid=c3afb98f45a0557918efe65941e0639f&units=metric`
        );
        const data = await res.json();
        setWeather(data);
      } catch (err) {
        console.error("Failed to load weather:", err);
      }
    }
    fetchWeather();
  }, []);

  if (!weather) {
    return <div className="weather-floating small">⛅</div>;
  }

  // OpenWeatherMap Weather Codes Mapping
  const weatherCode = weather.weather?.[0]?.id || 800;
  const main = weather.weather?.[0]?.main || "Clear";

  let scene = { label: "☀️ Sunny", image: "/images/sunny.jpg" };

  if (weatherCode >= 200 && weatherCode < 300)
    scene = { label: "⛈ Thunderstorm", image: "/images/storm.jpg" };
  else if (weatherCode >= 300 && weatherCode < 400)
    scene = { label: "🌦 Drizzle", image: "/images/drizzle.jpg" };
  else if (weatherCode >= 500 && weatherCode < 600)
    scene = { label: "🌧 Rainy", image: "/images/rain.jpg" };
  else if (weatherCode >= 600 && weatherCode < 700)
    scene = { label: "🌨 Snowy", image: "/images/snow.jpg" };
  else if (weatherCode >= 700 && weatherCode < 800)
    scene = { label: "🌫 Foggy", image: "/images/foggy.jpg" };
  else if (weatherCode === 800)
    scene = { label: "☀️ Clear Sky", image: "/images/sunny.jpg" };
  else if (weatherCode > 800 && weatherCode <= 802)
    scene = { label: "⛅ Partly Cloudy", image: "/images/partly_cloudy.jpg" };
  else if (weatherCode > 802)
    scene = { label: "☁️ Overcast", image: "/images/cloudy.jpg" };

  return (
    <>
      {/* Small Floating Icon */}
      {!expanded && (
        <div
          className="weather-floating small"
          onClick={() => setExpanded(true)}
          title="Show Singapore Weather"
        >
          {scene.label.split(" ")[0]}
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
              <div className="temp">{weather.main.temp}°C</div>
              <div className="desc">
                {weather.weather?.[0]?.description || main}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
    }
