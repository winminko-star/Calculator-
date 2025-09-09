// src/pages/TeeStencil.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { ref as dbRef, push, set as dbSet } from "firebase/database";

/**
 * Pipe Tee — Paper Wrap Stencils (Run-hole & Branch-cut)
 * - Canvas 2 ခု: Run ကိုပတ်ရေးမယ့် "hole outline", Branch ကိုပတ်ဖြတ်မယ့် "fish-mouth outline"
 * - Degree အလိုက် Height(mm) စာရင်းကို Table ထုတ်ပေးတယ်
 * - Pitch/Yaw သက်ရောက်မှု "အမြဲ" ထည့်တွက်ထားတယ်
 * - Save → /teeTemplates (AllReview.jsx နောက်ဆုံးဗားရှင်းနှင့် ပေါင်းသုံးနိုင်)
 */

export default function TeeStencil() {
  /* ------------ Inputs ------------ */
  const [title, setTitle] = useState("");
  const [runOD, setRunOD] = useState(60);        // mm
  const [branchOD, setBranchOD] = useState(50);  // mm
  const [pitchDeg, setPitchDeg] = useState(90);  // ° (90 = စံ Tee)
  const [yawDeg, setYawDeg] = useState(0);       // ° (wrap direction phase)
  const [stepDeg, setStepDeg] = useState(30);    // ° (30°/15° စသည်)

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const toRad = (d) => (d * Math.PI) / 180;
  const round1 = (v) => Math.round(v * 100) / 100;

  /* ------------ Core calc (Pitch/Yaw always applied) ------------ */
  const data = useMemo(() => {
    const Rr = Math.max(1e-6, runOD / 2);
    const Rb = Math.max(1e-6, branchOD / 2);
    const pitch = toRad(pitchDeg);
    const yaw = toRad(yawDeg);

    // stations (0..360, ensure 360 included)
    const degs = [];
    const step = clamp(Math.abs(stepDeg || 30), 3, 90);
    for (let d = 0; d < 360; d += step) degs.push(Math.round(d));
    if (degs[degs.length - 1] !== 360) degs.push(360);

    // amplitude with pitch (0..1), phase with yaw
    const amp = Math.max(0, Math.sin(pitch)); // 0° -> 0 opening, 90° -> max
    const hRun = []; // wrap on RUN (hole)
    const hBr  = []; // wrap on BRANCH (cut)

    degs.forEach((deg) => {
      const t = toRad(deg) - yaw;     // phase shift with yaw
      const lobe = Math.abs(Math.cos(t)); // symmetric around 0/180

      // RUN stencil height (max Rb)
      const hOnRun = clamp(Rb * amp * lobe, 0, Rb);

      // BRANCH stencil height (max Rr)
      const fish = Math.abs(Math.cos(t)) * amp;
      const hOnBr = clamp(Rr * fish, 0, Rr);

      hRun.push({ deg, h: hOnRun }); // mm
      hBr.push({ deg, h: hOnBr });   // mm
    });

    const runC = Math.PI * runOD;
    const brC = Math.PI * branchOD;

    // stations for AllReview preview (u along circumference, v = height)
    const stations = degs.map((deg, i) => {
      const uRun = (deg / 360) * runC;
      const uBranch = (deg / 360) * brC;
      return {
        deg,
        uRun,
        vRun: hRun[i].h,
        uBranch,
        vBranch: hBr[i].h,
      };
    });

    // points (u,v) arrays for AllReview drawUnwrapPreview()
    const runPts = hRun.map((p) => ({ u: (p.deg / 360) * runC, v: p.h }));
    const brPts  = hBr.map((p) => ({ u: (p.deg / 360) * brC, v: p.h }));

    return {
      degs,
      hRun,
      hBr,
      runC,
      brC,
      stations,
      runPts,
      brPts,
      pitchDeg,
      yawDeg,
      step,
    };
  }, [runOD, branchOD, pitchDeg, yawDeg, stepDeg]);

  /* ------------ Canvas drawing ------------ */
  const cRunRef = useRef(null);
  const cBrRef = useRef(null);

  useEffect(() => {
    drawStencilCanvas(
      cRunRef.current,
      data.hRun,
      runOD,
      `Run-hole stencil — Pitch ${data.pitchDeg}°, Yaw ${data.yawDeg}°`
    );
    drawStencilCanvas(
      cBrRef.current,
      data.hBr,
      branchOD,
      `Branch-cut stencil — Pitch ${data.pitchDeg}°, Yaw ${data.yawDeg}°`
    );
  }, [data, runOD, branchOD]);

  /* ------------ Save to Firebase (/teeTemplates) ------------ */
  const onSave = async () => {
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    const payload = {
      createdAt: now,
      expiresAt,
      title: title || "Untitled",
      inputs: {
        runOD,
        branchOD,
        pitch: pitchDeg,
        yaw: yawDeg,
        samples: data.degs.length,
        stepDeg: data.step,
      },
      // For AllReview.jsx (latest)
      run: data.runPts,        // [{u,v}...]
      branch: data.brPts,      // [{u,v}...]
      stations: data.stations, // [{deg,uRun,vRun,uBranch,vBranch}...]
    };

    await dbSet(push(dbRef(db, "teeTemplates")), payload);
    alert("Saved ✅");
  };

  const onClear = () => {
    setTitle("");
    setRunOD(60);
    setBranchOD(50);
    setPitchDeg(90);
    setYawDeg(0);
    setStepDeg(30);
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Controls */}
      <div className="card" style={{ padding: 12 }}>
        <div className="page-title">🧩 Pipe Tee — Paper Wrap Stencils</div>

        <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: "1 1 220px" }} />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="Run OD (mm)" value={runOD} onChange={(e) => setRunOD(+e.target.value || 0)} />
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="Branch OD (mm)" value={branchOD} onChange={(e) => setBranchOD(+e.target.value || 0)} />
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="Pitch (°)" value={pitchDeg} onChange={(e) => setPitchDeg(+e.target.value || 0)} />
          <input className="input" type="number" inputMode="decimal" step="any" placeholder="Yaw (°)" value={yawDeg} onChange={(e) => setYawDeg(+e.target.value || 0)} />
          <input className="input" type="number" inputMode="decimal" step="1" placeholder="Step (°)" value={stepDeg} onChange={(e) => setStepDeg(+e.target.value || 0)} />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={() => { /* live via useMemo; redraw in useEffect */ }}>
            ⟳ Update
          </button>
          <button className="btn" onClick={onSave}>💾 Save</button>
          <button className="btn" onClick={onClear} style={{ background: "#64748b" }}>
            🧹 Clear
          </button>
        </div>

        <div className="small" style={{ marginTop: 8, color: "#334155" }}>
          • Canvas (အပေါ်) မှာ outline ကိုမြင်ရတယ်—pill အတွင်းကစာတန်ဖိုးတွေက **height (mm)** — unit မရေးထားပေမယ့် အောက်က Table မှာ mm တိတိကျကျ ထုတ်ပေးတယ်။
          <br />• Run-hole stencil = RUN ပိုက်ပေါ် wrap မှာဖေါက်မယ့်အပေါက် outline; Branch-cut stencil = BRANCH ပိုက်အဆုံး fish-mouth ဖြတ်မယ့် outline။
        </div>
      </div>

      {/* Canvases */}
      <div className="card">
        <canvas
          ref={cRunRef}
          style={{ width: "100%", height: 240, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}
        />
      </div>
      <div className="card">
        <canvas
          ref={cBrRef}
          style={{ width: "100%", height: 240, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}
        />
      </div>

      {/* Tables */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div className="page-title">Dimensions — degree → height (mm)</div>

        <DimTable caption="Run-hole stencil (wrap on RUN)" rows={data.hRun} />
        <DimTable caption="Branch-cut stencil (wrap on BRANCH)" rows={data.hBr} />

        <div className="small" style={{ marginTop: 4 }}>
          Circumference — Run: <b>{round1(data.runC)}</b> mm · Branch: <b>{round1(data.brC)}</b> mm ·
          Step: <b>{data.step}°</b> · Pitch <b>{data.pitchDeg}°</b> · Yaw <b>{data.yawDeg}°</b>
        </div>
      </div>
    </div>
  );
}

/* ------------ Drawing + Table helpers ------------ */

function drawStencilCanvas(canvas, stations, OD, title) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 240;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  const pad = 18;
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 14px system-ui";
  ctx.fillText(title, pad, pad - 4);

  if (!stations?.length) {
    ctx.fillText("No data", pad + 4, pad + 22);
    return;
  }

  const C = Math.PI * OD;
  const minU = 0, maxU = C;
  // v range 0..R (nice headroom)
  const R = Math.max(1e-6, OD / 2);
  const minV = 0, maxV = R;

  const X = (u) => pad + ((u - minU) * (W - 2 * pad)) / Math.max(1e-6, maxU - minU);
  const Y = (v) => H - pad - ((v - minV) * (H - 2 * pad)) / Math.max(1e-6, maxV - minV);

  // vertical grid every 30°
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  const du = C / 12;
  for (let u = 0; u <= C + 1e-6; u += du) {
    ctx.beginPath();
    ctx.moveTo(X(u), pad);
    ctx.lineTo(X(u), H - pad);
    ctx.stroke();
  }

  // baseline
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(pad, H - pad);
  ctx.lineTo(W - pad, H - pad);
  ctx.stroke();

  // polyline
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  stations.forEach((p, i) => {
    const u = (p.deg / 360) * C;
    const x = X(u);
    const y = Y(p.h);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // degree ticks + height pills (numbers only)
  ctx.textAlign = "center";
  ctx.font = "bold 12px system-ui";
  stations.forEach((p) => {
    const u = (p.deg / 360) * C;
    const x = X(u);
    const y = Y(p.h);
    // degree at bottom
    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(p.deg), x, H - pad + 14);

    // height pill above curve (no unit text)
    const label = String(Math.round(p.h));
    const tw = Math.ceil(ctx.measureText(label).width) + 10;
    const th = 18, r = 8;
    const rx = x - tw / 2, ry = y - th - 6;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + tw - r, ry);
    ctx.quadraticCurveTo(rx + tw, ry, rx + tw, ry + r);
    ctx.lineTo(rx + tw, ry + th - r);
    ctx.quadraticCurveTo(rx + tw, ry + th, rx + tw - r, ry + th);
    ctx.lineTo(rx + r, ry + th);
    ctx.quadraticCurveTo(rx, ry + th, rx, ry + th - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.fillText(label, x, ry + th - 4);
  });
}

function DimTable({ caption, rows }) {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{caption}</div>
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 420, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Degree (°)</th>
              {rows.map((r) => (
                <th key={"d" + r.deg} style={th}>{r.deg}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdHead}>Height (mm)</td>
              {rows.map((r) => (
                <td key={"h" + r.deg} style={td}>{Math.round(r.h)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: "6px 8px", border: "1px solid #e5e7eb", background: "#f8fafc", textAlign: "center", whiteSpace: "nowrap" };
const td = { padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "center" };
const tdHead = { ...td, background: "#f1f5f9", fontWeight: 600 };
