import { useState } from "react";

function cleanNumber(value, decimalPlaces = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return number
    .toFixed(decimalPlaces)
    .replace(/\.?0+$/, "");
}

export default function LengthConverter() {
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [mmResult, setMmResult] = useState("");

  const [millimetres, setMillimetres] = useState("");
  const [feetResult, setFeetResult] = useState("");
  const [inchesResult, setInchesResult] = useState("");

  function convertFeetInchesToMm() {
    const feetValue = Number(feet) || 0;
    const inchesValue = Number(inches) || 0;

    if (feetValue < 0 || inchesValue < 0) {
      setMmResult("Invalid value");
      return;
    }

    const totalMillimetres =
      feetValue * 304.8 +
      inchesValue * 25.4;

    setMmResult(cleanNumber(totalMillimetres));
  }

  function convertMmToFeetInches() {
    const mmValue = Number(millimetres);

    if (
      millimetres === "" ||
      !Number.isFinite(mmValue) ||
      mmValue < 0
    ) {
      setFeetResult("");
      setInchesResult("");
      return;
    }

    const totalInches = mmValue / 25.4;
    let calculatedFeet = Math.floor(totalInches / 12);
    let calculatedInches =
      totalInches - calculatedFeet * 12;

    calculatedInches =
      Math.round(calculatedInches * 10000) / 10000;

    if (calculatedInches >= 12) {
      calculatedFeet += 1;
      calculatedInches = 0;
    }

    setFeetResult(calculatedFeet.toString());
    setInchesResult(cleanNumber(calculatedInches));
  }

  function clearAll() {
    setFeet("");
    setInches("");
    setMmResult("");
    setMillimetres("");
    setFeetResult("");
    setInchesResult("");
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    fontSize: 16,
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 700,
    color: "#334155",
  };

  const buttonStyle = {
    width: "100%",
    padding: "10px",
    border: "none",
    borderRadius: 10,
    background: "#0ea5e9",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  };

  const resultStyle = {
    minHeight: 24,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    background: "#f1f5f9",
    textAlign: "center",
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  };

  return (
    <div>
      <div
        style={{
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            marginBottom: 12,
            fontSize: 16,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Feet / Inches to mm
        </div>

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
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={feet}
              placeholder="0"
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
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={inches}
              placeholder="0"
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

        <div style={resultStyle}>
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
          background: "#fff",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            marginBottom: 12,
            fontSize: 16,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          mm to Feet / Inches
        </div>

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

        <div style={resultStyle}>
          {feetResult !== "" ||
          inchesResult !== ""
            ? `${feetResult || 0} ft ${
                inchesResult || 0
              } in`
            : "Result"}
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
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Clear All
      </button>
    </div>
  );
}
