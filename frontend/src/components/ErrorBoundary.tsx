import { Component, type ErrorInfo, type ReactNode } from "react";

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("UI error:", error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="loading" role="alert">
        <h2>Something went wrong</h2>
        <p style={{ margin: "8px 0 16px" }}>The page hit an unexpected error. Your data is safe.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
