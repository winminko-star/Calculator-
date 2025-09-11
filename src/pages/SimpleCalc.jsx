// src/pages/SimpleCalc.jsx
import React, { useMemo, useState } from "react";

const keys = [
  ["AC", "DEL", "(", ")"],
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["0", ".", "+", "="],
];

const isOp = (ch) => "+-×÷".includes(ch);

export default function SimpleCalc() {
  const [expr, setExpr] = useState("");
  const [flash, setFlash] = useState(""); // for press feedback

  // ---------- input rules ----------
  const push = (k) => {
    setFlash(k);
    setTimeout(() => setFlash(""), 120);

    if (k === "AC") return setExpr("");
    if (k === "DEL") return setExpr((s) => s.slice(0, -1));
    if (k === "=") return setExpr((s) => tryEval(s));

    setExpr((s0) => {
      let s = s0;

      // normalize minus key from "−" to "-"
      if (k === "−") k = "-";

      // prevent double operators (except allow '-' after '(' or at start)
      if (isOp(k)) {
        if (!s) return k === "-" ? "-" : s; // only minus can start
        const prev = s[s.length - 1];
        if (isOp(prev)) {
          // replace previous operator (keep negative like "( -" also ok)
          if (!(k === "-" && prev === "(")) s = s.slice(0, -1);
        }
      }

      // only one dot in current number segment
      if (k === ".") {
        const lastOp = Math.max(
          s.lastIndexOf("+"),
          s.lastIndexOf("-"),
          s.lastIndexOf("×"),
          s.lastIndexOf("÷"),
          s.lastIndexOf("(")
        );
        const seg = s.slice(lastOp + 1);
        if (seg.includes(".")) return s; // already has dot
        if (!seg) return s + "0."; // start with 0.
      }

      // parentheses quick guard: don't allow closing without opening
      if (k === ")") {
        const opens = (s.match(/\(/g) || []).length;
        const closes = (s.match(/\)/g) || []).length;
        if (opens <= closes) return s;
      }

      return s + k;
    });
  };

  // live preview (safe)
  const preview = useMemo(() => {
    const v = safeEval(expr);
    return v === null ? "" : v.toString();
  }, [expr]);

  return (
    <div
      className="container grid"
      style={{
        gap: 16,
        background: "linear-gradient(180deg, #e0f2fe 0%, #f8fafc 35%, #f1f5f9 100%)",
        minHeight: "calc(100vh - 56px)",
        paddingTop: 16,
      }}
    >
      {/* header & display */}
      <div
        className="card"
        style={{
          border: "none",
          background: "linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)",
          color: "white",
        }}
      >
        <div className="page-title" style={{ color: "white" }}>
          🧮 Simple Calculator
        </div>

        {/* display (STABLE, NO JUMP) */}
        <div
          style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: 12,
          }}
        >
          {/* expression line */}
          <div
            style={{
              height: 32,               // fixed height
              lineHeight: "32px",
              fontSize: 18,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",     // no wrap
              overflowX: "auto",        // horizontal scroll if long
              overflowY: "hidden",
              wordBreak: "keep-all",
            }}
          >
            {expr || "0"}
          </div>

          {/* preview line (reserve height even when empty) */}
          <div
            style={{
              marginTop: 4,
              height: 36,               // fixed height
              lineHeight: "36px",
              fontSize: 22,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {preview || "\u00A0" /* keep space so height never collapses */}
          </div>
        </div>
      </div>

      {/* keypad */}
      <div
        className="card"
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {keys.flat().map((k) => (
            <Key key={k} label={k} active={flash === k} onClick={() => push(k)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Key({ label, onClick, active }) {
  const isAccent = ["=", "+", "−", "×", "÷"].includes(label);
  const bg = isAccent ? "#0ea5e9" : "#f1f5f9";
  const fg = isAccent ? "#fff" : "#0f172a";
  const bgActive = isAccent ? "#0284c7" : "#e2e8f0";

  return (
    <button
      onClick={onClick}
      className="btn"
      style={{
        height: 62,
        borderRadius: 16,
        fontSize: 22,
        fontWeight: 800,
        background: active ? bgActive : bg,
        color: fg,
        border: "none",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        transition: "background 120ms, transform 60ms",
        touchAction: "manipulation",
      }}
      onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {label}
    </button>
  );
}

// ---------- safe evaluate ----------
function safeEval(source) {
  if (!source) return null;
  try {
    // replace pretty ops
    let s = source.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
    // sanitize: allow digits, ops, dot, parentheses, spaces only
    if (!/^[0-9+\-*/().\s]*$/.test(s)) return null;
    // balance parentheses
    const opens = (s.match(/\(/g) || []).length;
    const closes = (s.match(/\)/g) || []).length;
    if (opens !== closes) return null;

    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${s});`)();
    if (typeof val !== "number" || !isFinite(val)) return null;
    return trimTrailingZeros(val);
  } catch {
    return null;
  }
}

function tryEval(s) {
  const v = safeEval(s);
  return v === null ? s : String(v);
}

function trimTrailingZeros(n) {
  // keep as typed-like look; show up to 12 dp but strip zeros
  const str = n.toFixed(12);
  return str.replace(/\.?0+$/, "");
      }
