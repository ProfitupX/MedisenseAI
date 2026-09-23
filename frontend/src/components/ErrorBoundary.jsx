import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#111b3a] border border-red-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <span className="text-3xl">⚠️</span>
              <h2 className="text-xl font-bold">Display Error</h2>
            </div>
            <p className="text-slate-300 text-sm mb-4">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
