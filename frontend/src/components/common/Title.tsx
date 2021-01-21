export default function Title(props: {
    text: string
}) {
    return (
        <div className="h4 noto font-weight-bold pt-5">— {props.text} —</div>
    )
}