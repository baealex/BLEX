declare module 'frappe-charts' {
    export interface ChartOptions {
        type?: string;
        data?: unknown;
        width?: number;
        height?: number;
        colors?: string[];
        countLabel?: string;
        title?: string;
        discreteDomains?: number;
        lineOptions?: {
            hideDots?: number;
        };
        axisOptions?: {
            xIsSeries?: number;
        };
        [key: string]: unknown;
    }

    export class Chart {
        constructor(element: HTMLElement | null, options: ChartOptions);
        destroy(): void;
    }
}
