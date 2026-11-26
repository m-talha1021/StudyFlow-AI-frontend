import { Component } from "react";

// Catches render crashes anywhere below it so a bug shows a friendly
// retry screen instead of a blank page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("StudyFlow AI crashed:", error, info);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e1b4b",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "480px", textAlign: "center" }}>
          <h1 style={{ fontSize: "28px", margin: "0 0 12px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "16px", lineHeight: 1.6, opacity: 0.9 }}>
            StudyFlow AI hit an unexpected error. Your saved work is safe —
            please try loading the page again.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              marginTop: "16px",
              padding: "12px 28px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#1e1b4b",
              background: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
