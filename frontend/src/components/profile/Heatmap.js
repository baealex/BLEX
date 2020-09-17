import ReactFrappeChart from 'react-frappe-charts';

export default function Heatmap(props) {
    return (
        <div className="heatmap">
            <ReactFrappeChart
                type='heatmap'
                title={`${Object.keys(props.data).length} activity in the last year`}
                data={{
                    end: new Date(),
                    dataPoints: props.data
                }}
                width={800}
                countLabel='Activity'
                discreteDomains={0}
            />
        </div>
    )
}