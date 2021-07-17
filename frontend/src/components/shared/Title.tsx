export default function Title(props: {
    text: string
}) {
    return (
        <h1 className="h4 noto font-weight-bold pt-5">— {props.text} —</h1>
    )
}