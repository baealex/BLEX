interface Props {
    label: string;
    onClick: (value: boolean) => void;
    defaultChecked: boolean;
};

export default function CheckBox(props: Props) {
    let checkbox: HTMLInputElement;

    const onClickCheckbox = () => {
        checkbox?.click();
    };

    return (
        <div className="d-flex align-items-center form-group form-check">
            <input
                ref={(el) => checkbox = el as HTMLInputElement}
                onClick={(e: any) => props.onClick(e.target.checked)}
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