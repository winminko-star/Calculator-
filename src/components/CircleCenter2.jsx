import React, {
  useCallback,
  useRef,
  useState,
} from "react";

/* ---------------- Helpers ---------------- */

const formatNumber = (value, digits = 3) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function circleFromThreePoints(
  pointA,
  pointB,
  pointC
) {
  const x1 = pointA.E;
  const y1 = pointA.N;
  const x2 = pointB.E;
  const y2 = pointB.N;
  const x3 = pointC.E;
  const y3 = pointC.N;

  const a1 = x1 - x2;
  const b1 = y1 - y2;
  const a2 = x1 - x3;
  const b2 = y1 - y3;

  const e =
    ((x1 * x1 - x2 * x2) +
      (y1 * y1 - y2 * y2)) /
    2;

  const f =
    ((x1 * x1 - x3 * x3) +
      (y1 * y1 - y3 * y3)) /
    2;

  const determinant = a1 * b2 - b1 * a2;

  if (Math.abs(determinant) < 1e-12) {
    return null;
  }

  return {
    E: (e * b2 - b1 * f) / determinant,
    N: (a1 * f - e * a2) / determinant,
  };
}

function distance(pointA, pointB) {
  return Math.hypot(
    pointA.E - pointB.E,
    pointA.N - pointB.N
  );
}

function calculateAdjustedCenter(points) {
  const count = points.length;

  if (count < 3) {
    throw new Error("Need at least 3 points.");
  }

  let eastTotal = 0;
  let northTotal = 0;
  let validTriples = 0;

  for (let i = 0; i < count - 2; i += 1) {
    for (let j = i + 1; j < count - 1; j += 1) {
      for (let k = j + 1; k < count; k += 1) {
        const center = circleFromThreePoints(
          points[i],
          points[j],
          points[k]
        );

        if (center) {
          eastTotal += center.E;
          northTotal += center.N;
          validTriples += 1;
        }
      }
    }
  }

  if (validTriples === 0) {
    throw new Error("Points are collinear.");
  }

  return {
    E: eastTotal / validTriples,
    N: northTotal / validTriples,
    triples: validTriples,
  };
}

function dotProduct(row, vector) {
  return (
    row[0] * vector[0] +
    row[1] * vector[1] +
    row[2] * vector[2]
  );
}

function invertThreeByThree(matrix) {
  const determinant =
    matrix[0][0] *
      (
        matrix[1][1] * matrix[2][2] -
        matrix[1][2] * matrix[2][1]
      ) -
    matrix[0][1] *
      (
        matrix[1][0] * matrix[2][2] -
        matrix[1][2] * matrix[2][0]
      ) +
    matrix[0][2] *
      (
        matrix[1][0] * matrix[2][1] -
        matrix[1][1] * matrix[2][0]
      );

  if (Math.abs(determinant) < 1e-12) {
    return null;
  }

  return [
    [
      (
        matrix[1][1] * matrix[2][2] -
        matrix[1][2] * matrix[2][1]
      ) / determinant,

      (
        matrix[0][2] * matrix[2][1] -
        matrix[0][1] * matrix[2][2]
      ) / determinant,

      (
        matrix[0][1] * matrix[1][2] -
        matrix[0][2] * matrix[1][1]
      ) / determinant,
    ],

    [
      (
        matrix[1][2] * matrix[2][0] -
        matrix[1][0] * matrix[2][2]
      ) / determinant,

      (
        matrix[0][0] * matrix[2][2] -
        matrix[0][2] * matrix[2][0]
      ) / determinant,

      (
        matrix[0][2] * matrix[1][0] -
        matrix[0][0] * matrix[1][2]
      ) / determinant,
    ],

    [
      (
        matrix[1][0] * matrix[2][1] -
        matrix[1][1] * matrix[2][0]
      ) / determinant,

      (
        matrix[0][1] * matrix[2][0] -
        matrix[0][0] * matrix[2][1]
      ) / determinant,

      (
        matrix[0][0] * matrix[1][1] -
        matrix[0][1] * matrix[1][0]
      ) / determinant,
    ],
  ];
}

