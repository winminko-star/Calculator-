// src/utils/stationMergeHelpers.js

/* ========== Parsing (Name,E,N,H) ========== */
export function parseNameENHText(text) {
  const out = [];
  for (const ln of (text || "").split(/\r?\n/)) {
    const s = ln.trim();
    if (!s) continue;
    const t = s.split(/[,\s]+/).filter(Boolean);
    if (t.length < 4) continue;
    const name = String(t[0]);
    const E = Number(t[1]), N = Number(t[2]), H = Number(t[3]);
    if (!isFinite(E) || !isFinite(N) || !isFinite(H)) continue;
    out.push({ name, E, N, H });
  }
  return out;
}
export const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "");

/* ========== Name mapping helpers ========== */
export const mapName = (name, mapObj) => (mapObj?.[name] ?? name);
export function applyNameMap(rows, mapObj) {
  if (!mapObj || !Object.keys(mapObj).length) return rows;
  return rows.map(p => ({ ...p, name: mapName(p.name, mapObj) }));
}
export function parseNameMapText(text) {
  const s = (text || "").trim();
  const out = {};
  if (!s) return out;

  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const obj = JSON.parse(s);
      if (Array.isArray(obj)) {
        for (const it of obj) if (it?.from && it?.to) out[String(it.from)] = String(it.to);
      } else {
        for (const k of Object.keys(obj)) out[String(k)] = String(obj[k]);
      }
      return out;
    } catch {}
  }
  for (const ln of s.split(/\r?\n/)) {
    const t = ln.split(/[,\s]+/).filter(Boolean);
    if (t.length >= 2) out[String(t[0])] = String(t[1]);
  }
  return out;
}
export function stringifyNameMapCSV(mapObj) {
  return Object.keys(mapObj).map(k => `${k},${mapObj[k]}`).join("\n");
}

/* ========== Small 3D LA (flat 3×3) ========== */
export const sub3 = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const add3 = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const mul3 = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot3 = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

export function mat3mul(A,B){
  const C = new Array(9).fill(0);
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) for(let k=0;k<3;k++)
    C[r*3+c]+=A[r*3+k]*B[k*3+c];
  return C;
}
export function mat3vec(A,v){
  return [
    A[0]*v[0]+A[1]*v[1]+A[2]*v[2],
    A[3]*v[0]+A[4]*v[1]+A[5]*v[2],
    A[6]*v[0]+A[7]*v[1]+A[8]*v[2],
  ];
}
export const det3=(A)=>A[0]*(A[4]*A[8]-A[5]*A[7]) - A[1]*(A[3]*A[8]-A[5]*A[6]) + A[2]*(A[3]*A[7]-A[4]*A[6]);

