import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere in the tree and shows a fallback
 * instead of a blank/black screen. Also logs the error so it surfaces in
 * the console during development.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crash:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
                <path
                  d="M12 2L1 21h22L12 2zm0 6v6m0 3v.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="font-serif text-2xl font-semibold text-ink-100">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-ink-400">
              The app hit an unexpected error while rendering. Your data is safe —
              try reloading the view.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-ink-700 bg-ink-850 p-3 text-left text-xs text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={this.reset}
                className="gold-btn px-5 py-2.5"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="ghost-btn px-5 py-2.5"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
