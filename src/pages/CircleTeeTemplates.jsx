import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

// ---------- math helpers ----------
const deg2rad = d => (d * Math.PI) / 180;

// equal-pipe (ODs တူ) Intersection profile (unwrap):
// u = R * t    , v_run = R * (1 - cos(θ) * cos(t))
// v_branch = R * (1 - cos(t))   (branch pipe ကို အနံကို ဖြတ်သွားတဲ့ template)
function makeProfiles({ runOD, branchOD, angleDeg, stepDeg = 15 }) {
  const Rr = runOD / 2;           // run radius (mm)
  const Rb = branchOD / 2;        // branch radius (mm)
  const θ  = deg2rad(angleDeg);   // angle between axes

  const steps = Math.max(4, Math.round(360 / stepDeg));
  const tList = Array.from({ length: steps + 1 }, (_, i) => deg2rad(i * stepDeg));

  // Unwrap width = circumference = 2πRr
  const width = 2 * Math.PI * Rr;

  // Run-hole template (wrap on RUN) -> depth from outside surface
  const run = tList.map(t => ({
    u: Rr * t,                                  // along circumference (mm)
    v: Math.max(0, Rr - (Rr * Math.cos(θ) * Math.cos(t))), // penetration depth
    deg: (t * 180) / Math.PI
  }));

  // Branch-cut template (wrap on BRANCH) -> cut back distance
  const branch = tList.map(t => ({
    u: Rb * t,
    v: Math.max(0, Rb - (Rb * Math.cos(t))),   // classic mitre cut
    deg: (t * 180) / Math.PI
  }));

  // Stations (deg labels)
  const stations = tList.map(t => ({
    uRun: Rr * t,
    vRun: Math.max(0, Rr - (Rr * Math.cos(θ) * Math.cos(t))),
    uBranch: Rb * t,
    vBranch: Math.max(0, Rb - (Rb * Math.cos(t))),
    deg: (t * 180) / Math.PI
  }));

  return { run, branch, widthRun: width, widthBranch: 2 * Math.PI * Rb, stations };
}

// ---------- drawing helpers ----------
function drawDimTemplate(canvas, pts, stations, opts) {
  if (!canvas) return;
  const { title, widthMm, label = "u(mm)", valueLabel = "v(mm)" } = opts;

  // setup
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 260;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  if (!pts?.length) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("No data", 12, 18);
    return;
  }

  // margins
  const padL = 42, padR = 16, padT = 28, padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // domain
  const minU = 0, maxU = widthMm;
  const minV = 0, maxV = Math.max(5, Math.max(...pts.map(p => p.v)));

  const X = u => padL + ((u - minU) * plotW) / (maxU - minU || 1);
  const Y = v => padT + plotH - ((v - minV) * plotH) / (maxV - minV || 1);

  // grid vertical every 30°
  const stepU = widthMm / 12;
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let u = minU; u <= maxU + 1e-6; u += stepU) {
    ctx.beginPath();
    ctx.moveTo(X(u), padT);
    ctx.lineTo(X(u), padT + plotH);
    ctx.stroke();
  }
  // border
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(padL, padT, plotW, plotH);

  // curve
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(X(pts[0].u), Y(pts[0].v));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i].u), Y(pts[i].v));
  ctx.stroke();

  // dimensions (station lines + numbers)
  ctx.fillStyle = "#0f172a";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";

  stations.forEach((st, i) => {
    const u = X(st.uRun ?? st.uBranch); // whichever template we’re drawing
    // station line
    ctx.strokeStyle = "rgba(2,6,23,0.15)";
    ctx.beginPath();
    ctx.moveTo(u, padT + plotH);
    ctx.lineTo(u, padT + plotH + 10);
    ctx.stroke();
    // baseline (u mm)
    ctx.fillText(String(Math.round((st.uRun ?? st.uBranch))), u, padT + plotH + 22);

    // v dimension — hide ~0
    const v = (st.vRun ?? st.vBranch);
    if (v > 0.5) {
      const yCurve = Y(v);
      // arrow
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(u, padT + plotH);
      ctx.lineTo(u, yCurve);
      ctx.stroke();
      // head
      ctx.beginPath();
      ctx.moveTo(u - 4, yCurve + 6);
      ctx.lineTo(u, yCurve);
      ctx.lineTo(u + 4, yCurve + 6);
      ctx.stroke();

      // value pill
      const text = String(Math.round(v));
      const tw = Math.ceil(ctx.measureText(text).width) + 8;
      const x = u, y = yCurve - 10, h = 18, r = 8;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.strokeStyle = "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(x - tw / 2 + r, y - h);
      ctx.lineTo(x + tw / 2 - r, y - h);
      ctx.quadraticCurveTo(x + tw / 2, y - h, x + tw / 2, y - h + r);
      ctx.lineTo(x + tw / 2, y - r);
      ctx.quadraticCurveTo(x + tw / 2, y, x + tw / 2 - r, y);
      ctx.lineTo(x - tw / 2 + r, y);
      ctx.quadraticCurveTo(x - tw / 2, y, x - tw / 2, y - r);
      ctx.lineTo(x - tw / 2, y - h + r);
      ctx.quadraticCurveTo(x - tw / 2, y - h, x - tw / 2 + r, y - h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.fillText(text, x, y - 4);
    }
  });

  // axes labels
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 14px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(title, padL, 20);

  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, padL + plotW / 2, H - 6);

  ctx.save();
  ctx.translate(14, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(valueLabel, 0, 0);
  ctx.restore();
}

