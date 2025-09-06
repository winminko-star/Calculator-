// src/pages/Drawing2D.jsx
import React, { useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

export default function Drawing2D() {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);
  const [triples, setTriples] = useState([]);

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPoints([...points, { x, y }]);
  };

  const draw = (ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "red";
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(`P${i + 1}`, p.x + 6, p.y - 6);
    });

    ctx.strokeStyle = "blue";
    lines.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const len = Math.hypot(a.x - b.x, a.y - b.y).toFixed(2);
      ctx.fillText(len, (a.x + b.x) / 2, (a.y + b.y) / 2);
    });

    triples.forEach(([a, b, c]) => {
      const ang =
        ((Math.atan2(c.y - b.y, c.x - b.x) -
          Math.atan2(a.y - b.y, a.x - b.x)) *
          180) /
        Math.PI;
      ctx.fillText(`${ang.toFixed(1)}°`, b.x + 10, b.y + 10);
    });
  };

  const saveToFirebase = async () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const tmp = document.createElement("canvas");
    tmp.width = cvs.width * 2;
    tmp.height = cvs.height * 2;
    const tctx = tmp.getContext("2d");
    tctx.scale(2, 2);
    tctx.drawImage(cvs, 0, 0);

    const dataUrl = tmp.toDataURL("image/png", 0.92);
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    await set(push(dbRef(db, "drawings")), {
      createdAt: now,
      expiresAt,
      dataUrl,
      meta: {
        points: points.length,
        lines: lines.length,
        triples: triples.length,
      },
    });
    alert("Saved to Firebase (DB only) ✅");
  };

  return (
    <div className="card">
      <div className="page-title">🧭 2D Drawing (E,N)</div>
      <canvas
        ref={canvasRef}
        width={500}
        height={400}
        style={{ border: "1px solid gray" }}
        onClick={handleCanvasClick}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={saveToFirebase}>
          💾 Save
        </button>
      </div>
      <RenderCanvas points={points} lines={lines} triples={triples} draw={draw} canvasRef={canvasRef} />
    </div>
  );
}

function RenderCanvas({ points, lines, triples, draw, canvasRef }) {
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx);
  }, [points, lines, triples, draw, canvasRef]);
  return null;
         }
