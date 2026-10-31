import { useMemo, useRef, useState } from "react";
import "./RightTriangle1.css";

const FIELD_NAMES = {
  opposite: "Facing",
  adjacent: "Nearest",
  hypotenuse: "Hypotenuse",
  angleA: "Angle A",
  angleC: "Angle C",
};

const SIDE_FIELDS = [
  "opposite",
  "adjacent",
  "hypotenuse",
];

const ANGLE_FIELDS = [
  "angleA",
  "angleC",
];

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const toDegrees = (radians) =>
  (radians * 180) / Math.PI;

const toRadians = (degrees) =>
  (degrees * Math.PI) / 180;

const formatValue = (
  value,
  decimals = 4
) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number(
    value.toFixed(decimals)
  ).toString();
};

function solveRightTriangle(
  manualValues
) {
  const values = {};

  Object.entries(
    manualValues
  ).forEach(([key, value]) => {
    const number =
      toNumber(value);

    if (number !== null) {
      values[key] = number;
    }
  });

  const enteredFields =
    Object.keys(values);

  if (enteredFields.length < 2) {
    return {
      values: {},
      error: "",
      message:
        "ပုံပေါ်မှာ တန်ဖိုး ၂ ခုထည့်ပါ",
    };
  }

  const invalidSide =
    SIDE_FIELDS.some(
      (field) =>
        values[field] !== undefined &&
        values[field] <= 0
    );

  if (invalidSide) {
    return {
      values: {},
      error:
        "အနားတန်ဖိုးသည် 0 ထက်ကြီးရမည်",
      message: "",
    };
  }

  const invalidAngle =
    ANGLE_FIELDS.some(
      (field) =>
        values[field] !== undefined &&
        (
          values[field] <= 0 ||
          values[field] >= 90
        )
    );

  if (invalidAngle) {
    return {
      values: {},
      error:
        "Angle သည် 0 နှင့် 90 ကြားဖြစ်ရမည်",
      message: "",
    };
  }

  let opposite =
    values.opposite;

  let adjacent =
    values.adjacent;

  let hypotenuse =
    values.hypotenuse;

  let angleA =
    values.angleA;

  let angleC =
    values.angleC;

  if (
    angleA !== undefined &&
    angleC !== undefined
  ) {
    const angleTotal =
      angleA + angleC;

    if (
      Math.abs(
        angleTotal - 90
      ) > 0.01
    ) {
      return {
        values: {},
        error:
          "Angle A + Angle C သည် 90 ဖြစ်ရမည်",
        message: "",
      };
    }

    const hasSide =
      SIDE_FIELDS.some(
        (field) =>
          values[field] !==
          undefined
      );

    if (!hasSide) {
      return {
        values: {},
        error: "",
        message:
          "ထောင့် ၂ ခုတည်းနဲ့ အနားအရှည် မတွက်နိုင်ပါ",
      };
    }
  }

  if (
    angleA !== undefined &&
    angleC === undefined
  ) {
    angleC = 90 - angleA;
  }

  if (
    angleC !== undefined &&
    angleA === undefined
  ) {
    angleA = 90 - angleC;
  }

  if (
    opposite !== undefined &&
    adjacent !== undefined
  ) {
    hypotenuse = Math.sqrt(
      opposite ** 2 +
      adjacent ** 2
    );

    angleA = toDegrees(
      Math.atan2(
        opposite,
        adjacent
      )
    );

    angleC = 90 - angleA;
  } else if (
    opposite !== undefined &&
    hypotenuse !== undefined
  ) {
    if (
      opposite >= hypotenuse
    ) {
      return {
        values: {},
        error:
          "Hypotenuse သည် Facing ထက်ကြီးရမည်",
        message: "",
      };
    }

    adjacent = Math.sqrt(
      hypotenuse ** 2 -
      opposite ** 2
    );

    angleA = toDegrees(
      Math.asin(
        opposite /
        hypotenuse
      )
    );

    angleC = 90 - angleA;
  } else if (
    adjacent !== undefined &&
    hypotenuse !== undefined
  ) {
    if (
      adjacent >= hypotenuse
    ) {
      return {
        values: {},
        error:
          "Hypotenuse သည် Nearest ထက်ကြီးရမည်",
        message: "",
      };
    }

    opposite = Math.sqrt(
      hypotenuse ** 2 -
      adjacent ** 2
    );

    angleA = toDegrees(
      Math.acos(
        adjacent /
        hypotenuse
      )
    );

    angleC = 90 - angleA;
  } else if (
    angleA !== undefined
  ) {
    const radians =
      toRadians(angleA);

    if (
      opposite !== undefined
    ) {
      adjacent =
        opposite /
        Math.tan(radians);

      hypotenuse =
        opposite /
        Math.sin(radians);
    } else if (
      adjacent !== undefined
    ) {
      opposite =
        adjacent *
        Math.tan(radians);

      hypotenuse =
        adjacent /
        Math.cos(radians);
    } else if (
      hypotenuse !== undefined
    ) {
      opposite =
        hypotenuse *
        Math.sin(radians);

      adjacent =
        hypotenuse *
        Math.cos(radians);
    }
  } else if (
    angleC !== undefined
  ) {
    const radians =
      toRadians(angleC);

    if (
      opposite !== undefined
    ) {
      adjacent =
        opposite *
        Math.tan(radians);

      hypotenuse =
        opposite /
        Math.cos(radians);
    } else if (
      adjacent !== undefined
    ) {
      opposite =
        adjacent /
        Math.tan(radians);

      hypotenuse =
        adjacent /
        Math.sin(radians);
    } else if (
      hypotenuse !== undefined
    ) {
      adjacent =
        hypotenuse *
        Math.sin(radians);

      opposite =
        hypotenuse *
        Math.cos(radians);
    }
  }

  const solved = {
    opposite,
    adjacent,
    hypotenuse,
    angleA,
    angleC,
  };

  const complete =
    Object.values(
      solved
    ).every(
      Number.isFinite
    );

  if (!complete) {
    return {
      values: {},
      error: "",
      message:
        "အနားတစ်ခုနှင့် ထောင့်တစ်ခု သို့မဟုတ် အနားနှစ်ခုထည့်ပါ",
    };
  }

  return {
    values: solved,
    error: "",
    message:
      "တွက်ချက်ပြီးပါပြီ",
  };
}