function calculateBestFitCircle(points) {
  const pointCount = points.length;

  if (pointCount < 3) {
    throw new Error("Need at least 3 points.");
  }

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;

  let targetX = 0;
  let targetY = 0;
  let targetOne = 0;

  for (const point of points) {
    const x = point.E;
    const y = point.N;
    const target = -(x * x + y * y);

    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;

    targetX += x * target;
    targetY += y * target;
    targetOne += target;
  }

  const matrix = [
    [sumXX, sumXY, sumX],
    [sumXY, sumYY, sumY],
    [sumX, sumY, pointCount],
  ];

  const targetVector = [
    targetX,
    targetY,
    targetOne,
  ];

  const inverse = invertThreeByThree(matrix);

  if (!inverse) {
    throw new Error(
      "Best-fit calculation failed."
    );
  }

  const a = dotProduct(
    inverse[0],
    targetVector
  );

  const b = dotProduct(
    inverse[1],
    targetVector
  );

  const c = dotProduct(
    inverse[2],
    targetVector
  );

  const centerE = -a / 2;
  const centerN = -b / 2;

  const radius = Math.sqrt(
    Math.max(
      0,
      (a * a + b * b) / 4 - c
    )
  );

  return {
    E: centerE,
    N: centerN,
    r: radius,
  };
}

function createDefaultRows() {
  return [
    { name: "P1", E: "", N: "" },
    { name: "P2", E: "", N: "" },
    { name: "P3", E: "", N: "" },
  ];
}

/* ---------------- Component ---------------- */

