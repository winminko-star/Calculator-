import React, { useState, useMemo } from "react";

// CircleFit.jsx // Drop into a Vite + React app (src/components/CircleFit.jsx) // Tailwind classes used for quick styling (optional).

export default function CircleFit() { const [points, setPoints] = useState([ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0.2, y: 0.9 }, ]);

const [decimals, setDecimals] = useState(4);

function updatePoint(i, key, val) { const v = parseFloat(val); setPoints((p) => p.map((pt, idx) => (idx === i ? { ...pt, [key]: Number.isFinite(v) ? v : pt[key] } : pt))); }

function addPoint() { setPoints((p) => [...p, { x: 0, y: 0 }]); }

function removePoint(i) { setPoints((p) => p.filter((_, idx) => idx !== i)); }

// --- Math helpers --- function round(v) { const f = Math.pow(10, decimals); return Math.round(v * f) / f; }

// Compute circle through 3 non-collinear points function circleFrom3(a, b, c) { // Using perpendicular bisector intersection (linear solve) const x1 = a.x, y1 = a.y; const x2 = b.x, y2 = b.y; const x3 = c.x, y3 = c.y;

const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
if (Math.abs(d) < 1e-12) return null; // collinear or degenerate

const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / d;
const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / d;

const r = Math.hypot(ux - x1, uy - y1);
return { x: ux, y: uy, r };

}

// Least-squares algebraic circle fit (Kasa method) // Solves for: x^2 + y^2 + Ax + By + C = 0 function leastSquaresCircleFit(pts) { const n = pts.length; if (n < 3) return null; let sumx = 0, sumy = 0, sumx2 = 0, sumy2 = 0, sumxy = 0, sumz = 0, sumxz = 0, sumyz = 0; for (const p of pts) { const x = p.x, y = p.y; const z = x * x + y * y; sumx += x; sumy += y; sumx2 += x * x; sumy2 += y * y; sumxy += x * y; sumz += z; sumxz += x * z; sumyz += y * z; }

// build normal equations matrix for [A, B, C]
// [ sumx2  sumxy  sumx ] [A] = [ sumxz ]
// [ sumxy  sumy2  sumy ] [B]   [ sumyz ]
// [ sumx   sumy   n    ] [C]   [ sumz  ]

const M = [
  [sumx2, sumxy, sumx],
  [sumxy, sumy2, sumy],
  [sumx,  sumy,  n   ],
];
const B = [sumxz, sumyz, sumz];

// Solve 3x3 linear system with Gaussian elimination
const sol = solveLinearSystem3(M, B);
if (!sol) return null;
const A = sol[0], Bc = sol[1], C = sol[2];

const cx = -A / 2;
const cy = -Bc / 2;
const r = Math.sqrt(cx * cx + cy * cy - C);
if (!isFinite(r)) return null;
return { x: cx, y: cy, r };

}

