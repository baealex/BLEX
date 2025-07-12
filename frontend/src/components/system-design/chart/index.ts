import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('./_chart'), { ssr: false });

export default Chart;
