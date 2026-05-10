import React from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // In a real production app, log the error to an error reporting service (e.g. Sentry)
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-800/80 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl animate-in">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Something went wrong</h1>
            <p className="text-foreground/60 mb-8 text-sm">
              We've encountered an unexpected frontend error. If you are in a session, you can reconnect immediately.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCcw size={18} />
              Reload Application
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 text-left bg-black/30 p-4 rounded-xl border border-white/5 overflow-x-auto">
                <p className="text-red-400 font-mono text-xs font-semibold mb-2">{this.state.error.toString()}</p>
                <p className="text-foreground/40 font-mono text-[10px] whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
