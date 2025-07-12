import { useEffect, useRef } from 'react';
import { Chart } from 'frappe-charts';

interface ChartProps<T, K> {
    type: string;
    data: T;
    width?: number;
    height?: number;
    colors?: string[];
    countLabel?: string;
    title?: string;
    discreteDomains?: number;
    lineOptions?: {
        hideDots: number;
    };
    axisOptions?: {
        xIsSeries: number;
    };
    deps?: K[];
}

const ChartComponent = <T, K>(props: ChartProps<T, K>) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            const chart = new Chart(ref.current, { ...props });
            return () => {
                chart.destroy();
            };
        }
    }, [ref, ...props.deps || []]);

    return <div ref={ref} />;
};

export default ChartComponent;
