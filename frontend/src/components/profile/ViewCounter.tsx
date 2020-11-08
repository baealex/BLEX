interface Props {
    today: number;
    yesterday: number;
    total: number;
}

export default function ViewCounter(props: Props) {
    return (
        <div className="shallow-dark text-center my-5 ns">
            Today : {props.today} / Yesterday : {props.yesterday} / Total : {props.total}
        </div>
    )
}