// src/pages/CircleCenter.jsx
import React, { useMemo, useState } from "react";

/* ========== UI helpers ========== */
const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");
function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="small" style={{ fontWeight: 600 }}>{label}</span>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

/* ========== Geometry ========== */
// circumcenter of 3 non-collinear points
function circumcenter(p1, p2, p3) {
  const x1 = p1.e, y1 = p1.n;
  const x2 = p2.e, y2 = p2.n;
  const x3 = p3.e, y3 = p3.n;
  const d = 2 * (x1*(y2 - y3) + x2*(y3 - y1) + x3*(y1 - y2));
  if (Math.abs(d) < 1e-9) return null;
  const x1s = x1*x1 + y1*y1, x2s = x2*x2 + y2*y2, x3s = x3*x3 + y3*y3;
  const cx = (x1s*(y2 - y3) + x2s*(y3 - y1) + x3s*(y1 - y2)) / d;
  const cy = (x1s*(x3 - x2) + x2s*(x1 - x3) + x3s*(x2 - x1)) / d;
  return { cx, cy };
}

// Least-Squares (Kåsa) -> center only
function leastSquaresCenter(points) {
  const n = points.length;
  if (n < 3) return null;
  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0,Sz=0;
  for (const p of points) {
    const x=p.e, y=p.n, z=x*x+y*y;
    Sx+=x; Sy+=y; Sxx+=x*x; Syy+=y*y; Sxy+=x*y; Sxz+=x*z; Syz+=y*z; Sz+=z;
  }
  const A=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]], b=[-Sxz,-Syz,-Sz];
  const sol=solve3x3(A,b); if(!sol) return null;
  const [D,E]=sol; return { cx:-D/2, cy:-E/2 };
}

