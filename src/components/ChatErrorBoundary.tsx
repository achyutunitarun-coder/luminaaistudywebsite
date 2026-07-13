import React, { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: string | null; showDetails: boolean }

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null, showDetails: false };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message + '\n\n' + (error.stack || '') };
  }
  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
              </div>
              <div>
                <div style={{ color: '#F87171', fontWeight: 600, fontSize: 15 }}>Something went wrong</div>
                <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>An error occurred while rendering this page</div>
              </div>
            </div>
            <button
              onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#A1A1AA', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              {this.state.showDetails ? '▾ Hide' : '▸ Show'} error details
            </button>
            {this.state.showDetails && (
              <pre style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, color: '#F87171', fontSize: 11, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => this.setState({ error: null, showDetails: false })}
                style={{ flex: 1, background: '#7C5CFC', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 16px', color: '#A1A1AA', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