function TriangleInput({
  x,
  y,
  width = 116,
  label,
  field,
  manualValue,
  calculatedValue,
  onChange,
  onFocus,
  suffix = "",
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const shownValue =
    manualValue !== ""
      ? manualValue
      : formatValue(
          calculatedValue
        );

  const isManual =
    manualValue !== "";

  const isCalculated =
    !isManual &&
    Number.isFinite(
      calculatedValue
    );

  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height="70"
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        className={`triangle-field ${
  isFocused && manualValue === ""
    ? "triangle-field-focused"
    : ""
} ${
  isManual
    ? "triangle-field-manual"
    : ""
} ${
  isCalculated
    ? "triangle-field-calculated"
    : ""
}`}
      >
        <span className="triangle-field-label">
          {label}
        </span>
        {isCalculated && (
  <button
    type="button"
    className="triangle-zoom-button"
    onClick={(e) => {
      e.stopPropagation();
      setShowZoom(v => !v);
    }}
  >
    
  </button>
)}

        <div className="triangle-input-wrapper">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={shownValue}
            placeholder="?"
             onFocus={() => {
  setIsFocused(true);
  onFocus(field);
}}

onBlur={() => {
  setIsFocused(false);
}}
            onChange={(event) =>
              onChange(
                field,
                event.target.value
              )
            }
            aria-label={label}
          />

          {suffix && (
            <span className="triangle-input-suffix">
              {suffix}
            </span>
          )}
        </div>
        {showZoom && isCalculated && (
  <div className="triangle-zoom-preview">
    <span>{label}</span>
    <strong>
      {shownValue}{suffix}
    </strong>
  </div>
)}
      </div>
    </foreignObject>
     );
    }