/* ========== Eigen + SVD (3×3) ========== */
function jacobiSym3(M9){
  let A=M9.slice(), V=[1,0,0, 0,1,0, 0,0,1];
  const off=()=>Math.hypot(A[1],A[2],A[5]);
  for(let it=0; it<30 && off()>1e-12; it++){
    let p=0,q=1;
    if(Math.abs(A[2])>Math.abs(A[1])){ p=0;q=2; }
    if(Math.abs(A[5])>Math.abs(A[p*3+q])){ p=1;q=2; }
    const app=A[p*3+p], aqq=A[q*3+q], apq=A[p*3+q]; if(Math.abs(apq)<1e-18) break;
    const phi=0.5*Math.atan2(2*apq, aqq-app), c=Math.cos(phi), s=Math.sin(phi);
    for(let k=0;k<3;k++){ const aik=A[k*3+p], aiq=A[k*3+q]; A[k*3+p]=c*aik-s*aiq; A[k*3+q]=s*aik+c*aiq; }
    for(let k=0;k<3;k++){ const apk=A[p*3+k], aqk=A[q*3+k]; A[p*3+k]=c*apk-s*aqk; A[q*3+k]=s*apk+c*aqk; }
    A[p*3+q]=A[q*3+p]=0;
    for(let k=0;k<3;k++){ const vkp=V[k*3+p], vkq=V[k*3+q]; V[k*3+p]=c*vkp-s*vkq; V[k*3+q]=s*vkp+c*vkq; }
  }
  return { eigVals:[A[0],A[4],A[8]], eigVecs:V };
}
function svd3x3(H){
  const AtA=[
    H[0]*H[0]+H[3]*H[3]+H[6]*H[6], H[0]*H[1]+H[3]*H[4]+H[6]*H[7], H[0]*H[2]+H[3]*H[5]+H[6]*H[8],
    H[1]*H[0]+H[4]*H[3]+H[7]*H[6], H[1]*H[1]+H[4]*H[4]+H[7]*H[7], H[1]*H[2]+H[4]*H[5]+H[7]*H[8],
    H[2]*H[0]+H[5]*H[3]+H[8]*H[6], H[2]*H[1]+H[5]*H[4]+H[8]*H[7], H[2]*H[2]+H[5]*H[5]+H[8]*H[8],
  ];
  const {eigVals,eigVecs}=jacobiSym3(AtA);
  const s=eigVals.map(v=>Math.sqrt(Math.max(v,0))), idx=[0,1,2].sort((i,j)=>s[j]-s[i]);
  const S=[s[idx[0]],s[idx[1]],s[idx[2]]];
  const V=[ eigVecs[0+idx[0]],eigVecs[0+idx[1]],eigVecs[0+idx[2]],
            eigVecs[3+idx[0]],eigVecs[3+idx[1]],eigVecs[3+idx[2]],
            eigVecs[6+idx[0]],eigVecs[6+idx[1]],eigVecs[6+idx[2]] ];
  const VT=[V[0],V[3],V[6], V[1],V[4],V[7], V[2],V[5],V[8]];
  const AV=mat3mul(H,V);
  const U=[ AV[0]/(S[0]||1), AV[1]/(S[1]||1), AV[2]/(S[2]||1),
            AV[3]/(S[0]||1), AV[4]/(S[1]||1), AV[5]/(S[2]||1),
            AV[6]/(S[0]||1), AV[7]/(S[1]||1), AV[8]/(S[2]||1) ];
  return { U,S,VT };
}

/* ========== Best-fit (Kabsch / Similarity) ========== */
export function bestFitTransform3D(ref, obs, {allowScale=false}={}) {
  const n=Math.min(ref.length, obs.length);
  if(n<3) return null;

  const mean3 = (arr)=>[
    arr.reduce((s,p)=>s+p[0],0)/arr.length,
    arr.reduce((s,p)=>s+p[1],0)/arr.length,
    arr.reduce((s,p)=>s+p[2],0)/arr.length,
  ];
  const cref=mean3(ref), cobs=mean3(obs);
  const X=ref.map(p=>sub3(p,cref)), Y=obs.map(p=>sub3(p,cobs));

  // H = Σ Y X^T
  let H=[0,0,0,0,0,0,0,0,0];
  for(let i=0;i<n;i++){
    const x=X[i], y=Y[i];
    H[0]+=y[0]*x[0]; H[1]+=y[0]*x[1]; H[2]+=y[0]*x[2];
    H[3]+=y[1]*x[0]; H[4]+=y[1]*x[1]; H[5]+=y[1]*x[2];
    H[6]+=y[2]*x[0]; H[7]+=y[2]*x[1]; H[8]+=y[2]*x[2];
  }

  const {U,S,VT}=svd3x3(H);
  let R=mat3mul(U,VT);
  if(det3(R)<0){ const U2=U.slice(); U2[2]*=-1; U2[5]*=-1; U2[8]*=-1; R=mat3mul(U2,VT); }

  let s=1;
  if(allowScale){
    let num=S[0]+S[1]+S[2], den=0;
    for(const x of X) den+=dot3(x,x);
    s=den>0? num/den : 1;
  }
  const t = sub3(cref, mul3(mat3vec(R, cobs), s));

  let sse=0;
  for(let i=0;i<n;i++){
    const py = add3(mul3(mat3vec(R, obs[i]), s), t);
    const r = sub3(ref[i], py);
    sse += dot3(r,r);
  }
  return { R, t, s, rms: Math.sqrt(sse/n) };
  }
