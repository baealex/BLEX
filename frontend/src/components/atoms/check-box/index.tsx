interface Props {
    label: string;
    onCheck: (value: boolean) => void;
    defaultChecked: boolean;
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
                className="form-check-input c-pointer"
                defaultChecked={props.defaultChecked}
            />
            {props.label && (
                <label className="form-check-label none-drag c-pointer" onClick={() => onClickCheckbox()}>
                    {props.label}
                </label>
            )}
        </div>
    );
}