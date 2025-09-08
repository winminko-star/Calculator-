import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, onValue, remove, set as dbSet } from "firebase/database";
import { useNavigate } from "react-router-dom";

/* ---------- Shared small comps ---------- */
function TitleRow({ item, path }) {
  const [val, setVal] = useState(item.title || "");
  const [saving, setSaving] = useState(false);

  const saveTitle = async () => {
    setSaving(true);
    try {
      await dbSet(dbRef(db, `${path}/${item.id}/title`), val || "Untitled");
    } finally { setSaving(false); }
  };

  return (
    <div className="row" style={{ gap: 8 }}>
      <input className="input" placeholder="Title" value={val}
             onChange={(e)=>setVal(e.target.value)} style={{flex:"1 1 auto"}} />
      <button className="btn" onClick={saveTitle} disabled={saving}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </div>
  );
}

// simple canvas preview for tee templates
function drawTemplateOnCanvas(canvas, pts, title) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 180;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,W,H);

  // grid
  ctx.strokeStyle = "#e5e7eb";
  for (let x=0; x<W; x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for (let y=0; y<H; y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  if (!pts?.length) return;
  const minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x));
  const minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
  const pad=12, sx=(W-pad*2)/Math.max(1,(maxX-minX)), sy=(H-pad*2)/Math.max(1,(maxY-minY||1));
  const s=Math.min(sx,sy);
  const S = (p)=>({x: pad+(p.x-minX)*s, y: H-pad-(p.y-minY)*s});

  ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2;
  const p0=S(pts[0]); ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
  for(let i=1;i<pts.length;i++){ const p=S(pts[i]); ctx.lineTo(p.x,p.y); }
  ctx.stroke();

  ctx.fillStyle="#0f172a"; ctx.font="bold 13px system-ui";
  ctx.fillText(title, 8, 16);
}

/* ---------- Main page ---------- */
export default function AllReview() {
  const [drawings, setDrawings] = useState([]);      // from /drawings
  const [tees, setTees] = useState([]);              // from /teeTemplates
  const navigate = useNavigate();

  useEffect(() => {
    // drawings
    const un1 = onValue(dbRef(db, "drawings"), (snap) => {
      const now = Date.now(); const arr=[];
      snap.forEach((c)=>{
        const v=c.val(); const id=c.key;
        if (v.expiresAt && v.expiresAt<now) { remove(dbRef(db,`drawings/${id}`)); return; }
        arr.push({ id, ...v });
      });
      arr.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setDrawings(arr);
    });
    // tee templates
    const un2 = onValue(dbRef(db, "teeTemplates"), (snap) => {
      const now = Date.now(); const arr=[];
      snap.forEach((c)=>{
        const v=c.val(); const id=c.key;
        if (v.expiresAt && v.expiresAt<now) { remove(dbRef(db,`teeTemplates/${id}`)); return; }
        arr.push({ id, ...v });
      });
      arr.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setTees(arr);
    });
    return () => { un1(); un2(); };
  }, []);

  const del = async (path, id) => {
    if (!confirm("Delete this record?")) return;
    await remove(dbRef(db, `${path}/${id}`));
  };

  const openIn2D = (it) => {
    if (!it.state) {
      alert("This item has no raw data. Save again from 2D to enable editing.");
      return;
    }
    localStorage.setItem("wmk_restore", JSON.stringify(it.state));
    navigate("/drawing2d");
  };

  return (
    <div className="grid">
      {/* ===== 2D DRAWINGS ===== */}
      <div className="card">
        <div className="page-title">📁 All Saved 2D Drawings</div>
        {drawings.length===0 && <div className="small">No drawings yet.</div>}

        {drawings.map(it=>(
          <div key={it.id} className="card" style={{ padding:12, marginBottom:10 }}>
            <TitleRow item={it} path="drawings" />

            <div className="small" style={{ marginTop:6 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} ·
              {" "}{it.meta?.points ?? 0} pts · {it.meta?.lines ?? 0} lines · {it.meta?.triples ?? 0} ∠
            </div>

            <div className="row" style={{ marginTop:8 }}>
              <button className="btn" onClick={()=>openIn2D(it)}>✏️ Open in 2D</button>
              <button className="btn" onClick={()=>del("drawings", it.id)} style={{ background:"#ef4444" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ===== TEE TEMPLATES ===== */}
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>
        {tees.length===0 && <div className="small">No templates yet.</div>}

        {tees.map(it=>(
          <div key={it.id} className="card" style={{ padding:12, marginBottom:10 }}>
            <TitleRow item={it} path="teeTemplates" />

            <div className="small" style={{ marginTop:6 }}>
              {new Date(it.createdAt || Date.now()).toLocaleString()} ·
              {" "}Rb={it.inputs?.Rb} · Rr={it.inputs?.Rr} · θ={it.inputs?.deg}° · samples={it.inputs?.samples}
            </div>

            <div style={{ display:"grid", gap:10, marginTop:10 }}>
              <CanvasPreview title="Branch cut template" pts={it.data?.branch}/>
              <CanvasPreview title="Run hole template" pts={it.data?.run}/>
            </div>

            <div className="row" style={{ marginTop:8 }}>
              <button className="btn" onClick={()=>del("teeTemplates", it.id)} style={{ background:"#ef4444" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* preview canvas for tee card */
function CanvasPreview({ title, pts }) {
  const ref = useRef(null);
  useEffect(()=>{ drawTemplateOnCanvas(ref.current, pts||[], title); }, [pts, title]);
  return <canvas ref={ref} style={{ width:"100%", height:180, border:"1px solid #e5e7eb", borderRadius:12 }} />;
}
