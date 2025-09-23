// src/utils/stationMergeHelpers.js
/* ---------- small utils ---------- */
export const fmt = (x, n = 3) =>
  Number.isFinite(x) ? Number(x).toFixed(n).replace(/\.?0+$/, "") : "";

export function parseNameENHText(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    const m = s.split(/[,\s]+/).filter(Boolean);
    if (m.length < 4) continue;
    const name = m[0];
    const E = Number(m[1]), N = Number(m[2]), H = Number(m[3]);
    if ([E, N, H].every(Number.isFinite)) out.push({ name, E, N, H });
  }
  return out;
}

/* name mapping (alias -> canonical) */
export function parseNameMapText(text) {
  const map = {};
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.split(/[,\s]+/).filter(Boolean);
    if (m.length < 2) continue;
    const alias = m[0], canonical = m[1];
    map[alias] = canonical;
  }
  return map;
}
export const stringifyNameMapCSV = (m) =>
  "alias,canonical\n" +
  Object.entries(m)
    .map(([a, c]) => `${a},${c}`)
    .join("\n");

export function applyNameMap(rows, map) {
  if (!map || !Object.keys(map).length) return rows;
  return rows.map((r) => ({
    ...r,
    name: map[r.name] ?? r.name,
  }));
}

/* ---------- tiny 3D math ---------- */
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* quaternion helpers */
function qToR([w, x, y, z]) {
  // 3x3 rotation matrix
  const ww = w * w, xx = x * x, yy = y * y, zz = z * z;
  return [
    [ww + xx - yy - zz, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), ww - xx + yy - zz, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), ww - xx - yy + zz],
  ];
}
function mat3mul(A, B) {
  const r = Array.from({ length: 3 }, () => Array(3).fill(0));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
  return r;
}
export const mat3vec = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];

/* ---------- Best-fit rigid/similarity (Horn 1987) ----------
   P: reference points   (Nx3)
   Q: observed points    (Nx3)  -> find R, s, t to map Q → P
   options: {allowScale:boolean}
*/
export function bestFitTransform3D(P, Q, opt = {}) {
  const n = Math.min(P.length, Q.length);
  if (n < 3) return null;

  // centroids
  const Pc = [0, 0, 0], Qc = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    Pc[0] += P[i][0]; Pc[1] += P[i][1]; Pc[2] += P[i][2];
    Qc[0] += Q[i][0]; Qc[1] += Q[i][1]; Qc[2] += Q[i][2];
  }
  Pc[0] /= n; Pc[1] /= n; Pc[2] /= n;
  Qc[0] /= n; Qc[1] /= n; Qc[2] /= n;

  // centered
  const X = [], Y = [];
  for (let i = 0; i < n; i++) {
    X.push(sub3(P[i], Pc));
    Y.push(sub3(Q[i], Qc));
  }

  // cross-covariance S = sum (Y_i * X_i^T)
  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const y = Y[i], x = X[i];
    S[0][0] += y[0] * x[0]; S[0][1] += y[0] * x[1]; S[0][2] += y[0] * x[2];
    S[1][0] += y[1] * x[0]; S[1][1] += y[1] * x[1]; S[1][2] += y[1] * x[2];
    S[2][0] += y[2] * x[0]; S[2][1] += y[2] * x[1]; S[2][2] += y[2] * x[2];
  }

  // Horn's quaternion method: form 4x4 N and power-iterate the largest eigenvector
  const trace = S[0][0] + S[1][1] + S[2][2];
  const N = [
    [trace, S[1][2] - S[2][1], S[2][0] - S[0][2], S[0][1] - S[1][0]],
    [S[1][2] - S[2][1], S[0][0] - S[1][1] - S[2][2], S[0][1] + S[1][0], S[0][2] + S[2][0]],
    [S[2][0] - S[0][2], S[0][1] + S[1][0], -S[0][0] + S[1][1] - S[2][2], S[1][2] + S[2][1]],
    [S[0][1] - S[1][0], S[0][2] + S[2][0], S[1][2] + S[2][1], -S[0][0] - S[1][1] + S[2][2]],
  ];
  // power iteration
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 30; it++) {
    const v = [
      N[0][0] * q[0] + N[0][1] * q[1] + N[0][2] * q[2] + N[0][3] * q[3],
      N[1][0] * q[0] + N[1][1] * q[1] + N[1][2] * q[2] + N[1][3] * q[3],
      N[2][0] * q[0] + N[2][1] * q[1] + N[2][2] * q[2] + N[2][3] * q[3],
      N[3][0] * q[0] + N[3][1] * q[1] + N[3][2] * q[2] + N[3][3] * q[3],
    ];
    const len = Math.hypot(v[0], v[1], v[2], v[3]) || 1;
    q = [v[0] / len, v[1] / len, v[2] / len, v[3] / len];
  }
  const R = qToR(q);

  // scale (optional similarity)
  let s = 1;
  if (opt.allowScale) {
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const Ry = mat3vec(R, Y[i]);
      num += dot3(Ry, X[i]);
      den += dot3(Y[i], Y[i]);
    }
    s = den > 0 ? num / den : 1;
  }

  // translation: Pc = s*R*Qc + t  =>  t = Pc - s*R*Qc
  const RQc = mat3vec(R, Qc);
  const t = sub3(Pc, mul3(RQc, s));

  // rms error
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const Ry = mat3vec(R, Y[i]);
    const p = add3(mul3(Ry, s), Pc);
    const e = sub3(p, add3(Q[i], Qc)); // (mapped Q) - (raw Q) is not right for rms; use mapped Q -> P
  }
  // compute rms on actual pairs: map Q→P and compare to P
  sse = 0;
  for (let i = 0; i < n; i++) {
    const qmap = add3(mul3(mat3vec(R, sub3(Q[i], Qc)), s), Pc);
    const diff = sub3(qmap, P[i]);
    sse += dot3(diff, diff);
  }
  const rms = Math.sqrt(sse / n);

  return { R, s, t, rms };
}
