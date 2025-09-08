import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set } from "firebase/database";

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

// clamp helper
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 0..360 ° normalize
const normDeg = (d) => ((d % 360) + 360) % 360;

// linear interpolate on [{deg,y}]
function yAtDeg(profile, deg) {
  const d = normDeg(deg);
  for (let i = 0; i < profile.length; i++) {
    if (Math.abs(profile[i].deg - d) < 1e-9) return profile[i].y;
  }
  let a = profile[0], b = profile[profile.length - 1];
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].deg >= d) { b = profile[i]; a = profile[i - 1]; break; }
  }
  const t = (d - a.deg) / ((b.deg - a.deg) || 1);
  return a.y + (b.y - a.y) * t;
}

/* -------------------------------------------------------
   “Math” – demo model to get two profiles from OD + OD + angle
   (သင့်စမ်းသပ်/အစားထိုးအတွက်သာ – သင့်နည်းလမ်းရှိရင် အပျက်အလွန် ဒီကောင်ကို
   ကိုယ့်နည်းနဲ့ပြောင်းပါ)
------------------------------------------------------- */
function computeProfiles(runOD, branchOD, angleDeg) {
  const Rr = runOD / 2;     // run radius (mm)
  const Rb = branchOD / 2;  // branch radius (mm)
  const th = (angleDeg * Math.PI) / 180; // radians

  // sample 0..360 deg (step 1°)
  const N = 361;
  const branch = [];
  const run = [];

  for (let d = 0; d <= 360; d++) {
    // demo-ish formulae:
    // branch end saddle height ~ intersection wave
    //   hb(φ) ≈ Rr * cos(φ) * sin(th)  (shifted upwards so min is 0)
    // run hole outline axial offset ~ Rb * cos(φ) * sin(th)
    const phi = (d * Math.PI) / 180;
    const hb = Rr * Math.cos(phi) * Math.sin(th);
    const hr = Rb * Math.cos(phi) * Math.sin(th);

    branch.push({ deg: d, y: hb });
    run.push({ deg: d, y: hr });
  }

  // shift so lowest = 0 (cut/offset တန်ဖိုးတွေ အပြော အနိမ့်ဆုံးက အဆင်ပြေ)
  const minB = Math.min(...branch.map(p => p.y));
  const minR = Math.min(...run.map(p => p.y));
  branch.forEach(p => p.y -= minB);
  run.forEach(p => p.y -= minR);

  return { branch, run };
}

/* -------------------------------------------------------
   Canvas drawers with 30° ticks and numeric labels (no unit text)
------------------------------------------------------- */
function drawUnwrapWithTicks(ctx, W, H, pad, profile, title) {
  ctx.clearRect(0, 0, W, H);

  // domain (deg) → x, value (mm) → y
  const X = (deg) => pad + (deg / 360) * (W - 2 * pad);
  const ys = profile.map(p => p.y);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const Y = (y) => pad + (ymax - y) * ((H - 2 * pad) / Math.max(1e-6, ymax - ymin || 1));

  // faint grid every 30°
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 360; g += 30) {
    const x = X(g);
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
  }

  // curve
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  profile.forEach((p, i) => {
    const x = X(p.deg), y = Y(p.y);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // ticks + labels (every 30°)
  ctx.font = "bold 12px system-ui";
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#94a3b8";
  for (let g = 0; g <= 360; g += 30) {
    const x = X(g);
    const yVal = yAtDeg(profile, g);
    const y = Y(yVal);

    // tick from baseline to curve
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, H - pad); ctx.lineTo(x, y); ctx.stroke();

    // value label (numeric only)
    const txt = (Math.round(yVal * 100) / 100).toString();
    ctx.fillText(txt, x + 4, y - 6);

    // angle label at baseline
    ctx.fillText(`${g}°`, x - 8, H - pad + 14);
  }

  // baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

  // title
  if (title) {
    ctx.font = "600 13px system-ui";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(title, pad, pad - 6);
  }
}