export default function CircleCenter2() {
  const [rows, setRows] = useState(
    createDefaultRows()
  );

  const [result, setResult] = useState({
    adjusted: null,
    bestFit: null,
  });

  const [message, setMessage] = useState("");

  const canvasRef = useRef(null);

  const addRow = () => {
    setRows((currentRows) => [
      ...currentRows,
      {
        name: `P${currentRows.length + 1}`,
        E: "",
        N: "",
      },
    ]);

    setMessage("");
  };

  const removeRow = () => {
    setRows((currentRows) => {
      if (currentRows.length <= 3) {
        setMessage(
          "At least 3 rows are required."
        );

        return currentRows;
      }

      setMessage("");

      return currentRows.slice(0, -1);
    });
  };

  const updateRow = (index, key, value) => {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: value,
            }
          : row
      )
    );

    setMessage("");
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, []);

  const clearAll = () => {
    setRows(createDefaultRows());

    setResult({
      adjusted: null,
      bestFit: null,
    });

    setMessage("");

    clearCanvas();
  };
    const drawDiagram = useCallback(
    (
      pointNames,
      points,
      adjustedCenter,
      bestFitCenter
    ) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      context.clearRect(0, 0, width, height);

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      const allEastings = points.map(
        (point) => point.E
      );

      const allNorthings = points.map(
        (point) => point.N
      );

      if (adjustedCenter) {
        allEastings.push(adjustedCenter.E);
        allNorthings.push(adjustedCenter.N);
      }

      if (bestFitCenter) {
        allEastings.push(bestFitCenter.E);
        allNorthings.push(bestFitCenter.N);
      }

      let minimumE = Math.min(...allEastings);
      let maximumE = Math.max(...allEastings);

      let minimumN = Math.min(...allNorthings);
      let maximumN = Math.max(...allNorthings);

      if (minimumE === maximumE) {
        minimumE -= 1;
        maximumE += 1;
      }

      if (minimumN === maximumN) {
        minimumN -= 1;
        maximumN += 1;
      }

      const padding = 48;

      const scaleX =
        (width - padding * 2) /
        (maximumE - minimumE);

      const scaleY =
        (height - padding * 2) /
        (maximumN - minimumN);

      const scale = Math.min(scaleX, scaleY);

      const canvasX = (easting) =>
        padding +
        (easting - minimumE) * scale;

      const canvasY = (northing) =>
        height -
        (padding +
          (northing - minimumN) * scale);

      context.strokeStyle = "#e2e8f0";
      context.lineWidth = 1;

      for (
        let gridX = padding;
        gridX <= width - padding;
        gridX += 40
      ) {
        context.beginPath();
        context.moveTo(gridX, padding);
        context.lineTo(
          gridX,
          height - padding
        );
        context.stroke();
      }

      for (
        let gridY = padding;
        gridY <= height - padding;
        gridY += 40
      ) {
        context.beginPath();
        context.moveTo(padding, gridY);
        context.lineTo(
          width - padding,
          gridY
        );
        context.stroke();
      }

      if (adjustedCenter) {
        const radii = points.map((point) =>
          distance(adjustedCenter, point)
        );

        const averageRadius =
          radii.reduce(
            (sum, radius) => sum + radius,
            0
          ) / radii.length;

        context.strokeStyle = "#16a34a";
        context.lineWidth = 2;

        context.beginPath();
        context.arc(
          canvasX(adjustedCenter.E),
          canvasY(adjustedCenter.N),
          averageRadius * scale,
          0,
          Math.PI * 2
        );
        context.stroke();
      }

      if (bestFitCenter) {
        context.setLineDash([7, 5]);
        context.strokeStyle = "#2563eb";
        context.lineWidth = 2;

        context.beginPath();
        context.arc(
          canvasX(bestFitCenter.E),
          canvasY(bestFitCenter.N),
          bestFitCenter.r * scale,
          0,
          Math.PI * 2
        );
        context.stroke();

        context.setLineDash([]);
      }

      points.forEach((point, index) => {
        const x = canvasX(point.E);
        const y = canvasY(point.N);

        context.fillStyle = "#0f172a";
        context.beginPath();
        context.arc(
          x,
          y,
          5,
          0,
          Math.PI * 2
        );
        context.fill();

        context.font =
          "bold 13px Arial, sans-serif";

        context.fillText(
          pointNames[index],
          x + 8,
          y - 8
        );
      });

      if (adjustedCenter) {
        const x = canvasX(adjustedCenter.E);
        const y = canvasY(adjustedCenter.N);

        context.fillStyle = "#16a34a";
        context.beginPath();
        context.arc(
          x,
          y,
          7,
          0,
          Math.PI * 2
        );
        context.fill();

        context.font =
          "bold 13px Arial, sans-serif";

        context.fillText(
          "Adjusted",
          x + 10,
          y - 8
        );
      }

      if (bestFitCenter) {
        const x = canvasX(bestFitCenter.E);
        const y = canvasY(bestFitCenter.N);

        context.fillStyle = "#2563eb";
        context.beginPath();
        context.arc(
          x,
          y,
          7,
          0,
          Math.PI * 2
        );
        context.fill();

        context.font =
          "bold 13px Arial, sans-serif";

        context.fillText(
          "Best Fit",
          x + 10,
          y + 18
        );
      }
    },
    []
  );

  const compute = () => {
    const validPoints = [];
    const pointNames = [];

    rows.forEach((row, index) => {
      const easting = Number(row.E);
      const northing = Number(row.N);

      if (
        row.E !== "" &&
        row.N !== "" &&
        Number.isFinite(easting) &&
        Number.isFinite(northing)
      ) {
        validPoints.push({
          E: easting,
          N: northing,
        });

        pointNames.push(
          row.name.trim() || `P${index + 1}`
        );
      }
    });

    if (validPoints.length < 3) {
      setMessage(
        "Enter at least 3 valid E and N points."
      );

      setResult({
        adjusted: null,
        bestFit: null,
      });

      clearCanvas();

      return;
    }

    let adjustedCenter = null;
    let bestFitCenter = null;

    try {
      adjustedCenter =
        calculateAdjustedCenter(validPoints);
    } catch {
      adjustedCenter = null;
    }

    try {
      bestFitCenter =
        calculateBestFitCircle(validPoints);
    } catch {
      bestFitCenter = null;
    }

    if (!adjustedCenter && !bestFitCenter) {
      setMessage(
        "Calculation failed. Check whether the points are collinear."
      );

      setResult({
        adjusted: null,
        bestFit: null,
      });

      clearCanvas();

      return;
    }

    setResult({
      adjusted: adjustedCenter,
      bestFit: bestFitCenter,
    });

    setMessage(
      "Circle center calculation completed."
    );

    drawDiagram(
      pointNames,
      validPoints,
      adjustedCenter,
      bestFitCenter
    );
  };

  const hasError =
    message.includes("failed") ||
    message.includes("Enter") ||
    message.includes("required");

  const styles = {
    wrapper: {
      width: "100%",
      boxSizing: "border-box",
      fontFamily:
        "Arial, Helvetica, sans-serif",
      color: "#0f172a",
    },

    card: {
      padding: 12,
      borderRadius: 16,
      border: "1px solid #dbeafe",
      background:
        "linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)",
      boxShadow:
        "0 8px 22px rgba(15, 23, 42, 0.08)",
    },

    titleBox: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      background:
        "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
      color: "#ffffff",
      textAlign: "center",
    },

    title: {
      margin: 0,
      fontSize: 18,
      fontWeight: 900,
    },

    subtitle: {
      margin: "5px 0 0",
      fontSize: 12,
      opacity: 0.9,
    },

    buttonGrid: {
      display: "grid",
      gridTemplateColumns:
        "repeat(2, minmax(0, 1fr))",
      gap: 8,
      marginBottom: 12,
    },

    button: {
      minHeight: 42,
      padding: "9px 10px",
      border: "none",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 800,
      cursor: "pointer",
      boxShadow:
        "0 3px 8px rgba(15, 23, 42, 0.08)",
      touchAction: "manipulation",
    },

    computeButton: {
      gridColumn: "1 / -1",
      minHeight: 44,
      padding: "10px 12px",
      border: "none",
      borderRadius: 10,
      background:
        "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
      color: "#ffffff",
      fontSize: 14,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow:
        "0 5px 12px rgba(22, 163, 74, 0.25)",
      touchAction: "manipulation",
    },

    tableContainer: {
      width: "100%",
      overflowX: "auto",
      borderRadius: 12,
      border: "1px solid #cbd5e1",
      background: "#ffffff",
      WebkitOverflowScrolling: "touch",
    },

    table: {
      width: "100%",
      minWidth: 315,
      borderCollapse: "collapse",
      tableLayout: "fixed",
    },

    headerCell: {
      padding: "10px 6px",
      background: "#e0f2fe",
      borderBottom: "1px solid #bae6fd",
      color: "#075985",
      fontSize: 13,
      fontWeight: 900,
      textAlign: "center",
    },

    cell: {
      padding: 6,
      borderBottom: "1px solid #e2e8f0",
      textAlign: "center",
      fontSize: 13,
    },

    numberCell: {
      width: 36,
      padding: 6,
      borderBottom: "1px solid #e2e8f0",
      textAlign: "center",
      fontSize: 13,
      fontWeight: 800,
      color: "#475569",
    },

    input: {
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      padding: "9px 7px",
      border: "1px solid #cbd5e1",
      borderRadius: 8,
      background: "#ffffff",
      color: "#0f172a",
      fontSize: 14,
      textAlign: "center",
      outline: "none",
    },

    message: {
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      background: hasError
        ? "#fee2e2"
        : "#dcfce7",
      color: hasError
        ? "#991b1b"
        : "#166534",
      fontSize: 13,
      fontWeight: 700,
      textAlign: "center",
    },

    resultGrid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 10,
      marginTop: 12,
    },

    resultCard: {
      padding: 12,
      borderRadius: 12,
      border: "1px solid #dbeafe",
      background: "#ffffff",
      boxShadow:
        "0 4px 12px rgba(15, 23, 42, 0.06)",
    },

    resultTitle: {
      margin: "0 0 8px",
      fontSize: 14,
      fontWeight: 900,
      color: "#0369a1",
    },

    resultLine: {
      margin: "4px 0",
      fontSize: 13,
      lineHeight: 1.5,
      wordBreak: "break-word",
    },

    canvasWrapper: {
      width: "100%",
      marginTop: 12,
      padding: 8,
      boxSizing: "border-box",
      overflowX: "auto",
      borderRadius: 12,
      border: "1px solid #cbd5e1",
      background: "#ffffff",
      WebkitOverflowScrolling: "touch",
    },

    canvas: {
      display: "block",
      width: "100%",
      minWidth: 520,
      maxWidth: 620,
      height: "auto",
      margin: "0 auto",
      borderRadius: 8,
      background: "#ffffff",
    },

    legend: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginTop: 8,
      fontSize: 12,
      fontWeight: 700,
      color: "#475569",
    },

    legendItem: {
      display: "flex",
      alignItems: "center",
      gap: 5,
    },
  };
    return (
    <div style={styles.wrapper}>
      <section style={styles.card}>
        <header style={styles.titleBox}>
          <h2 style={styles.title}>
            Circle Center Calculator
          </h2>

          <p style={styles.subtitle}>
            Enter at least three E and N points
          </p>
        </header>

        <div style={styles.buttonGrid}>
          <button
            type="button"
            onClick={clearAll}
            style={{
              ...styles.button,
              background: "#fee2e2",
              color: "#b91c1c",
            }}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={addRow}
            style={{
              ...styles.button,
              background: "#dbeafe",
              color: "#1d4ed8",
            }}
          >
            + Add Row
          </button>

          <button
            type="button"
            onClick={removeRow}
            style={{
              ...styles.button,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            − Remove
          </button>

          <button
            type="button"
            onClick={compute}
            style={styles.computeButton}
          >
            Compute Circle Center
          </button>
        </div>

        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <colgroup>
              <col style={{ width: 38 }} />
              <col style={{ width: 68 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
            </colgroup>

            <thead>
              <tr>
                <th style={styles.headerCell}>
                  #
                </th>

                <th style={styles.headerCell}>
                  Name
                </th>

                <th style={styles.headerCell}>
                  E
                </th>

                <th style={styles.headerCell}>
                  N
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td style={styles.numberCell}>
                    {index + 1}
                  </td>

                  <td style={styles.cell}>
                    <input
                      type="text"
                      value={row.name}
                      placeholder={`P${index + 1}`}
                      onChange={(event) =>
                        updateRow(
                          index,
                          "name",
                          event.target.value
                        )
                      }
                      style={styles.input}
                    />
                  </td>

                  <td style={styles.cell}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={row.E}
                      placeholder="E"
                      onChange={(event) =>
                        updateRow(
                          index,
                          "E",
                          event.target.value
                        )
                      }
                      style={styles.input}
                    />
                  </td>

                  <td style={styles.cell}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={row.N}
                      placeholder="N"
                      onChange={(event) =>
                        updateRow(
                          index,
                          "N",
                          event.target.value
                        )
                      }
                      style={styles.input}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        <div style={styles.resultGrid}>
          <div style={styles.resultCard}>
            <h3 style={styles.resultTitle}>
              Adjusted Center
            </h3>

            {result.adjusted ? (
              <>
                <p style={styles.resultLine}>
                  <strong>E:</strong>{" "}
                  {formatNumber(
                    result.adjusted.E
                  )}
                </p>

                <p style={styles.resultLine}>
                  <strong>N:</strong>{" "}
                  {formatNumber(
                    result.adjusted.N
                  )}
                </p>

                <p style={styles.resultLine}>
                  <strong>Triples:</strong>{" "}
                  {result.adjusted.triples}
                </p>
              </>
            ) : (
              <p style={styles.resultLine}>
                No result
              </p>
            )}
          </div>

          <div style={styles.resultCard}>
            <h3 style={styles.resultTitle}>
              Best-Fit Circle
            </h3>

            {result.bestFit ? (
              <>
                <p style={styles.resultLine}>
                  <strong>E:</strong>{" "}
                  {formatNumber(
                    result.bestFit.E
                  )}
                </p>

                <p style={styles.resultLine}>
                  <strong>N:</strong>{" "}
                  {formatNumber(
                    result.bestFit.N
                  )}
                </p>

                <p style={styles.resultLine}>
                  <strong>Radius:</strong>{" "}
                  {formatNumber(
                    result.bestFit.r
                  )}
                </p>
              </>
            ) : (
              <p style={styles.resultLine}>
                No result
              </p>
            )}
          </div>
        </div>

        <div style={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            width="620"
            height="380"
            style={styles.canvas}
          />

          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#0f172a",
                }}
              />
              Input Point
            </span>

            <span style={styles.legendItem}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#16a34a",
                }}
              />
              Adjusted
            </span>

            <span style={styles.legendItem}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#2563eb",
                }}
              />
              Best Fit
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
