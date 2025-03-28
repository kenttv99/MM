// frontend\src\components\Errors\ErrorBoundary.tsx
"use client"
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorPlaceholder from './ErrorPlaceholder';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <ErrorPlaceholder />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;