import { Component, type ReactNode } from 'react';
import {
  cleanReload,
  isFailedAssetLoad,
  isStaleChunkError,
  recoverFromStaleChunk,
} from '../utils/appRecovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  name?: string;
  variant?: 'app' | 'section';
  monitorGlobalErrors?: boolean;
  resetKeys?: readonly unknown[];
}
interface State {
  hasError: boolean;
  error: Error | null;
  isReloading: boolean;
}

/**
 * Catches render-time crashes anywhere in the tree and shows a fallback
 * with detailed error output for easy mobile debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isReloading: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isReloading: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.name ?? 'App'} render crash:`, error, info.componentStack);
    if (isStaleChunkError(error)) void recoverFromStaleChunk(error);
  }

  componentDidMount() {
    if (!this.props.monitorGlobalErrors) return;
    window.addEventListener('error', this.handleWindowError, true);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentDidUpdate(previousProps: Props) {
    if (!this.state.hasError) return;
    const previousKeys = previousProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys ?? [];
    const changed = previousKeys.length !== nextKeys.length
      || previousKeys.some((key, index) => !Object.is(key, nextKeys[index]));
    if (changed) this.resetBoundary();
  }

  componentWillUnmount() {
    if (!this.props.monitorGlobalErrors) return;
    window.removeEventListener('error', this.handleWindowError, true);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleWindowError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message || 'An app resource failed to load.');
    if (isStaleChunkError(error) || isFailedAssetLoad(event)) {
      event.preventDefault();
      void recoverFromStaleChunk(isStaleChunkError(error) ? error : new Error('Loading chunk failed'))
        .then((reloading) => {
          if (!reloading) this.setState({ hasError: true, error, isReloading: false });
        });
      return;
    }

    console.error('[ErrorBoundary] Uncaught browser error:', error);
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error('An unexpected app error occurred.');
    if (isStaleChunkError(error)) {
      event.preventDefault();
      void recoverFromStaleChunk(error).then((reloading) => {
        if (!reloading) this.setState({ hasError: true, error, isReloading: false });
      });
      return;
    }

    console.error('[ErrorBoundary] Unhandled promise rejection:', error);
  };

  resetBoundary = () => {
    this.setState({ hasError: false, error: null, isReloading: false });
  };

  handleReload = async () => {
    this.setState({ isReloading: true });
    await cleanReload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.resetBoundary)
          : this.props.fallback;
      }

      if (this.props.variant === 'section') {
        return (
          <div className="card flex min-h-48 flex-col items-center justify-center px-4 py-8 text-center" role="alert">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M12 2L1 21h22L12 2zm0 6v6m0 3v.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="mt-3 font-serif text-base font-semibold text-ink-100">
              {this.props.name ?? 'This section'} hit an error
            </h2>
            <div className="mt-2 w-full max-w-md rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-left">
              <p className="font-mono text-xs text-red-300 break-all whitespace-pre-wrap">
                {this.state.error?.name}: {this.state.error?.message || 'Unknown render error'}
              </p>
            </div>
            <button type="button" onClick={this.resetBoundary} className="ghost-btn mt-4 text-xs">
              Try again
            </button>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 py-6 text-center">
          <div className="w-full max-w-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                <path
                  d="M12 2L1 21h22L12 2zm0 6v6m0 3v.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="font-serif text-xl font-semibold text-ink-100">
              {this.props.name ? `${this.props.name} Error` : 'Something went wrong'}
            </h1>
            <p className="mt-1 text-xs text-ink-400">
              The app caught a runtime exception during rendering:
            </p>

            {/* Error Message Display */}
            <div className="mt-4 w-full rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-left shadow-inner">
              <p className="font-mono text-xs font-medium text-red-200 break-all whitespace-pre-wrap">
                {this.state.error?.name}: {this.state.error?.message || 'No error details captured'}
              </p>
            </div>

            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={this.resetBoundary}
                className="ghost-btn px-4 py-2 text-xs"
              >
                Reset UI
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                disabled={this.state.isReloading}
                className="gold-btn px-5 py-2 text-xs"
              >
                {this.state.isReloading ? 'Refreshing…' : 'Reload App'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
