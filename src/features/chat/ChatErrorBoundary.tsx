import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string; }

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8" style={{ background: "var(--bg-base)" }}>
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--red-tint)" }}>
              <span className="text-lg">⚠️</span>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Something went wrong</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: "" })}
              className="text-sm px-4 py-2 rounded-lg bg-[var(--brand)] text-white hover:brightness-110 transition-all"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
