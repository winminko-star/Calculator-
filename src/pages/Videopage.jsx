import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase";
import "../index.css";

export default function Videopage() {
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const correctPassword = "169496";

  /* ✅ Load all videos from Firebase Storage */
  const fetchVideos = async () => {
    const folderRef = ref(storage, "videos/");
    const result = await listAll(folderRef);
    const items = await Promise.all(
      result.items.map(async (itemRef) => {
        const downloadURL = await getDownloadURL(itemRef);
        return { title: itemRef.name.replace(".mp4", ""), src: downloadURL };
      })
    );
    setVideos(items.reverse()); // latest first
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handlePlay = (ref) => {
    document.querySelectorAll("video").forEach((v) => {
      if (v !== ref) v.pause();
    });
  };

  const handlePassword = () => {
    if (password === correctPassword) {
      setAuthorized(true);
      alert("✅ Access Granted!");
    } else {
      alert("❌ Wrong password!");
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim())
      return alert("⚠️ Please enter a title & choose a file!");

    const fileRef = ref(storage, `videos/${title}.mp4`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);

    setUrl(downloadURL);
    alert("🎉 Uploaded successfully!");
    setFile(null);
    setTitle("");
    fetchVideos(); // auto refresh video list
  };

  const handleDelete = async (videoTitle) => {
    if (!authorized) return alert("🚫 You must be authorized to delete!");
    const confirm = window.confirm(`🗑 Delete "${videoTitle}"?`);
    if (!confirm) return;

    const fileRef = ref(storage, `videos/${videoTitle}.mp4`);
    await deleteObject(fileRef)
      .then(() => {
        alert("✅ Deleted successfully!");
        fetchVideos(); // refresh list
      })
      .catch((error) => {
        console.error("❌ Delete failed:", error);
        alert("❌ Error deleting file!");
      });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    alert("📋 Video link copied!");
  };

  return (
    <div className="cartoon-page" style={{ padding: "20px" }}>
      <h2
        className="rainbow-title"
        style={{ textAlign: "center", marginBottom: "20px" }}
      >
        🎬 Video Collection
      </h2>

      {/* ✅ Back Button */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          🔙 Back to Home
        </button>
      </div>

      {/* ✅ Video Grid */}
      <div
        className="cartoon-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        {videos.map((video, index) => (
          <div
            key={index}
            className="cartoon-box"
            style={{
              backgroundColor: "#fff",
              borderRadius: "10px",
              padding: "10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              textAlign: "center",
            }}
          >
            <h4>{video.title}</h4>
            <video
              width="100%"
              height="200"
              controls
              controlsList="nodownload"
              ref={(ref) => {
                if (ref) ref.onplay = () => handlePlay(ref);
              }}
            >
              <source src={video.src} type="video/mp4" />
              Your browser does not support video playback.
            </video>
            {authorized && (
              <button
                onClick={() => handleDelete(video.title)}
                style={{
                  marginTop: 8,
                  backgroundColor: "#e74c3c",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                🗑 Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ✅ Upload Section */}
      <div
        style={{
          marginTop: 40,
          padding: 20,
          borderTop: "2px solid #ddd",
          textAlign: "center",
        }}
      >
        <h3>🔐 Admin Upload Section</h3>

        {!authorized ? (
          <>
            <p>Enter password to unlock upload panel:</p>
            <input
              type="password"
              value={password}
              placeholder="Enter password"
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ccc",
                marginRight: 8,
              }}
            />
            <button onClick={handlePassword}>Enter</button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ccc",
                marginBottom: 10,
                width: "90%",
              }}
            />
            <br />
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ marginBottom: 10 }}
            />
            <br />
            <button onClick={handleUpload}>⬆️ Upload Video</button>

            {url && (
              <div style={{ marginTop: 20 }}>
                <video
                  src={url}
                  controls
                  width="300"
                  style={{ borderRadius: 8 }}
                />
                <div style={{ marginTop: 10 }}>
                  <input
                    type="text"
                    value={url}
                    readOnly
                    style={{
                      width: "90%",
                      padding: 8,
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      marginBottom: 8,
                    }}
                  />
                  <button onClick={copyLink}>📋 Copy Link</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
         }
