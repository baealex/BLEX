export default function ViewCounter(props) {
    return (
        <div className="shallow-dark text-center my-5 ns">
            Today : {props.today} / Yesterday : {props.yesterday} / Total : {props.total}
        </div>
    )
}