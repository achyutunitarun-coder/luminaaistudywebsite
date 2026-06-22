import React, { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: string | null }

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message + '\n\n' + (error.stack || '') };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ff6b6b', fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 14 }}>
          <h2>Chat Error</h2>
          {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
