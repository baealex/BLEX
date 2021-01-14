export interface Props {
    text: string;
}

export default function PurpleBorder(props: Props) {
    return (
        <div className="mt-3 bg-border-purple noto p-3 bg-light vivid-purple">
            {props.text}
        </div>
    )
}