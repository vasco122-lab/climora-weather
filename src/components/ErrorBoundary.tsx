import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('CLIMORA ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050814] text-slate-100 flex items-center justify-center p-6">
          <div className="chroma-surface rounded-2xl max-w-lg w-full p-8 space-y-4">
            <h2 className="text-2xl font-bold chroma-text">Something went wrong</h2>
            <p className="text-sm text-slate-300 leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="chroma-btn px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
            >
              Reload CLIMORA
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
