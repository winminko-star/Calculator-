import React, { useState } from "react";

function cleanNumber(value, decimalPlaces = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return number
    .toFixed(decimalPlaces)
    .replace(/\.?0+$/, "");
}

function parseFraction(value) {
  const text = String(value).trim();

  if (text === "") {
    return 0;
  }

  // Example: 6 1/4
  const mixed = text.match(
    /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/
  );

  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);

    if (denominator === 0) {
      return NaN;
    }

    return whole + numerator / denominator;
  }

  // Example: 1/4
  const fraction = text.match(
    /^(\d+)\s*\/\s*(\d+)$/
  );

  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);

    if (denominator === 0) {
      return NaN;
    }

    return numerator / denominator;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : NaN;
}

export default function LengthConverter() {
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");

  const [millimetres, setMillimetres] =
    useState("");

  const [mmResult, setMmResult] =
    useState("");

  const [feetResult, setFeetResult] =
    useState("");

  const [inchesResult, setInchesResult] =
    useState("");
  const [decimalResult, setDecimalResult] =
  useState("");

const [fractionResult, setFractionResult] =
  useState("");

  function convertFeetInchesToMm() {
    const ft = parseFraction(feet);
    const inch = parseFraction(inches);

    if (
      !Number.isFinite(ft) ||
      !Number.isFinite(inch)
    ) {
      setMmResult("Invalid");
      return;
    }

    const total =
      ft * 304.8 +
      inch * 25.4;

    setMmResult(cleanNumber(total));
  }

  function convertMmToFeetInches() {
  const mm = Number(millimetres);

  if (!Number.isFinite(mm) || mm < 0) {
    setFeetResult("");
    setInchesResult("");
    setDecimalResult("");
    setFractionResult("");
    return;
  }

  const totalInches = mm / 25.4;

  let feet = Math.floor(totalInches / 12);

  const decimalInches =
    totalInches - feet * 12;

  let wholeInches =
    Math.floor(decimalInches);

  let numerator = Math.round(
    (decimalInches - wholeInches) * 16
  );

  let denominator = 16;

  if (numerator === 16) {
    wholeInches += 1;
    numerator = 0;
  }

  if (wholeInches === 12) {
    feet += 1;
    wholeInches = 0;
  }

  function gcd(a, b) {
    let first = a;
    let second = b;

    while (second !== 0) {
      const remainder = first % second;
      first = second;
      second = remainder;
    }

    return first;
  }

  let fractionInchesText = "";

  if (numerator === 0) {
    fractionInchesText =
      `${wholeInches}`;
  } else {
    const commonDivisor = gcd(
      numerator,
      denominator
    );

    numerator =
      numerator / commonDivisor;

    denominator =
      denominator / commonDivisor;

    if (wholeInches === 0) {
      fractionInchesText =
        `${numerator}/${denominator}`;
    } else {
      fractionInchesText =
        `${wholeInches} ${numerator}/${denominator}`;
    }
  }

  const decimalText =
    `${feet} ft ${decimalInches.toFixed(3)} in`;

  const fractionText =
    `${feet} ft ${fractionInchesText} in`;

  setFeetResult(String(feet));

  setInchesResult(
    decimalInches.toFixed(3)
  );

  setDecimalResult(decimalText);
  setFractionResult(fractionText);
  }

  function clearAll() {
    setFeet("");
    setInches("");
    setMillimetres("");

    setMmResult("");
    setFeetResult("");
    setInchesResult("");
    setDecimalResult("");
setFractionResult("");
  }

  const inputStyle = {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block",
    marginBottom: 6,
    fontWeight: 700,
  };

  const buttonStyle = {
    width: "100%",
    padding: 10,
    border: "none",
    borderRadius: 10,
    background: "#0ea5e9",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
            <div
        style={{
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 16,
            color: "#0f172a",
          }}
        >
          Feet / Inches to mm
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div>
            <label style={labelStyle}>
              Feet
            </label>

            <input
              type="text"
              inputMode="text"
              value={feet}
              placeholder="Example: 5"
              onChange={(event) =>
                setFeet(event.target.value)
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Inches
            </label>

            <input
              type="text"
              inputMode="text"
              value={inches}
              placeholder="Example: 6 1/4"
              onChange={(event) =>
                setInches(event.target.value)
              }
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={convertFeetInchesToMm}
          style={{
            ...buttonStyle,
            marginTop: 12,
          }}
        >
          Convert to mm
        </button>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: "#f1f5f9",
            textAlign: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {mmResult
            ? `${mmResult} mm`
            : "Result"}
        </div>
      </div>

      <div
        style={{
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 16,
            color: "#0f172a",
          }}
        >
          mm to Feet / Inches
        </h3>

        <div>
          <label style={labelStyle}>
            Millimetres
          </label>

          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={millimetres}
            placeholder="Enter mm"
            onChange={(event) =>
              setMillimetres(event.target.value)
            }
            style={inputStyle}
          />
        </div>

        <button
          type="button"
          onClick={convertMmToFeetInches}
          style={{
            ...buttonStyle,
            marginTop: 12,
          }}
        >
          Convert to ft / in
        </button>

        <div
  style={{
    marginTop: 10,
    display: "grid",
    gap: 8,
  }}
>
  <div
    style={{
      padding: 10,
      borderRadius: 10,
      background: "#e0f2fe",
      textAlign: "center",
      color: "#0c4a6e",
    }}
  >
    <div
      style={{
        marginBottom: 4,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      Decimal
    </div>

    <div
      style={{
        fontSize: 18,
        fontWeight: 900,
      }}
    >
      {decimalResult || "Result"}
    </div>
  </div>

  <div
    style={{
      padding: 10,
      borderRadius: 10,
      background: "#dcfce7",
      textAlign: "center",
      color: "#14532d",
    }}
  >
    <div
      style={{
        marginBottom: 4,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      Fraction — nearest 1/16"
    </div>

    <div
      style={{
        fontSize: 18,
        fontWeight: 900,
      }}
    >
      {fractionResult || "Result"}
    </div>
  </div>
</div>
      </div>

      <button
        type="button"
        onClick={clearAll}
        style={{
          width: "100%",
          padding: 10,
          border: "none",
          borderRadius: 10,
          background: "#ef4444",
          color: "#ffffff",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Clear All
      </button>
    </div>
  );
}
