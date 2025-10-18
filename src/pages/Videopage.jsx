// src/pages/Videopage.jsx
import React, { useRef, useState } from "react";
import "./Videopage.css";

const videos = [
  { id: 1, src: "/videos/numbersBaby1.mp4", title: "Numbers" },
  { id: 2, src: "/videos/video2.mp4", title: "Amazing Video 2" },
  { id: 3, src: "/videos/video3.mp4", title: "Amazing Video 3" },
  { id: 4, src: "/videos/video4.mp4", title: "Amazing Video 4" },
  { id: 5, src: "/videos/video5.mp4", title: "Amazing Video 5" },
];

export default function Videopage() {
  const videoRefs = useRef([]);
  const [search, setSearch] = useState("");
  const [playingIdx, setPlayingIdx] = useState(null);

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
      // iOS Safari
      videoEl.webkitEnterFullscreen();
    }
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
            >
              <video
                ref={(el) => (videoRefs.current[idx] = el)}
                src={video.src}
                controls
                playsInline
                preload="metadata"
                poster="/videos/video-poster.jpg"
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
            <button
              className="fullscreen-btn"
              onClick={() => toggleFullscreen(idx)}
            >
              ⛶ Fullscreen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
              }
