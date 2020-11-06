export default function Title(props: {
    text: string
}) {
    return (
        <div className="h4 serif font-weight-bold pt-5">— {props.text} —</div>
    )
}