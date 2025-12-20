import React from 'react';

class ErrorBoundary extends React.Component<{
    fallback: React.ReactNode;
    children: React.ReactNode;
}, {
    hasError: boolean;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        console.error('Error in component:', error);
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
