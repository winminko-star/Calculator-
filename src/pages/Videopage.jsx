// src/pages/Videopage.jsx
import React, { useRef, useState } from "react";
import "./Videopage.css";

const videos = [
  { id: 1, src: "/videos/numbersBaby1.mp4", poster: "/videos/NumbersBaby1.jpg", title: "Numbers" },
  { id: 2, src: "/videos/video2.mp4", poster: "/videos/video2.jpg", title: "Amazing Video 2" },
  { id: 3, src: "/videos/video3.mp4", poster: "/videos/video3.jpg", title: "Amazing Video 3" },
  { id: 4, src: "/videos/video4.mp4", poster: "/videos/video4.jpg", title: "Amazing Video 4" },
  { id: 5, src: "/videos/video5.mp4", poster: "/videos/video5.jpg", title: "Amazing Video 5" },
];

export default function Videopage() {
  const videoRefs = useRef([]);
  const [search, setSearch] = useState("");
  const [playingIdx, setPlayingIdx] = useState(null);
  const [rotation, setRotation] = useState({}); // key: idx, value: deg

  const handlePlay = (id, idx) => {
    videoRefs.current.forEach((video, vIdx) => {
      if (video && videos[vIdx].id !== id) {
        video.pause();
      }
    });
    setPlayingIdx(idx);
  };

  const toggleFullscreen = (idx) => {
    const videoEl = videoRefs.current[idx];
    if (videoEl.requestFullscreen) {
      videoEl.requestFullscreen();
    } else if (videoEl.webkitEnterFullscreen) {
      videoEl.webkitEnterFullscreen();
    }
  };

  const rotateVideo = (idx) => {
    const current = rotation[idx] || 0;
    const next = (current + 90) % 360;
    setRotation({ ...rotation, [idx]: next });
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="video-page">
      <h1 className="video-page-title">🎬 Our Special Videos</h1>

      <div className="video-search">
        <input
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="video-grid">
        {filteredVideos.map((video, idx) => (
          <div key={video.id} className="video-card">
            <div
              className={`video-wrapper ${playingIdx === idx ? "playing" : ""}`}
              onClick={() => videoRefs.current[idx]?.play()}
              style={{
                transform: `rotate(${rotation[idx] || 0}deg)`,
                transition: "transform 0.3s ease",
              }}
            >
              <video
                ref={(el) => (videoRefs.current[idx] = el)}
                src={video.src}
                poster={video.poster || "/videos/video-poster.jpg"} // <--- video-specific poster
                controls
                playsInline
                preload="metadata"
                className="video-element"
                onPlay={() => handlePlay(video.id, idx)}
              />
              {playingIdx !== idx && (
                <div className="play-overlay">
                  <span>▶</span>
                </div>
              )}
            </div>

            <div className="video-title">{video.title}</div>

            <div className="video-buttons">
              <button
                className="fullscreen-btn"
                onClick={() => toggleFullscreen(idx)}
              >
                ⛶ Fullscreen
              </button>
              <button
                className="rotate-btn"
                onClick={() => rotateVideo(idx)}
              >
                🔄 Rotate
              </button>
            </div>
          </div>
        ))}
      </div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
          }