function solveLinearSystem3(M, B) { // Copy const A = [ [M[0][0], M[0][1], M[0][2], B[0]], [M[1][0], M[1][1], M[1][2], B[1]], [M[2][0], M[2][1], M[2][2], B[2]], ]; const n = 3; for (let i = 0; i < n; i++) { // pivot let maxRow = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k; if (Math.abs(A[maxRow][i]) < 1e-14) return null; // singular // swap [A[i], A[maxRow]] = [A[maxRow], A[i]]; // normalize const diag = A[i][i]; for (let j = i; j < n + 1; j++) A[i][j] /= diag; // eliminate for (let k = 0; k < n; k++) if (k !== i) { const factor = A[k][i]; for (let j = i; j < n + 1; j++) A[k][j] -= factor * A[i][j]; } } return [A[0][3], A[1][3], A[2][3]]; }

function statisticsForCircle(center, pts) { if (!center) return null; const diffs = pts.map((p) => Math.hypot(p.x - center.x, p.y - center.y) - center.r); const absErrs = diffs.map((d) => Math.abs(d)); const mse = diffs.reduce((s, v) => s + v * v, 0) / pts.length; const rmse = Math.sqrt(mse); const meanAbs = absErrs.reduce((s, v) => s + v, 0) / pts.length; return { rmse, meanAbs }; }

// Generate all 3-point combos (indices) function combinations3(n) { const out = []; for (let i = 0; i < n - 2; i++) for (let j = i + 1; j < n - 1; j++) for (let k = j + 1; k < n; k++) out.push([i, j, k]); return out; }

const results = useMemo(() => { const n = points.length; const combos = combinations3(n); const comboCircles = combos.map((idxs) => { const c = circleFrom3(points[idxs[0]], points[idxs[1]], points[idxs[2]]); return { idxs, circle: c }; }).filter((x) => x.circle !== null);

const avgCenter = comboCircles.length ? {
  x: comboCircles.reduce((s, c) => s + c.circle.x, 0) / comboCircles.length,
  y: comboCircles.reduce((s, c) => s + c.circle.y, 0) / comboCircles.length,
  r: comboCircles.length ? comboCircles.reduce((s, c) => s + c.circle.r, 0) / comboCircles.length : 0,
} : null;

const ls = leastSquaresCircleFit(points);

const avgStats = avgCenter ? statisticsForCircle(avgCenter, points) : null;
const lsStats = ls ? statisticsForCircle(ls, points) : null;

// choose best by RMSE (lower is better)
let best = null;
if (avgStats && lsStats) {
  best = (avgStats.rmse <= lsStats.rmse) ? { method: '3-point-average', circle: avgCenter, stats: avgStats } : { method: 'least-squares', circle: ls, stats: lsStats };
} else if (lsStats) best = { method: 'least-squares', circle: ls, stats: lsStats };
else if (avgStats) best = { method: '3-point-average', circle: avgCenter, stats: avgStats };

// For each combo include fit error
const combosWithErr = comboCircles.map((c) => ({ idxs: c.idxs, circle: c.circle, stats: statisticsForCircle(c.circle, points) }));

return { combosWithErr, avgCenter, avgStats, ls, lsStats, best };

}, [points, decimals]);

return ( <div className="max-w-3xl mx-auto p-4"> <h2 className="text-xl font-semibold mb-3">Circle fit — 3-point combos vs least-squares</h2>

<div className="mb-3">
    <div className="flex gap-2 items-center mb-2">
      <button className="btn bg-sky-500 text-white px-3 py-1 rounded" onClick={addPoint}>Add point</button>
      <button className="btn bg-gray-200 px-3 py-1 rounded" onClick={() => setPoints([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0.2, y: 0.9 }])}>Reset example</button>
      <label className="ml-auto">Decimals:
        <input className="ml-2 w-16 p-1 border rounded" type="number" value={decimals} onChange={(e) => setDecimals(Math.max(0, Math.min(8, Number(e.target.value))))} />
      </label>
    </div>

    <div className="grid grid-cols-1 gap-2">
      {points.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="text-sm w-8">P{i + 1}</div>
          <input className="p-1 w-32 border rounded" value={p.x} onChange={(e) => updatePoint(i, 'x', e.target.value)} />
          <input className="p-1 w-32 border rounded" value={p.y} onChange={(e) => updatePoint(i, 'y', e.target.value)} />
          <button className="ml-auto text-sm text-red-600" onClick={() => removePoint(i)} disabled={points.length <= 3}>Remove</button>
        </div>
      ))}
    </div>
  </div>

  <div className="mb-4 p-3 bg-white border rounded shadow-sm">
    <h3 className="font-medium">Results</h3>
    {results.combosWithErr.length === 0 && <div className="text-sm text-gray-600">No valid 3-point combos (points may be collinear).</div>}

    {results.combosWithErr.length > 0 && (
      <div className="mt-2 space-y-3">
        <div>
          <strong>All 3-point combos ({results.combosWithErr.length}):</strong>
          <div className="mt-1 grid gap-2">
            {results.combosWithErr.map((c, idx) => (
              <div key={idx} className="text-sm">
                Combo {c.idxs.map(i=>`P${i+1}`).join(', ')} → center=({round(c.circle.x)},{round(c.circle.y)}) r={round(c.circle.r)} | RMSE={round(c.stats.rmse)}
              </div>
            ))}
          </div>
        </div>

        <div>
          <strong>3-point averaged center:</strong>
          {results.avgCenter ? (
            <div className="text-sm">center=({round(results.avgCenter.x)},{round(results.avgCenter.y)}) r={round(results.avgCenter.r)} | RMSE={round(results.avgStats.rmse)}</div>
          ) : <div className="text-sm text-gray-600">n/a</div>}
        </div>

        <div>
          <strong>Least-squares fit:</strong>
          {results.ls ? (
            <div className="text-sm">center=({round(results.ls.x)},{round(results.ls.y)}) r={round(results.ls.r)} | RMSE={round(results.lsStats.rmse)}</div>
          ) : <div className="text-sm text-gray-600">n/a</div>}
        </div>

        <div className="pt-2 border-t">
          <strong>Chosen (lower RMSE):</strong>
          {results.best ? (
            <div className="text-sm">Method: {results.best.method} → center=({round(results.best.circle.x)},{round(results.best.circle.y)}) r={round(results.best.circle.r)} | RMSE={round(results.best.stats.rmse)} </div>
          ) : <div className="text-sm text-gray-600">n/a</div>}
        </div>

      </div>
    )}
  </div>

  <div className="text-xs text-gray-500">Notes: 1) 3-point average = compute every circle from each 3-point combo then average the centers/radii. 2) Least-squares = algebraic Kasa fit. Lower RMSE → better fit to all given points. 3) If all points lie exactly on a circle then both methods should match.</div>
</div>

); }

  
