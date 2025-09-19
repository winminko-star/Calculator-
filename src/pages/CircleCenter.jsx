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

/* ========== SVG Preview (Triplet center + one circle + radii lines) ========== */
function Preview({ points, tCenter, radius }) {
  const xs = [
    ...points.map(p => p.e),
    ...(tCenter && Number.isFinite(radius) ? [tCenter.cx - radius, tCenter.cx + radius] : []),
    ...(tCenter ? [tCenter.cx] : []),
  ];
  const ys = [
    ...points.map(p => p.n),
    ...(tCenter && Number.isFinite(radius) ? [tCenter.cy - radius, tCenter.cy + radius] : []),
    ...(tCenter ? [tCenter.cy] : []),
  ];

  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 10;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 10;

  const pad = 10, w = 360, h = 260;
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);

  const innerPadX = 0.06 * spanX;
  const innerPadY = 0.06 * spanY;

  const sx = (w - 2*pad) / (spanX + 2*innerPadX);
  const sy = (h - 2*pad) / (spanY + 2*innerPadY);
  const x0 = minX - innerPadX;
  const y0 = minY - innerPadY;

  const toSvg = (x,y) => ({ X: pad + (x - x0) * sx, Y: h - pad - (y - y0) * sy });

  const C = tCenter ? toSvg(tCenter.cx, tCenter.cy) : null;
  const R = tCenter && Number.isFinite(radius) ? Math.max(radius * ((sx+sy)/2), 0) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display:"block" }}>
      <rect x="0" y="0" width={w} height={h} rx="12" fill="#fff" stroke="#e5e7eb" />
      {/* grid */}
      <g stroke="#eef2f7" strokeWidth="1">
        {Array.from({length:10}).map((_,i)=>(
          <line key={"v"+i} x1={pad+i*((w-2*pad)/10)} y1={pad} x2={pad+i*((w-2*pad)/10)} y2={h-pad}/>
        ))}
        {Array.from({length:8}).map((_,i)=>(
          <line key={"h"+i} x1={pad} y1={pad+i*((h-2*pad)/8)} x2={w-pad} y2={pad+i*((h-2*pad)/8)}/>
        ))}
      </g>

      {C && Number.isFinite(R) && (
        <circle cx={C.X} cy={C.Y} r={R} fill="none" stroke="#0ea5e9" strokeWidth="2" />
      )}

      {C && points.map((p)=> {
        const P = toSvg(p.e, p.n);
        return <line key={"r"+p.id} x1={C.X} y1={C.Y} x2={P.X} y2={P.Y} stroke="#94a3b8" strokeWidth="1.5" />;
      })}

      {points.map((p,i)=>{
        const P = toSvg(p.e,p.n);
        return (
          <g key={p.id}>
            <circle cx={P.X} cy={P.Y} r="5" fill="#ef4444" />
            <text x={P.X+8} y={P.Y-6} fontSize="12" fill="#0f172a">{i+1}</text>
          </g>
        );
      })}

      {C && (
        <>
          <circle cx={C.X} cy={C.Y} r="4" fill="#16a34a" />
          <text x={C.X + 6} y={C.Y - 6} fontSize="12" fill="#16a34a">T</text>
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
    </div>
  );
    }