export default function RightTriangle() {
  const svgRef = useRef(null);

  const [
    manualValues,
    setManualValues,
  ] = useState({
    opposite: "",
    adjacent: "",
    hypotenuse: "",
    angleA: "",
    angleC: "",
  });

  const [
    inputOrder,
    setInputOrder,
  ] = useState([]);

  const solved = useMemo(
    () =>
      solveRightTriangle(
        manualValues
      ),
    [manualValues]
  );

  const result =
    solved.values;

  const normalizedShape =
    useMemo(() => {
      const opposite =
        result.opposite;

      const adjacent =
        result.adjacent;

      if (
        !Number.isFinite(
          opposite
        ) ||
        !Number.isFinite(
          adjacent
        ) ||
        opposite <= 0 ||
        adjacent <= 0
      ) {
        return {
          leftX: 95,
          rightX: 405,
          bottomY: 380,
          topY: 95,
        };
      }

      const availableWidth =
        310;

      const availableHeight =
        285;

      const scale = Math.min(
        availableWidth /
          adjacent,
        availableHeight /
          opposite
      );

      const drawnWidth =
        Math.max(
          110,
          adjacent * scale
        );

      const drawnHeight =
        Math.max(
          110,
          opposite * scale
        );

      return {
        leftX: 95,
        rightX:
          95 + drawnWidth,
        bottomY: 380,
        topY:
          380 - drawnHeight,
      };
    }, [
      result.opposite,
      result.adjacent,
    ]);

  const {
    leftX,
    rightX,
    bottomY,
    topY,
  } = normalizedShape;

  const hypMidX =
    (leftX + rightX) / 2;

  const hypMidY =
    (bottomY + topY) / 2;

  const handleFieldFocus = (
    field
  ) => {
    if (
      manualValues[field] !== ""
    ) {
      return;
    }

    setInputOrder(
      (currentOrder) => {
        const withoutCurrent =
          currentOrder.filter(
            (item) =>
              item !== field
          );

        if (
          withoutCurrent.length <
          2
        ) {
          return [
            ...withoutCurrent,
            field,
          ];
        }

        const fieldToRemove =
          withoutCurrent[0];

        setManualValues(
          (currentValues) => ({
            ...currentValues,
            [fieldToRemove]:
              "",
          })
        );

        return [
          ...withoutCurrent.slice(
            1
          ),
          field,
        ];
      }
    );
  };

  const handleValueChange = (
    field,
    value
  ) => {
    setInputOrder(
      (currentOrder) => {
        const withoutCurrent =
          currentOrder.filter(
            (item) =>
              item !== field
          );

        if (value === "") {
          return withoutCurrent;
        }

        if (
          withoutCurrent.length >=
          2
        ) {
          const fieldToRemove =
            withoutCurrent[0];

          setManualValues(
            (currentValues) => ({
              ...currentValues,
              [fieldToRemove]:
                "",
              [field]: value,
            })
          );

          return [
            ...withoutCurrent.slice(
              1
            ),
            field,
          ];
        }

        return [
          ...withoutCurrent,
          field,
        ];
      }
    );

    setManualValues(
      (currentValues) => ({
        ...currentValues,
        [field]: value,
      })
    );
  };

  const handleClear = () => {
    setManualValues({
      opposite: "",
      adjacent: "",
      hypotenuse: "",
      angleA: "",
      angleC: "",
    });

    setInputOrder([]);
  };

  const handleExample = () => {
    setManualValues({
      opposite: "30",
      adjacent: "40",
      hypotenuse: "",
      angleA: "",
      angleC: "",
    });

    setInputOrder([
      "opposite",
      "adjacent",
    ]);
  };

  return (
    <main className="right-triangle-page">
      <section className="right-triangle-card">
        <header className="right-triangle-header">
          <div>
            <h1>
              Right Triangle
            </h1>

            <p>
              ပုံပေါ်မှာ တန်ဖိုး
              ၂ ခုထည့်ပါ။
              ကျန်တာတွေ
              သူ့နေရာနဲ့သူ
              အလိုအလျောက်
              ထွက်ပါမယ်။
            </p>
          </div>

          <div className="triangle-header-actions">
            <button
              type="button"
              className="triangle-example-button"
              onClick={
                handleExample
              }
            >
              Example
            </button>

            <button
              type="button"
              className="triangle-clear-button"
              onClick={
                handleClear
              }
            >
              Clear All
            </button>
          </div>
        </header>

        <div className="triangle-canvas-container">
          <svg
            ref={svgRef}
            className="triangle-svg"
            viewBox="0 0 500 480"
            role="img"
            aria-label="Interactive right triangle calculator"
          >
            <defs>
              <linearGradient
                id="triangleFill"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#38bdf8"
                  stopOpacity="0.34"
                />

                <stop
                  offset="100%"
                  stopColor="#2563eb"
                  stopOpacity="0.12"
                />
              </linearGradient>

              <filter id="triangleShadow">
                <feDropShadow
                  dx="0"
                  dy="5"
                  stdDeviation="6"
                  floodOpacity="0.18"
                />
              </filter>
            </defs>

            <polygon
              points={`${leftX},${bottomY} ${rightX},${bottomY} ${rightX},${topY}`}
              className="triangle-shape"
              filter="url(#triangleShadow)"
            />

            <line
              x1={leftX}
              y1={bottomY}
              x2={rightX}
              y2={bottomY}
              className="triangle-line"
            />

            <line
              x1={rightX}
              y1={bottomY}
              x2={rightX}
              y2={topY}
              className="triangle-line"
            />

            <line
              x1={leftX}
              y1={bottomY}
              x2={rightX}
              y2={topY}
              className="triangle-hypotenuse-line"
            />

            <polyline
              points={`${
                rightX - 28
              },${bottomY} ${
                rightX - 28
              },${
                bottomY - 28
              } ${rightX},${
                bottomY - 28
              }`}
              className="right-angle-mark"
            />

            <text
              x={rightX - 40}
              y={bottomY - 38}
              className="right-angle-label"
            >
              90
            </text>

            <path
              d={`M ${
                leftX + 52
              } ${bottomY}
              A 52 52 0 0 0
              ${
                leftX + 40
              } ${
                bottomY - 33
              }`}
              className="angle-arc"
            />

            <path
              d={`M ${rightX} ${
                topY + 50
              }
              A 50 50 0 0 0
              ${
                rightX - 35
              } ${
                topY + 36
              }`}
              className="angle-arc"
            />

            <circle
              cx={leftX}
              cy={bottomY}
              r="7"
              className="triangle-point"
            />

            <circle
              cx={rightX}
              cy={bottomY}
              r="7"
              className="triangle-point"
            />

            <circle
              cx={rightX}
              cy={topY}
              r="7"
              className="triangle-point"
            />

            <text
              x={leftX - 24}
              y={bottomY + 31}
              className="triangle-point-label"
            >
              A
            </text>

            <text
              x={rightX + 13}
              y={bottomY + 28}
              className="triangle-point-label"
            >
              B
            </text>

            <text
              x={rightX + 14}
              y={topY - 7}
              className="triangle-point-label"
            >
              C
            </text>
                        <TriangleInput
              x={
                (
                  leftX +
                  rightX
                ) /
                  2 -
                58
              }
              y={bottomY + 22}
              label="Nearest"
              field="adjacent"
              manualValue={
                manualValues.adjacent
              }
              calculatedValue={
                result.adjacent
              }
              onFocus={
                handleFieldFocus
              }
              onChange={
                handleValueChange
              }
            />

            <TriangleInput
  x={rightX - 55}
              y={
                (
                  topY +
                  bottomY
                ) /
                  2 -
                34
              }
              label="Facing"
              field="opposite"
              manualValue={
                manualValues.opposite
              }
              calculatedValue={
                result.opposite
              }
              onFocus={
                handleFieldFocus
              }
              onChange={
                handleValueChange
              }
            />

            <TriangleInput
              x={hypMidX - 120}
              y={hypMidY - 84}
              label="Hypotenuse"
              field="hypotenuse"
              manualValue={
                manualValues.hypotenuse
              }
              calculatedValue={
                result.hypotenuse
              }
              onFocus={
                handleFieldFocus
              }
              onChange={
                handleValueChange
              }
            />

            <TriangleInput
              x={leftX + 18}
              y={bottomY - 93}
              width={105}
              label="Angle A"
              field="angleA"
              manualValue={
                manualValues.angleA
              }
              calculatedValue={
                result.angleA
              }
              onFocus={
                handleFieldFocus
              }
              onChange={
                handleValueChange
              }
              suffix=""
            />

            <TriangleInput
              x={rightX - 128}
              y={topY + 12}
              width={105}
              label="Angle C"
              field="angleC"
              manualValue={
                manualValues.angleC
              }
              calculatedValue={
                result.angleC
              }
              onFocus={
                handleFieldFocus
              }
              onChange={
                handleValueChange
              }
              suffix=""
            />
          </svg>
        </div>

        <div
          className={`triangle-status ${
            solved.error
              ? "triangle-status-error"
              : ""
          }`}
        >
          {solved.error ||
            solved.message}
        </div>

        <div className="triangle-legend">
          <span>
            <i className="legend-dot legend-manual" />
            ကိုယ်ထည့်ထားသောတန်ဖိုး
          </span>

          <span>
            <i className="legend-dot legend-result" />
            တွက်ချက်ထားသောအဖြေ
          </span>
        </div>

        <p className="triangle-help">
          တန်ဖိုး ၂ ခုထည့်ပြီးနောက်
          တခြားနေရာတစ်ခုကို
          ပြောင်းရေးလိုက်ရင်
          အရင်ထည့်ထားတဲ့
          အဟောင်းဆုံးတန်ဖိုးကို
          အလိုအလျောက်
          ဖယ်ပေးပါမယ်။
        </p>
      </section>
    </main>
  );
}
