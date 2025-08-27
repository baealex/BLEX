import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface ChartDataset {
    name: string;
    values: number[];
    chartType: string;
}

interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

interface ChartProps<T extends ChartData, K> {
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

const Chart = <T extends ChartData, K>(props: ChartProps<T, K>) => {
    const chartData = {
        labels: props.data.labels,
        datasets: props.data.datasets.map((dataset, index) => ({
            label: dataset.name,
            data: dataset.values,
            borderColor: props.colors?.[index] || '#A076F1',
            backgroundColor: props.colors?.[index] ? `${props.colors[index]}15` : '#A076F115',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: props.lineOptions?.hideDots ? 0 : 5,
            pointHoverRadius: 8,
            pointBackgroundColor: props.colors?.[index] || '#A076F1',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 3,
            pointHoverBackgroundColor: props.colors?.[index] || '#A076F1',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3
        }))
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: props.colors?.[0] || '#A076F1',
                borderWidth: 2,
                cornerRadius: 12,
                displayColors: false,
                titleFont: {
                    size: 14,
                    weight: 600
                },
                bodyFont: {
                    size: 13,
                    weight: 500
                },
                padding: 12,
                callbacks: {
                    title: (tooltipItems: unknown[]) => {
                        const items = tooltipItems as { label?: string }[];
                        const label = items[0]?.label || '';
                        const date = new Date(label);
                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    },
                    label: (context: { parsed: { y: number } }) => {
                        return `조회수: ${context.parsed.y.toLocaleString()}회`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    color: '#6B7280',
                    font: { size: 12 },
                    maxTicksLimit: 8,
                    callback: (_: unknown, index: number) => {
                        const labels = props.data.labels;
                        const label = labels[index];
                        if (!label) return '';

                        // MM-DD 형식으로 표시
                        const date = new Date(label);
                        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: '#F3F4F6',
                    borderDash: [5, 5]
                },
                border: { display: false },
                ticks: {
                    color: '#6B7280',
                    font: { size: 12 },
                    stepSize: 1,
                    callback: (value: unknown) => {
                        return (value as number).toLocaleString();
                    }
                }
            }
        },
        elements: { point: { hoverBorderWidth: 3 } }
    };

    return (
        <div
            style={{
                height: props.height || 300,
                width: props.width || '100%'
            }}>
            <Line data={chartData} options={options} />
        </div>
    );
};

export default Chart;
