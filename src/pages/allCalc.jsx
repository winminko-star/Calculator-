import React, { useMemo, useState } from "react";
import "./allCalc.css";

const PI = Math.PI;
const rad = d => d * PI / 180;
const deg = r => r * 180 / PI;
const fields = [
  ["radius", "Radius", "R", "length"],
  ["degree", "Central angle", "D", "degrees"],
  ["al", "Straight length (Chord)", "AL", "length"],
  ["ha", "Selected arc length", "HA", "length"],
  ["fa", "Full arc / Circumference", "FA", "length"],
];
const fmt = (n, p) => n == null || !Number.isFinite(n) ? "—" :
  Number(n.toFixed(p)).toLocaleString(undefined, { maximumFractionDigits: p });

function calculate(input) {
  const v = {};
  for (const [key, label] of fields) {
    if (input[key] !== "" && input[key] != null) {
      const n = Number(input[key]);
      if (!Number.isFinite(n) || n <= 0) return { error: `${label} must be greater than zero.` };
      v[key] = n;
    }
  }
  if (v.degree > 360) return { error: "D cannot be greater than 360°." };

  let R = v.radius ?? (v.fa != null ? v.fa / (2 * PI) : null);
  let D = v.degree ?? null;

  if (D == null && R != null && v.ha != null) D = deg(v.ha / R);
  if (D == null && R != null && v.al != null) {
    const q = v.al / (2 * R);
    if (q > 1) return { error: "AL (chord) cannot be longer than the diameter 2R." };
    D = deg(2 * Math.asin(q));
  }
  if (R == null && D != null) {
    if (v.ha != null) R = v.ha / rad(D);
    else if (v.al != null) R = v.al / (2 * Math.sin(rad(D) / 2));
  }
  if (R == null && D == null && v.ha != null && v.fa != null) {
    R = v.fa / (2 * PI);
    D = 360 * v.ha / v.fa;
  }
  if (R == null) return { error: "Enter a compatible pair, for example R + D, R + AL, R + HA, or HA + FA." };
  if (!Number.isFinite(R) || R <= 0) return { error: "These values do not produce a valid radius." };
  if (D != null && (!Number.isFinite(D) || D <= 0 || D > 360)) return { error: "D must be between 0° and 360°." };

  const theta = D == null ? null : rad(D);
  const AL = theta == null ? null : 2 * R * Math.sin(theta / 2);
  const HA = theta == null ? null : 2 * PI * R * D / 360;
  const FA = 2 * PI * R;
  const expected = { radius: R, degree: D, al: AL, ha: HA, fa: FA };
  for (const [key, value] of Object.entries(v)) {
    const e = expected[key];
    if (e != null && Math.abs(value - e) > Math.max(.01, Math.abs(e) * .015))
      return { error: `Entered ${key.toUpperCase()} does not match the other measurements.` };
  }
  return {
    result: { radius: R, degree: D, al: AL, ha: HA, fa: FA, diameter: 2 * R, area: PI * R * R },
    note: D == null ? "Circle size is known. Enter D, AL, or HA to calculate the selected arc and chord." :
      "AL is the straight chord. HA is the curved arc for angle D. FA is the complete circumference."
  };
}