// ---------- main component ----------
export default function CircleTeeDim() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("");       // mm
  const [branchOD, setBranchOD] = useState(""); // mm
  const [deg, setDeg] = useState("90");         // overlap angle
  const [step, setStep] = useState("15");       // station every N deg

  const cRun = useRef(null);
  const cBranch = useRef(null);

  // live draw
  useEffect(() => {
    const R = parseFloat(runOD), B = parseFloat(branchOD);
    const A = parseFloat(deg), S = parseFloat(step) || 15;
    if (!isFinite(R) || !isFinite(B) || !isFinite(A)) {
      // clear canvases
      [cRun.current, cBranch.current].forEach(cv => {
        if (!cv) return;
        const ctx = cv.getContext("2d");
        ctx && ctx.clearRect(0,0,cv.width,cv.height);
      });
      return;
    }
    const prof = makeProfiles({ runOD: R, branchOD: B, angleDeg: A, stepDeg: S });
    drawDimTemplate(
      cRun.current,
      prof.run,
      prof.stations,
      { title: "Run hole template (wrap on RUN)", widthMm: prof.widthRun }
    );
    drawDimTemplate(
      cBranch.current,
      prof.branch,
      prof.stations.map(s=>({ uBranch:s.uBranch, vBranch:s.vBranch })), // map for branch
      { title: "Branch cut template (wrap on BRANCH)", widthMm: prof.widthBranch }
    );
  }, [runOD, branchOD, deg, step]);

  const clearAll = () => { setTitle(""); setRunOD(""); setBranchOD(""); setDeg("90"); setStep("15"); };

  const save = async () => {
    const R = parseFloat(runOD), B = parseFloat(branchOD);
    const A = parseFloat(deg), S = parseFloat(step) || 15;
    if (!isFinite(R) || !isFinite(B) || !isFinite(A)) { alert("Fill all numbers first."); return; }
    const prof = makeProfiles({ runOD: R, branchOD: B, angleDeg: A, stepDeg: S });

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    await set(push(dbRef(db, "teeTemplates")), {
      createdAt: now, expiresAt,
      title: title || "Untitled",
      inputs: { runOD: R, branchOD: B, deg: A, stepDeg: S },
      run: prof.run, branch: prof.branch,
      stations: prof.stations
    });
    alert("Saved ✅");
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates (with dimensions)</div>

        <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />

        <div className="row">
          <input className="input" placeholder="Run OD" value={runOD} onChange={e=>setRunOD(e.target.value)} />
          <input className="input" placeholder="Branch OD" value={branchOD} onChange={e=>setBranchOD(e.target.value)} />
        </div>

        <div className="row">
          <input className="input" placeholder="Angle (deg)" value={deg} onChange={e=>setDeg(e.target.value)} />
          <input className="input" placeholder="Station step (deg, e.g. 15)" value={step} onChange={e=>setStep(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={save}>💾 Save</button>
          <button className="btn" onClick={clearAll} style={{ background: "#64748b" }}>🧹 Clear</button>
        </div>
      </div>

      <div className="card">
        <canvas ref={cRun} style={{ width: "100%", height: 260, border: "1px solid #e5e7eb", borderRadius: 12 }} />
      </div>

      <div className="card">
        <canvas ref={cBranch} style={{ width: "100%", height: 260, border: "1px solid #e5e7eb", borderRadius: 12 }} />
      </div>

      <div className="card small">
        Usage:  တစ်ခုချင်းကို print → စက္ကူကို pipe ပတ်ပြီး  
        - **Run hole template** ကို run ပိုက်ပေါ်မှာပတ်ပြီး station line တွေနှင့် **v(mm)** အတိုင်းအတာအထိ ခြစ်/မှတ်ပြီး ဖောက်ပါ။  
        - **Branch cut template** ကို branch ပိုက်အဆုံးမှာပတ်ပြီး **v(mm)** အတိုင်းအတာအထိ ဖြတ်ပါ။  
        Note: label တွေမှာ mm မရေးပဲ နံပါတ်ပဲပြထားပါတယ်။
      </div>
    </div>
  );
    }