/* -------------------------------------------------------
   Component
------------------------------------------------------- */
export default function CircleTee() {
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState("200");
  const [branchOD, setBranchOD] = useState("50");
  const [angle, setAngle] = useState("35");  // deg

  // recompute profiles when inputs change
  const profiles = useMemo(() => {
    const ro = clamp(parseFloat(runOD) || 0, 1, 999999);
    const bo = clamp(parseFloat(branchOD) || 0, 1, 999999);
    const ang = clamp(parseFloat(angle) || 0, 0, 180);
    return computeProfiles(ro, bo, ang);
  }, [runOD, branchOD, angle]);

  // canvases
  const branchRef = useRef(null);
  const runRef = useRef(null);

  // draw on mount/resize/inputs
  useEffect(() => {
    const DPR = window.devicePixelRatio || 1;

    function draw() {
      const cvsB = branchRef.current;
      const cvsR = runRef.current;
      if (!cvsB || !cvsR) return;

      const wB = cvsB.clientWidth, hB = cvsB.clientHeight;
      const wR = cvsR.clientWidth, hR = cvsR.clientHeight;
      cvsB.width = Math.floor(wB * DPR); cvsB.height = Math.floor(hB * DPR);
      cvsR.width = Math.floor(wR * DPR); cvsR.height = Math.floor(hR * DPR);

      const ctxB = cvsB.getContext("2d"); ctxB.setTransform(DPR, 0, 0, DPR, 0, 0);
      const ctxR = cvsR.getContext("2d"); ctxR.setTransform(DPR, 0, 0, DPR, 0, 0);

      drawUnwrapWithTicks(ctxB, wB, hB, 16, profiles.branch, "Branch cut template");
      drawUnwrapWithTicks(ctxR, wR, hR, 16, profiles.run, "Run hole template");
    }

    draw();
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(draw, 80); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, [profiles]);

  /* -------- Save to Firebase (Title + params + 30° samples) -------- */
  const onSave = async () => {
    // sample every 30°
    const samples = Array.from({ length: 13 }, (_, i) => i * 30); // 0..360
    const branch30 = samples.map(d => ({ deg: d, y: +(yAtDeg(profiles.branch, d).toFixed(3)) }));
    const run30    = samples.map(d => ({ deg: d, y: +(yAtDeg(profiles.run, d).toFixed(3)) }));

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    await set(push(dbRef(db, "teeTemplates")), {
      createdAt: now,
      expiresAt,
      type: "pipe-tee",
      title: title || "Untitled",
      params: {
        runOD: +(parseFloat(runOD) || 0),
        branchOD: +(parseFloat(branchOD) || 0),
        angleDeg: +(parseFloat(angle) || 0),
      },
      // lightweight result to replay/print later
      result: {
        branch30,   // [{deg, y}, ...] (mm, but UI မတွဲရေးပါ)
        run30
      }
    });

    alert("Saved ✅ (Review မှာပြန်ကြည့်နိုင်ပါပြီ)");
  };

  const onClear = () => {
    setTitle("");
    setRunOD("");
    setBranchOD("");
    setAngle("");
  };

  const onUpdate = () => {
    // nothing special—inputs already trigger redraw
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="page-title">🧩 Pipe Tee Templates</div>

        <div className="grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />

          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Run OD" value={runOD} onChange={e => setRunOD(e.target.value)} />

          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Branch OD" value={branchOD} onChange={e => setBranchOD(e.target.value)} />

          <input className="input" type="number" inputMode="decimal" step="any"
                 placeholder="Angle (deg)" value={angle} onChange={e => setAngle(e.target.value)} />

          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn" onClick={onUpdate}>↻ Update</button>
            <button className="btn" onClick={onSave} style={{ background: "#0ea5e9" }}>💾 Save</button>
            <button className="btn" onClick={onClear} style={{ background: "#64748b" }}>🧹 Clear</button>
          </div>
        </div>
      </div>

      {/* Canvas: Branch template */}
      <div className="card">
        <div className="page-title">Branch cut template</div>
        <canvas ref={branchRef} style={{ width: "100%", height: 240, display: "block", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }} />
      </div>

      {/* Canvas: Run template */}
      <div className="card">
        <div className="page-title">Run hole template</div>
        <canvas ref={runRef} style={{ width: "100%", height: 240, display: "block", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }} />
      </div>
    </div>
  );
                        }
