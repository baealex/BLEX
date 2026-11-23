import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    fallback: ReactNode;
    children: ReactNode;
    onError?: () => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError(error: unknown) {
        console.error('Error in component:', error);
        return { hasError: true };
    }

    componentDidCatch() {
        this.props.onError?.();
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
