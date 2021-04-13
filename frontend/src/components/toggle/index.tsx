interface Props {
    label: string;
    onClick: Function;
    defaultChecked?: boolean;
};

export default function Toggle(props: Props) {
    let checkbox: HTMLInputElement;

    const onClickCheckbox = () => {
        checkbox?.click();
    };

    return (
        <div className="custom-control custom-switch noto">
            <input
                ref={(el) => checkbox = el as HTMLInputElement}
                onClick={(e: any) => props.onClick(e.target.checked)}
                type="checkbox"
                className="custom-control-input"
                defaultChecked={props.defaultChecked}
            />
            <label className="custom-control-label" onClick={() => onClickCheckbox()}>
                {props.label}
            </label>
        </div>
    )
}