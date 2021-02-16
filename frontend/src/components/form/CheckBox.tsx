interface Props {
    label: string;
    onCheck: Function;
    checked: boolean;
};

export default function CheckBox(props: Props) {
    let checkbox: HTMLInputElement;

    const onClickCheckbox = () => {
        checkbox?.click();
    };

    return (
        <div className="form-group form-check">
            <input
                ref={(el) => checkbox = el as HTMLInputElement}
                onClick={(e: any) => props.onCheck(e.target.checked)}
                type="checkbox"
                className="form-check-input"
                defaultChecked={props.checked}
            />
            <label className="form-check-label" onClick={() => onClickCheckbox()}>
                {props.label}
            </label>
        </div>
    );
}