// 3x3 solver (Cramer's rule)
function solve3x3(A,b){
  const det=A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
           -A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
           +A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
  if(Math.abs(det)<1e-12) return null;
  const detX=b[0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
            -A[0][1]*(b[1]*A[2][2]-A[1][2]*b[2])
            +A[0][2]*(b[1]*A[2][1]-A[1][1]*b[2]);
  const detY=A[0][0]*(b[1]*A[2][2]-A[1][2]*b[2])
            -b[0]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
            +A[0][2]*(A[1][0]*b[2]-b[1]*A[2][0]);
  const detZ=A[0][0]*(A[1][1]*b[2]-b[1]*A[2][1])
            -A[0][1]*(A[1][0]*b[2]-b[1]*A[2][0])
            +b[0]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
  return [detX/det, detY/det, detZ/det];
}

/* ========== Accurate SVG Preview ========== */
function Preview({ points, tCenter, radius }) {
  const width = 360;
  const height = 300;
  const padding = 28;

  const validPoints = points.filter(
    (point) =>
      Number.isFinite(point.e) &&
      Number.isFinite(point.n)
  );

  const hasCircle =
    tCenter &&
    Number.isFinite(tCenter.cx) &&
    Number.isFinite(tCenter.cy) &&
    Number.isFinite(radius) &&
    radius >= 0;

  const xs = validPoints.map((point) => point.e);
  const ys = validPoints.map((point) => point.n);

  if (hasCircle) {
    xs.push(
      tCenter.cx - radius,
      tCenter.cx + radius
    );

    ys.push(
      tCenter.cy - radius,
      tCenter.cy + radius
    );
  }

  if (tCenter) {
    xs.push(tCenter.cx);
    ys.push(tCenter.cy);
  }

  let minX = xs.length
    ? Math.min(...xs)
    : -10;

  let maxX = xs.length
    ? Math.max(...xs)
    : 10;

  let minY = ys.length
    ? Math.min(...ys)
    : -10;

  let maxY = ys.length
    ? Math.max(...ys)
    : 10;

  if (maxX === minX) {
    minX -= 1;
    maxX += 1;
  }

  if (maxY === minY) {
    minY -= 1;
    maxY += 1;
  }

  const dataWidth = maxX - minX;
  const dataHeight = maxY - minY;

  const drawableWidth =
    width - padding * 2;

  const drawableHeight =
    height - padding * 2;

  /*
    အရေးကြီးဆုံးနေရာ:
    E နဲ့ N နှစ်ခုလုံးအတွက် scale တစ်ခုတည်းသုံးတယ်။
    ဒါကြောင့် circle က oval မဖြစ်တော့ဘူး။
  */
  const scale = Math.min(
    drawableWidth / dataWidth,
    drawableHeight / dataHeight
  );

  const usedWidth = dataWidth * scale;
  const usedHeight = dataHeight * scale;

  const offsetX =
    padding +
    (drawableWidth - usedWidth) / 2;

  const offsetY =
    padding +
    (drawableHeight - usedHeight) / 2;

  function toSvg(easting, northing) {
    return {
      X:
        offsetX +
        (easting - minX) * scale,

      Y:
        height -
        offsetY -
        (northing - minY) * scale,
    };
  }

  const centerSvg = tCenter
    ? toSvg(tCenter.cx, tCenter.cy)
    : null;

  const circleRadius =
    hasCircle
      ? radius * scale
      : null;

  const verticalGridLines = 10;
  const horizontalGridLines = 8;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{
        display: "block",
        background: "#ffffff",
        borderRadius: 12,
      }}
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="12"
        fill="#ffffff"
        stroke="#e5e7eb"
      />

      {/* Grid */}
      <g
        stroke="#eef2f7"
        strokeWidth="1"
      >
        {Array.from({
          length: verticalGridLines + 1,
        }).map((_, index) => {
          const x =
            padding +
            index *
              (drawableWidth /
                verticalGridLines);

          return (
            <line
              key={`vertical-${index}`}
              x1={x}
              y1={padding}
              x2={x}
              y2={height - padding}
            />
          );
        })}

        {Array.from({
          length: horizontalGridLines + 1,
        }).map((_, index) => {
          const y =
            padding +
            index *
              (drawableHeight /
                horizontalGridLines);

          return (
            <line
              key={`horizontal-${index}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
            />
          );
        })}
      </g>

      {/* Accurate circle */}
      {centerSvg &&
        Number.isFinite(circleRadius) && (
          <circle
            cx={centerSvg.X}
            cy={centerSvg.Y}
            r={circleRadius}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2.5"
          />
        )}

      {/* Radius lines */}
      {centerSvg &&
        validPoints.map((point) => {
          const pointSvg = toSvg(
            point.e,
            point.n
          );

          return (
            <line
              key={`radius-${point.id}`}
              x1={centerSvg.X}
              y1={centerSvg.Y}
              x2={pointSvg.X}
              y2={pointSvg.Y}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
          );
        })}

      {/* Input points */}
      {validPoints.map((point, index) => {
        const pointSvg = toSvg(
          point.e,
          point.n
        );

        return (
          <g key={point.id}>
            <circle
              cx={pointSvg.X}
              cy={pointSvg.Y}
              r="5"
              fill="#ef4444"
            />

            <text
              x={pointSvg.X + 8}
              y={pointSvg.Y - 7}
              fontSize="12"
              fontWeight="700"
              fill="#0f172a"
            >
              {index + 1}
            </text>
          </g>
        );
      })}

      {/* Triplet center */}
      {centerSvg && (
        <>
          <circle
            cx={centerSvg.X}
            cy={centerSvg.Y}
            r="4.5"
            fill="#16a34a"
          />

          <text
            x={centerSvg.X + 7}
            y={centerSvg.Y - 7}
            fontSize="12"
            fontWeight="700"
            fill="#16a34a"
          >
            T
          </text>
        </>
      )}
    </svg>
  );
}

/* ========== Page ========== */
export default function CircleCenter() {
  const [e, setE] = useState("");
  const [n, setN] = useState("");
  const [pts, setPts] = useState([]);

  const addPoint = () => {
    const E = parseFloat(e), N = parseFloat(n);
    if (!isFinite(E) || !isFinite(N)) return;
    setPts(list => [...list, { id: Date.now()+Math.random(), e: E, n: N }]);
    setE(""); setN("");
  };
  const clearAll = () => setPts([]);
  const removePoint = (id) => setPts(list => list.filter(p => p.id !== id));

  const tCenter = useMemo(() => {
    if (pts.length < 3) return null;
    const cs = [];
    for (let i=0;i<pts.length;i++)
      for (let j=i+1;j<pts.length;j++)
        for (let k=j+1;k<pts.length;k++) {
          const c = circumcenter(pts[i], pts[j], pts[k]);
          if (c) cs.push(c);
        }
    if (!cs.length) return null;
    const cx = cs.reduce((s,c)=>s+c.cx,0)/cs.length;
    const cy = cs.reduce((s,c)=>s+c.cy,0)/cs.length;
    return { cx, cy };
  }, [pts]);

  const radii = useMemo(() => {
    if (!tCenter) return [];
    return pts.map(p => ({ id:p.id, r: Math.hypot(p.e - tCenter.cx, p.n - tCenter.cy) }));
  }, [pts, tCenter]);

  const circleR = useMemo(() => {
    if (!radii.length) return undefined;
    const arr = radii.map(x=>x.r).sort((a,b)=>a-b);
    return arr[Math.floor(arr.length/2)];
  }, [radii]);

  const lCenter = useMemo(() => leastSquaresCenter(pts), [pts]);

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="page-title">🎯 Circle Center Finder</div>
        <div className="small">Triplet နည်း = SVG ပေါ်မှာ center + circle + radii lines ပြ • Best-fit = center ကို စာနဲ့ပဲ ပြ</div>
      </div>

      {/* Inputs */}
      <div className="card grid" style={{ gap: 12 }}>
        <Field label="E (Easting)" value={e} onChange={(ev)=>setE(ev.target.value)} placeholder="e.g. 123.45" />
        <Field label="N (Northing)" value={n} onChange={(ev)=>setN(ev.target.value)} placeholder="e.g. 67.89" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={addPoint}>+ Add point</button>
          <button className="btn" style={{ background:"#334155" }} onClick={clearAll}>🧹 Clear</button>
        </div>
        <div className="small" style={{ display:"grid", gap:6 }}>
          {pts.length ? pts.map((p,i)=>(
            <div
              key={p.id}
              style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:"6px 8px"
              }}
            >
              <span>#{i+1}: E={fmt(p.e)}, N={fmt(p.n)}</span>
              <button
                type="button"
                onClick={()=>removePoint(p.id)}
                style={{
                  border:"none", background:"#ef4444", color:"#fff",
                  borderRadius:8, padding:"2px 10px", fontWeight:800, lineHeight:1
                }}
              >×</button>
            </div>
          )) : "No points yet."}
        </div>
      </div>

      <div className="card">
        <Preview points={pts} tCenter={tCenter} radius={circleR} />
      </div>

      <div className="card grid" style={{ gap: 10 }}>
        <div className="page-title">📌 Results</div>

        <div className="card">
          <div className="page-title">① Triplet Center (SVG ပြပြီးသား)</div>
          {tCenter ? (
            <>
              <div className="small">Center (T): E = <b>{fmt(tCenter.cx)}</b>, N = <b>{fmt(tCenter.cy)}</b></div>
              <div className="small">Circle radius (median): <b>{fmt(circleR)}</b></div>
              <div className="small" style={{ marginTop: 8 }}>
                <b>Radii to points</b>
                {radii.map((r,i)=>(
                  <div key={r.id}>#{i+1}: r = {fmt(r.r)}</div>
                ))}
              </div>
            </>
          ) : (
            <div className="small">Need ≥ 3 non-collinear points.</div>
          )}
        </div>

        <div className="card">
          <div className="page-title">② Least-Squares (Best-Fit) Center</div>
          {lCenter ? (
            <div className="small">Center (L): E = <b>{fmt(lCenter.cx)}</b>, N = <b>{fmt(lCenter.cy)}</b></div>
          ) : (
            <div className="small">Need ≥ 3 points.</div>
          )}
        </div>
      </div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
    }
