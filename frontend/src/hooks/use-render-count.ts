import { useRef } from 'react';

interface Props {
    consoleLog?: boolean;
    maxRenderCount?: number;
    onMaxRenderCount?: () => void;
}

export function useRenderCount(props: Props) {
    const count = useRef(0);
    count.current += 1;

    if (props.consoleLog) {
        console.log(`render count: ${count.current}`);
    }

    if (props.maxRenderCount) {
        if (count.current > props.maxRenderCount) {
            props.onMaxRenderCount && props.onMaxRenderCount();
        }
    }
}
