import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, msg: String(err?.message || err) };
  }
  componentDidCatch(err, info) {
    console.error("App crashed:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#b91c1c" }}>
            {this.state.msg}
          </pre>
          <button onClick={() => location.reload()} style={{
            marginTop: 8, padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb"
          }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
        }
