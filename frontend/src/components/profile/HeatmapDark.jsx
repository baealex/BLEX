import ReactFrappeChart from 'react-frappe-charts';

export default function HeatmapDark(props) {
    return (
        <div className="heatmap mt-5">
            <ReactFrappeChart
                type='heatmap'
                title={`${Object.keys(props.data).length} activity in the last year`}
                data={{
                    end: new Date(),
                    dataPoints: props.data
                }}
                colors={['#14120f', '#391b74', '#843690', '#dc65c4', '#e69ed8']}
                width={800}
                countLabel='Activity'
                discreteDomains={0}
            />
        </div>
    )
}