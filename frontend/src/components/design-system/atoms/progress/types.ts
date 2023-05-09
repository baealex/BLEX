export interface CommonProgressProps {
    color?: string;
    size?: string;
    className?: string;
}

export interface ProgressBarProps extends CommonProgressProps {
    type: 'bar';
    value: number;
    max?: number;
}

export interface ProgressTimerProps extends CommonProgressProps {
    type: 'timer';
    time: number;
    onEnd?: () => void;
    isReady?: boolean;
    isReversed?: boolean;
    repeat?: boolean;
}

export type ProgressProps = ProgressBarProps | ProgressTimerProps;
