import React, { useEffect, useState } from "react";
import "./SingaporeWeatherFloating.css";

export default function SingaporeWeatherFloating() {
  const [weather, setWeather] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const apiKey = "c3afb98f45a0557918efe65941e0639f"; // ✅ your key
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=1.3521&lon=103.8198&units=metric&appid=${apiKey}`;
        const res = await fetch(url);
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

  const main = weather.weather[0].main;
  const temp = Math.round(weather.main.temp);

  const condition =
    {
      Clear: { label: "☀️ Sunny", image: "/images/sunny.jpg" },
      Clouds: { label: "☁️ Cloudy", image: "/images/cloudy.jpg" },
      Rain: { label: "🌧 Rainy", image: "/images/rain.jpg" },
      Drizzle: { label: "🌦 Light Rain", image: "/images/drizzle.jpg" },
      Thunderstorm: { label: "⛈ Storm", image: "/images/storm.jpg" },
      Mist: { label: "🌫 Misty", image: "/images/foggy.jpg" },
      Haze: { label: "🌫 Hazy", image: "/images/foggy.jpg" },
    }[main] || { label: "🌤 Normal", image: "/images/default.jpg" };

  return (
    <>
      {/* Floating mini icon */}
      {!expanded && (
        <div
          className="weather-floating small"
          onClick={() => setExpanded(true)}
          title="Show Singapore Weather"
        >
          {condition.label.split(" ")[0]}
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="weather-floating expanded">
          <button className="close-btn" onClick={() => setExpanded(false)}>
            ×
          </button>
          <div className="weather-scene">
            <img src={condition.image} alt={condition.label} className="bg" />
            <div className="overlay">
              <div className="condition">{condition.label}</div>
              <div className="temp">{temp}°C</div>
              <div className="desc">{weather.weather[0].description}</div>
              <div className="desc">Singapore Weather</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
