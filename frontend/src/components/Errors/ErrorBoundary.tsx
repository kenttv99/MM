// frontend\src\components\Errors\ErrorBoundary.tsx
"use client"
import React, { Component, ErrorInfo } from 'react';
import ErrorPlaceholder from './ErrorPlaceholder';
import { ErrorBoundaryProps, ErrorBoundaryState } from "@/types/index";


class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
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