function Diagram({ degree }) {
  const cx = 180, cy = 170, r = 116, start = -90, d = Math.max(1, Math.min(degree || 90, 359.9)), end = start + d;
  const pt = a => ({ x: cx + r * Math.cos(rad(a)), y: cy + r * Math.sin(rad(a)) });
  const p1 = pt(start), p2 = pt(end), mid = start + d / 2;
  const label = (a, rr) => ({ x: cx + rr * Math.cos(rad(a)), y: cy + rr * Math.sin(rad(a)) });
  const chordLabel = label(mid, r * .58), arcLabel = label(mid, r + 21);
  const arc = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${d > 180 ? 1 : 0} 1 ${p2.x} ${p2.y}`;
  const full = `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx-.01} ${cy-r}`;
  const angleArc = `M ${cx+24*Math.cos(rad(start))} ${cy+24*Math.sin(rad(start))} A 24 24 0 ${d>180?1:0} 1 ${cx+24*Math.cos(rad(end))} ${cy+24*Math.sin(rad(end))}`;
  return <div className="ca-diagram">
    <svg viewBox="0 0 360 360" role="img" aria-label="Circle with radius, central angle, straight chord AL, curved arc HA, and full arc FA">
      <circle cx={cx} cy={cy} r={r} className="ca-circle"/>
      <path d={full} className="ca-full"/>
      <path d={arc} className="ca-ha"/>
      <path d={`M${cx} ${cy} L${p1.x} ${p1.y}`} className="ca-radius"/>
      <path d={`M${cx} ${cy} L${p2.x} ${p2.y}`} className="ca-radius"/>
      <path d={`M${p1.x} ${p1.y} L${p2.x} ${p2.y}`} className="ca-chord"/>
      <path d={angleArc} className="ca-angle"/>
      <circle cx={cx} cy={cy} r="4" className="ca-center"/>
      <text x={cx-8} y={cy+43} className="ca-label ca-degree">D = {degree == null ? "—" : `${fmt(degree,2)}°`}</text>
      <text x={cx+35} y={cy-43} className="ca-label">R</text>
      <text x={chordLabel.x} y={chordLabel.y-8} className="ca-label ca-al">AL</text>
      <text x={arcLabel.x} y={arcLabel.y-5} className="ca-label ca-ha-text">HA</text>
      <text x={cx+119} y={cy+126} className="ca-label ca-fa-text">FA</text>
      <text x={cx-18} y={cy+58} className="ca-small">CENTER</text>
    </svg>
    <div className="ca-legend"><span><i className="ca-key ca-key-al"/> AL · straight</span><span><i className="ca-key ca-key-ha"/> HA · curved</span><span><i className="ca-key ca-key-fa"/> FA · full circle</span></div>
  </div>;
}

export default function AllCalc() {
  const [values, setValues] = useState({ radius: "5", degree: "90" });
  const [places, setPlaces] = useState(4);
  const calc = useMemo(() => calculate(values), [values]);
  const out = calc.result || {};
  const change = (key, value) => setValues(old => ({ ...old, [key]: value }));
  return <main className="allcalc">
    <header className="ca-header"><div><small>GEOMETRY TOOL</small><h2>Circle All Calculator</h2><p>Calculate straight and curved measurements of a circle.</p></div>
      <button type="button" onClick={() => setValues({})}>Reset</button></header>

    <section className="ca-panel ca-diagram-panel">
      <div className="ca-heading"><b>01</b><div><h3>Circle diagram</h3><p>Diagram changes with the entered radius and angle.</p></div></div>
      <Diagram degree={out.degree}/>
    </section>

    <div className="ca-columns">
      <section className="ca-panel">
        <div className="ca-heading"><b>02</b><div><h3>Enter measurements</h3><p>Enter any compatible pair of values.</p></div></div>
        <div className="ca-fields">{fields.map(([key,label,symbol,unit]) => <label className="ca-field" key={key}>
          <span>{label} <strong>({symbol})</strong></span><div><input type="number" min="0" step="any" inputMode="decimal" placeholder="Enter value" value={values[key] ?? ""} onChange={e=>change(key,e.target.value)}/><small>{unit}</small></div>
        </label>)}</div>
        {calc.error && <p className="ca-error" role="alert">{calc.error}</p>}
        <p className="ca-note"><b>Meaning:</b> AL is the straight line between the two arc endpoints (chord). HA is the curved arc corresponding to D. FA is the entire circumference.</p>
      </section>

      <section className="ca-panel">
        <div className="ca-heading"><b>03</b><div><h3>Calculated results</h3><p>Same length unit as the radius.</p></div></div>
        {[
          ["Radius","R","radius"],["Central angle","D","degree"],["Straight length","AL","al"],
          ["Selected arc","HA","ha"],["Full arc","FA","fa"],["Diameter","2R","diameter"],["Circle area","πR²","area"]
        ].map(([label,symbol,key])=><div className={`ca-result ca-${key}`} key={key}><span>{label} <small>{symbol}</small></span><strong>{calc.error ? "—" : key==="degree" && out[key]!=null ? `${fmt(out[key],places)}°` : fmt(out[key],places)}</strong></div>)}
        <label className="ca-decimals">Decimal places <select value={places} onChange={e=>setPlaces(Number(e.target.value))}>{[2,3,4,6,8,10].map(n=><option key={n}>{n}</option>)}</select></label>
        {calc.note && <p className="ca-note">{calc.note}</p>}
      </section>
    </div>

    <section className="ca-panel ca-formulas"><h3>Formulas</h3><div>
      <p><b>AL · Straight chord</b><code>2 × R × sin(D ÷ 2)</code></p>
      <p><b>HA · Selected arc</b><code>(2 × π × R) × (D ÷ 360)</code></p>
      <p><b>FA · Full circumference</b><code>2 × π × R</code></p>
    </div></section>
  </main>;
}
